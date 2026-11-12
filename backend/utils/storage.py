import os
import re
import copy
import json
import shutil
import base64
import hashlib
import tempfile
import mimetypes

from flask import current_app, has_app_context

INLINE_DB_ATTACHMENT_TYPES = {"metadata", "data", "thought", "brain", "tool"}

IMAGE_TYPES = {"image", "png", "jpg", "jpeg", "webp", "gif", "bmp"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
AUDIO_TYPES = {"audio", "mp3", "wav", "ogg", "m4a", "flac", "aac", "webm"}
AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}
VIDEO_TYPES = {"video", "mp4"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}

MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
    "application/json": "json",
    "text/plain": "txt",
    "text/csv": "csv",
    "text/markdown": "md",
}

EXT_TO_MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
}

_DATA_URI_RE = re.compile(
    r"^data:([a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+)?(?:;[^,]*)?;base64,(.+)$",
    re.IGNORECASE | re.DOTALL,
)


def get_storage_dir() -> str:
    """Return the resolved root storage directory, creating it if needed."""
    if has_app_context() and current_app.config.get("STORAGE_DIR_PATH"):
        target = current_app.config["STORAGE_DIR_PATH"]
    elif os.getenv("STORAGE_DIR_PATH"):
        target = os.getenv("STORAGE_DIR_PATH")
    elif os.path.isdir("/app/storage"):
        target = "/app/storage"
    else:
        target = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "storage")
        )
    target = os.path.abspath(target)
    os.makedirs(target, exist_ok=True)
    return target


def get_avatars_dir() -> str:
    """Return the avatars storage directory, creating it if needed."""
    avatars_dir = os.path.abspath(os.path.join(get_storage_dir(), "avatars"))
    os.makedirs(avatars_dir, exist_ok=True)
    return avatars_dir


def sanitize_chat_id(chat_id) -> str:
    """Sanitize a chat_id into a safe single directory name."""
    raw = "" if chat_id is None else str(chat_id)
    safe = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw)
    if not safe or safe in (".", ".."):
        return "default"
    return safe


def get_chat_storage_dir(chat_id, create: bool = True) -> str:
    """Return the traversal-validated storage directory for a chat."""
    chats_root = os.path.abspath(os.path.join(get_storage_dir(), "chats"))
    if create:
        os.makedirs(chats_root, exist_ok=True)
    safe_chat_id = sanitize_chat_id(chat_id)
    target = os.path.abspath(os.path.join(chats_root, safe_chat_id))
    if os.path.commonpath([chats_root, target]) != chats_root or target == chats_root:
        raise ValueError(f"Unsafe chat storage path for chat_id={chat_id!r}")
    if create:
        os.makedirs(target, exist_ok=True)
    return target


def is_file_backed_attachment(att_type: str | None, content=None) -> bool:
    """Return True if the attachment should be stored as a disk file instead of inline DB text."""
    normalized_type = (att_type or "").strip().lower()
    if normalized_type not in INLINE_DB_ATTACHMENT_TYPES:
        return True
    if isinstance(content, str) and content.strip().startswith(
        ("data:image/", "data:audio/", "data:video/")
    ):
        return True
    return False


def _mime_to_ext(mime: str, default_ext: str = "bin") -> str:
    clean_mime = (mime or "").split(";")[0].strip().lower()
    if clean_mime in MIME_TO_EXT:
        return MIME_TO_EXT[clean_mime]
    guessed = mimetypes.guess_extension(clean_mime)
    if guessed:
        return guessed.lstrip(".").lower()
    return default_ext


def decode_media_payload(value, default_mime: str = "image/png"):
    """Decode a data: URI or known raw base64 media payload into (raw_bytes, ext, mime) or None."""
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None

    match = _DATA_URI_RE.match(s)
    if match:
        mime = (match.group(1) or default_mime).strip().lower()
        b64_data = re.sub(r"\s+", "", match.group(2))
        if not b64_data:
            return None
        try:
            raw_bytes = base64.b64decode(b64_data)
        except Exception:
            return None
        if not raw_bytes:
            return None
        ext = _mime_to_ext(mime, default_ext="png" if mime.startswith("image/") else "bin")
        return raw_bytes, ext, mime

    s_clean = re.sub(r"\s+", "", s)
    sig_ext = None
    sig_mime = None
    if s_clean.startswith("iVBORw0KGgo"):
        sig_ext, sig_mime = "png", "image/png"
    elif s_clean.startswith("/9j/"):
        sig_ext, sig_mime = "jpg", "image/jpeg"
    elif s_clean.startswith("R0lGOD"):
        sig_ext, sig_mime = "gif", "image/gif"
    elif s_clean.startswith("UklGR"):
        sig_ext, sig_mime = "webp", "image/webp"
    elif s_clean.startswith("AAAA") and "ZnR5c" in s_clean[:24]:
        sig_ext, sig_mime = "mp4", "video/mp4"

    if sig_ext and sig_mime:
        try:
            raw_bytes = base64.b64decode(s_clean)
        except Exception:
            return None
        if not raw_bytes:
            return None
        return raw_bytes, sig_ext, sig_mime

    return None


