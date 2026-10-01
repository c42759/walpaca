from flask import Blueprint, request, jsonify
from models import (
    db,
    Chat,
    Message,
    Attachment,
    generate_uuid,
    current_alpaca_timestamp,
)
from routes.folders import _delete_chat_internal

chats_bp = Blueprint("chats", __name__)


@chats_bp.route("/chats", methods=["GET"])
def get_chats():
    folder_id = request.args.get("folder")
    is_template = request.args.get("is_template")

    query = Chat.query
    if folder_id is not None:
        if folder_id.lower() in ("none", "null", ""):
            query = query.filter(
                (Chat.folder is None) | (Chat.folder == "none") | (Chat.folder == "")
            )
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


@chats_bp.route("/chats/<chat_id>", methods=["GET"])
def get_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    return jsonify(chat.to_dict(include_messages=True))


@chats_bp.route("/chats", methods=["POST"])
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


@chats_bp.route("/chats/<chat_id>", methods=["PUT"])
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


@chats_bp.route("/chats/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    _delete_chat_internal(chat)
    db.session.commit()
    return jsonify({"success": True, "deleted": chat_id})


@chats_bp.route("/chats/<chat_id>/duplicate", methods=["POST"])
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


@chats_bp.route("/chats/<chat_id>/fork", methods=["POST"])
def fork_chat(chat_id):
    data = request.json or {}
    message_id = data.get("message_id")
    if not message_id:
        return jsonify({"error": "message_id is required to fork chat"}), 400

    original = Chat.query.get_or_404(chat_id)
    new_chat = Chat(
        id=generate_uuid(),
        name=f"{original.name} (Fork)",
        folder=original.folder,
        is_template=original.is_template,
    )
    db.session.add(new_chat)

    messages = (
        Message.query.filter_by(chat_id=chat_id)
        .order_by(Message.date_time.asc())
        .all()
    )

    for msg in messages:
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

        if msg.id == message_id:
            break

    db.session.commit()
    return jsonify(new_chat.to_dict(include_messages=True)), 201


@chats_bp.route("/chats/import", methods=["POST"])
def import_chats():
    data = request.json or {}
    chats_input = (
        data.get("chats")
        if isinstance(data, dict) and "chats" in data
        else ([data] if isinstance(data, dict) else data)
    )

    if not isinstance(chats_input, list):
        return (
            jsonify({"error": "Invalid payload format, expected array or chat object"}),
            400,
        )

    imported_chats = []
    for c_data in chats_input:
        if not isinstance(c_data, dict):
            continue
        chat_id = c_data.get("id") or generate_uuid()
        chat_name = c_data.get("name") or c_data.get("title") or "Imported Chat"
        chat = Chat(
            id=chat_id,
            name=chat_name,
            folder=c_data.get("folder"),
            is_template=1 if c_data.get("is_template") else 0,
        )
        db.session.add(chat)

        for msg_data in c_data.get("messages", []):
            if not isinstance(msg_data, dict):
                continue
            msg_id = msg_data.get("id") or generate_uuid()
            role = msg_data.get("role") or (
                "user" if msg_data.get("isSelf") else "assistant"
            )
            message = Message(
                id=msg_id,
                chat_id=chat_id,
                role=role,
                model=msg_data.get("model"),
                content=msg_data.get("content", ""),
                date_time=msg_data.get("date_time")
                or msg_data.get("time")
                or current_alpaca_timestamp(),
            )
            db.session.add(message)

            for att_data in msg_data.get("attachments", []):
                if not isinstance(att_data, dict):
                    continue
                att = Attachment(
                    id=att_data.get("id") or generate_uuid(),
                    message_id=msg_id,
                    type=att_data.get("type", "thought"),
                    name=att_data.get("name"),
                    content=att_data.get("content"),
                )
                db.session.add(att)

        imported_chats.append(chat)

    db.session.commit()
    return jsonify([c.to_dict(include_messages=True) for c in imported_chats]), 201
