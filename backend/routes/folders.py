from flask import request
from flask import jsonify
from flask import Blueprint

from models import db
from models import ChatFolder
from models import generate_uuid
from utils.storage import delete_chat_storage_dir

folders_bp = Blueprint("folders", __name__)


def _collect_folder_chat_ids(folder) -> list[str]:
    """Recursively gather chat IDs under folder and all nested subfolders."""
    chat_ids = []
    visited = set()
    stack = [folder]
    while stack:
        current = stack.pop()
        if not current or current.id in visited:
            continue
        visited.add(current.id)
        for chat in current.chats:
            chat_ids.append(chat.id)
        for sub in current.subfolders:
            stack.append(sub)
    return chat_ids


def _delete_chat_internal(chat):
    """Delete a chat, its storage directory, and all its messages/attachments via cascade."""
    delete_chat_storage_dir(chat.id)
    db.session.delete(chat)


def _delete_folder_internal(folder):
    """Delete a folder, its subfolders, contained chat storage dirs, and DB records."""
    for chat_id in _collect_folder_chat_ids(folder):
        delete_chat_storage_dir(chat_id)
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
