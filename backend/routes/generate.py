import json
import time
import threading
import urllib.error
import urllib.request

from flask import Blueprint
from flask import request
from flask import Response
from flask import stream_with_context
from flask import current_app
from models import db
from models import Chat
from models import Message
from models import Attachment
from models import Instance
from models import ModelPreferences
from models import generate_uuid
from models import current_alpaca_timestamp

generate_bp = Blueprint("generate", __name__)


def _upsert_thought_attachment(message_id, thinking_content):
    """Upsert an Attachment of type 'thought' for a message."""
    if not message_id or not thinking_content:
        return
    try:
        att = Attachment.query.filter_by(message_id=message_id, type="thought").first()
        if att:
            att.content = thinking_content
        else:
            att = Attachment(
                id=generate_uuid(),
                message_id=message_id,
                type="thought",
                name="Thought",
                content=thinking_content,
            )
            db.session.add(att)
        db.session.commit()
    except Exception:
        pass


def format_duration(ns):
    """Format nanoseconds into human-readable duration (MM:SS or X seconds)."""
    if not ns or ns <= 0:
        return "0 seconds"
    s = ns / 1e9
    if s >= 60:
        mins = int(s // 60)
        secs = int(round(s % 60))
        if secs == 60:
            mins += 1
            secs = 0
        return f"{mins}:{secs:02d}"
    else:
        sec_val = int(round(s))
        if sec_val == 0 and s > 0:
            return f"{s:.2f} seconds"
        return f"{sec_val} seconds"


def format_rate(count, duration_ns):
    """Format token evaluation rate (tokens/s)."""
    if not count or not duration_ns or duration_ns <= 0:
        return "0.00 tokens/s"
    rate = count / (duration_ns / 1e9)
    return f"{rate:.2f} tokens/s"


def build_metadata_markdown(stats):
    """Generate Markdown metadata table from LLM stats."""
    tot_dur = format_duration(stats.get("total_duration", 0))
    load_dur = format_duration(stats.get("load_duration", 0))
    prompt_count = stats.get("prompt_eval_count", 0)
    prompt_dur = format_duration(stats.get("prompt_eval_duration", 0))
    prompt_rate = format_rate(prompt_count, stats.get("prompt_eval_duration", 0))
    eval_count = stats.get("eval_count", 0)
    eval_dur = format_duration(stats.get("eval_duration", 0))
    eval_rate = format_rate(eval_count, stats.get("eval_duration", 0))

    return (
        "| Metric | Value |\n"
        "| ---- | ---- |\n"
        f"| Total Duration | {tot_dur} |\n"
        f"| Load Duration | {load_dur} |\n"
        f"| Prompt Eval Count | {prompt_count} tokens |\n"
        f"| Prompt Eval Duration | {prompt_dur} |\n"
        f"| Prompt Eval Rate | {prompt_rate} |\n"
        f"| Eval Count | {eval_count} tokens |\n"
        f"| Eval Duration | {eval_dur} |\n"
        f"| Eval Rate | {eval_rate} |"
    )


def _upsert_metadata_attachment(message_id, metadata_table):
    """Upsert an Attachment of type 'metadata' for a message."""
    if not message_id or not metadata_table:
        return
    try:
        att = Attachment.query.filter_by(message_id=message_id, type="metadata").first()
        if att:
            att.content = metadata_table
        else:
            att = Attachment(
                id=generate_uuid(),
                message_id=message_id,
                type="metadata",
                name="Metadata",
                content=metadata_table,
            )
            db.session.add(att)
        db.session.commit()
    except Exception:
        pass


def consume_upstream_to_completion(
    resp, app, message_id, initial_content, inst_type, initial_thinking=""
):
    """
    Continues consuming tokens from the upstream LLM HTTP response stream when the client disconnects,
    persisting response content, thinking attachment & metadata attachment to database.
    """
    with app.app_context():
        start_time = time.time()
        full_text = initial_content
        full_thinking = initial_thinking
        last_db_update = time.time()
        stats = {}
        token_count = 0
        try:
            for line in resp:
                if not line:
                    continue
                line_str = line.decode("utf-8").strip()
                if not line_str:
                    continue

                token = ""
                thinking_token = ""
                if inst_type == "ollama":
                    try:
                        chunk_data = json.loads(line_str)
                        msg_chunk = chunk_data.get("message", {})
                        token = msg_chunk.get("content") or chunk_data.get("response", "")
                        thinking_token = (
                            msg_chunk.get("thinking")
                            or chunk_data.get("thinking")
                            or msg_chunk.get("reasoning_content")
                            or chunk_data.get("reasoning_content")
                            or ""
                        )
                        for k in [
                            "total_duration",
                            "load_duration",
                            "prompt_eval_count",
                            "prompt_eval_duration",
                            "eval_count",
                            "eval_duration",
                        ]:
                            if k in chunk_data:
                                stats[k] = chunk_data[k]
                    except Exception:
                        pass
                else:
                    if line_str.startswith("data: "):
                        raw_data = line_str[6:].strip()
                        if raw_data == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(raw_data)
                            choices = chunk_data.get("choices") or []
                            delta = choices[0].get("delta", {}) if choices else {}
                            token = delta.get("content", "")
                            thinking_token = (
                                delta.get("thinking")
                                or delta.get("reasoning_content")
                                or ""
                            )
                        except Exception:
                            pass

                if token:
                    full_text += token
                    token_count += 1
                if thinking_token:
                    full_thinking += thinking_token

                now = time.time()
                if message_id and (now - last_db_update >= 2.0):
                    try:
                        msg = Message.query.get(message_id)
                        if msg:
                            msg.content = full_text + " **processing**"
                            db.session.commit()
                        if full_thinking:
                            _upsert_thought_attachment(message_id, full_thinking)
                        last_db_update = now
                    except Exception:
                        pass

            if not stats.get("total_duration"):
                elapsed_ns = int((time.time() - start_time) * 1e9)
                stats["total_duration"] = elapsed_ns
                stats["eval_count"] = stats.get("eval_count") or token_count
                stats["eval_duration"] = stats.get("eval_duration") or elapsed_ns

            metadata_table = build_metadata_markdown(stats)

            if message_id:
                msg = Message.query.get(message_id)
                if msg:
                    msg.content = full_text
                    db.session.commit()
                if full_thinking:
                    _upsert_thought_attachment(message_id, full_thinking)
                _upsert_metadata_attachment(message_id, metadata_table)
        except Exception as e:
            print(f"[LLM Background Worker] Error completing response: {e}")


def evaluate_lorebook_entries(
    model_id: str,
    messages: list = None,
    base_system_prompt: str = None,
    scan_depth: int = 5,
) -> str:
    """
    Evaluates model preferences for character definitions and character book / lorebook entries.
    Scans recent conversation messages for entry keywords and combines triggered lore and persona
    prompts into a final system prompt string.
    """
    pref = ModelPreferences.query.get(model_id) if model_id else None

    if not pref:
        return base_system_prompt or ""

    char_dict = pref.get_character()
    char_data = (
        char_dict.get("data")
        if isinstance(char_dict.get("data"), dict)
        else char_dict
    )

    if not char_data or not isinstance(char_data, dict):
        return base_system_prompt or ""

    system_sections = []

    # 1. Base system prompt provided in request
    if base_system_prompt and base_system_prompt.strip():
        system_sections.append(base_system_prompt.strip())

    # 2. Character system prompt or persona definition if present
    char_name = char_data.get("name")
    char_system = (
        char_data.get("system_prompt")
        or char_data.get("personality")
        or char_data.get("description")
        or char_data.get("first_mes")
    )

    if char_system and isinstance(char_system, str) and char_system.strip():
        char_sys_clean = char_system.strip()
        # Avoid duplicating if already present in base_system_prompt
        if not base_system_prompt or char_sys_clean not in base_system_prompt:
            header = (
                f"Character Persona ({char_name}):"
                if char_name
                else "Character Persona:"
            )
            system_sections.append(f"{header}\n{char_sys_clean}")

    # 3. Lorebook processing
    lorebook = char_data.get("character_book")
    entries = []

    if isinstance(lorebook, dict) and isinstance(lorebook.get("entries"), list):
        entries = lorebook["entries"]
    elif isinstance(lorebook, list):
        entries = lorebook

    if entries:
        recent_text = ""
        if messages and isinstance(messages, list):
            recent_msgs = messages[-scan_depth:]
            msg_texts = []

            for m in recent_msgs:
                if isinstance(m, dict) and m.get("content"):
                    msg_texts.append(str(m.get("content")))

            recent_text = " ".join(msg_texts).lower()

        matched_entries = []

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            # Skip disabled entries
            if entry.get("enabled", True) is False:
                continue

            content = entry.get("content") or entry.get("description")

            if not content or not str(content).strip():
                continue

            entry_name = (
                entry.get("name")
                or entry.get("comment")
                or entry.get("title")
                or "Lore"
            )
            is_constant = bool(
                entry.get("constant") or entry.get("always_active") or False
            )

            raw_keys = (
                entry.get("keys") or entry.get("tags") or entry.get("keywords") or []
            )

            if isinstance(raw_keys, str):
                raw_keys = [
                    k.strip().lower() for k in raw_keys.split(",") if k.strip()
                ]

            key_matched = False

            if is_constant:
                key_matched = True
            elif recent_text and isinstance(raw_keys, list):
                for k in raw_keys:
                    if isinstance(k, str) and k.strip():
                        if k in recent_text:
                            key_matched = True
                            break

            if key_matched:
                matched_entries.append(f"[{entry_name}: {str(content).strip()}]")

        if matched_entries:
            lore_block = "World Information & Lore:\n" + "\n".join(matched_entries)
            system_sections.append(lore_block)

    # 4. Post-history instructions if present
    post_instructions = char_data.get("post_history_instructions")

    if (
        post_instructions
        and isinstance(post_instructions, str)
        and post_instructions.strip()
    ):
        system_sections.append(post_instructions.strip())

    return "\n\n".join(system_sections)


def clean_base64_image(content: str) -> str:
    """Extract raw base64 string from content or Data URL."""
    if not content:
        return ""
    if "," in content and content.startswith("data:"):
        return content.split(",", 1)[1]
    return content.strip()


@generate_bp.route("/generate", methods=["POST"])
@generate_bp.route("/chats/<chat_id>/generate", methods=["POST"])
def generate_response(chat_id=None):
    """
    Triggers an LLM response from the target instance model and streams tokens directly to the API caller.
    Persists updates to database incrementally and completes generation in background if client disconnects.
    """
    app = current_app._get_current_object()
    data = request.json or {}
    instance_id = data.get("instance_id")
    model = data.get("model") or "llama3"
    prompt = data.get("prompt")
    messages = data.get("messages")
    system_prompt = data.get("system")
    think = data.get("think")
    if think is None:
        think = data.get("thinking", False)

    if chat_id and not messages and not prompt:
        chat = Chat.query.get(chat_id)
        if chat:
            chat_msgs = (
                Message.query.filter_by(chat_id=chat_id)
                .order_by(Message.date_time.asc())
                .all()
            )
            messages = []
            for m in chat_msgs:
                msg_obj = {"role": m.role, "content": m.content}
                img_atts = [
                    a
                    for a in m.attachments
                    if a.type in ("image", "png", "jpg", "jpeg", "webp")
                    or (a.content and a.content.startswith("data:image"))
                ]
                if img_atts:
                    raw_imgs = [
                        clean_base64_image(a.content)
                        for a in img_atts
                        if clean_base64_image(a.content)
                    ]
                    if raw_imgs:
                        msg_obj["images"] = raw_imgs
                doc_atts = [
                    a
                    for a in m.attachments
                    if a.type
                    not in ("thought", "metadata", "image", "png", "jpg", "jpeg", "webp")
                    and not (a.content and a.content.startswith("data:image"))
                ]
                if doc_atts:
                    doc_blocks = []
                    for da in doc_atts:
                        doc_blocks.append(
                            f"```{da.name} ({da.type})\n{da.content}\n```"
                        )
                    if doc_blocks:
                        msg_obj["content"] = (
                            msg_obj.get("content", "")
                            + "\n\n"
                            + "\n\n".join(doc_blocks)
                        ).strip()
                messages.append(msg_obj)

    message_id = None
    if chat_id:
        chat = Chat.query.get(chat_id)
        if chat:
            db_msg = Message(id=generate_uuid(),
                             chat_id=chat_id,
                             role="assistant",
                             model=model,
                             content=" **LLM still processing.**",
                             date_time=current_alpaca_timestamp())
            db.session.add(db_msg)
            db.session.commit()
            message_id = db_msg.id

    instance = Instance.query.get(instance_id) if instance_id else Instance.query.first()
    props = instance.get_properties() if instance else {}
    inst_type = (instance.type if instance else "ollama").lower()
    host = props.get("url") or props.get("host") or props.get("endpoint") or ""

    api_key = (
        props.get("apiKey")
        or props.get("api_key")
        or props.get("key")
        or props.get("api")
        or ""
    )

    if api_key == "NOKEY":
        api_key = ""

    if not host:
        if inst_type == "ollama":
            host = "http://localhost:11434"
        elif inst_type == "openrouter":
            host = "https://openrouter.ai/api/v1"
        elif inst_type == "openai":
            host = "https://api.openai.com/v1"
        elif inst_type == "gemini":
            host = "https://generativelanguage.googleapis.com/v1beta/openai"
        elif inst_type == "groq":
            host = "https://api.groq.com/openai/v1"
        elif inst_type == "together":
            host = "https://api.together.xyz/v1"
        elif inst_type == "deepseek":
            host = "https://api.deepseek.com"
        else:
            host = "http://localhost:8000/v1"

    host = host.rstrip("/")

    # Normalize Google Gemini host
    if inst_type == "gemini" or "generativelanguage.googleapis.com" in host:
        if not host.endswith("/openai"):
            if host.endswith("/v1beta"):
                host = f"{host}/openai"
            elif "v1beta" not in host:
                host = "https://generativelanguage.googleapis.com/v1beta/openai"

    # Normalize dummy model IDs for Gemini
    if (inst_type == "gemini" or "generativelanguage.googleapis.com" in host) and (
        "-m1" in model or "-m2" in model or not model
    ):
        model = "gemini-3.8-flash"

    headers = {"Content-Type": "application/json", "User-Agent": "Walpaca/1.0"}

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if not messages and prompt:
        user_msg = {"role": "user", "content": prompt}

        if data.get("images"):
            user_msg["images"] = [
                clean_base64_image(img)
                for img in data.get("images")
                if clean_base64_image(img)
            ]

        messages_payload = [user_msg]

    elif messages:
        messages_payload = []

        for m in messages:
            m_copy = dict(m)
            atts = m_copy.get("attachments", [])

            if atts:
                img_atts = [
                    a
                    for a in atts
                    if isinstance(a, dict)
                    and (
                        a.get("type") in ("image", "png", "jpg", "jpeg", "webp")
                        or (
                            isinstance(a.get("content"), str)
                            and a.get("content").startswith("data:image")
                        )
                    )
                ]

                if img_atts and not m_copy.get("images"):
                    m_copy["images"] = [
                        clean_base64_image(a.get("content", ""))
                        for a in img_atts
                        if clean_base64_image(a.get("content", ""))
                    ]

                doc_atts = [
                    a
                    for a in atts
                    if isinstance(a, dict)
                    and a.get("type")
                    not in ("thought", "metadata", "image", "png", "jpg", "jpeg", "webp")
                    and not (
                        isinstance(a.get("content"), str)
                        and a.get("content").startswith("data:image")
                    )
                ]
                if doc_atts:
                    doc_blocks = []

                    for da in doc_atts:
                        name = da.get("name", "document")
                        att_type = da.get("type", "plain_text")
                        content = da.get("content", "")

                        if content:
                            doc_blocks.append(
                                f"```{name} ({att_type})\n{content}\n```"
                            )

                    if doc_blocks:
                        m_copy["content"] = (
                            m_copy.get("content", "")
                            + "\n\n"
                            + "\n\n".join(doc_blocks)
                        ).strip()

            if "images" in m_copy:
                m_copy["images"] = [
                    clean_base64_image(img)
                    for img in m_copy["images"]
                    if clean_base64_image(img)
                ]

            messages_payload.append(m_copy)

    else:
        messages_payload = [{"role": "user", "content": "Hello"}]

    if inst_type != "ollama":
        while messages_payload and messages_payload[-1].get("role") != "user":
            messages_payload.pop()
        if not messages_payload:
            messages_payload = [{"role": "user", "content": prompt or "Hello"}]

        formatted_messages = []
        for m in messages_payload:
            m_copy = dict(m)
            imgs = m_copy.pop("images", None)
            if imgs:
                content_text = m_copy.get("content", "")
                content_blocks = (
                    [{"type": "text", "text": content_text}]
                    if isinstance(content_text, str)
                    else list(content_text)
                )
                for img_b64 in imgs:
                    url = (
                        img_b64
                        if img_b64.startswith("http") or img_b64.startswith("data:")
                        else f"data:image/png;base64,{img_b64}"
                    )
                    content_blocks.append(
                        {"type": "image_url", "image_url": {"url": url}}
                    )
                m_copy["content"] = content_blocks
            formatted_messages.append(m_copy)
        messages_payload = formatted_messages

    effective_system = evaluate_lorebook_entries(
        model, messages_payload, system_prompt
    )

    if effective_system:
        messages_payload.insert(0, {"role": "system", "content": effective_system})

    raw_num_ctx = (
        data.get("num_ctx")
        or props.get("num_ctx")
        or props.get("numCtx")
        or props.get("context_size")
        or props.get("context")
    )

    num_ctx_val = None

    if raw_num_ctx is not None:
        try:
            num_ctx_val = int(raw_num_ctx)
        except (ValueError, TypeError):
            pass

    def generate_stream():
        options = {"think": bool(think)}

        if num_ctx_val is not None:
            options["num_ctx"] = num_ctx_val

        start_time = time.time()
        accumulated_content = ""
        accumulated_thinking = ""
        chunk_count = 0
        last_db_update = time.time()
        stream_stats = {}

        if inst_type == "ollama":
            target_url = f"{host}/api/chat"
            payload = {
                "model": model,
                "messages": messages_payload,
                "stream": True,
                "think": bool(think),
            }

            if options:
                payload["options"] = options

            req = urllib.request.Request(
                target_url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )

            try:
                resp = urllib.request.urlopen(req, timeout=120)
                try:
                    for line in resp:
                        if not line:
                            continue
                        try:
                            line_str = line.decode("utf-8").strip()
                            if not line_str:
                                continue
                            chunk_data = json.loads(line_str)
                            msg_chunk = chunk_data.get("message", {})
                            content_delta = msg_chunk.get("content") or chunk_data.get(
                                "response", ""
                            )
                            thinking_delta = (
                                msg_chunk.get("thinking")
                                or chunk_data.get("thinking")
                                or msg_chunk.get("reasoning_content")
                                or chunk_data.get("reasoning_content")
                                or ""
                            )
                            is_done = chunk_data.get("done", False)

                            for k in [
                                "total_duration",
                                "load_duration",
                                "prompt_eval_count",
                                "prompt_eval_duration",
                                "eval_count",
                                "eval_duration",
                            ]:
                                if k in chunk_data:
                                    stream_stats[k] = chunk_data[k]

                            if content_delta:
                                accumulated_content += content_delta
                                chunk_count += 1
                            if thinking_delta:
                                accumulated_thinking += thinking_delta

                            metadata_table = None
                            now = time.time()
                            if message_id:
                                if is_done:
                                    if not stream_stats.get("total_duration"):
                                        elapsed_ns = int(
                                            (time.time() - start_time) * 1e9
                                        )
                                        stream_stats["total_duration"] = elapsed_ns
                                        stream_stats["eval_count"] = (
                                            stream_stats.get("eval_count")
                                            or chunk_count
                                        )
                                        stream_stats["eval_duration"] = (
                                            stream_stats.get("eval_duration")
                                            or elapsed_ns
                                        )
                                    metadata_table = build_metadata_markdown(
                                        stream_stats
                                    )
                                    try:
                                        msg = Message.query.get(message_id)
                                        if msg:
                                            msg.content = accumulated_content
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(
                                                message_id, accumulated_thinking
                                            )
                                        _upsert_metadata_attachment(
                                            message_id, metadata_table
                                        )
                                    except Exception:
                                        pass
                                elif now - last_db_update >= 2.0:
                                    try:
                                        msg = Message.query.get(message_id)
                                        if msg:
                                            msg.content = (
                                                accumulated_content + " **processing**"
                                            )
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(
                                                message_id, accumulated_thinking
                                            )
                                        last_db_update = now
                                    except Exception:
                                        pass

                            out_payload = {
                                "id": message_id,
                                "model": model,
                                "content": content_delta,
                                "thinking": thinking_delta,
                                "metadata": metadata_table,
                                "done": is_done,
                            }
                            yield f"data: {json.dumps(out_payload)}\n\n"
                        except GeneratorExit:
                            threading.Thread(
                                target=consume_upstream_to_completion,
                                args=(
                                    resp,
                                    app,
                                    message_id,
                                    accumulated_content,
                                    inst_type,
                                    accumulated_thinking,
                                ),
                                daemon=True,
                            ).start()
                            return
                        except Exception:
                            yield f"data: {line_str}\n\n"
                except GeneratorExit:
                    threading.Thread(
                        target=consume_upstream_to_completion,
                        args=(
                            resp,
                            app,
                            message_id,
                            accumulated_content,
                            inst_type,
                            accumulated_thinking,
                        ),
                        daemon=True,
                    ).start()
                    return
            except Exception as e:
                err_payload = {
                    "error": f"Failed streaming from Ollama instance: {str(e)}",
                    "done": True,
                }
                yield f"data: {json.dumps(err_payload)}\n\n"

        else:
            target_url = (
                host
                if host.endswith("/chat/completions")
                else (
                    f"{host}/chat/completions"
                    if host.endswith("/v1") or host.endswith("/openai")
                    else f"{host}/v1/chat/completions"
                )
            )
            payload = {
                "model": model,
                "messages": messages_payload,
                "stream": True,
            }
            # Only send valid top-level OpenAI/Gemini parameters, NOT options dictionary
            temp = (
                data.get("temperature")
                if data.get("temperature") is not None
                else props.get("temperature")
            )
            if temp is not None:
                try:
                    payload["temperature"] = float(temp)
                except (ValueError, TypeError):
                    pass
            max_tok = (
                data.get("max_tokens")
                or props.get("max_tokens")
                or data.get("num_predict")
            )
            if max_tok is not None:
                try:
                    payload["max_tokens"] = int(max_tok)
                except (ValueError, TypeError):
                    pass

            req = urllib.request.Request(
                target_url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                resp = urllib.request.urlopen(req, timeout=120)
                try:
                    for line in resp:
                        if not line:
                            continue
                        line_str = line.decode("utf-8").strip()
                        if not line_str:
                            continue
                        if line_str.startswith("data: "):
                            raw_data = line_str[6:].strip()
                            if raw_data == "[DONE]":
                                elapsed_ns = int((time.time() - start_time) * 1e9)
                                stream_stats["total_duration"] = elapsed_ns
                                stream_stats["eval_count"] = chunk_count
                                stream_stats["eval_duration"] = elapsed_ns
                                metadata_table = build_metadata_markdown(stream_stats)
                                if message_id:
                                    try:
                                        msg = Message.query.get(message_id)
                                        if msg:
                                            msg.content = accumulated_content
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(
                                                message_id, accumulated_thinking
                                            )
                                        _upsert_metadata_attachment(
                                            message_id, metadata_table
                                        )
                                    except Exception:
                                        pass
                                yield f"data: {json.dumps({'id': message_id, 'model': model, 'content': '', 'metadata': metadata_table, 'done': True})}\n\n"
                                break
                            try:
                                chunk_data = json.loads(raw_data)
                                choices = chunk_data.get("choices") or []
                                delta = choices[0].get("delta", {}) if choices else {}
                                content_delta = delta.get("content", "")
                                thinking_delta = (
                                    delta.get("thinking")
                                    or delta.get("reasoning_content")
                                    or ""
                                )
                                if content_delta:
                                    accumulated_content += content_delta
                                    chunk_count += 1
                                if thinking_delta:
                                    accumulated_thinking += thinking_delta

                                now = time.time()
                                if message_id and (now - last_db_update >= 2.0):
                                    try:
                                        msg = Message.query.get(message_id)
                                        if msg:
                                            msg.content = (
                                                accumulated_content + " **processing**"
                                            )
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(
                                                message_id, accumulated_thinking
                                            )
                                        last_db_update = now
                                    except Exception:
                                        pass

                                out_payload = {
                                    "id": message_id,
                                    "model": model,
                                    "content": content_delta,
                                    "thinking": thinking_delta,
                                    "done": False,
                                }
                                yield f"data: {json.dumps(out_payload)}\n\n"
                            except GeneratorExit:
                                threading.Thread(
                                    target=consume_upstream_to_completion,
                                    args=(
                                        resp,
                                        app,
                                        message_id,
                                        accumulated_content,
                                        inst_type,
                                        accumulated_thinking,
                                    ),
                                    daemon=True,
                                ).start()
                                return
                            except Exception:
                                yield f"{line_str}\n\n"
                        else:
                            yield f"data: {line_str}\n\n"
                except GeneratorExit:
                    threading.Thread(
                        target=consume_upstream_to_completion,
                        args=(
                            resp,
                            app,
                            message_id,
                            accumulated_content,
                            inst_type,
                            accumulated_thinking,
                        ),
                        daemon=True,
                    ).start()
                    return
            except urllib.error.HTTPError as e:
                err_detail = ""
                try:
                    err_body = e.read().decode("utf-8", errors="replace")
                    err_json = json.loads(err_body)
                    if isinstance(err_json, dict) and "error" in err_json:
                        sub_err = err_json["error"]
                        if isinstance(sub_err, dict):
                            err_detail = sub_err.get("message") or str(sub_err)
                        else:
                            err_detail = str(sub_err)
                    else:
                        err_detail = err_body[:300]
                except Exception:
                    err_detail = str(e)

                msg_text = f"Upstream API error ({e.code}): {err_detail}"
                if message_id:
                    try:
                        m_record = Message.query.get(message_id)
                        if m_record and (
                            not m_record.content
                            or m_record.content.strip() == "**LLM still processing.**"
                        ):
                            m_record.content = msg_text
                            db.session.commit()
                    except Exception:
                        pass
                err_payload = {
                    "error": msg_text,
                    "done": True,
                }
                yield f"data: {json.dumps(err_payload)}\n\n"
            except Exception as e:
                msg_text = f"Failed streaming from LLM instance: {str(e)}"
                if message_id:
                    try:
                        m_record = Message.query.get(message_id)
                        if m_record and (
                            not m_record.content
                            or m_record.content.strip() == "**LLM still processing.**"
                        ):
                            m_record.content = msg_text
                            db.session.commit()
                    except Exception:
                        pass
                err_payload = {
                    "error": msg_text,
                    "done": True,
                }
                yield f"data: {json.dumps(err_payload)}\n\n"

    response = Response(
        stream_with_context(generate_stream()), mimetype="text/event-stream"
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response
