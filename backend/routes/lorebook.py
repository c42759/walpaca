import os
import re
import json

from flask import request
from flask import jsonify
from flask import Blueprint

lorebook_bp = Blueprint("lorebook", __name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_lorebook_dir():
    """Ensure lorebook directory exists and return absolute path."""
    target_dir = os.getenv(
        "LOREBOOK_DIR_PATH", os.path.join(BASE_DIR, "app/lorebook")
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


def format_keys(keys_raw):
    """Normalize keys to a list of strings."""
    if isinstance(keys_raw, list):
        return [str(k).strip() for k in keys_raw if str(k).strip()]
    elif isinstance(keys_raw, str):
        return [k.strip() for k in keys_raw.split(",") if k.strip()]
    return []


@lorebook_bp.route("/lorebook", methods=["GET"])
def list_lorebook_templates():
    target_dir = get_lorebook_dir()
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
                name = (
                    data.get("name")
                    or os.path.splitext(fname)[0].replace("_", " ").title()
                )
                keys = format_keys(data.get("keys"))
                content = data.get("content") or ""
            else:
                name = os.path.splitext(fname)[0].replace("_", " ").title()
                keys = []
                content = json.dumps(data, indent=2)

            templates.append(
                {
                    "filename": fname,
                    "name": name,
                    "keys": keys,
                    "content": content,
                }
            )
        except Exception as e:
            templates.append(
                {
                    "filename": fname,
                    "name": os.path.splitext(fname)[0].replace("_", " ").title(),
                    "keys": [],
                    "content": "",
                    "error": f"Failed to parse JSON: {str(e)}",
                }
            )

    return jsonify(templates)


@lorebook_bp.route("/lorebook", methods=["POST"])
def create_lorebook_template():
    data = request.json or {}
    name = (data.get("name") or "New Character").strip()
    keys = format_keys(data.get("keys"))
    content = data.get("content") or ""

    # Generate unique filename automatically based on character name
    slug = re.sub(
        r"[^a-zA-Z0-9_\-]", "_", name.lower().replace(" ", "_")
    ).strip("_")
    base_name = slug or "character"
    fname = f"{base_name}.json"
    target_dir = get_lorebook_dir()
    file_path = os.path.join(target_dir, fname)

    counter = 1
    while os.path.exists(file_path):
        fname = f"{base_name}_{counter}.json"
        file_path = os.path.join(target_dir, fname)
        counter += 1

    payload = {
        "name": name,
        "keys": keys,
        "content": content,
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return (
        jsonify(
            {
                "filename": fname,
                "name": name,
                "keys": keys,
                "content": content,
            }
        ),
        201,
    )


@lorebook_bp.route("/lorebook/<filename>", methods=["PUT"])
def update_lorebook_template(filename):
    fname = sanitize_filename(filename)
    target_dir = get_lorebook_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Template file '{fname}' not found"}), 404

    data = request.json or {}
    name = (
        data.get("name") or os.path.splitext(fname)[0].replace("_", " ").title()
    ).strip()
    keys = format_keys(data.get("keys"))
    content = data.get("content") or ""

    payload = {
        "name": name,
        "keys": keys,
        "content": content,
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return (
        jsonify(
            {
                "filename": fname,
                "name": name,
                "keys": keys,
                "content": content,
            }
        ),
        200,
    )


@lorebook_bp.route("/lorebook/<filename>", methods=["DELETE"])
def delete_lorebook_template(filename):
    fname = sanitize_filename(filename)
    target_dir = get_lorebook_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Template file '{fname}' not found"}), 404

    os.remove(file_path)
    return jsonify({"success": True, "deleted": fname}), 200
