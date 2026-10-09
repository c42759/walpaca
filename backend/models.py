import json
import uuid
import datetime
import time

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def generate_uuid() -> str:
    """Generate Alpaca-compatible UUID string."""
    return f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')}{uuid.uuid4().hex}"


def current_alpaca_timestamp() -> str:
    """Generate Alpaca-compatible datetime string (YYYY/MM/DD HH:MM:SS)."""
    return datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S")


class ChatFolder(db.Model):
    __tablename__ = "chat_folder"

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    name = db.Column(db.String, nullable=False)
    color = db.Column(db.String, nullable=True)
    parent = db.Column(db.String, db.ForeignKey("chat_folder.id"), nullable=True)

    subfolders = db.relationship(
        "ChatFolder",
        backref=db.backref("parent_folder", remote_side=[id]),
        cascade="all, delete-orphan",
    )
    chats = db.relationship("Chat", backref="folder_ref", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "parent": self.parent,
        }


class Chat(db.Model):
    __tablename__ = "chat"

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    name = db.Column(db.String, nullable=False)
    folder = db.Column(db.String, db.ForeignKey("chat_folder.id"), nullable=True)
    is_template = db.Column(db.Integer, nullable=False, default=0)

    messages = db.relationship(
        "Message",
        backref="chat",
        cascade="all, delete-orphan",
        order_by="Message.date_time.asc()",
    )

    def to_dict(self, include_messages=False):
        data = {
            "id": self.id,
            "name": self.name,
            "folder": self.folder,
            "is_template": bool(self.is_template),
            "latest_message_time": None,
        }
        if self.messages:
            data["latest_message_time"] = self.messages[-1].date_time
        if include_messages:
            data["messages"] = [m.to_dict(include_attachments=True) for m in self.messages]
        return data


class Message(db.Model):
    __tablename__ = "message"

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    chat_id = db.Column(db.String, db.ForeignKey("chat.id"), nullable=False)
    role = db.Column(db.String, nullable=False)
    model = db.Column(db.String, nullable=True)
    date_time = db.Column(
        db.String,
        nullable=False,
        default=current_alpaca_timestamp,
    )
    content = db.Column(db.Text, nullable=False)

    attachments = db.relationship(
        "Attachment", backref="message", cascade="all, delete-orphan"
    )

    def to_dict(self, include_attachments=True):
        data = {
            "id": self.id,
            "chat_id": self.chat_id,
            "role": self.role,
            "model": self.model,
            "date_time": self.date_time,
            "content": self.content,
        }
        if include_attachments:
            data["attachments"] = [a.to_dict() for a in self.attachments]
        return data


class Attachment(db.Model):
    __tablename__ = "attachment"

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    message_id = db.Column(db.String, db.ForeignKey("message.id"), nullable=False)
    type = db.Column(db.String, nullable=False)
    name = db.Column(db.String, nullable=False)
    content = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "message_id": self.message_id,
            "type": self.type,
            "name": self.name,
            "content": self.content,
        }


class Instance(db.Model):
    __tablename__ = "instance"

    id = db.Column(db.String, primary_key=True)
    pinned = db.Column(db.Integer, nullable=False, default=0)
    is_enabled = db.Column(db.Integer, nullable=False, default=0)
    type = db.Column(db.String, nullable=False)
    properties = db.Column(db.Text, nullable=False, default="{}")

    models = db.relationship(
        "InstanceModel",
        backref="instance_ref",
        cascade="all, delete-orphan",
    )

    def get_properties(self) -> dict:
        try:
            return json.loads(self.properties) if self.properties else {}
        except Exception:
            return {}

    def set_properties(self, prop_dict: dict):
        self.properties = json.dumps(prop_dict)

    def to_dict(self):
        return {"id": self.id,
                "pinned": bool(self.pinned),
                "is_enabled": bool(self.is_enabled),
                "enabled": bool(self.is_enabled),
                "type": self.type,
                "properties": self.get_properties()}


class InstanceModel(db.Model):
    __tablename__ = "instance_model"

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    instance_id = db.Column(db.String, db.ForeignKey("instance.id"), nullable=False)
    model_id = db.Column(db.String, nullable=False)

    preferences = db.relationship("ModelPreferences", backref="instance_model_ref", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id,
                "instance_id": self.instance_id,
                "model_id": self.model_id}


