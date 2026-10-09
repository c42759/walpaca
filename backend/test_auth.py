import os
import unittest
import tempfile
import time

from main import create_app
from models import db, Preference, PinSession
from utils.security import reset_rate_limit, record_failed_attempt, check_rate_limit


class TestAuthAPI(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
        })
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_status_when_disabled(self):
        res = self.client.get("/api/auth/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["pin_enabled"])
        self.assertTrue(data["authenticated"])

    def test_setup_pin_and_verify(self):
        # 1. Setup new PIN
        res = self.client.post("/api/auth/setup", json={"pin": "1234"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["pin_enabled"])
        self.assertTrue(data["authenticated"])

        # 2. Status with session cookie from setup
        res = self.client.get("/api/auth/status")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["authenticated"])

        # 3. Status without session cookie
        clean_client = self.app.test_client()
        res_clean = clean_client.get("/api/auth/status")
        self.assertEqual(res_clean.status_code, 200)
        self.assertTrue(res_clean.get_json()["pin_enabled"])
        self.assertFalse(res_clean.get_json()["authenticated"])

        # 4. Protected endpoint rejected without session
        res_folders = clean_client.get("/api/folders")
        self.assertEqual(res_folders.status_code, 401)
        self.assertTrue(res_folders.get_json().get("auth_required"))

        # 5. Verify with invalid PIN
        res_invalid = clean_client.post("/api/auth/verify", json={"pin": "0000"})
        self.assertEqual(res_invalid.status_code, 401)

        # 6. Verify with valid PIN
        res_valid = clean_client.post("/api/auth/verify", json={"pin": "1234"})
        self.assertEqual(res_valid.status_code, 200)
        self.assertTrue(res_valid.get_json()["authenticated"])

        # 7. Protected endpoint allowed with session
        res_folders_authed = clean_client.get("/api/folders")
        self.assertEqual(res_folders_authed.status_code, 200)

    def test_rate_limiting(self):
        reset_rate_limit("test_client_ip")
        for _ in range(5):
            record_failed_attempt("test_client_ip")
        allowed, remaining = check_rate_limit("test_client_ip")
        self.assertFalse(allowed)
        self.assertGreater(remaining, 0)
        reset_rate_limit("test_client_ip")

    def test_disable_pin(self):
        # Setup PIN
        self.client.post("/api/auth/setup", json={"pin": "5678"})

        # Fail disable with wrong current PIN
        res_fail = self.client.post("/api/auth/disable", json={"current_pin": "wrong"})
        self.assertEqual(res_fail.status_code, 401)

        # Succeed disable with correct PIN
        res_ok = self.client.post("/api/auth/disable", json={"current_pin": "5678"})
        self.assertEqual(res_ok.status_code, 200)
        self.assertFalse(res_ok.get_json()["pin_enabled"])

        # Clean client can now access protected route without PIN
        clean_client = self.app.test_client()
        res_folders = clean_client.get("/api/folders")
        self.assertEqual(res_folders.status_code, 200)

    def test_logout(self):
        self.client.post("/api/auth/setup", json={"pin": "9999"})
        res_logout = self.client.post("/api/auth/logout")
        self.assertEqual(res_logout.status_code, 200)

        # Now protected endpoint should be blocked
        res_folders = self.client.get("/api/folders")
        self.assertEqual(res_folders.status_code, 401)


if __name__ == "__main__":
    unittest.main()
