from models import db
from flask import request
from flask import jsonify
from flask import Blueprint

from models import Message
from models import Instance
from models import InstanceModel
from models import generate_uuid
from models import ModelPreferences
from models import is_internal_id

model_preferences_bp = Blueprint("model_preferences", __name__)


def resolve_model_preference(identifier: str):
    """Resolve ModelPreferences by its id, model_id (UUID), or model name."""
    if not identifier:
        return None
    # 1. Direct primary key
    pref = ModelPreferences.query.get(identifier)
    if pref:
        return pref
    # 2. Match model_id column (UUID of InstanceModel)
    pref = ModelPreferences.query.filter_by(model_id=identifier).first()
    if pref:
        return pref
    # 3. Match InstanceModel name
    ims = InstanceModel.query.filter_by(model_id=identifier).all()
    for im in ims:
        pref = ModelPreferences.query.filter_by(model_id=im.id).first()
        if pref:
            return pref
    return None


@model_preferences_bp.route("/model-preferences", methods=["GET", "POST"])
def list_model_preferences():
    if request.method == "POST":
        data = request.json or {}
        model_val = data.get("model_id") or data.get("model") or data.get("id")

        # If model doesn't come with request, use the one from latest message of assistant
        if not model_val:
            chat_id = data.get("chat_id")
            if chat_id:
                latest_msg = (
                    Message.query.filter_by(chat_id=chat_id, role="assistant")
                    .filter(Message.model.isnot(None))
                    .order_by(Message.date_time.desc())
                    .first()
                )
            else:
                latest_msg = (
                    Message.query.filter_by(role="assistant")
                    .filter(Message.model.isnot(None))
                    .order_by(Message.date_time.desc())
                    .first()
                )
            if latest_msg and latest_msg.model:
                model_val = latest_msg.model

        if not model_val:
            return jsonify({"error": "Missing model id and no assistant message found"}), 400

        # Resolve instance
        instance_id = data.get("instance_id")
        if not instance_id:
            active_inst = Instance.query.filter_by(is_enabled=1).first() or Instance.query.first()
            if active_inst:
                instance_id = active_inst.id

        # Resolve physical model name if model_val is an internal ID
        clean_model_name = model_val
        if is_internal_id(model_val):
            # 1. Check if model_val is a ModelPreferences ID
            src_pref = ModelPreferences.query.get(model_val)
            if src_pref:
                pref_dict = src_pref.to_dict()
                if pref_dict.get("model_name") and not is_internal_id(pref_dict["model_name"]):
                    clean_model_name = pref_dict["model_name"]
            # 2. Check if model_val is an InstanceModel ID
            if is_internal_id(clean_model_name):
                src_im = InstanceModel.query.get(model_val)
                if src_im and src_im.model_id and not is_internal_id(src_im.model_id):
                    clean_model_name = src_im.model_id
                elif src_im and is_internal_id(src_im.model_id):
                    nested_im = InstanceModel.query.get(src_im.model_id)
                    if nested_im and nested_im.model_id and not is_internal_id(nested_im.model_id):
                        clean_model_name = nested_im.model_id

        # Resolve or create InstanceModel for this instance
        target_im = InstanceModel.query.filter_by(instance_id=instance_id, model_id=clean_model_name).first()
        if not target_im:
            target_im = InstanceModel(instance_id=instance_id, model_id=clean_model_name)
            db.session.add(target_im)
            db.session.flush()
        model_uuid = target_im.id

        pref = None
        pref_id = data.get("id")
        # Only update existing preference if pref_id matches an existing ModelPreferences primary key
        if pref_id and not data.get("create_new", False):
            pref = ModelPreferences.query.get(pref_id)

        if not pref:
            pref = ModelPreferences(id=generate_uuid())
            db.session.add(pref)

        pref.instance_id = instance_id
        pref.model_id = model_uuid

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
    pref = resolve_model_preference(model_id)

    if request.method == "GET":
        if not pref:
            return jsonify(
                {
                    "id": model_id,
                    "instance_id": None,
                    "model_id": model_id,
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
            # Resolve instance and instance model
            instance_id = data.get("instance_id")
            if not instance_id:
                active_inst = Instance.query.filter_by(is_enabled=1).first() or Instance.query.first()
                if active_inst:
                    instance_id = active_inst.id

            target_im = InstanceModel.query.get(model_id)
            if target_im:
                model_uuid = target_im.id
                if not instance_id:
                    instance_id = target_im.instance_id
            elif instance_id:
                target_im = InstanceModel.query.filter_by(instance_id=instance_id, model_id=model_id).first()
                if not target_im:
                    target_im = InstanceModel(instance_id=instance_id, model_id=model_id)
                    db.session.add(target_im)
                    db.session.flush()
                model_uuid = target_im.id
            else:
                model_uuid = model_id

            pref = ModelPreferences(id=generate_uuid(), instance_id=instance_id, model_id=model_uuid)
            db.session.add(pref)

        if "instance_id" in data or "model_id" in data:
            new_inst_id = data.get("instance_id") or pref.instance_id
            new_model_val = data.get("model_id") or pref.model_id
            if new_model_val:
                target_im = InstanceModel.query.get(new_model_val)
                if target_im:
                    if new_inst_id and target_im.instance_id != new_inst_id:
                        new_im = InstanceModel.query.filter_by(instance_id=new_inst_id, model_id=target_im.model_id).first()
                        if not new_im:
                            new_im = InstanceModel(instance_id=new_inst_id, model_id=target_im.model_id)
                            db.session.add(new_im)
                            db.session.flush()
                        pref.model_id = new_im.id
                    else:
                        pref.model_id = target_im.id
                else:
                    if new_inst_id:
                        target_im = InstanceModel.query.filter_by(instance_id=new_inst_id, model_id=new_model_val).first()
                        if not target_im:
                            target_im = InstanceModel(instance_id=new_inst_id, model_id=new_model_val)
                            db.session.add(target_im)
                            db.session.flush()
                        pref.model_id = target_im.id
                    else:
                        pref.model_id = new_model_val
            if "instance_id" in data:
                pref.instance_id = data["instance_id"]
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
