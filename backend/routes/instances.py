import json
import urllib.request
import urllib.error
from flask import Blueprint, request, jsonify
from models import db, Instance, OnlineInstanceModelList, generate_uuid

instances_bp = Blueprint("instances", __name__)


def derive_model_capabilities(model_id, details=None):
    """Infer capability tags ('code', 'vision', 'reasoning') for a model."""
    details = details or {}
    caps = []
    name_lower = (model_id or "").lower()
    family = (details.get("family") or "").lower()
    families = [str(f).lower() for f in (details.get("families") or [])]

    # Code capability
    if (
        any(
            k in name_lower
            for k in [
                "code",
                "coder",
                "starcoder",
                "codellama",
                "wizardcoder",
                "deepseek-coder",
            ]
        )
        or any(k in family for k in ["code", "coder"])
        or any(any(k in f for k in ["code", "coder"]) for f in families)
    ):
        caps.append("code")

    # Vision capability
    if (
        any(
            k in name_lower
            for k in [
                "vision",
                "llava",
                "bakllava",
                "moondream",
                "minicpm-v",
                "clip",
                "vl",
                "pixtral",
                "omni",
            ]
        )
        or any(k in family for k in ["clip", "vision", "mllm"])
        or any(any(k in f for k in ["clip", "vision", "mllm"]) for f in families)
    ):
        caps.append("vision")

    # Reasoning capability
    if (
        any(
            k in name_lower
            for k in ["r1", "qwq", "think", "reasoning", "deepseek-r1", "o1", "o3"]
        )
        or any(k in family for k in ["r1", "qwq", "reasoning"])
        or any(any(k in f for k in ["r1", "qwq", "reasoning"]) for f in families)
    ):
        caps.append("reasoning")

    return caps


