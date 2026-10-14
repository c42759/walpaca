import json
import time
import threading
import ollama

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
from models import InstanceModel
from models import ModelPreferences
from models import generate_uuid
from models import current_alpaca_timestamp
from utils.mcp_manager import McpManager

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


def _add_tool_attachment(message_id, tool_name, tool_data):
    """Save an Attachment of type 'tool' for a message containing execution details."""
    if not message_id or not tool_data:
        return
    try:
        content_str = json.dumps(tool_data) if not isinstance(tool_data, str) else tool_data
        att = Attachment(
            id=generate_uuid(),
            message_id=message_id,
            type="tool",
            name=f"Tool: {tool_name}",
            content=content_str,
        )
        db.session.add(att)
        db.session.commit()
    except Exception:
        pass


def _persist_message_update(
    message_id: str,
    content: str,
    thinking: str = "",
    metadata_table: str = None,
    is_processing: bool = False,
):
    """Updates Message content, thought attachment, and metadata table in the database."""
    if not message_id:
        return
    try:
        msg = Message.query.get(message_id)
        if msg:
            msg.content = (content + " **processing**") if is_processing else content
            db.session.commit()
        if thinking:
            _upsert_thought_attachment(message_id, thinking)
        if metadata_table:
            _upsert_metadata_attachment(message_id, metadata_table)
    except Exception:
        pass


def format_duration(ns):
    """Format nanoseconds into human-readable duration (MM:SS or X seconds)."""
    if not isinstance(ns, (int, float)) or ns <= 0:
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
    if (
        not isinstance(count, (int, float))
        or not isinstance(duration_ns, (int, float))
        or duration_ns <= 0
    ):
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


def consume_upstream_to_completion(
    resp, app, message_id, initial_content, inst_type="ollama", initial_thinking=""
):
    """
    Continues consuming tokens from upstream Ollama response stream when client disconnects,
    persisting response content, thinking attachment & metadata attachment to database.
    """
    if isinstance(inst_type, str) and inst_type not in ("ollama", "openai", "gemini", ""):
        initial_thinking = inst_type

    with app.app_context():
        start_time = time.time()
        full_text = initial_content
        full_thinking = initial_thinking
        last_db_update = time.time()
        stats = {}
        token_count = 0

        try:
            for item in resp:
                if item is None:
                    continue

                token = ""
                thinking_token = ""

                msg_chunk = getattr(item, "message", None) or (
                    item.get("message", {}) if isinstance(item, dict) else None
                )
                if msg_chunk is not None:
                    token = (
                        getattr(msg_chunk, "content", None)
                        or (msg_chunk.get("content") if isinstance(msg_chunk, dict) else "")
                        or ""
                    )
                    thinking_token = (
                        getattr(msg_chunk, "thinking", None)
                        or (msg_chunk.get("thinking") if isinstance(msg_chunk, dict) else "")
                        or getattr(msg_chunk, "reasoning_content", None)
                        or (msg_chunk.get("reasoning_content") if isinstance(msg_chunk, dict) else "")
                        or ""
                    )
                else:
                    token = getattr(item, "response", "") or (item.get("response", "") if isinstance(item, dict) else "")
                    thinking_token = getattr(item, "thinking", "") or (item.get("thinking", "") if isinstance(item, dict) else "")

                for k in [
                    "total_duration",
                    "load_duration",
                    "prompt_eval_count",
                    "prompt_eval_duration",
                    "eval_count",
                    "eval_duration",
                ]:
                    val = getattr(item, k, None) or (item.get(k) if isinstance(item, dict) else None)
                    if isinstance(val, (int, float)):
                        stats[k] = val

                if token:
                    full_text += token
                    token_count += 1
                if thinking_token:
                    full_thinking += thinking_token

                now = time.time()
                if message_id and (now - last_db_update >= 2.0):
                    _persist_message_update(
                        message_id,
                        full_text,
                        full_thinking,
                        is_processing=True,
                    )
                    last_db_update = now

            if not stats.get("total_duration"):
                elapsed_ns = int((time.time() - start_time) * 1e9)
                stats["total_duration"] = elapsed_ns
                stats["eval_count"] = stats.get("eval_count") or token_count
                stats["eval_duration"] = stats.get("eval_duration") or elapsed_ns

            metadata_table = build_metadata_markdown(stats)

            if message_id:
                _persist_message_update(
                    message_id,
                    full_text,
                    full_thinking,
                    metadata_table=metadata_table,
                    is_processing=False,
                )
        except Exception as e:
            print(f"[Ollama Background Worker] Error completing response: {e}")



