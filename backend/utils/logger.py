import atexit
import contextvars
import datetime
import json
import logging
import logging.handlers
import os
import queue
import re
import sys
import time
import uuid
from typing import Any, Dict, Optional

# Context variable for request correlation across threads/tasks
request_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)

SENSITIVE_KEYS = {
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "api_key",
    "apikey",
    "key",
    "cookie",
    "set-cookie",
    "credit_card",
    "card_number",
    "cvv",
    "ssn",
    "private_key",
}

SENSITIVE_PATTERNS = [
    (re.compile(r"Bearer\s+([A-Za-z0-9\-._~+/]+=*)", re.IGNORECASE), "Bearer [REDACTED]"),
    (re.compile(r"sk-[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_API_KEY]"),
    (re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"), "[REDACTED_CARD]"),
]


def redact_data(val: Any) -> Any:
    """Recursively mask sensitive keys and pattern matches in dictionaries, lists, or strings."""
    if isinstance(val, dict):
        cleaned = {}
        for k, v in val.items():
            if str(k).lower() in SENSITIVE_KEYS:
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = redact_data(v)
        return cleaned
    elif isinstance(val, (list, tuple, set)):
        return [redact_data(item) for item in val]
    elif isinstance(val, str):
        masked = val
        for pattern, replacement in SENSITIVE_PATTERNS:
            masked = pattern.sub(replacement, masked)
        return masked
    return val


def get_request_id() -> Optional[str]:
    """Return active request ID from contextvars."""
    return request_id_var.get()


def set_request_id(req_id: Optional[str]) -> None:
    """Set active request ID in contextvars."""
    request_id_var.set(req_id)


class StructuredJSONFormatter(logging.Formatter):
    """Formats standard LogRecord instances into structured JSON objects."""

    def __init__(self, service_name: str, environment: str):
        super().__init__()
        self.service_name = service_name
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        try:
            timestamp = datetime.datetime.fromtimestamp(record.created, tz=datetime.timezone.utc).isoformat(
                timespec="milliseconds"
            )
            if timestamp.endswith("+00:00"):
                timestamp = timestamp[:-6] + "Z"

            log_payload: Dict[str, Any] = {
                "timestamp": timestamp,
                "level": record.levelname,
                "service": self.service_name,
                "environment": self.environment,
                "logger": record.name,
                "message": redact_data(record.getMessage()),
            }

            req_id = get_request_id()
            if req_id:
                log_payload["requestId"] = req_id

            is_dev = self.environment.lower() in ("development", "dev", "local")
            if is_dev or record.levelno >= logging.WARNING:
                log_payload["source"] = {
                    "file": record.pathname,
                    "line": record.lineno,
                    "function": record.funcName,
                }

            if record.exc_info:
                log_payload["exception"] = {
                    "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                    "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                    "stacktrace": self.formatException(record.exc_info),
                }

            standard_attrs = {
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message"
            }

            extras = {
                k: redact_data(v)
                for k, v in record.__dict__.items()
                if k not in standard_attrs and not k.startswith("_")
            }
            if extras:
                log_payload["extra"] = extras

            return json.dumps(log_payload, default=str)
        except Exception as e:
            # Fallback safe serialization if formatting encounters an issue
            return json.dumps({
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "level": "ERROR",
                "service": self.service_name,
                "environment": self.environment,
                "logger": "utils.logger",
                "message": f"Failed to serialize log message: {e}",
                "original_message": str(record.msg),
            })


_listener: Optional[logging.handlers.QueueListener] = None


def setup_logging(app=None, log_level: Optional[str] = None) -> None:
    """Initializes root logger with non-blocking QueueHandler and QueueListener streaming JSON to sys.stdout."""
    global _listener

    if _listener is not None:
        return

    level_name = log_level or os.getenv("LOG_LEVEL", "INFO").upper()
    resolved_level = getattr(logging, level_name, logging.INFO)
    service_name = os.getenv("SERVICE_NAME", "walpaca-backend")
    environment = os.getenv("FLASK_ENV", os.getenv("ENVIRONMENT", "production"))

    stdout_stream = logging.StreamHandler(sys.stdout)
    stdout_stream.setFormatter(StructuredJSONFormatter(service_name=service_name, environment=environment))

    log_queue: queue.SimpleQueue = queue.SimpleQueue()
    queue_handler = logging.handlers.QueueHandler(log_queue)

    root_logger = logging.getLogger()
    root_logger.setLevel(resolved_level)
    root_logger.handlers = [queue_handler]

    _listener = logging.handlers.QueueListener(log_queue, stdout_stream, respect_handler_level=True)
    _listener.start()
    atexit.register(_listener.stop)

    # Minimize noisy werkzeug text logs in favor of structured HTTP access logs
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    if app is not None:
        app.logger.handlers = [queue_handler]
        app.logger.setLevel(resolved_level)


def init_logging_middleware(app) -> None:
    """Attaches request correlation ID tracking and structured HTTP metrics to Flask app."""
    from flask import g, request

    setup_logging(app)
    app_logger = logging.getLogger("walpaca.http")

    @app.before_request
    def before_request_tracking():
        correlation_id = (
            request.headers.get("X-Request-ID")
            or request.headers.get("X-Correlation-ID")
            or uuid.uuid4().hex
        )
        set_request_id(correlation_id)
        g.request_id = correlation_id
        g.request_start_time = time.perf_counter()

    @app.after_request
    def after_request_tracking(response):
        req_id = getattr(g, "request_id", get_request_id())
        if req_id:
            response.headers["X-Request-ID"] = req_id

        start_time = getattr(g, "request_start_time", None)
        duration_ms = (
            round((time.perf_counter() - start_time) * 1000, 2)
            if start_time is not None
            else None
        )

        status_code = response.status_code
        level = logging.INFO
        if status_code >= 500:
            level = logging.ERROR
        elif status_code >= 400:
            level = logging.WARN

        query_dict = request.args.to_dict()

        app_logger.log(
            level,
            f"HTTP {request.method} {request.path} {status_code}",
            extra={
                "http": {
                    "method": request.method,
                    "path": request.path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "remote_addr": request.remote_addr,
                    "query_params": redact_data(query_dict) if query_dict else None,
                }
            },
        )
        return response

    @app.teardown_request
    def teardown_request_cleanup(_exception=None):
        set_request_id(None)


def get_traced_headers(headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Inject current correlation ID into outgoing HTTP headers for distributed tracing."""
    hdrs = dict(headers or {})
    req_id = get_request_id()
    if req_id:
        hdrs["X-Request-ID"] = req_id
    return hdrs