def detect_avatar_mime_and_ext(
    raw_bytes: bytes, filename: str | None = None, content_type: str | None = None
) -> tuple[str, str] | None:
    """Detect supported avatar (mime, ext) from magic bytes, content_type, or filename."""
    if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if raw_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if raw_bytes.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif", "gif"
    if len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP":
        return "image/webp", "webp"
    if len(raw_bytes) >= 8 and raw_bytes[4:8] == b"ftyp":
        return "video/mp4", "mp4"

    ct = (content_type or "").split(";")[0].strip().lower()
    fname_ext = os.path.splitext(filename or "")[1].lower()
    if ct == "video/mp4" or fname_ext == ".mp4":
        return "video/mp4", "mp4"
    if ct in ("image/jpeg", "image/jpg") or fname_ext in (".jpg", ".jpeg"):
        return "image/jpeg", "jpg"
    if ct == "image/webp" or fname_ext == ".webp":
        return "image/webp", "webp"
    if ct == "image/gif" or fname_ext == ".gif":
        return "image/gif", "gif"
    if ct == "image/png" or fname_ext == ".png" or ct.startswith("image/"):
        return "image/png", "png"
    return None


def _atomic_write_bytes(target_path: str, raw_bytes: bytes) -> None:
    """Write bytes atomically into the target directory with 0o644 permissions."""
    target_dir = os.path.dirname(target_path)
    fd, tmp_path = tempfile.mkstemp(dir=target_dir, prefix=".tmp_")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw_bytes)
        os.chmod(tmp_path, 0o644)
        os.replace(tmp_path, target_path)
    except Exception:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass
        raise


def save_avatar_bytes(raw_bytes: bytes, ext: str) -> str:
    """Store avatar bytes content-addressed in avatars/ and return /api/avatars/<filename>."""
    clean_ext = re.sub(r"[^a-z0-9]", "", (ext or "").lower().lstrip(".")) or "png"
    if clean_ext == "jpeg":
        clean_ext = "jpg"
    digest = hashlib.sha256(raw_bytes).hexdigest()[:16]
    filename = f"avatar_{digest}.{clean_ext}"
    avatars_dir = get_avatars_dir()
    target_path = os.path.abspath(os.path.join(avatars_dir, filename))
    if os.path.commonpath([avatars_dir, target_path]) != avatars_dir:
        raise ValueError("Invalid avatar path")
    if not os.path.exists(target_path):
        _atomic_write_bytes(target_path, raw_bytes)
    return f"/api/avatars/{filename}"


def persist_avatar_if_inline(picture):
    """Convert inline data URI or base64 avatar string to a /api/avatars/... URL."""
    if not picture:
        return None
    if not isinstance(picture, str):
        return picture
    trimmed = picture.strip()
    if not trimmed:
        return None
    if trimmed.startswith(("/api/", "http://", "https://", "/icon-")):
        return trimmed
    decoded = decode_media_payload(trimmed)
    if decoded:
        raw_bytes, ext, _ = decoded
        return save_avatar_bytes(raw_bytes, ext)
    return picture


def normalize_character_avatars(character) -> dict:
    """Deep-copy a character dict/JSON and persist any inline picture/avatar fields to disk."""
    if isinstance(character, str):
        try:
            parsed = json.loads(character)
        except Exception:
            return {}
    elif isinstance(character, dict):
        parsed = character
    else:
        return {}

    if not isinstance(parsed, dict):
        return {}

    out = copy.deepcopy(parsed)
    for key in ("picture", "avatar"):
        if out.get(key):
            out[key] = persist_avatar_if_inline(out[key])

    if isinstance(out.get("data"), dict):
        for key in ("picture", "avatar"):
            if out["data"].get(key):
                out["data"][key] = persist_avatar_if_inline(out["data"][key])

    return out


