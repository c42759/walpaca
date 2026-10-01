import os
import json
from flask import Blueprint, request, jsonify

preferences_bp = Blueprint("preferences", __name__)

DEFAULT_PREFERENCES = {
    "auto_play_voice": False,
    "desktop_notifications": True,
    "play_sound_notification": True,
    "auto_scroll": True,
    "default_audio_output": "default",
    "active_instance_id": None,
}


def get_preferences_path():
    config_dir = os.getenv("CONFIG_DIR")
    if not config_dir:
        if os.path.exists("/app/config"):
            config_dir = "/app/config"
        else:
            config_dir = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "config")
            )
    os.makedirs(config_dir, exist_ok=True)
    return os.path.join(config_dir, "preferences.json")


def load_preferences():
    path = get_preferences_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return {**DEFAULT_PREFERENCES, **data}
        except Exception as e:
            print(f"Error reading preferences from {path}: {e}")
    return DEFAULT_PREFERENCES.copy()


def save_preferences(data):
    path = get_preferences_path()
    current = load_preferences()
    if isinstance(data, dict):
        current.update(data)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current


@preferences_bp.route("/preferences", methods=["GET", "POST", "PUT"])
def handle_preferences():
    if request.method in ["POST", "PUT"]:
        data = request.json or {}
        saved = save_preferences(data)
        return jsonify(saved)
    return jsonify(load_preferences())
