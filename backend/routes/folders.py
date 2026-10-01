from flask import Blueprint, request, jsonify
from models import db, ChatFolder, generate_uuid

folders_bp = Blueprint("folders", __name__)


def _delete_chat_internal(chat):
    """Delete a chat and all its messages and attachments via cascade."""
    db.session.delete(chat)


def _delete_folder_internal(folder):
    """Delete a folder, its subfolders, and all contained chats and messages via cascade."""
    db.session.delete(folder)


@folders_bp.route("/folders", methods=["GET"])
def get_folders():
    parent_id = request.args.get("parent")
    query = ChatFolder.query
    if parent_id is not None:
        query = query.filter_by(parent=parent_id if parent_id != "" else None)
    folders = query.all()
    return jsonify([f.to_dict() for f in folders])


@folders_bp.route("/folders", methods=["POST"])
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


@folders_bp.route("/folders/<folder_id>", methods=["PUT"])
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


@folders_bp.route("/folders/<folder_id>", methods=["DELETE"])
def delete_folder(folder_id):
    folder = ChatFolder.query.get_or_404(folder_id)
    _delete_folder_internal(folder)
    db.session.commit()
    return jsonify({"success": True, "deleted": folder_id})
