import json
import ollama
import urllib.error
import urllib.request

from flask import Blueprint
from flask import request
from flask import jsonify
from flask import Response
from flask import stream_with_context

from models import db
from models import Instance
from models import InstanceModel
from models import OnlineInstanceModelList
from models import generate_uuid

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

    api_key = (
        props.get("apiKey")
        or props.get("api_key")
        or props.get("key")
        or props.get("api")
        or ""
    )

    if api_key == "NOKEY":
        api_key = ""

    models = []
    headers = {"User-Agent": "AlpacaWeb/1.0"}

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if inst_type == "ollama":
        if not host:
            host = "http://localhost:11434"
        host = host.rstrip("/")

        # Try Ollama Python SDK client first
        try:

            client_kwargs = {"host": host}
            if headers:
                client_kwargs["headers"] = headers
            client = ollama.Client(**client_kwargs)
            res = client.list()

            model_items = (
                getattr(res, "models", None)
                or (res.get("models") if isinstance(res, dict) else None)
                or []
            )

            for m in model_items:
                model_id = (
                    getattr(m, "model", None)
                    or getattr(m, "name", None)
                    or (m.get("model") or m.get("name") if isinstance(m, dict) else None)
                )

                if model_id:
                    details = getattr(m, "details", None) or (
                        m.get("details", {}) if isinstance(m, dict) else {}
                    )

                    family = getattr(details, "family", None) or (
                        details.get("family") if isinstance(details, dict) else None
                    )
                    families = getattr(details, "families", None) or (
                        details.get("families") if isinstance(details, dict) else []
                    )
                    fam = family or (families[0] if families else None)

                    param_size = getattr(details, "parameter_size", None) or (
                        details.get("parameter_size")
                        if isinstance(details, dict)
                        else None
                    )
                    quant_level = getattr(details, "quantization_level", None) or (
                        details.get("quantization_level")
                        if isinstance(details, dict)
                        else None
                    )
                    mod_at = getattr(m, "modified_at", None) or (
                        m.get("modified_at") if isinstance(m, dict) else None
                    )
                    if hasattr(mod_at, "isoformat"):
                        mod_at = mod_at.isoformat()
                    size_val = getattr(m, "size", None) or (
                        m.get("size") if isinstance(m, dict) else None
                    )

                    tag_str = (
                        model_id.split(":")[-1] if ":" in model_id else model_id
                    )
                    details_dict = {
                        "family": fam,
                        "families": families,
                        "parameter_size": param_size,
                        "quantization_level": quant_level,
                    }

                    models.append(
                        {
                            "id": model_id,
                            "name": model_id,
                            "provider": "Ollama",
                            "voice": "af_heart",
                            "context": "8,192 tokens",
                            "tag": tag_str,
                            "family": fam,
                            "parameter_size": param_size,
                            "quantization_level": quant_level,
                            "modified_at": mod_at,
                            "size": size_val,
                            "capabilities": derive_model_capabilities(
                                model_id, details_dict
                            ),
                        }
                    )
            if models:
                return models
        except Exception:
            pass

        # Fallback to /v1/models (OpenAI-compatible)
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


    elif inst_type == "gemini" or "generativelanguage.googleapis.com" in host:
        # First try Google Gemini native models endpoint if API key exists
        if api_key:
            target_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            try:
                req = urllib.request.Request(target_url, headers=headers, method="GET")
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    for m in data.get("models", []):
                        methods = m.get("supportedGenerationMethods", [])
                        desc = (m.get("description") or "").lower()
                        if "generatecontent" in [str(x).lower() for x in methods] and "deprecated" not in desc:
                            raw_name = m.get("name", "")
                            model_id = raw_name[7:] if raw_name.startswith("models/") else raw_name
                            display_name = m.get("displayName") or model_id
                            in_tokens = m.get("inputTokenLimit")
                            ctx_str = f"{in_tokens:,} tokens" if in_tokens else "1,048,576 tokens"
                            models.append(
                                {
                                    "id": model_id,
                                    "name": display_name,
                                    "provider": "Google Gemini",
                                    "voice": "af_heart",
                                    "context": ctx_str,
                                    "tag": model_id,
                                    "family": "Gemini",
                                    "capabilities": ["vision", "reasoning", "code"],
                                }
                            )
                    if models:
                        return models
            except Exception:
                pass

        # Try Google Gemini OpenAI-compatible /v1beta/openai/models
        target_url = "https://generativelanguage.googleapis.com/v1beta/openai/models"
        try:
            req = urllib.request.Request(target_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for m in data.get("data", []) or data.get("models", []):
                    raw_id = m.get("id") or m.get("name")
                    if raw_id:
                        model_id = raw_id[7:] if raw_id.startswith("models/") else raw_id
                        models.append(
                            {
                                "id": model_id,
                                "name": m.get("name", model_id),
                                "provider": "Google Gemini",
                                "voice": "af_heart",
                                "context": "1,048,576 tokens",
                                "tag": model_id,
                                "family": "Gemini",
                                "capabilities": ["vision", "reasoning", "code"],
                            }
                        )
                if models:
                    return models
        except Exception:
            pass

        # Robust curated fallback list of active Gemini models
        return [
            {
                "id": "gemini-3.8-flash",
                "name": "Gemini 3.8 Flash",
                "provider": "Google Gemini",
                "voice": "af_heart",
                "context": "1,048,576 tokens",
                "tag": "gemini-3.8-flash",
                "family": "Gemini",
                "capabilities": ["vision", "reasoning", "code"],
            },
            {
                "id": "gemini-flash-latest",
                "name": "Gemini Flash (Latest)",
                "provider": "Google Gemini",
                "voice": "af_heart",
                "context": "1,048,576 tokens",
                "tag": "gemini-flash-latest",
                "family": "Gemini",
                "capabilities": ["vision", "reasoning", "code"],
            },
            {
                "id": "gemini-2.5-pro",
                "name": "Gemini 2.5 Pro",
                "provider": "Google Gemini",
                "voice": "af_heart",
                "context": "2,097,152 tokens",
                "tag": "gemini-2.5-pro",
                "family": "Gemini",
                "capabilities": ["vision", "reasoning", "code"],
            },
            {
                "id": "gemini-2.0-flash",
                "name": "Gemini 2.0 Flash",
                "provider": "Google Gemini",
                "voice": "af_heart",
                "context": "1,048,576 tokens",
                "tag": "gemini-2.0-flash",
                "family": "Gemini",
                "capabilities": ["vision", "reasoning", "code"],
            },
            {
                "id": "gemini-1.5-flash",
                "name": "Gemini 1.5 Flash",
                "provider": "Google Gemini",
                "voice": "af_heart",
                "context": "1,048,576 tokens",
                "tag": "gemini-1.5-flash",
                "family": "Gemini",
                "capabilities": ["vision", "reasoning", "code"],
            },
            {
                "id": "gemini-1.5-pro",
                "name": "Gemini 1.5 Pro",
                "provider": "Google Gemini",
                "voice": "af_heart",
                "context": "2,097,152 tokens",
                "tag": "gemini-1.5-pro",
                "family": "Gemini",
                "capabilities": ["vision", "reasoning", "code"],
            },
        ]

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
    """
    Get all instances.
    """

    instances = Instance.query.all()

    # If instances exist but none enabled, enable first instance
    if instances and not any(i.is_enabled for i in instances):
        instances[0].is_enabled = 1
        db.session.commit()

    return jsonify([i.to_dict() for i in instances])


def set_instance_enabled(instance_id: str):
    """Ensure only one instance is enabled at a time."""
    Instance.query.filter(Instance.id != instance_id).update({"is_enabled": 0})
    Instance.query.filter(Instance.id == instance_id).update({"is_enabled": 1})
    db.session.commit()


@instances_bp.route("/instances", methods=["POST", "PUT"])
def create_or_update_instance():
    """
    Create or update an instance.
    """

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

    if "is_enabled" in data or "enabled" in data:
        enable_flag = bool(data.get("is_enabled") if "is_enabled" in data else data.get("enabled"))
        if enable_flag:
            set_instance_enabled(instance.id)
        else:
            instance.is_enabled = 0
            other = Instance.query.filter(Instance.id != instance.id).first()
            if other:
                set_instance_enabled(other.id)
            else:
                db.session.commit()
    else:
        # If no instance is enabled, make this one enabled
        any_enabled = Instance.query.filter_by(is_enabled=1).first()
        if not any_enabled:
            instance.is_enabled = 1
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

    if "is_enabled" in data or "enabled" in data:
        enable_flag = bool(data.get("is_enabled") if "is_enabled" in data else data.get("enabled"))
        if enable_flag:
            set_instance_enabled(instance.id)
        else:
            instance.is_enabled = 0
            other = Instance.query.filter(Instance.id != instance.id).first()
            if other:
                set_instance_enabled(other.id)
            else:
                db.session.commit()

    return jsonify(instance.to_dict()), 200


@instances_bp.route("/instances/<instance_id>", methods=["DELETE"])
def delete_instance(instance_id):
    instance = Instance.query.get_or_404(instance_id)
    was_enabled = bool(instance.is_enabled)

    db.session.delete(instance)
    db.session.commit()

    if was_enabled:
        next_inst = Instance.query.first()
        if next_inst:
            next_inst.is_enabled = 1
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

            # Synchronize discovered models with InstanceModel table
            for m in live_models:
                mid = m.get("id")
                if mid:
                    im = InstanceModel.query.filter_by(instance_id=instance_id, model_id=mid).first()
                    if not im:
                        im = InstanceModel(instance_id=instance_id, model_id=mid)
                        db.session.add(im)
                        db.session.flush()
                    m["uuid"] = im.id
                    m["instance_model_id"] = im.id

            db.session.commit()
            return jsonify(live_models)

        if record:
            cached = record.get_list()
            for m in cached:
                mid = m.get("id")
                if mid:
                    im = InstanceModel.query.filter_by(instance_id=instance_id, model_id=mid).first()
                    if im:
                        m["uuid"] = im.id
                        m["instance_model_id"] = im.id
            return jsonify(cached)

        db_models = InstanceModel.query.filter_by(instance_id=instance_id).all()
        return jsonify([
            {
                "id": im.model_id,
                "name": im.model_id,
                "uuid": im.id,
                "instance_model_id": im.id,
                "provider": instance.type if instance else "Provider",
            }
            for im in db_models
        ])
    else:
        data = request.json or {}
        model_list = data.get("list", [])
        if not record:
            record = OnlineInstanceModelList(id=instance_id)
            db.session.add(record)
        record.set_list(model_list)

        for m in model_list:
            mid = m.get("id") if isinstance(m, dict) else str(m)
            if mid:
                im = InstanceModel.query.filter_by(instance_id=instance_id, model_id=mid).first()
                if not im:
                    im = InstanceModel(instance_id=instance_id, model_id=mid)
                    db.session.add(im)

        db.session.commit()
        return jsonify(record.to_dict())


@instances_bp.route("/instances/<instance_id>/models/pull", methods=["POST"])
@instances_bp.route("/instances/<instance_id>/pull", methods=["POST"])
def pull_instance_model(instance_id):
    instance = Instance.query.get_or_404(instance_id)
    data = request.json or {}
    model_name = (data.get("model") or data.get("name") or "").strip()

    if not model_name:
        return jsonify({"error": "Model name is required"}), 400

    props = instance.get_properties()
    inst_type = (instance.type or "ollama").lower()
    host = props.get("url") or props.get("host") or props.get("endpoint") or "http://0.0.0.0:11434"

    if inst_type != "ollama":
        return jsonify({"error": f"Pulling models is only supported for Ollama instances (got '{inst_type}')"}), 400

    if host.endswith("/"):
        host = host[:-1]

    pull_url = f"{host}/api/pull"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "AlpacaWeb/1.0",
    }
    api_key = props.get("apiKey") or props.get("api_key") or props.get("key") or props.get("api") or ""
    if api_key and api_key != "NOKEY":
        headers["Authorization"] = f"Bearer {api_key}"

    allow_ssl = bool(props.get("allow_self_signed_ssl"))
    context = None
    if allow_ssl:
        import ssl
        context = ssl._create_unverified_context()

    def generate_pull_stream():
        try:
            client_kwargs = {"host": host}
            if headers:
                client_kwargs["headers"] = headers
            client = ollama.Client(**client_kwargs)

            for chunk in client.pull(model=model_name, stream=True):
                if hasattr(chunk, "model_dump"):
                    chunk_obj = chunk.model_dump()
                elif hasattr(chunk, "__dict__"):
                    chunk_obj = {
                        k: v
                        for k, v in chunk.__dict__.items()
                        if not k.startswith("_")
                    }
                elif isinstance(chunk, dict):
                    chunk_obj = chunk
                else:
                    chunk_obj = {"status": str(chunk)}

                # Check for completion
                if chunk_obj.get("status") == "success":
                    try:
                        im = InstanceModel.query.filter_by(
                            instance_id=instance_id, model_id=model_name
                        ).first()
                        if not im:
                            im = InstanceModel(
                                instance_id=instance_id, model_id=model_name
                            )
                            db.session.add(im)
                            db.session.commit()
                    except Exception:
                        db.session.rollback()

                yield f"data: {json.dumps(chunk_obj)}\n\n"

        except Exception as e:
            err_msg = str(e)
            if hasattr(e, "error"):
                err_msg = str(getattr(e, "error"))
            yield f"data: {json.dumps({'error': err_msg, 'status': 'error'})}\n\n"

    response = Response(
        stream_with_context(generate_pull_stream()),
        mimetype="text/event-stream",
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    return response


@instances_bp.route("/instances/<instance_id>/models/<path:model_name>", methods=["DELETE"])
@instances_bp.route("/instances/<instance_id>/models", methods=["DELETE"])
def delete_instance_model(instance_id, model_name=None):
    instance = Instance.query.get_or_404(instance_id)

    if not model_name:
        data = request.json or {}
        model_name = data.get("model") or data.get("name") or data.get("model_name")

    if not model_name:
        return jsonify({"error": "Model name is required"}), 400

    model_name = str(model_name).strip()
    props = instance.get_properties()
    inst_type = (instance.type or "ollama").lower()
    host = props.get("url") or props.get("host") or props.get("endpoint") or "http://0.0.0.0:11434"

    if host.endswith("/"):
        host = host[:-1]

    headers = {
        "User-Agent": "AlpacaWeb/1.0",
    }
    api_key = props.get("apiKey") or props.get("api_key") or props.get("key") or props.get("api") or ""
    if api_key and api_key != "NOKEY":
        headers["Authorization"] = f"Bearer {api_key}"

    # For Ollama instances, forward deletion using Ollama Python SDK
    if inst_type == "ollama":
        try:
            client_kwargs = {"host": host}
            if headers:
                client_kwargs["headers"] = headers
            client = ollama.Client(**client_kwargs)
            client.delete(model=model_name)
        except Exception as e:
            err_msg = str(e)
            if hasattr(e, "error"):
                err_msg = str(getattr(e, "error"))
            status_code = getattr(e, "status_code", 502) or 502
            return (
                jsonify(
                    {"error": f"Failed deleting model from Ollama instance: {err_msg}"}
                ),
                status_code,
            )


    # Remove from InstanceModel table if present
    try:
        InstanceModel.query.filter_by(instance_id=instance_id, model_id=model_name).delete()
        record = OnlineInstanceModelList.query.get(instance_id)
        if record:
            cached_list = record.get_list()
            updated_list = [m for m in cached_list if (m.get("id") if isinstance(m, dict) else str(m)) != model_name]
            record.set_list(updated_list)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database cleanup failed: {str(e)}"}), 500

    return jsonify({"success": True, "deleted": model_name}), 200