def fetch_live_instance_models(instance):
    """Fetch live available models from target instance server."""
    if not instance:
        return []

    props = instance.get_properties()
    inst_type = (instance.type or "ollama").lower()
    host = props.get("url") or props.get("host") or props.get("endpoint") or ""
    api_key = props.get("apiKey") or props.get("api_key") or props.get("key") or ""

    models = []
    headers = {"User-Agent": "AlpacaWeb/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if inst_type == "ollama":
        if not host:
            host = "http://localhost:11434"
        host = host.rstrip("/")

        # Try Ollama native /api/tags first
        target_url = f"{host}/api/tags"
        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for m in data.get("models", []):
                    model_id = m.get("name") or m.get("model")
                    if model_id:
                        details = m.get("details") or {}
                        fam = details.get("family") or (
                            details.get("families")[0]
                            if details.get("families")
                            else None
                        )
                        tag_str = (
                            model_id.split(":")[-1] if ":" in model_id else model_id
                        )

                        models.append(
                            {
                                "id": model_id,
                                "name": model_id,
                                "provider": "Ollama",
                                "voice": "af_heart",
                                "context": "8,192 tokens",
                                "tag": tag_str,
                                "family": fam,
                                "parameter_size": details.get("parameter_size"),
                                "quantization_level": details.get(
                                    "quantization_level"
                                ),
                                "modified_at": m.get("modified_at"),
                                "size": m.get("size"),
                                "capabilities": derive_model_capabilities(
                                    model_id, details
                                ),
                            }
                        )
                if models:
                    return models
        except Exception:
            pass

        # Fallback to /v1/models
        target_url = f"{host}/v1/models"
        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for m in data.get("data", []):
                    model_id = m.get("id")
                    if model_id:
                        details = m.get("details") or {}
                        models.append(
                            {
                                "id": model_id,
                                "name": m.get("name", model_id),
                                "provider": "Ollama",
                                "voice": "af_heart",
                                "context": "8,192 tokens",
                                "tag": (
                                    model_id.split(":")[-1]
                                    if ":" in model_id
                                    else model_id
                                ),
                                "family": details.get("family"),
                                "parameter_size": details.get("parameter_size"),
                                "quantization_level": details.get(
                                    "quantization_level"
                                ),
                                "modified_at": m.get("modified_at"),
                                "size": m.get("size"),
                                "capabilities": derive_model_capabilities(
                                    model_id, details
                                ),
                            }
                        )
                if models:
                    return models
        except Exception:
            pass

    else:
        # OpenAI, OpenRouter, vLLM, TGI, or custom OpenAI-compatible server
        if not host:
            if inst_type == "openrouter":
                host = "https://openrouter.ai/api/v1"
            elif inst_type == "openai":
                host = "https://api.openai.com/v1"
            else:
                host = "http://localhost:8000/v1"

        host = host.rstrip("/")
        if host.endswith("/models"):
            target_url = host
        elif host.endswith("/v1"):
            target_url = f"{host}/models"
        else:
            target_url = f"{host}/v1/models"

        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                model_items = data.get("data") or data.get("models") or []
                for m in model_items:
                    model_id = m.get("id") or m.get("name")
                    if model_id:
                        details = m.get("details") or {}
                        models.append(
                            {
                                "id": model_id,
                                "name": m.get("name", model_id),
                                "provider": (
                                    instance.type.capitalize()
                                    if instance.type
                                    else "AI Provider"
                                ),
                                "voice": "af_heart",
                                "context": "8,192 tokens",
                                "tag": (
                                    model_id.split(":")[-1]
                                    if ":" in model_id
                                    else model_id
                                ),
                                "family": details.get("family")
                                or instance.type.capitalize(),
                                "parameter_size": details.get("parameter_size"),
                                "quantization_level": details.get(
                                    "quantization_level"
                                ),
                                "modified_at": m.get("modified_at"),
                                "size": m.get("size"),
                                "capabilities": derive_model_capabilities(
                                    model_id, details
                                ),
                            }
                        )
                if models:
                    return models
        except Exception:
            pass

    return models


@instances_bp.route("/instances", methods=["GET"])
def get_instances():
    instances = Instance.query.all()
    return jsonify([i.to_dict() for i in instances])


@instances_bp.route("/instances", methods=["POST", "PUT"])
def create_or_update_instance():
    data = request.json or {}
    instance_id = data.get("id") or generate_uuid()
    instance = Instance.query.get(instance_id)
    if not instance:
        instance = Instance(id=instance_id)
        db.session.add(instance)
    if "pinned" in data:
        instance.pinned = 1 if data["pinned"] else 0
    if "type" in data:
        instance.type = data["type"]
    if "properties" in data:
        instance.set_properties(data.get("properties", {}))
    db.session.commit()
    return jsonify(instance.to_dict()), 200


@instances_bp.route("/instances/<instance_id>", methods=["PUT"])
def update_instance_by_id(instance_id):
    data = request.json or {}
    instance = Instance.query.get(instance_id)
    if not instance:
        instance = Instance(id=instance_id)
        db.session.add(instance)
    if "pinned" in data:
        instance.pinned = 1 if data["pinned"] else 0
    if "type" in data:
        instance.type = data["type"]
    if "properties" in data:
        props = instance.get_properties()
        props.update(data.get("properties", {}))
        instance.set_properties(props)
    db.session.commit()
    return jsonify(instance.to_dict()), 200


@instances_bp.route("/instances/<instance_id>", methods=["DELETE"])
def delete_instance(instance_id):
    instance = Instance.query.get_or_404(instance_id)
    db.session.delete(instance)
    db.session.commit()
    return jsonify({"success": True, "deleted": instance_id})


@instances_bp.route("/instances/<instance_id>/models", methods=["GET", "POST"])
def instance_models(instance_id):
    record = OnlineInstanceModelList.query.get(instance_id)
    if request.method == "GET":
        instance = Instance.query.get(instance_id)
        live_models = fetch_live_instance_models(instance) if instance else []

        if live_models:
            if not record:
                record = OnlineInstanceModelList(id=instance_id)
                db.session.add(record)
            record.set_list(live_models)
            db.session.commit()
            return jsonify(live_models)

        if not record:
            return jsonify([])
        return jsonify(record.get_list())
    else:
        data = request.json or {}
        model_list = data.get("list", [])
        if not record:
            record = OnlineInstanceModelList(id=instance_id)
            db.session.add(record)
        record.set_list(model_list)
        db.session.commit()
        return jsonify(record.to_dict())
