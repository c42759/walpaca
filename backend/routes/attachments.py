from flask import Blueprint, request, jsonify
from models import db, Message, Attachment, generate_uuid

attachments_bp = Blueprint("attachments", __name__)


@attachments_bp.route("/messages/<message_id>/attachments", methods=["GET"])
def get_message_attachments(message_id):
    Message.query.get_or_404(message_id)
    attachments = Attachment.query.filter_by(message_id=message_id).all()
    return jsonify([a.to_dict() for a in attachments])


@attachments_bp.route("/messages/<message_id>/attachments", methods=["POST"])
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


@attachments_bp.route("/attachments/<attachment_id>", methods=["DELETE"])
def delete_attachment(attachment_id):
    att = Attachment.query.get_or_404(attachment_id)
    db.session.delete(att)
    db.session.commit()
    return jsonify({"success": True, "deleted": attachment_id})
