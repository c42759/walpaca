import time
from flask import Blueprint, request, jsonify
from models import db, Preference, PinSession
from utils.security import (
    hash_pin,
    verify_pin,
    generate_session_token,
    check_rate_limit,
    record_failed_attempt,
    reset_rate_limit,
)

auth_bp = Blueprint("auth", __name__)

SESSION_COOKIE_NAME = "walpaca_session"
SESSION_DURATION_SECONDS = 86400 * 30  # 30 days


def get_session_token_from_request() -> str | None:
    """Extract session token from cookie, Authorization header, or custom header."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        return token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    custom_header = request.headers.get("X-Walpaca-Session")
    if custom_header:
        return custom_header.strip()

    return None


def is_pin_security_enabled() -> bool:
    """Check if PIN security toggle is enabled."""
    pref = db.session.get(Preference, "pin_security_enabled")
    return bool(pref and pref.get_value() is True)


def get_pin_hash() -> str | None:
    """Retrieve stored PIN hash."""
    pref = db.session.get(Preference, "pin_hash")
    return pref.get_value() if pref else None


def set_preference_value(key: str, val):
    """Create or update a preference entry."""
    pref = db.session.get(Preference, key)
    if not pref:
        pref = Preference(key=key)
        db.session.add(pref)
    pref.set_value(val)


@auth_bp.route("/status", methods=["GET"])
def auth_status():
    """Return whether PIN security is enabled and if current session is authenticated."""
    pin_enabled = is_pin_security_enabled()
    if not pin_enabled:
        return jsonify({"pin_enabled": False, "authenticated": True})

    token = get_session_token_from_request()
    if token:
        sess = db.session.get(PinSession, token)
        if sess and sess.is_valid():
            return jsonify({"pin_enabled": True, "authenticated": True})
        elif sess and not sess.is_valid():
            db.session.delete(sess)
            db.session.commit()

    return jsonify({"pin_enabled": True, "authenticated": False})


@auth_bp.route("/verify", methods=["POST"])
def verify_pin_route():
    """Verify user PIN and issue session cookie."""
    client_ip = request.remote_addr or "127.0.0.1"
    is_allowed, remaining = check_rate_limit(client_ip)
    if not is_allowed:
        return jsonify({
            "error": f"Too many failed attempts. Please wait {remaining} seconds.",
            "lockout": True,
            "remaining_seconds": remaining,
        }), 429

    data = request.json or {}
    pin = data.get("pin", "")
    pin_hash = get_pin_hash()

    if not pin_hash:
        return jsonify({"error": "PIN security is not configured."}), 400

    if not verify_pin(pin, pin_hash):
        record_failed_attempt(client_ip)
        return jsonify({"error": "Invalid PIN", "authenticated": False}), 401

    reset_rate_limit(client_ip)
    token = generate_session_token()
    expires_at = time.time() + SESSION_DURATION_SECONDS
    session_row = PinSession(id=token, expires_at=expires_at)
    db.session.add(session_row)
    db.session.commit()

    resp = jsonify({"success": True, "authenticated": True, "token": token})
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        samesite="Lax",
        path="/",
        max_age=SESSION_DURATION_SECONDS,
    )
    return resp


@auth_bp.route("/setup", methods=["POST"])
def setup_pin_route():
    """Set or update PIN security configuration."""
    data = request.json or {}
    new_pin = data.get("pin", "")
    current_pin = data.get("current_pin", "")

    if is_pin_security_enabled():
        current_hash = get_pin_hash()
        if not current_hash or not verify_pin(current_pin, current_hash):
            return jsonify({"error": "Current PIN is incorrect"}), 401

    if not new_pin or len(str(new_pin).strip()) < 4:
        return jsonify({"error": "PIN must be at least 4 characters/digits"}), 400

    hashed = hash_pin(str(new_pin).strip())
    set_preference_value("pin_hash", hashed)
    set_preference_value("pin_security_enabled", True)

    # Invalidate old sessions
    PinSession.query.delete()

    # Create new session token for the current client
    token = generate_session_token()
    expires_at = time.time() + SESSION_DURATION_SECONDS
    session_row = PinSession(id=token, expires_at=expires_at)
    db.session.add(session_row)
    db.session.commit()

    resp = jsonify({"success": True, "pin_enabled": True, "authenticated": True, "token": token})
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        samesite="Lax",
        path="/",
        max_age=SESSION_DURATION_SECONDS,
    )
    return resp


@auth_bp.route("/disable", methods=["POST"])
def disable_pin_route():
    """Disable PIN security upon verifying current PIN."""
    data = request.json or {}
    current_pin = data.get("current_pin", "")

    if is_pin_security_enabled():
        current_hash = get_pin_hash()
        if current_hash and not verify_pin(current_pin, current_hash):
            return jsonify({"error": "Current PIN is incorrect"}), 401

    set_preference_value("pin_security_enabled", False)
    PinSession.query.delete()
    db.session.commit()

    resp = jsonify({"success": True, "pin_enabled": False, "authenticated": True})
    resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return resp


@auth_bp.route("/logout", methods=["POST"])
def logout_route():
    """Revoke active session token and clear cookie."""
    token = get_session_token_from_request()
    if token:
        sess = db.session.get(PinSession, token)
        if sess:
            db.session.delete(sess)
            db.session.commit()

    resp = jsonify({"success": True, "authenticated": False})
    resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return resp
