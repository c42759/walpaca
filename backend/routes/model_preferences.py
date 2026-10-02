from models import db
from flask import request
from flask import jsonify
from flask import Blueprint
from models import ModelPreferences

model_preferences_bp = Blueprint("model_preferences", __name__)


@model_preferences_bp.route("/model-preferences", methods=["GET", "POST"])
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
                pref.num_ctx = (
                    int(data["num_ctx"]) if data["num_ctx"] is not None else None
                )
            except (ValueError, TypeError):
                pass
        if "character" in data:
            pref.set_character(data["character"])
        db.session.commit()
        return jsonify(pref.to_dict())

    preferences = ModelPreferences.query.all()
    return jsonify([p.to_dict() for p in preferences])


@model_preferences_bp.route(
    "/model-preferences/<path:model_id>", methods=["GET", "POST", "DELETE"]
)
def model_preferences(model_id):
    pref = ModelPreferences.query.get(model_id)
    if request.method == "GET":
        if not pref:
            return jsonify(
                {
                    "id": model_id,
                    "picture": None,
                    "voice": None,
                    "num_ctx": None,
                    "character": {},
                }
            )
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
                pref.num_ctx = (
                    int(data["num_ctx"]) if data["num_ctx"] is not None else None
                )
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
