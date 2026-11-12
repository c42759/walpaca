import os
import mimetypes

from flask import Blueprint, abort, send_from_directory

from utils.storage import get_avatars_dir

avatars_bp = Blueprint("avatars", __name__)

_AVATAR_MIME_MAP = {
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


@avatars_bp.route("/avatars/<path:filename>", methods=["GET"])
def serve_avatar(filename):
    """Serve persisted avatar media files with immutable caching headers."""
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        abort(400)

    safe_name = os.path.basename(filename)
    if not safe_name or safe_name in (".", ".."):
        abort(400)

    avatars_dir = get_avatars_dir()
    target = os.path.abspath(os.path.join(avatars_dir, safe_name))
    if os.path.commonpath([avatars_dir, target]) != avatars_dir or target == avatars_dir:
        abort(403)
    if not os.path.isfile(target):
        abort(404)

    ext = os.path.splitext(safe_name)[1].lower()
    mimetype = (
        _AVATAR_MIME_MAP.get(ext)
        or mimetypes.guess_type(safe_name)[0]
        or "application/octet-stream"
    )
    response = send_from_directory(avatars_dir, safe_name, mimetype=mimetype)
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response
