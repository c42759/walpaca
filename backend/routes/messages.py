from flask import Blueprint, request, jsonify
from models import (
    db,
    Chat,
    Message,
    Attachment,
    generate_uuid,
    current_alpaca_timestamp,
)

messages_bp = Blueprint("messages", __name__)


@messages_bp.route("/chats/<chat_id>/messages", methods=["GET"])
def get_chat_messages(chat_id):
    Chat.query.get_or_404(chat_id)
    messages = (
        Message.query.filter_by(chat_id=chat_id)
        .order_by(Message.date_time.asc())
        .all()
    )
    return jsonify([m.to_dict(include_attachments=True) for m in messages])


@messages_bp.route("/chats/<chat_id>/messages", methods=["POST"])
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


@messages_bp.route("/messages/<message_id>", methods=["PUT"])
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


@messages_bp.route("/messages/<message_id>", methods=["DELETE"])
def delete_message(message_id):
    msg = Message.query.get_or_404(message_id)
    db.session.delete(msg)
    db.session.commit()
    return jsonify({"success": True, "deleted": message_id})
