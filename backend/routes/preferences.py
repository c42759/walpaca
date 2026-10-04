from models import db
from models import Preference
from flask import Blueprint
from flask import request
from flask import jsonify

preferences_bp = Blueprint("preferences", __name__)

DEFAULT_PREFERENCES = {
    "auto_play_voice": False,
    "desktop_notifications": True,
    "play_sound_notification": True,
    "auto_scroll": True,
    "default_audio_output": "default",
}


def load_preferences() -> dict:
    prefs = DEFAULT_PREFERENCES.copy()

    rows = Preference.query.all()
    
    for row in rows:
        if row.key != "active_instance_id":
            prefs[row.key] = row.get_value()
    
    return prefs


def save_preferences(data: dict) -> dict:
    if isinstance(data, dict):
        for k, v in data.items():
            if k == "active_instance_id":
                continue
            
            pref = Preference.query.get(k)
            
            if not pref:
                pref = Preference(key=k)
                db.session.add(pref)
            
            pref.set_value(v)
        db.session.commit()
    return load_preferences()


@preferences_bp.route("/preferences", methods=["GET", "POST", "PUT"])
def handle_preferences():
    if request.method in ["POST", "PUT"]:
        data = request.json or {}
        saved = save_preferences(data)
        return jsonify(saved)

    return jsonify(load_preferences())


@preferences_bp.route("/preferences/<key>", methods=["GET", "PUT", "DELETE"])
def handle_preference_key(key):
    pref = Preference.query.get(key)
    
    if request.method == "GET":
        val = pref.get_value() if pref else DEFAULT_PREFERENCES.get(key)
    
        return jsonify({"key": key, "value": val})
    
    elif request.method == "PUT":
        data = request.json or {}
        val = data.get("value")
    
        if not pref:
            pref = Preference(key=key)
            db.session.add(pref)
    
        pref.set_value(val)
        db.session.commit()
    
        return jsonify(pref.to_dict())
    
    elif request.method == "DELETE":
        if pref:
            db.session.delete(pref)
            db.session.commit()
    
        return jsonify({"success": True, "deleted": key})
