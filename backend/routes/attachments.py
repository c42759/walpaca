import os

from flask import Blueprint, Response, jsonify, request, send_file

from models import Attachment, Message, db, generate_uuid
from utils.storage import (
    decode_media_payload,
    delete_storage_file,
    infer_attachment_mimetype,
    is_file_backed_attachment,
    resolve_storage_file,
    save_chat_attachment_file,
)

attachments_bp = Blueprint("attachments", __name__)


def _infer_upload_type(content_type: str | None, filename: str | None) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    ext = os.path.splitext(filename or "")[1].lower()
    if ct.startswith("image/") or ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}:
        return "image"
    if ct.startswith("audio/") or ext in {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}:
        return "audio"
    if ct.startswith("video/") or ext in {".mp4", ".webm", ".mov"}:
        return "video"
    return "file"


@attachments_bp.route("/messages/<message_id>/attachments", methods=["GET"])
def get_message_attachments(message_id):
    Message.query.get_or_404(message_id)
    attachments = Attachment.query.filter_by(message_id=message_id).all()
    return jsonify([a.to_dict() for a in attachments])


@attachments_bp.route("/messages/<message_id>/attachments", methods=["POST"])
def add_attachment(message_id):
    msg = Message.query.get_or_404(message_id)

    if "file" in request.files:
        uploaded = request.files["file"]
        raw_bytes = uploaded.read()
        att_id = request.form.get("id") or generate_uuid()
        att_name = request.form.get("name") or uploaded.filename or "attachment"
        att_type = request.form.get("type") or _infer_upload_type(
            uploaded.content_type, att_name
        )
        rel_path, _ = save_chat_attachment_file(
            msg.chat_id, att_id, att_type, att_name, raw_bytes
        )
        att = Attachment(
            id=att_id,
            message_id=message_id,
            type=att_type,
            name=att_name,
            content="",
            file_path=rel_path,
        )
    else:
        data = request.get_json(silent=True) or {}
        att_id = data.get("id") or generate_uuid()
        att_type = data.get("type", "file")
        att_name = data.get("name", "attachment")
        att_content = data.get("content", "")
        if is_file_backed_attachment(att_type, att_content):
            rel_path, _ = save_chat_attachment_file(
                msg.chat_id, att_id, att_type, att_name, att_content
            )
            att = Attachment(
                id=att_id,
                message_id=message_id,
                type=att_type,
                name=att_name,
                content="",
                file_path=rel_path,
            )
        else:
            att = Attachment(
                id=att_id,
                message_id=message_id,
                type=att_type,
                name=att_name,
                content=att_content if att_content is not None else "",
            )

    db.session.add(att)
    db.session.commit()
    return jsonify(att.to_dict()), 201


@attachments_bp.route("/attachments/<attachment_id>", methods=["GET"])
def get_attachment_content(attachment_id):
    att = Attachment.query.get_or_404(attachment_id)
    as_attachment = request.args.get("download") in ("1", "true", "True")
    download_name = os.path.basename(att.name or "") or att.id

    if att.file_path:
        abs_path = resolve_storage_file(att.file_path)
        if not abs_path:
            return jsonify({"error": "Attachment file not found"}), 404
        mimetype = infer_attachment_mimetype(att.name, att.file_path, att.type)
        return send_file(
            abs_path,
            mimetype=mimetype,
            as_attachment=as_attachment,
            download_name=download_name,
        )

    if isinstance(att.content, str) and att.content.strip().startswith("data:"):
        decoded = decode_media_payload(att.content)
        if decoded:
            raw, _ext, mime = decoded
            headers = (
                {"Content-Disposition": f'attachment; filename="{download_name}"'}
                if as_attachment
                else {}
            )
            return Response(raw, mimetype=mime, headers=headers)

    mime = "application/json" if att.type == "tool" else "text/plain; charset=utf-8"
    headers = (
        {"Content-Disposition": f'attachment; filename="{download_name}"'}
        if as_attachment
        else {}
    )
    return Response(att.content or "", mimetype=mime, headers=headers)


@attachments_bp.route("/attachments/<attachment_id>", methods=["DELETE"])
def delete_attachment(attachment_id):
    att = Attachment.query.get_or_404(attachment_id)
    if att.file_path:
        delete_storage_file(att.file_path)
    db.session.delete(att)
    db.session.commit()
    return jsonify({"success": True, "deleted": attachment_id})