def resolve_model_preference(model: str, instance_id: str = None):
    """
    Locates matching ModelPreferences entry given model identifier (UUID, InstanceModel ID,
    or physical model name) and optional instance_id.
    """
    if not model:
        return None

    # 1. Direct PK lookup on ModelPreferences
    pref = db.session.get(ModelPreferences, model)
    if pref:
        return pref

    # 2. Filtered by instance_id if available
    if instance_id:
        pref = ModelPreferences.query.filter_by(instance_id=instance_id, model_id=model).first()
        if pref:
            return pref

        ims = InstanceModel.query.filter_by(instance_id=instance_id, model_id=model).all()
        for im in ims:
            pref = ModelPreferences.query.filter_by(instance_id=instance_id, model_id=im.id).first()
            if pref:
                return pref

        im = InstanceModel.query.filter_by(instance_id=instance_id, id=model).first()
        if im:
            pref = ModelPreferences.query.filter_by(instance_id=instance_id, model_id=im.id).first()
            if pref:
                return pref

    # 3. Fallback without instance_id restriction
    pref = ModelPreferences.query.filter_by(model_id=model).first()
    if pref:
        return pref

    ims = InstanceModel.query.filter_by(model_id=model).all()
    for im in ims:
        pref = ModelPreferences.query.filter_by(model_id=im.id).first()
        if pref:
            return pref

    im = db.session.get(InstanceModel, model)
    if im:
        pref = ModelPreferences.query.filter_by(model_id=im.id).first()
        if pref:
            return pref

    return None


def evaluate_lorebook_entries(
    model_id: str,
    messages: list = None,
    base_system_prompt: str = None,
    scan_depth: int = 5,
    instance_id: str = None,
    pref=None,
) -> str:
    """
    Evaluates model preferences for character definitions and character book / lorebook entries.
    Scans recent conversation messages for entry keywords and combines triggered lore and persona
    prompts into a final system prompt string.
    """
    if not pref and model_id:
        pref = resolve_model_preference(model_id, instance_id)

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
    """Extract a raw base64 string from content or Data URL."""
    if not content:
        return ""

    if "," in content and content.startswith("data:"):
        return content.split(",", 1)[1]

    return content.strip()


def _format_message_attachments(content: str, attachments: list) -> tuple:
    """Extracts base64 images and markdown document blocks from attachments."""
    images = []
    doc_blocks = []

    for a in attachments:
        a_type = a.get("type") if isinstance(a, dict) else getattr(a, "type", "")
        a_content = a.get("content") if isinstance(a, dict) else getattr(a, "content", "")
        a_name = a.get("name", "document") if isinstance(a, dict) else getattr(a, "name", "document")

        if (
            a_type in ("image", "png", "jpg", "jpeg", "webp")
            or (isinstance(a_content, str) and a_content.startswith("data:image"))
        ):
            clean_b64 = clean_base64_image(a_content)
            if clean_b64:
                images.append(clean_b64)
        elif (
            a_type not in ("thought", "metadata")
            and not (isinstance(a_content, str) and a_content.startswith("data:image"))
        ):
            if a_content:
                doc_blocks.append(f"```{a_name} ({a_type})\n{a_content}\n```")

    final_content = content or ""
    if doc_blocks:
        final_content = (final_content + "\n\n" + "\n\n".join(doc_blocks)).strip()

    return final_content, images


def _build_messages_payload(data: dict, chat_id: str = None) -> list:
    """Constructs normalized message payload with multimodal images and document attachments."""
    prompt = data.get("prompt")
    messages = data.get("messages")

    if chat_id and not messages and not prompt:
        chat = Chat.query.get(chat_id)
        if chat:
            chat_msgs = (
                Message.query.filter_by(chat_id=chat_id)
                .order_by(Message.date_time.asc())
                .all()
            )
            built = []
            for m in chat_msgs:
                c, imgs = _format_message_attachments(m.content, m.attachments)
                msg_obj = {"role": m.role, "content": c}
                if imgs:
                    msg_obj["images"] = imgs
                built.append(msg_obj)
            return built

    if not messages and prompt:
        user_msg = {"role": "user", "content": prompt}
        if data.get("images"):
            imgs = [clean_base64_image(img) for img in data.get("images") if clean_base64_image(img)]
            if imgs:
                user_msg["images"] = imgs
        return [user_msg]

    if messages:
        built = []
        for m in messages:
            m_copy = dict(m)
            raw_atts = m_copy.get("attachments", [])
            content, att_imgs = _format_message_attachments(m_copy.get("content", ""), raw_atts)
            m_copy["content"] = content

            existing_imgs = [clean_base64_image(img) for img in m_copy.get("images", []) if clean_base64_image(img)]
            all_imgs = existing_imgs + [img for img in att_imgs if img not in existing_imgs]
            if all_imgs:
                m_copy["images"] = all_imgs
            elif "images" in m_copy:
                del m_copy["images"]

            built.append(m_copy)
        return built

    return [{"role": "user", "content": "Hello"}]


