from flask import Blueprint, request, jsonify
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


@api_bp.route("/folders/<folder_id>", methods=["DELETE"])
def delete_folder(folder_id):
    folder = ChatFolder.query.get_or_404(folder_id)
    db.session.delete(folder)
    db.session.commit()
    return jsonify({"success": True, "deleted": folder_id})


# ----------------- CHATS -----------------
@api_bp.route("/chats", methods=["GET"])
def get_chats():
    folder_id = request.args.get("folder")
    is_template = request.args.get("is_template")

    query = Chat.query
    if folder_id is not None:
        query = query.filter_by(folder=folder_id if folder_id != "" else None)
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
    db.session.delete(chat)
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


@api_bp.route("/instances", methods=["POST"])
def create_or_update_instance():
    data = request.json or {}
    instance_id = data.get("id") or generate_uuid()
    instance = Instance.query.get(instance_id)
    if not instance:
        instance = Instance(id=instance_id)
        db.session.add(instance)
    instance.pinned = 1 if data.get("pinned") else 0
    instance.type = data.get("type", "ollama")
    instance.set_properties(data.get("properties", {}))
    db.session.commit()
    return jsonify(instance.to_dict()), 200


@api_bp.route("/instances/<instance_id>", methods=["DELETE"])
def delete_instance(instance_id):
    instance = Instance.query.get_or_404(instance_id)
    db.session.delete(instance)
    db.session.commit()
    return jsonify({"success": True, "deleted": instance_id})


@api_bp.route("/instances/<instance_id>/models", methods=["GET", "POST"])
def instance_models(instance_id):
    record = OnlineInstanceModelList.query.get(instance_id)
    if request.method == "GET":
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
@api_bp.route("/model-preferences", methods=["GET"])
def list_model_preferences():
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
