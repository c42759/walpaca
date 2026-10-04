import json
import logging
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask  # noqa: E402
from utils.logger import (  # noqa: E402
    StructuredJSONFormatter,
    get_request_id,
    get_traced_headers,
    init_logging_middleware,
    redact_data,
    set_request_id,
)


class TestStructuredLogging(unittest.TestCase):
    def tearDown(self):
        set_request_id(None)

    def test_json_formatter_base_fields(self):
        formatter = StructuredJSONFormatter(service_name="test-service", environment="test")
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="/path/to/test_file.py",
            lineno=42,
            msg="User %s logged in",
            args=("alice",),
            exc_info=None,
        )
        set_request_id("trace-id-abc12345")
        formatted = formatter.format(record)
        data = json.loads(formatted)

        self.assertEqual(data["level"], "INFO")
        self.assertEqual(data["service"], "test-service")
        self.assertEqual(data["environment"], "test")
        self.assertEqual(data["logger"], "test.logger")
        self.assertEqual(data["message"], "User alice logged in")
        self.assertEqual(data["requestId"], "trace-id-abc12345")
        self.assertTrue(data["timestamp"].endswith("Z"))

    def test_pii_and_secret_redaction(self):
        sensitive_payload = {
            "username": "admin",
            "password": "supersecretpassword",
            "api_key": "sk-1234567890abcdef1234567890",
            "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
            "nested": {
                "token": "secret-token-value",
                "credit_card": "4111 2222 3333 4444",
                "safe_note": "Contains sk-1234567890abcdef1234567890 inside plaintext string",
            },
        }

        sanitized = redact_data(sensitive_payload)

        self.assertEqual(sanitized["username"], "admin")
        self.assertEqual(sanitized["password"], "[REDACTED]")
        self.assertEqual(sanitized["api_key"], "[REDACTED]")
        self.assertEqual(sanitized["authorization"], "[REDACTED]")
        self.assertEqual(sanitized["nested"]["token"], "[REDACTED]")
        self.assertEqual(sanitized["nested"]["credit_card"], "[REDACTED]")
        self.assertIn("[REDACTED_API_KEY]", sanitized["nested"]["safe_note"])
        self.assertNotIn("sk-1234567890abcdef1234567890", sanitized["nested"]["safe_note"])

    def test_exception_serialization(self):
        formatter = StructuredJSONFormatter(service_name="test-service", environment="test")
        try:
            raise ValueError("Invalid configuration parameter")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test.logger",
            level=logging.ERROR,
            pathname="/path/to/test_file.py",
            lineno=99,
            msg="An error occurred",
            args=(),
            exc_info=exc_info,
        )

        formatted = formatter.format(record)
        data = json.loads(formatted)

        self.assertEqual(data["level"], "ERROR")
        self.assertIn("exception", data)
        self.assertEqual(data["exception"]["type"], "ValueError")
        self.assertEqual(data["exception"]["message"], "Invalid configuration parameter")
        self.assertIn("Traceback", data["exception"]["stacktrace"])

    def test_middleware_request_id_lifecycle(self):
        app = Flask(__name__)
        init_logging_middleware(app)

        @app.route("/test-endpoint", methods=["GET"])
        def test_endpoint():
            return {"active_request_id": get_request_id()}

        client = app.test_client()

        # 1. Custom Request ID passed via header
        res1 = client.get("/test-endpoint", headers={"X-Request-ID": "custom-uuid-888"})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.headers.get("X-Request-ID"), "custom-uuid-888")
        self.assertEqual(res1.get_json()["active_request_id"], "custom-uuid-888")

        # Context variable should be reset after teardown
        self.assertIsNone(get_request_id())

        # 2. No Request ID passed -> Auto-generated
        res2 = client.get("/test-endpoint")
        self.assertEqual(res2.status_code, 200)
        generated_id = res2.headers.get("X-Request-ID")
        self.assertIsNotNone(generated_id)
        self.assertGreaterEqual(len(generated_id), 16)
        self.assertEqual(res2.get_json()["active_request_id"], generated_id)

    def test_get_traced_headers(self):
        set_request_id("outbound-trace-777")
        base_headers = {"Accept": "application/json"}
        traced = get_traced_headers(base_headers)

        self.assertEqual(traced["Accept"], "application/json")
        self.assertEqual(traced["X-Request-ID"], "outbound-trace-777")


if __name__ == "__main__":
    unittest.main()