class OnlineInstanceModelList(db.Model):
    __tablename__ = "online_instance_model_list"

    id = db.Column(db.String, primary_key=True)
    list = db.Column(db.Text, nullable=False, default="[]")

    def get_list(self) -> list:
        try:
            return json.loads(self.list) if self.list else []
        except Exception:
            return []

    def set_list(self, model_list: list):
        self.list = json.dumps(model_list)

    def to_dict(self):
        return {"id": self.id,
                "list": self.get_list()}


import re


def is_internal_id(val: str) -> bool:
    """Check if a string represents an internal UUID or timestamp ID rather than a human-readable model name."""
    if not val or not isinstance(val, str):
        return False
    val = val.strip()
    if re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", val):
        return True
    if re.match(r"^\d{14,20}[0-9a-fA-F]{16,40}$", val):
        return True
    if re.match(r"^[0-9a-fA-F]{32,64}$", val):
        return True
    return False


class ModelPreferences(db.Model):
    __tablename__ = "model_preferences"

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    instance_id = db.Column(db.String, db.ForeignKey("instance.id"), nullable=True)
    model_id = db.Column(db.String, db.ForeignKey("instance_model.id"), nullable=True)
    picture = db.Column(db.Text, nullable=True)
    voice = db.Column(db.String, nullable=True)
    character = db.Column(db.Text, nullable=True)

    model_ref = db.relationship(
        "InstanceModel",
        foreign_keys=[model_id],
        lazy="joined",
        overlaps="instance_model_ref,preferences",
    )

    def _get_raw_character_dict(self) -> dict:
        try:
            val = json.loads(self.character) if self.character else {}
            return val if isinstance(val, dict) else {}
        except Exception:
            return {}

    @property
    def num_ctx(self):
        raw = self._get_raw_character_dict()
        return raw.get("_num_ctx")

    @num_ctx.setter
    def num_ctx(self, value):
        raw = self._get_raw_character_dict()
        if value is None:
            raw.pop("_num_ctx", None)
        else:
            raw["_num_ctx"] = value
        self.character = json.dumps(raw)

    def get_character(self) -> dict:
        raw = self._get_raw_character_dict()
        return {k: v for k, v in raw.items() if k != "_num_ctx"}

    def set_character(self, char_dict: dict):
        current_ctx = self.num_ctx
        new_dict = dict(char_dict) if isinstance(char_dict, dict) else {}
        if current_ctx is not None:
            new_dict["_num_ctx"] = current_ctx
        self.character = json.dumps(new_dict)

    def to_dict(self):
        m_name = None
        if self.model_ref and self.model_ref.model_id:
            m_name = self.model_ref.model_id
        elif self.model_id:
            try:
                im = InstanceModel.query.get(self.model_id)
                if im and im.model_id:
                    m_name = im.model_id
                else:
                    m_name = self.model_id
            except Exception:
                m_name = self.model_id

        # If m_name is an internal ID, recursively resolve to clean physical model name
        if m_name and is_internal_id(m_name):
            try:
                im_sub = InstanceModel.query.get(m_name)
                if im_sub and im_sub.model_id and not is_internal_id(im_sub.model_id):
                    m_name = im_sub.model_id
                else:
                    pref_sub = ModelPreferences.query.get(m_name)
                    if pref_sub and pref_sub.id != self.id:
                        pref_sub_dict = pref_sub.to_dict()
                        if pref_sub_dict.get("model_name") and not is_internal_id(pref_sub_dict["model_name"]):
                            m_name = pref_sub_dict["model_name"]
            except Exception:
                pass

        char_dict = self.get_character() or {}
        char_name = char_dict.get("name") if isinstance(char_dict, dict) else None

        return {"id": self.id,
                "name": char_name or m_name or self.id,
                "instance_id": self.instance_id,
                "model_id": self.model_id,
                "model_name": m_name,
                "picture": self.picture,
                "voice": self.voice,
                "num_ctx": self.num_ctx,
                "character": char_dict}


class Preference(db.Model):
    __tablename__ = "preference"

    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.Text, nullable=True)

    def get_value(self):
        try:
            return json.loads(self.value) if self.value is not None else None
        except Exception:
            return self.value

    def set_value(self, val):
        self.value = json.dumps(val)

    def to_dict(self):
        return {"key": self.key,
                "value": self.get_value()}


class PinSession(db.Model):
    __tablename__ = "pin_session"

    id = db.Column(db.String, primary_key=True)
    created_at = db.Column(
        db.String,
        nullable=False,
        default=current_alpaca_timestamp,
    )
    expires_at = db.Column(db.Float, nullable=False)

    def is_valid(self) -> bool:
        return time.time() < self.expires_at

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "is_valid": self.is_valid(),
        }

