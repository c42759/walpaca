from flask import Blueprint, request, jsonify
from models import Chat, Message

search_bp = Blueprint("search", __name__)


@search_bp.route("/search", methods=["GET"])
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

    return jsonify(
        {
            "chats": [c.to_dict(include_messages=False) for c in matched_chats],
            "messages": [
                m.to_dict(include_attachments=False) for m in matched_messages
            ],
        }
    )
