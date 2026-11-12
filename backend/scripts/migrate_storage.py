"""Idempotent migration script to move inline avatars and attachments from DB/JSON to storage/."""

import os
import sys
import json

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import create_app
from models import Attachment, Message, ModelPreferences, db
from routes.personas import get_personas_dir
from utils.storage import (
    get_storage_dir,
    is_file_backed_attachment,
    normalize_character_avatars,
    persist_avatar_if_inline,
    save_chat_attachment_file,
)


def _migrate_personas_dir(stats: dict) -> None:
    """Persist inline base64/data-URI avatars in personas/*.json to storage/avatars/."""
    personas_dir = get_personas_dir()
    if not os.path.isdir(personas_dir):
        return

    for fname in sorted(os.listdir(personas_dir)):
        if not fname.endswith(".json"):
            continue
        file_path = os.path.join(personas_dir, fname)
        if not os.path.isfile(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed reading persona {fname}: {e}")
            continue

        if not isinstance(data, dict):
            continue

        changed = False
        if data.get("picture"):
            new_pic = persist_avatar_if_inline(data["picture"])
            if new_pic != data["picture"]:
                data["picture"] = new_pic
                changed = True

        if isinstance(data.get("character"), dict):
            norm_char = normalize_character_avatars(data["character"])
            if norm_char != data["character"]:
                data["character"] = norm_char
                changed = True

        if changed:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            stats["personas_migrated"] += 1


def _resolve_sqlite_path(uri: str) -> str | None:
    if isinstance(uri, str) and uri.startswith("sqlite:///"):
        path = uri[len("sqlite:///"):]
        if path and path != ":memory:":
            return path
    return None


def migrate_storage() -> dict:
    """Run idempotent storage migration for personas, model_preferences, and attachments."""
    stats = {
        "personas_migrated": 0,
        "model_pref_pictures_migrated": 0,
        "model_pref_chars_migrated": 0,
        "attachments_migrated": 0,
        "attachment_bytes_written": 0,
        "db_size_before": None,
        "db_size_after": None,
    }

    app = create_app()
    _migrate_personas_dir(stats)

    with app.app_context():
        get_storage_dir()
        db_file = _resolve_sqlite_path(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
        if db_file and os.path.isfile(db_file):
            stats["db_size_before"] = os.path.getsize(db_file)

        # Ensure attachment.file_path column exists
        with db.engine.connect() as conn:
            res_att = conn.execute(db.text("PRAGMA table_info(attachment)")).fetchall()
            att_cols = [r[1] for r in res_att]
            if "file_path" not in att_cols and res_att:
                conn.execute(db.text("ALTER TABLE attachment ADD COLUMN file_path TEXT"))
                conn.commit()

        # Migrate ModelPreferences avatars
        for pref in ModelPreferences.query.all():
            if pref.picture:
                new_pic = persist_avatar_if_inline(pref.picture)
                if new_pic != pref.picture:
                    pref.picture = new_pic
                    stats["model_pref_pictures_migrated"] += 1

            raw_char = pref._get_raw_character_dict()
            if raw_char:
                norm_char = normalize_character_avatars(raw_char)
                if norm_char != raw_char:
                    pref.character = json.dumps(norm_char)
                    stats["model_pref_chars_migrated"] += 1

        # Migrate file-backed Attachment rows
        pending_atts = Attachment.query.filter(Attachment.file_path.is_(None)).all()
        for att in pending_atts:
            if not is_file_backed_attachment(att.type, att.content):
                continue
            msg = db.session.get(Message, att.message_id)
            chat_id = msg.chat_id if msg else "orphan"
            rel_path, size_bytes = save_chat_attachment_file(
                chat_id, att.id, att.type, att.name, att.content
            )
            att.file_path = rel_path
            att.content = ""
            stats["attachments_migrated"] += 1
            stats["attachment_bytes_written"] += size_bytes

        db.session.commit()

        if db_file and os.path.isfile(db_file):
            with db.engine.connect().execution_options(
                isolation_level="AUTOCOMMIT"
            ) as conn:
                conn.execute(db.text("VACUUM"))
            stats["db_size_after"] = os.path.getsize(db_file)

    print("Storage Migration Summary:")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    return stats


if __name__ == "__main__":
    migrate_storage()
