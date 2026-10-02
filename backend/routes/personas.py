import os
import re
import json
import base64

from flask import Blueprint
from flask import request
from flask import jsonify

personas_bp = Blueprint("personas", __name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_personas_dir():
    """Ensure personas directory exists and return absolute path."""
    target_dir = os.getenv(
        "PERSONAS_DIR_PATH", os.path.join(BASE_DIR, "app/personas")
    )
    os.makedirs(target_dir, exist_ok=True)
    return target_dir


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and invalid characters."""
    base = os.path.basename(filename)
    base = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base)
    if not base.endswith(".json"):
        base += ".json"
    return base


@personas_bp.route("/personas", methods=["GET"])
def list_persona_templates():
    target_dir = get_personas_dir()
    templates = []

    if not os.path.exists(target_dir):
        return jsonify([])

    for fname in sorted(os.listdir(target_dir)):
        if not fname.endswith(".json"):
            continue
        file_path = os.path.join(target_dir, fname)
        if not os.path.isfile(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, dict):
                item = dict(data)
                item["filename"] = fname
                item["name"] = (
                    data.get("name")
                    or os.path.splitext(fname)[0].replace("_", " ").title()
                )
                item["description"] = data.get("description") or ""
                item["system_prompt"] = (
                    data.get("system_prompt") or data.get("personality") or ""
                )
                item["picture"] = data.get("picture") or None
                item["voice"] = data.get("voice") or None
            else:
                item = {
                    "filename": fname,
                    "name": os.path.splitext(fname)[0].replace("_", " ").title(),
                    "description": "",
                    "system_prompt": "",
                    "picture": None,
                    "voice": None,
                }

            templates.append(item)
        except Exception as e:
            templates.append(
                {
                    "filename": fname,
                    "name": os.path.splitext(fname)[0].replace("_", " ").title(),
                    "description": "",
                    "system_prompt": "",
                    "picture": None,
                    "voice": None,
                    "error": f"Failed to parse JSON: {str(e)}",
                }
            )

    return jsonify(templates)


@personas_bp.route("/personas", methods=["POST"])
def create_persona_template():
    data = request.json or {}
    name = (data.get("name") or "New Persona").strip()

    # Generate unique filename automatically based on persona name
    slug = re.sub(
        r"[^a-zA-Z0-9_\-]", "_", name.lower().replace(" ", "_")
    ).strip("_")
    base_name = slug or "persona"
    fname = f"{base_name}.json"
    target_dir = get_personas_dir()
    file_path = os.path.join(target_dir, fname)

    counter = 1
    while os.path.exists(file_path):
        fname = f"{base_name}_{counter}.json"
        file_path = os.path.join(target_dir, fname)
        counter += 1

    payload = dict(data)
    payload["name"] = name
    if "description" not in payload:
        payload["description"] = ""
    if "system_prompt" not in payload:
        payload["system_prompt"] = payload.get("personality", "")

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    res = dict(payload)
    res["filename"] = fname
    return jsonify(res), 201


@personas_bp.route("/personas/<filename>", methods=["PUT"])
def update_persona_template(filename):
    fname = sanitize_filename(filename)
    target_dir = get_personas_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Persona template file '{fname}' not found"}), 404

    data = request.json or {}
    name = (
        data.get("name") or os.path.splitext(fname)[0].replace("_", " ").title()
    ).strip()

    payload = dict(data)
    payload["name"] = name

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    res = dict(payload)
    res["filename"] = fname
    return jsonify(res), 200


@personas_bp.route("/personas/<filename>", methods=["DELETE"])
def delete_persona_template(filename):
    fname = sanitize_filename(filename)
    target_dir = get_personas_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Persona template file '{fname}' not found"}), 404

    os.remove(file_path)
    return jsonify({"success": True, "deleted": fname}), 200


@personas_bp.route("/personas/avatar", methods=["POST"])
def upload_persona_avatar():
    file = request.files.get("file") or request.files.get("avatar")
    if not file or not file.filename:
        return jsonify({"error": "No image file provided"}), 400

    content_type = file.content_type or "image/png"
    if not content_type.startswith("image/"):
        content_type = "image/png"

    raw_bytes = file.read()
    if not raw_bytes:
        return jsonify({"error": "Uploaded file is empty"}), 400

    b64_str = base64.b64encode(raw_bytes).decode("utf-8")
    data_uri = f"data:{content_type};base64,{b64_str}"

    return jsonify({"picture": data_uri}), 200