def _sanitize_attachment_filename(name: str | None, att_type: str | None, ext_hint: str | None) -> str:
    base_name = os.path.basename(str(name or "attachment").strip()) or "attachment"
    safe_name = re.sub(r"[^a-zA-Z0-9._\-]", "_", base_name).lstrip(".")
    if not safe_name:
        safe_name = "attachment"

    _stem, existing_ext = os.path.splitext(safe_name)
    if not existing_ext:
        norm_type = (att_type or "").strip().lower()
        if ext_hint:
            safe_name = f"{safe_name}.{ext_hint.lstrip('.')}"
        elif norm_type in ("image", "png"):
            safe_name = f"{safe_name}.png"
        elif norm_type in (
            "jpg",
            "jpeg",
            "webp",
            "gif",
            "mp3",
            "wav",
            "ogg",
            "mp4",
            "webm",
            "pdf",
            "csv",
            "json",
            "md",
        ):
            safe_name = f"{safe_name}.{norm_type}"
        else:
            safe_name = f"{safe_name}.txt"
    return safe_name


def save_chat_attachment_file(
    chat_id, att_id: str, att_type: str | None, name: str | None, content
) -> tuple[str, int]:
    """Persist a chat attachment payload to disk and return (rel_path, size_bytes)."""
    chat_dir = get_chat_storage_dir(chat_id, create=True)
    safe_chat_id = os.path.basename(chat_dir)
    safe_att_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(att_id or "att")) or "att"

    ext_hint = None
    norm_type = (att_type or "").strip().lower()

    if isinstance(content, (bytes, bytearray)):
        raw_bytes = bytes(content)
    else:
        content_str = "" if content is None else str(content)
        decoded = decode_media_payload(content_str)
        if decoded:
            raw_bytes, ext_hint, _ = decoded
        elif norm_type in IMAGE_TYPES | AUDIO_TYPES | VIDEO_TYPES and content_str.strip():
            b64_candidate = re.sub(r"\s+", "", content_str)
            try:
                raw_bytes = base64.b64decode(b64_candidate, validate=True)
                if not raw_bytes:
                    raw_bytes = content_str.encode("utf-8")
            except Exception:
                raw_bytes = content_str.encode("utf-8")
        else:
            raw_bytes = content_str.encode("utf-8")

    safe_name = _sanitize_attachment_filename(name, att_type, ext_hint)
    filename = f"{safe_att_id}_{safe_name}"
    target_path = os.path.abspath(os.path.join(chat_dir, filename))
    if os.path.commonpath([chat_dir, target_path]) != chat_dir or target_path == chat_dir:
        raise ValueError(f"Unsafe attachment path for chat_id={chat_id!r}, att_id={att_id!r}")

    _atomic_write_bytes(target_path, raw_bytes)
    rel_path = f"chats/{safe_chat_id}/{filename}"
    return rel_path, len(raw_bytes)


def resolve_storage_file(rel_path: str | None) -> str | None:
    """Resolve a storage-relative path safely, returning its absolute path if it exists."""
    if not rel_path or not isinstance(rel_path, str):
        return None
    storage_root = os.path.abspath(get_storage_dir())
    candidate = os.path.abspath(os.path.join(storage_root, rel_path))
    if os.path.commonpath([storage_root, candidate]) != storage_root or candidate == storage_root:
        return None
    return candidate if os.path.isfile(candidate) else None


def copy_chat_attachment_file(
    src_rel_path: str | None, target_chat_id, new_att_id: str, name: str | None
) -> str | None:
    """Copy an existing chat attachment file into target_chat_id's directory."""
    src_abs = resolve_storage_file(src_rel_path)
    if not src_abs:
        return None

    chat_dir = get_chat_storage_dir(target_chat_id, create=True)
    safe_chat_id = os.path.basename(chat_dir)
    safe_att_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(new_att_id or "att")) or "att"
    src_ext = os.path.splitext(src_abs)[1].lstrip(".")
    safe_name = _sanitize_attachment_filename(name, None, src_ext or None)
    filename = f"{safe_att_id}_{safe_name}"
    target_path = os.path.abspath(os.path.join(chat_dir, filename))
    if os.path.commonpath([chat_dir, target_path]) != chat_dir or target_path == chat_dir:
        return None

    with open(src_abs, "rb") as f:
        raw_bytes = f.read()
    _atomic_write_bytes(target_path, raw_bytes)
    return f"chats/{safe_chat_id}/{filename}"


