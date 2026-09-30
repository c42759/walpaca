import json
import os
import threading
import time
import urllib.error
import urllib.request
from flask import Blueprint, request, jsonify, Response, stream_with_context, current_app
from models import (
    db,
    Chat,
    Message,
    Attachment,
    ChatFolder,
    Instance,
    OnlineInstanceModelList,
    ModelPreferences,
    generate_uuid,
    current_alpaca_timestamp,
)

api_bp = Blueprint("api", __name__, url_prefix="/api")


# ----------------- CHAT FOLDERS -----------------
@api_bp.route("/folders", methods=["GET"])
def get_folders():
    parent_id = request.args.get("parent")
    query = ChatFolder.query
    if parent_id is not None:
        query = query.filter_by(parent=parent_id if parent_id != "" else None)
    folders = query.all()
    return jsonify([f.to_dict() for f in folders])


@api_bp.route("/folders", methods=["POST"])
def create_folder():
    data = request.json or {}
    folder = ChatFolder(
        id=data.get("id") or generate_uuid(),
        name=data.get("name", "New Folder"),
        color=data.get("color"),
        parent=data.get("parent"),
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify(folder.to_dict()), 201


@api_bp.route("/folders/<folder_id>", methods=["PUT"])
def update_folder(folder_id):
    folder = ChatFolder.query.get_or_404(folder_id)
    data = request.json or {}
    if "name" in data:
        folder.name = data["name"]
    if "color" in data:
        folder.color = data["color"]
    if "parent" in data:
        folder.parent = data["parent"]
    db.session.commit()
    return jsonify(folder.to_dict())


# ----------------- DELETION HELPERS -----------------
def _delete_chat_internal(chat):
    """Delete a chat and all its messages and attachments via cascade."""
    db.session.delete(chat)


def _delete_folder_internal(folder):
    """Delete a folder, its subfolders, and all contained chats and messages via cascade."""
    db.session.delete(folder)


@api_bp.route("/folders/<folder_id>", methods=["DELETE"])
def delete_folder(folder_id):
    folder = ChatFolder.query.get_or_404(folder_id)
    _delete_folder_internal(folder)
    db.session.commit()
    return jsonify({"success": True, "deleted": folder_id})


# ----------------- CHATS -----------------
@api_bp.route("/chats", methods=["GET"])
def get_chats():
    folder_id = request.args.get("folder")
    is_template = request.args.get("is_template")

    query = Chat.query
    if folder_id is not None:
        if folder_id.lower() in ("none", "null", ""):
            query = query.filter((Chat.folder == None) | (Chat.folder == "none") | (Chat.folder == ""))
        else:
            query = query.filter_by(folder=folder_id)
    if is_template is not None:
        query = query.filter_by(
            is_template=1 if is_template in ("1", "true", "True") else 0
        )

    chats = query.all()
    result = [c.to_dict(include_messages=False) for c in chats]
    result.sort(key=lambda x: x["latest_message_time"] or "", reverse=True)
    return jsonify(result)


@api_bp.route("/chats/<chat_id>", methods=["GET"])
def get_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    return jsonify(chat.to_dict(include_messages=True))


@api_bp.route("/chats", methods=["POST"])
def create_chat():
    data = request.json or {}
    chat = Chat(
        id=data.get("id") or generate_uuid(),
        name=data.get("name", "New Chat"),
        folder=data.get("folder"),
        is_template=1 if data.get("is_template") else 0,
    )
    db.session.add(chat)
    db.session.commit()
    return jsonify(chat.to_dict(include_messages=True)), 201


@api_bp.route("/chats/<chat_id>", methods=["PUT"])
def update_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    data = request.json or {}
    if "name" in data:
        chat.name = data["name"]
    if "folder" in data:
        chat.folder = data["folder"]
    if "is_template" in data:
        chat.is_template = 1 if data["is_template"] else 0
    db.session.commit()
    return jsonify(chat.to_dict(include_messages=False))


@api_bp.route("/chats/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    _delete_chat_internal(chat)
    db.session.commit()
    return jsonify({"success": True, "deleted": chat_id})


@api_bp.route("/chats/<chat_id>/duplicate", methods=["POST"])
def duplicate_chat(chat_id):
    original = Chat.query.get_or_404(chat_id)
    new_chat = Chat(
        id=generate_uuid(),
        name=f"{original.name} (Copy)",
        folder=original.folder,
        is_template=original.is_template,
    )
    db.session.add(new_chat)
    for msg in original.messages:
        new_msg = Message(
            id=generate_uuid(),
            chat_id=new_chat.id,
            role=msg.role,
            model=msg.model,
            date_time=msg.date_time,
            content=msg.content,
        )
        db.session.add(new_msg)
        for att in msg.attachments:
            new_att = Attachment(
                id=generate_uuid(),
                message_id=new_msg.id,
                type=att.type,
                name=att.name,
                content=att.content,
            )
            db.session.add(new_att)
    db.session.commit()
    return jsonify(new_chat.to_dict(include_messages=True)), 201


# ----------------- MESSAGES & ATTACHMENTS -----------------
@api_bp.route("/chats/<chat_id>/messages", methods=["GET"])
def get_chat_messages(chat_id):
    Chat.query.get_or_404(chat_id)
    messages = (
        Message.query.filter_by(chat_id=chat_id)
        .order_by(Message.date_time.asc())
        .all()
    )
    return jsonify([m.to_dict(include_attachments=True) for m in messages])


@api_bp.route("/chats/<chat_id>/messages", methods=["POST"])
def create_message(chat_id):
    Chat.query.get_or_404(chat_id)
    data = request.json or {}
    message = Message(
        id=data.get("id") or generate_uuid(),
        chat_id=chat_id,
        role=data.get("role", "user"),
        model=data.get("model"),
        content=data.get("content", ""),
        date_time=data.get("date_time") or current_alpaca_timestamp(),
    )
    db.session.add(message)
    for att_data in data.get("attachments", []):
        att = Attachment(
            id=att_data.get("id") or generate_uuid(),
            message_id=message.id,
            type=att_data.get("type", "thought"),
            name=att_data.get("name", "Thought"),
            content=att_data.get("content", ""),
        )
        db.session.add(att)
    db.session.commit()
    return jsonify(message.to_dict(include_attachments=True)), 201


@api_bp.route("/messages/<message_id>", methods=["PUT"])
def update_message(message_id):
    msg = Message.query.get_or_404(message_id)
    data = request.json or {}
    if "content" in data:
        msg.content = data["content"]
    if "model" in data:
        msg.model = data["model"]
    if "role" in data:
        msg.role = data["role"]
    db.session.commit()
    return jsonify(msg.to_dict(include_attachments=True))


@api_bp.route("/messages/<message_id>", methods=["DELETE"])
def delete_message(message_id):
    msg = Message.query.get_or_404(message_id)
    db.session.delete(msg)
    db.session.commit()
    return jsonify({"success": True, "deleted": message_id})


@api_bp.route("/messages/<message_id>/attachments", methods=["GET"])
def get_message_attachments(message_id):
    Message.query.get_or_404(message_id)
    attachments = Attachment.query.filter_by(message_id=message_id).all()
    return jsonify([a.to_dict() for a in attachments])


@api_bp.route("/messages/<message_id>/attachments", methods=["POST"])
def add_attachment(message_id):
    Message.query.get_or_404(message_id)
    data = request.json or {}
    att = Attachment(
        id=data.get("id") or generate_uuid(),
        message_id=message_id,
        type=data.get("type", "file"),
        name=data.get("name", "attachment"),
        content=data.get("content", ""),
    )
    db.session.add(att)
    db.session.commit()
    return jsonify(att.to_dict()), 201


@api_bp.route("/attachments/<attachment_id>", methods=["DELETE"])
def delete_attachment(attachment_id):
    att = Attachment.query.get_or_404(attachment_id)
    db.session.delete(att)
    db.session.commit()
    return jsonify({"success": True, "deleted": attachment_id})


# ----------------- INSTANCES & MODELS -----------------
@api_bp.route("/instances", methods=["GET"])
def get_instances():
    instances = Instance.query.all()
    return jsonify([i.to_dict() for i in instances])


@api_bp.route("/instances", methods=["POST", "PUT"])
def create_or_update_instance():
    data = request.json or {}
    instance_id = data.get("id") or generate_uuid()
    instance = Instance.query.get(instance_id)
    if not instance:
        instance = Instance(id=instance_id)
        db.session.add(instance)
    if "pinned" in data:
        instance.pinned = 1 if data["pinned"] else 0
    if "type" in data:
        instance.type = data["type"]
    if "properties" in data:
        instance.set_properties(data.get("properties", {}))
    db.session.commit()
    return jsonify(instance.to_dict()), 200


@api_bp.route("/instances/<instance_id>", methods=["PUT"])
def update_instance_by_id(instance_id):
    data = request.json or {}
    instance = Instance.query.get(instance_id)
    if not instance:
        instance = Instance(id=instance_id)
        db.session.add(instance)
    if "pinned" in data:
        instance.pinned = 1 if data["pinned"] else 0
    if "type" in data:
        instance.type = data["type"]
    if "properties" in data:
        props = instance.get_properties()
        props.update(data.get("properties", {}))
        instance.set_properties(props)
    db.session.commit()
    return jsonify(instance.to_dict()), 200


@api_bp.route("/instances/<instance_id>", methods=["DELETE"])
def delete_instance(instance_id):
    instance = Instance.query.get_or_404(instance_id)
    db.session.delete(instance)
    db.session.commit()
    return jsonify({"success": True, "deleted": instance_id})


def derive_model_capabilities(model_id, details=None):
    """Infer capability tags ('code', 'vision', 'reasoning') for a model."""
    details = details or {}
    caps = []
    name_lower = (model_id or "").lower()
    family = (details.get("family") or "").lower()
    families = [str(f).lower() for f in (details.get("families") or [])]

    # Code capability
    if (
        any(k in name_lower for k in ["code", "coder", "starcoder", "codellama", "wizardcoder", "deepseek-coder"])
        or any(k in family for k in ["code", "coder"])
        or any(any(k in f for k in ["code", "coder"]) for f in families)
    ):
        caps.append("code")

    # Vision capability
    if (
        any(k in name_lower for k in ["vision", "llava", "bakllava", "moondream", "minicpm-v", "clip", "vl", "pixtral", "omni"])
        or any(k in family for k in ["clip", "vision", "mllm"])
        or any(any(k in f for k in ["clip", "vision", "mllm"]) for f in families)
    ):
        caps.append("vision")

    # Reasoning capability
    if (
        any(k in name_lower for k in ["r1", "qwq", "think", "reasoning", "deepseek-r1", "o1", "o3"])
        or any(k in family for k in ["r1", "qwq", "reasoning"])
        or any(any(k in f for k in ["r1", "qwq", "reasoning"]) for f in families)
    ):
        caps.append("reasoning")

    return caps


def fetch_live_instance_models(instance):
    """Fetch live available models from target instance server."""
    if not instance:
        return []

    props = instance.get_properties()
    inst_type = (instance.type or "ollama").lower()
    host = props.get("url") or props.get("host") or props.get("endpoint") or ""
    api_key = props.get("apiKey") or props.get("api_key") or props.get("key") or ""

    models = []
    headers = {"User-Agent": "AlpacaWeb/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if inst_type == "ollama":
        if not host:
            host = "http://localhost:11434"
        host = host.rstrip("/")

        # Try Ollama native /api/tags first
        target_url = f"{host}/api/tags"
        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for m in data.get("models", []):
                    model_id = m.get("name") or m.get("model")
                    if model_id:
                        details = m.get("details") or {}
                        fam = details.get("family") or (details.get("families")[0] if details.get("families") else None)
                        tag_str = model_id.split(":")[-1] if ":" in model_id else model_id

                        models.append({
                            "id": model_id,
                            "name": model_id,
                            "provider": "Ollama",
                            "voice": "af_heart",
                            "context": "8,192 tokens",
                            "tag": tag_str,
                            "family": fam,
                            "parameter_size": details.get("parameter_size"),
                            "quantization_level": details.get("quantization_level"),
                            "modified_at": m.get("modified_at"),
                            "size": m.get("size"),
                            "capabilities": derive_model_capabilities(model_id, details),
                        })
                if models:
                    return models
        except Exception:
            pass

        # Fallback to /v1/models
        target_url = f"{host}/v1/models"
        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for m in data.get("data", []):
                    model_id = m.get("id")
                    if model_id:
                        details = m.get("details") or {}
                        models.append({
                            "id": model_id,
                            "name": m.get("name", model_id),
                            "provider": "Ollama",
                            "voice": "af_heart",
                            "context": "8,192 tokens",
                            "tag": model_id.split(":")[-1] if ":" in model_id else model_id,
                            "family": details.get("family"),
                            "parameter_size": details.get("parameter_size"),
                            "quantization_level": details.get("quantization_level"),
                            "modified_at": m.get("modified_at"),
                            "size": m.get("size"),
                            "capabilities": derive_model_capabilities(model_id, details),
                        })
                if models:
                    return models
        except Exception:
            pass

    else:
        # OpenAI, OpenRouter, vLLM, TGI, or custom OpenAI-compatible server
        if not host:
            if inst_type == "openrouter":
                host = "https://openrouter.ai/api/v1"
            elif inst_type == "openai":
                host = "https://api.openai.com/v1"
            else:
                host = "http://localhost:8000/v1"

        host = host.rstrip("/")
        if host.endswith("/models"):
            target_url = host
        elif host.endswith("/v1"):
            target_url = f"{host}/models"
        else:
            target_url = f"{host}/v1/models"

        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                model_items = data.get("data") or data.get("models") or []
                for m in model_items:
                    model_id = m.get("id") or m.get("name")
                    if model_id:
                        details = m.get("details") or {}
                        models.append({
                            "id": model_id,
                            "name": m.get("name", model_id),
                            "provider": instance.type.capitalize() if instance.type else "AI Provider",
                            "voice": "af_heart",
                            "context": "8,192 tokens",
                            "tag": model_id.split(":")[-1] if ":" in model_id else model_id,
                            "family": details.get("family") or instance.type.capitalize(),
                            "parameter_size": details.get("parameter_size"),
                            "quantization_level": details.get("quantization_level"),
                            "modified_at": m.get("modified_at"),
                            "size": m.get("size"),
                            "capabilities": derive_model_capabilities(model_id, details),
                        })
                if models:
                    return models
        except Exception:
            pass

    return models


@api_bp.route("/instances/<instance_id>/models", methods=["GET", "POST"])
def instance_models(instance_id):
    record = OnlineInstanceModelList.query.get(instance_id)
    if request.method == "GET":
        instance = Instance.query.get(instance_id)
        live_models = fetch_live_instance_models(instance) if instance else []

        if live_models:
            if not record:
                record = OnlineInstanceModelList(id=instance_id)
                db.session.add(record)
            record.set_list(live_models)
            db.session.commit()
            return jsonify(live_models)

        if not record:
            return jsonify([])
        return jsonify(record.get_list())
    else:
        data = request.json or {}
        model_list = data.get("list", [])
        if not record:
            record = OnlineInstanceModelList(id=instance_id)
            db.session.add(record)
        record.set_list(model_list)
        db.session.commit()
        return jsonify(record.to_dict())


# ----------------- MODEL PREFERENCES -----------------
@api_bp.route("/model-preferences", methods=["GET", "POST"])
def list_model_preferences():
    if request.method == "POST":
        data = request.json or {}
        model_id = data.get("id")
        if not model_id:
            return jsonify({"error": "Missing model id"}), 400
        pref = ModelPreferences.query.get(model_id)
        if not pref:
            pref = ModelPreferences(id=model_id)
            db.session.add(pref)
        if "picture" in data:
            pref.picture = data["picture"]
        if "voice" in data:
            pref.voice = data["voice"]
        if "num_ctx" in data:
            try:
                pref.num_ctx = int(data["num_ctx"]) if data["num_ctx"] is not None else None
            except (ValueError, TypeError):
                pass
        if "character" in data:
            pref.set_character(data["character"])
        db.session.commit()
        return jsonify(pref.to_dict())

    preferences = ModelPreferences.query.all()
    return jsonify([p.to_dict() for p in preferences])


@api_bp.route("/model-preferences/<path:model_id>", methods=["GET", "POST", "DELETE"])
def model_preferences(model_id):
    pref = ModelPreferences.query.get(model_id)
    if request.method == "GET":
        if not pref:
            return jsonify({
                "id": model_id,
                "picture": None,
                "voice": None,
                "num_ctx": None,
                "character": {},
            })
        return jsonify(pref.to_dict())
    elif request.method == "POST":
        data = request.json or {}
        if not pref:
            pref = ModelPreferences(id=model_id)
            db.session.add(pref)
        if "picture" in data:
            pref.picture = data["picture"]
        if "voice" in data:
            pref.voice = data["voice"]
        if "num_ctx" in data:
            try:
                pref.num_ctx = int(data["num_ctx"]) if data["num_ctx"] is not None else None
            except (ValueError, TypeError):
                pass
        if "character" in data:
            pref.set_character(data["character"])
        db.session.commit()
        return jsonify(pref.to_dict())
    elif request.method == "DELETE":
        if pref:
            db.session.delete(pref)
            db.session.commit()
        return jsonify({"success": True, "deleted": model_id})


# ----------------- GLOBAL SEARCH -----------------
@api_bp.route("/search", methods=["GET"])
def search():
    query_str = request.args.get("q", "").strip()
    if not query_str:
        return jsonify({"chats": [], "messages": []})

    matched_chats = Chat.query.filter(Chat.name.ilike(f"%{query_str}%")).all()
    matched_messages = (
        Message.query.filter(Message.content.ilike(f"%{query_str}%"))
        .limit(50)
        .all()
    )

    return jsonify({
        "chats": [c.to_dict(include_messages=False) for c in matched_chats],
        "messages": [
            m.to_dict(include_attachments=False) for m in matched_messages
        ],
    })


# ----------------- TEXT-TO-SPEECH (TTS) -----------------
@api_bp.route("/tts", methods=["GET", "POST", "OPTIONS"])
def text_to_speech():
    if request.method == "OPTIONS":
        resp = Response("", status=200)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    if request.method == "POST":
        data = request.get_json(silent=True) or request.form or {}
    else:
        data = request.args

    text = data.get("text") or data.get("input")
    if not text or not str(text).strip():
        return jsonify({"error": "Missing required parameter 'text' or 'input'"}), 400

    voice = data.get("voice") or "af_heart"
    model = data.get("model") or "kokoro"
    try:
        speed = float(data.get("speed", 1.0))
    except (ValueError, TypeError):
        speed = 1.0

    response_format = data.get("response_format") or "mp3"

    payload = {
        "model": model,
        "input": str(text).strip(),
        "voice": voice,
        "speed": speed,
        "response_format": response_format,
    }

    tts_server_url = os.getenv("TTS_SERVER_URL", "http://kokoro:8880").rstrip("/")
    tts_api_key = os.getenv("TTS_API_KEY")

    target_url = f"{tts_server_url}/v1/audio/speech"

    payload_bytes = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if tts_api_key:
        headers["Authorization"] = f"Bearer {tts_api_key}"

    req = urllib.request.Request(
        target_url, data=payload_bytes, headers=headers, method="POST"
    )

    try:
        resp = urllib.request.urlopen(req, timeout=60)
        content_type = (
            resp.headers.get("Content-Type") or f"audio/{response_format}"
        )

        def generate():
            while True:
                chunk = resp.read(4096)
                if not chunk:
                    break
                yield chunk

        res = Response(stream_with_context(generate()), content_type=content_type)
        res.headers["Access-Control-Allow-Origin"] = "*"
        return res

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        return jsonify({
            "error": "TTS server error",
            "status_code": e.code,
            "detail": detail,
        }), e.code
    except urllib.error.URLError as e:
        return jsonify({
            "error": "Failed to reach TTS server",
            "detail": str(e.reason),
        }), 502


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


def consume_upstream_to_completion(resp, app, message_id, initial_content, inst_type, initial_thinking=""):
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
                        for k in ["total_duration", "load_duration", "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration"]:
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


# ----------------- STREAMING GENERATION / LLM INFERENCE -----------------
@api_bp.route("/generate", methods=["POST"])
@api_bp.route("/chats/<chat_id>/generate", methods=["POST"])
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
            messages = [{"role": m.role, "content": m.content} for m in chat_msgs]

    message_id = None
    if chat_id:
        chat = Chat.query.get(chat_id)
        if chat:
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
            message_id = db_msg.id

    instance = Instance.query.get(instance_id) if instance_id else Instance.query.first()
    props = instance.get_properties() if instance else {}
    inst_type = (instance.type if instance else "ollama").lower()
    host = props.get("url") or props.get("host") or props.get("endpoint") or ""
    api_key = props.get("apiKey") or props.get("api_key") or props.get("key") or ""

    if not host:
        if inst_type == "ollama":
            host = "http://localhost:11434"
        elif inst_type == "openrouter":
            host = "https://openrouter.ai/api/v1"
        elif inst_type == "openai":
            host = "https://api.openai.com/v1"
        else:
            host = "http://localhost:8000/v1"

    host = host.rstrip("/")

    headers = {"Content-Type": "application/json", "User-Agent": "AlpacaWeb/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if not messages and prompt:
        messages_payload = [{"role": "user", "content": prompt}]
    elif messages:
        messages_payload = messages
    else:
        messages_payload = [{"role": "user", "content": "Hello"}]

    if system_prompt:
        messages_payload.insert(0, {"role": "system", "content": system_prompt})

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
                            content_delta = msg_chunk.get("content") or chunk_data.get("response", "")
                            thinking_delta = (
                                msg_chunk.get("thinking")
                                or chunk_data.get("thinking")
                                or msg_chunk.get("reasoning_content")
                                or chunk_data.get("reasoning_content")
                                or ""
                            )
                            is_done = chunk_data.get("done", False)

                            for k in ["total_duration", "load_duration", "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration"]:
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
                                        elapsed_ns = int((time.time() - start_time) * 1e9)
                                        stream_stats["total_duration"] = elapsed_ns
                                        stream_stats["eval_count"] = stream_stats.get("eval_count") or chunk_count
                                        stream_stats["eval_duration"] = stream_stats.get("eval_duration") or elapsed_ns
                                    metadata_table = build_metadata_markdown(stream_stats)
                                    try:
                                        msg = Message.query.get(message_id)
                                        if msg:
                                            msg.content = accumulated_content
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(message_id, accumulated_thinking)
                                        _upsert_metadata_attachment(message_id, metadata_table)
                                    except Exception:
                                        pass
                                elif now - last_db_update >= 2.0:
                                    try:
                                        msg = Message.query.get(message_id)
                                        if msg:
                                            msg.content = accumulated_content + " **processing**"
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(message_id, accumulated_thinking)
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
                                args=(resp, app, message_id, accumulated_content, inst_type, accumulated_thinking),
                                daemon=True,
                            ).start()
                            return
                        except Exception:
                            yield f"data: {line_str}\n\n"
                except GeneratorExit:
                    threading.Thread(
                        target=consume_upstream_to_completion,
                        args=(resp, app, message_id, accumulated_content, inst_type, accumulated_thinking),
                        daemon=True,
                    ).start()
                    return
            except Exception as e:
                err_payload = {"error": f"Failed streaming from Ollama instance: {str(e)}", "done": True}
                yield f"data: {json.dumps(err_payload)}\n\n"

        else:
            target_url = host if host.endswith("/chat/completions") else (
                f"{host}/chat/completions" if host.endswith("/v1") else f"{host}/v1/chat/completions"
            )
            payload = {
                "model": model,
                "messages": messages_payload,
                "stream": True,
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
                                            _upsert_thought_attachment(message_id, accumulated_thinking)
                                        _upsert_metadata_attachment(message_id, metadata_table)
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
                                            msg.content = accumulated_content + " **processing**"
                                            db.session.commit()
                                        if accumulated_thinking:
                                            _upsert_thought_attachment(message_id, accumulated_thinking)
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
                                    args=(resp, app, message_id, accumulated_content, inst_type, accumulated_thinking),
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
                        args=(resp, app, message_id, accumulated_content, inst_type, accumulated_thinking),
                        daemon=True,
                    ).start()
                    return
            except Exception as e:
                err_payload = {"error": f"Failed streaming from LLM instance: {str(e)}", "done": True}
                yield f"data: {json.dumps(err_payload)}\n\n"

    response = Response(stream_with_context(generate_stream()), mimetype="text/event-stream")
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