def _resolve_request_model(data: dict, chat_id: str = None) -> str:
    """Resolve model identifier from request, chat history, global assistant history, or default."""
    model = data.get("model")
    if model:
        return model

    if chat_id:
        latest_msg = (
            Message.query.filter_by(chat_id=chat_id, role="assistant")
            .filter(Message.model.isnot(None))
            .order_by(Message.date_time.desc())
            .first()
        )
        if latest_msg and latest_msg.model:
            return latest_msg.model

    latest_global = (
        Message.query.filter_by(role="assistant")
        .filter(Message.model.isnot(None))
        .order_by(Message.date_time.desc())
        .first()
    )
    if latest_global and latest_global.model:
        return latest_global.model

    return "llama3"


def _resolve_ollama_instance(data: dict):
    """
    Resolves the target Ollama Instance record, host endpoint, and headers.
    Defaults host to http://localhost:11434.
    """
    instance_id = data.get("instance_id")
    instance = (
        Instance.query.get(instance_id)
        if instance_id
        else (Instance.query.filter_by(is_enabled=1).first() or Instance.query.first())
    )
    props = instance.get_properties() if instance else {}
    host = props.get("url") or props.get("host") or props.get("endpoint") or "http://localhost:11434"
    host = host.rstrip("/")

    api_key = (
        props.get("apiKey")
        or props.get("api_key")
        or props.get("key")
        or props.get("api")
        or ""
    )
    if api_key == "NOKEY":
        api_key = ""

    headers = {"Content-Type": "application/json", "User-Agent": "Walpaca/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    return instance, props, host, headers


def _resolve_physical_model_name(model: str, instance_id: str):
    """
    Resolves model identifier to upstream Ollama physical model name and ModelPreferences match.
    """
    pref_match = resolve_model_preference(model, instance_id)
    resolved_model_name = model

    if pref_match:
        if pref_match.model_ref and pref_match.model_ref.model_id:
            resolved_model_name = pref_match.model_ref.model_id
        elif pref_match.model_id:
            im = db.session.get(InstanceModel, pref_match.model_id)
            resolved_model_name = im.model_id if im and im.model_id else pref_match.model_id
    else:
        im_match = db.session.get(InstanceModel, model)
        if not im_match and instance_id:
            im_match = InstanceModel.query.filter_by(instance_id=instance_id, model_id=model).first()
        if im_match and im_match.model_id:
            resolved_model_name = im_match.model_id

    return resolved_model_name, pref_match


def _resolve_num_ctx(data: dict, pref_match, props: dict):
    """Resolves context window size from request data, ModelPreferences, or instance properties."""
    raw_num_ctx = (
        data.get("num_ctx")
        or (pref_match.num_ctx if pref_match else None)
        or props.get("num_ctx")
        or props.get("numCtx")
        or props.get("context_size")
        or props.get("context")
    )
    if raw_num_ctx is not None:
        try:
            return int(raw_num_ctx)
        except (ValueError, TypeError):
            pass
    return None


def _create_processing_message(chat_id: str, model: str) -> str:
    """Inserts initial assistant placeholder message record and returns its ID."""
    if not chat_id:
        return None
    chat = Chat.query.get(chat_id)
    if not chat:
        return None
    db_msg = Message(
        id=generate_uuid(),
        chat_id=chat_id,
        role="assistant",
        model=model,
        content=" **LLM still processing.**",
        date_time=current_alpaca_timestamp(),
    )
    db.session.add(db_msg)
    db.session.commit()
    return db_msg.id


def _handle_ollama_tool_call(tc, tool_map: dict, message_id: str):
    """
    Executes a single Ollama tool call via McpManager, stores tool attachment,
    and returns (call_event_dict, result_event_dict, asst_tc_dict, tool_msg_dict).
    """
    fn = getattr(tc, "function", None) or (tc.get("function") if isinstance(tc, dict) else {})
    t_name = getattr(fn, "name", None) or (fn.get("name") if isinstance(fn, dict) else "")
    t_args = getattr(fn, "arguments", None) or (fn.get("arguments") if isinstance(fn, dict) else {})
    if isinstance(t_args, str):
        try:
            t_args = json.loads(t_args)
        except Exception:
            pass

    call_event = {
        "id": message_id,
        "type": "tool_call",
        "name": t_name,
        "args": t_args,
        "done": False,
    }

    if t_name in tool_map:
        srv, _ = tool_map[t_name]
        try:
            t_result = McpManager.call_tool(srv.id, t_name, t_args)
        except Exception as e:
            t_result = {"error": str(e)}
    else:
        t_result = {"error": f"Tool '{t_name}' not available"}

    result_event = {
        "id": message_id,
        "type": "tool_result",
        "name": t_name,
        "result": t_result,
        "done": False,
    }

    if message_id:
        _add_tool_attachment(
            message_id,
            t_name,
            {"call": {"name": t_name, "arguments": t_args}, "result": t_result},
        )

    asst_tc = tc if isinstance(tc, dict) else {"function": {"name": t_name, "arguments": t_args}}
    tool_msg = {
        "role": "tool",
        "content": json.dumps(t_result) if not isinstance(t_result, str) else t_result,
        "name": t_name,
        "tool_name": t_name,
    }

    return call_event, result_event, asst_tc, tool_msg


@generate_bp.route("/generate", methods=["POST"])
@generate_bp.route("/chats/<chat_id>/generate", methods=["POST"])
def generate_response(chat_id=None):
    """
    Triggers an LLM response from the target Ollama instance and streams tokens directly to the API caller.
    Persists updates to database incrementally and completes generation in background if client disconnects.
    """
    app = current_app._get_current_object()
    data = request.json or {}

    model = _resolve_request_model(data, chat_id)
    instance, props, host, headers = _resolve_ollama_instance(data)
    instance_id = instance.id if instance else None

    resolved_model_name, pref_match = _resolve_physical_model_name(model, instance_id)
    message_id = _create_processing_message(chat_id, model)
    messages_payload = _build_messages_payload(data, chat_id)

    effective_system = evaluate_lorebook_entries(
        model,
        messages_payload,
        data.get("system"),
        instance_id=instance_id,
        pref=pref_match,
    )
    if effective_system:
        messages_payload.insert(0, {"role": "system", "content": effective_system})

    think = data.get("think")
    if think is None:
        think = data.get("thinking", False)

    num_ctx_val = _resolve_num_ctx(data, pref_match, props)

    active_mcp_tuples = (
        McpManager.get_enabled_tools()
        if data.get("mcp_enabled", True)
        else []
    )
    tool_map = {tool.name: (server, tool) for server, tool in active_mcp_tuples}
    ollama_tools = McpManager.to_ollama_tools(active_mcp_tuples) if active_mcp_tuples else None

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
        max_tool_turns = 5
        tool_turns = 0

        try:
            client_kwargs = {"host": host}
            if headers:
                client_kwargs["headers"] = headers
            client = ollama.Client(**client_kwargs)

            chat_kwargs = {
                "model": resolved_model_name,
                "messages": messages_payload,
                "stream": True,
            }
            if options:
                chat_kwargs["options"] = options
            if think is not None:
                chat_kwargs["think"] = bool(think)
            if ollama_tools:
                chat_kwargs["tools"] = ollama_tools

            while True:
                stream = client.chat(**chat_kwargs)
                has_tool_call = False

                try:
                    for chunk in stream:
                        msg_chunk = getattr(chunk, "message", None) or (
                            chunk.get("message", {}) if isinstance(chunk, dict) else {}
                        )

                        raw_tool_calls = getattr(msg_chunk, "tool_calls", None) or (
                            msg_chunk.get("tool_calls") if isinstance(msg_chunk, dict) else None
                        )
                        if raw_tool_calls and tool_turns < max_tool_turns:
                            has_tool_call = True
                            tool_turns += 1

                            assistant_tool_calls = []
                            tool_results = []

                            for tc in raw_tool_calls:
                                call_event, result_event, asst_tc, tool_msg = _handle_ollama_tool_call(
                                    tc, tool_map, message_id
                                )
                                yield f"data: {json.dumps(call_event, ensure_ascii=False)}\n\n"
                                yield f"data: {json.dumps(result_event, ensure_ascii=False)}\n\n"
                                assistant_tool_calls.append(asst_tc)
                                tool_results.append(tool_msg)

                            messages_payload.append({
                                "role": "assistant",
                                "content": (
                                    getattr(msg_chunk, "content", None)
                                    or (msg_chunk.get("content") if isinstance(msg_chunk, dict) else "")
                                    or ""
                                ),
                                "tool_calls": assistant_tool_calls,
                            })
                            for tm in tool_results:
                                messages_payload.append(tm)

                            chat_kwargs["messages"] = messages_payload
                            if tool_turns >= max_tool_turns:
                                chat_kwargs.pop("tools", None)

                            # Break inner stream loop to re-issue client.chat() with tool results
                            break

                        raw_content = (
                            getattr(msg_chunk, "content", None)
                            or (msg_chunk.get("content") if isinstance(msg_chunk, dict) else "")
                            or getattr(chunk, "response", "")
                            or (chunk.get("response", "") if isinstance(chunk, dict) else "")
                            or ""
                        )
                        content_delta = raw_content if isinstance(raw_content, str) else ""

                        raw_thinking = (
                            getattr(msg_chunk, "thinking", None)
                            or (msg_chunk.get("thinking") if isinstance(msg_chunk, dict) else "")
                            or getattr(msg_chunk, "reasoning_content", None)
                            or (msg_chunk.get("reasoning_content") if isinstance(msg_chunk, dict) else "")
                            or getattr(chunk, "thinking", None)
                            or (chunk.get("thinking") if isinstance(chunk, dict) else "")
                            or getattr(chunk, "reasoning_content", None)
                            or (chunk.get("reasoning_content") if isinstance(chunk, dict) else "")
                            or ""
                        )
                        thinking_delta = raw_thinking if isinstance(raw_thinking, str) else ""

                        is_done = bool(getattr(chunk, "done", False))

                        for k in [
                            "total_duration",
                            "load_duration",
                            "prompt_eval_count",
                            "prompt_eval_duration",
                            "eval_count",
                            "eval_duration",
                        ]:
                            val = getattr(chunk, k, None) or (
                                chunk.get(k) if isinstance(chunk, dict) else None
                            )
                            if isinstance(val, (int, float)):
                                stream_stats[k] = val

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
                                    elapsed_ns = int((time.time() - start_time) * 1e9)
                                    stream_stats["total_duration"] = elapsed_ns
                                    stream_stats["eval_count"] = (
                                        stream_stats.get("eval_count") or chunk_count
                                    )
                                    stream_stats["eval_duration"] = (
                                        stream_stats.get("eval_duration") or elapsed_ns
                                    )
                                metadata_table = build_metadata_markdown(stream_stats)
                                _persist_message_update(
                                    message_id,
                                    accumulated_content,
                                    accumulated_thinking,
                                    metadata_table=metadata_table,
                                    is_processing=False,
                                )
                            elif now - last_db_update >= 2.0:
                                _persist_message_update(
                                    message_id,
                                    accumulated_content,
                                    accumulated_thinking,
                                    is_processing=True,
                                )
                                last_db_update = now

                        out_payload = {
                            "id": message_id,
                            "model": model,
                            "content": content_delta,
                            "thinking": thinking_delta,
                            "metadata": metadata_table,
                            "done": is_done,
                        }
                        yield f"data: {json.dumps(out_payload, ensure_ascii=False)}\n\n"

                    if has_tool_call:
                        continue

                    return

                except GeneratorExit:
                    threading.Thread(
                        target=consume_upstream_to_completion,
                        args=(
                            stream,
                            app,
                            message_id,
                            accumulated_content,
                            "ollama",
                            accumulated_thinking,
                        ),
                        daemon=True,
                    ).start()
                    return
        except Exception as e:
            err_msg = str(e)
            if hasattr(e, "error"):
                err_msg = str(getattr(e, "error"))
            err_payload = {
                "error": f"Failed streaming from Ollama instance: {err_msg}",
                "done": True,
            }
            yield f"data: {json.dumps(err_payload, ensure_ascii=False)}\n\n"

    response = Response(
        stream_with_context(generate_stream()), mimetype="text/event-stream"
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"

    return response