def delete_storage_file(rel_path: str | None) -> None:
    """Delete a file inside the storage root if it exists."""
    target = resolve_storage_file(rel_path)
    if target:
        try:
            os.remove(target)
        except FileNotFoundError:
            pass


def delete_chat_storage_dir(chat_id) -> None:
    """Delete the entire storage directory for a chat if it exists."""
    chats_root = os.path.abspath(os.path.join(get_storage_dir(), "chats"))
    if not os.path.isdir(chats_root):
        return
    try:
        target = get_chat_storage_dir(chat_id, create=False)
    except ValueError:
        return
    if os.path.commonpath([chats_root, target]) != chats_root or target == chats_root:
        return
    if os.path.isdir(target):
        shutil.rmtree(target, ignore_errors=True)


def infer_attachment_mimetype(name: str | None, file_path: str | None, att_type: str | None) -> str:
    """Infer a sensible HTTP MIME type for an attachment."""
    for candidate in (name, file_path):
        if candidate:
            ext = os.path.splitext(candidate)[1].lower()
            if ext in EXT_TO_MIME:
                return EXT_TO_MIME[ext]
            guessed, _ = mimetypes.guess_type(candidate)
            if guessed:
                return guessed

    norm_type = (att_type or "").strip().lower()
    type_map = {
        "image": "image/png",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "mp4": "video/mp4",
        "video": "video/mp4",
        "audio": "audio/mpeg",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "pdf": "application/pdf",
        "json": "application/json",
        "tool": "application/json",
        "csv": "text/csv; charset=utf-8",
        "md": "text/markdown; charset=utf-8",
        "markdown": "text/markdown; charset=utf-8",
        "plain_text": "text/plain; charset=utf-8",
        "text": "text/plain; charset=utf-8",
        "code": "text/plain; charset=utf-8",
    }
    return type_map.get(norm_type, "application/octet-stream")


def read_attachment_for_llm(att) -> dict:
    """Read an Attachment ORM instance or dict into an LLM-ready descriptor dict."""
    if isinstance(att, dict):
        att_type = (att.get("type") or "").strip().lower()
        att_name = att.get("name") or ""
        file_path = att.get("file_path")
        content = att.get("content")
        url = att.get("url")
    else:
        att_type = (getattr(att, "type", None) or "").strip().lower()
        att_name = getattr(att, "name", None) or ""
        file_path = getattr(att, "file_path", None)
        content = getattr(att, "content", None)
        url = None

    if not file_path and isinstance(att, dict):
        ref = None
        for candidate in (url, content):
            if isinstance(candidate, str) and candidate.strip().startswith("/api/attachments/"):
                ref = candidate.strip()
                break
        if ref and has_app_context():
            att_id = ref.split("/api/attachments/", 1)[1].split("?", 1)[0].strip("/")
            if att_id:
                from models import Attachment

                db_att = Attachment.query.get(att_id)
                if db_att:
                    file_path = db_att.file_path
                    if not att_type:
                        att_type = (db_att.type or "").strip().lower()
                    if not att_name:
                        att_name = db_att.name or ""
                    if not file_path and content == ref:
                        content = db_att.content

    ext = os.path.splitext(att_name or file_path or "")[1].lower()
    is_image = att_type in IMAGE_TYPES or ext in IMAGE_EXTS
    is_audio = att_type in AUDIO_TYPES or ext in AUDIO_EXTS

    if file_path:
        abs_path = resolve_storage_file(file_path)
        if not abs_path:
            return {"is_image": False, "is_audio": False, "text": None}
        with open(abs_path, "rb") as f:
            raw_bytes = f.read()
        if is_image:
            return {
                "is_image": True,
                "base64": base64.b64encode(raw_bytes).decode("utf-8"),
                "text": None,
            }
        if is_audio:
            return {"is_image": False, "is_audio": True, "text": None}
        return {
            "is_image": False,
            "is_audio": False,
            "text": raw_bytes.decode("utf-8", errors="replace"),
        }

    c_str = "" if content is None else str(content)
    if is_image or c_str.strip().startswith("data:image"):
        b64 = c_str.split(",", 1)[1] if (c_str.startswith("data:") and "," in c_str) else c_str.strip()
        return {"is_image": True, "base64": b64, "text": None}
    if is_audio or c_str.strip().startswith("data:audio"):
        return {"is_image": False, "is_audio": True, "text": None}
    return {"is_image": False, "is_audio": False, "text": c_str}
