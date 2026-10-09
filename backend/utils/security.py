import secrets
import time
from collections import defaultdict
from werkzeug.security import check_password_hash, generate_password_hash

# In-memory failed attempts tracker: client_ip -> list of failure timestamps
_failed_attempts = defaultdict(list)
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 30


def hash_pin(pin: str) -> str:
    """Securely hash a PIN string using PBKDF2-SHA256."""
    return generate_password_hash(str(pin), method="pbkdf2:sha256")


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify raw PIN against stored hash."""
    if not pin or not pin_hash:
        return False
    return check_password_hash(pin_hash, str(pin))


def generate_session_token() -> str:
    """Generate cryptographically secure session token."""
    return secrets.token_hex(32)


def check_rate_limit(client_id: str) -> tuple[bool, int]:
    """
    Check if a client is temporarily locked out due to repeated failed attempts.
    Returns (is_allowed, remaining_seconds).
    """
    now = time.time()
    attempts = [t for t in _failed_attempts[client_id] if now - t < LOCKOUT_DURATION_SECONDS]
    _failed_attempts[client_id] = attempts

    if len(attempts) >= MAX_FAILED_ATTEMPTS:
        oldest_attempt = attempts[0]
        remaining = int(LOCKOUT_DURATION_SECONDS - (now - oldest_attempt))
        return False, max(1, remaining)

    return True, 0


def record_failed_attempt(client_id: str):
    """Record a failed PIN entry timestamp for the client."""
    _failed_attempts[client_id].append(time.time())


def reset_rate_limit(client_id: str):
    """Clear failed attempts on successful verification."""
    _failed_attempts.pop(client_id, None)
