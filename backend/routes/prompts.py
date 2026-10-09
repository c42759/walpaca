import os
import re
import json

from flask import request
from flask import jsonify
from flask import Blueprint

prompts_bp = Blueprint("prompts", __name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_prompts_dir():
    """Ensure prompts directory exists and return absolute path."""
    target_dir = os.getenv(
        "PROMPTS_DIR_PATH", os.path.join(BASE_DIR, "app/prompts")
    )
    # If app/prompts does not exist and root prompts exists, use root prompts
    if not os.path.exists(target_dir):
        fallback_dir = os.path.join(BASE_DIR, "prompts")
        if os.path.exists(fallback_dir):
            target_dir = fallback_dir

    os.makedirs(target_dir, exist_ok=True)
    return target_dir


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and invalid characters."""
    base = os.path.basename(filename)
    base = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base)
    if not base.endswith(".json"):
        base += ".json"
    return base


@prompts_bp.route("/prompts", methods=["GET"])
def list_prompts():
    target_dir = get_prompts_dir()
    prompts_list = []

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
                title = (
                    data.get("title")
                    or data.get("name")
                    or os.path.splitext(fname)[0].replace("_", " ").title()
                )
                content = data.get("content") or ""
            else:
                title = os.path.splitext(fname)[0].replace("_", " ").title()
                content = str(data)

            prompts_list.append(
                {
                    "filename": fname,
                    "title": title,
                    "content": content,
                }
            )
        except Exception as e:
            prompts_list.append(
                {
                    "filename": fname,
                    "title": os.path.splitext(fname)[0].replace("_", " ").title(),
                    "content": "",
                    "error": f"Failed to parse JSON: {str(e)}",
                }
            )

    return jsonify(prompts_list)


@prompts_bp.route("/prompts/<filename>", methods=["GET"])
def get_prompt(filename):
    fname = sanitize_filename(filename)
    target_dir = get_prompts_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Prompt file '{fname}' not found"}), 404

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            title = (
                data.get("title")
                or data.get("name")
                or os.path.splitext(fname)[0].replace("_", " ").title()
            )
            content = data.get("content") or ""
        else:
            title = os.path.splitext(fname)[0].replace("_", " ").title()
            content = str(data)

        return (
            jsonify(
                {
                    "filename": fname,
                    "title": title,
                    "content": content,
                }
            ),
            200,
        )
    except Exception as e:
        return (
            jsonify({"error": f"Failed reading prompt '{fname}': {str(e)}"}),
            500,
        )


@prompts_bp.route("/prompts", methods=["POST"])
def create_prompt():
    data = request.json or {}
    title = (data.get("title") or data.get("name") or "New Prompt").strip()
    content = data.get("content") or ""

    slug = re.sub(
        r"[^a-zA-Z0-9_\-]", "_", title.lower().replace(" ", "_")
    ).strip("_")
    base_name = slug or "prompt"
    fname = f"{base_name}.json"
    target_dir = get_prompts_dir()
    file_path = os.path.join(target_dir, fname)

    counter = 1
    while os.path.exists(file_path):
        fname = f"{base_name}_{counter}.json"
        file_path = os.path.join(target_dir, fname)
        counter += 1

    payload = {
        "title": title,
        "content": content,
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return (
        jsonify(
            {
                "filename": fname,
                "title": title,
                "content": content,
            }
        ),
        201,
    )


@prompts_bp.route("/prompts/<filename>", methods=["PUT"])
def update_prompt(filename):
    fname = sanitize_filename(filename)
    target_dir = get_prompts_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Prompt file '{fname}' not found"}), 404

    data = request.json or {}
    title = (
        data.get("title")
        or data.get("name")
        or os.path.splitext(fname)[0].replace("_", " ").title()
    ).strip()
    content = data.get("content") or ""

    payload = {
        "title": title,
        "content": content,
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return (
        jsonify(
            {
                "filename": fname,
                "title": title,
                "content": content,
            }
        ),
        200,
    )


@prompts_bp.route("/prompts/<filename>", methods=["DELETE"])
def delete_prompt(filename):
    fname = sanitize_filename(filename)
    target_dir = get_prompts_dir()
    file_path = os.path.join(target_dir, fname)

    if not os.path.isfile(file_path):
        return jsonify({"error": f"Prompt file '{fname}' not found"}), 404

    os.remove(file_path)
    return jsonify({"success": True, "deleted": fname}), 200
