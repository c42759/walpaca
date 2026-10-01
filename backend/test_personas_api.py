import json
import os
import shutil
import tempfile
import unittest
from main import create_app


class PersonasAPITestCase(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        os.environ["PERSONAS_DIR_PATH"] = self.test_dir
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_list_personas_empty(self):
        response = self.client.get("/api/personas")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_create_persona_template_auto_filename_and_uniqueness(self):
        payload1 = {
            "name": "Code Reviewer",
            "description": "Senior engineer persona.",
            "system_prompt": "Perform thorough code reviews.",
            "voice": "af_heart",
        }
        res1 = self.client.post("/api/personas", json=payload1)
        self.assertEqual(res1.status_code, 201)
        data1 = res1.get_json()
        self.assertEqual(data1["name"], "Code Reviewer")
        self.assertEqual(data1["filename"], "code_reviewer.json")

        # Create duplicate name
        payload2 = {
            "name": "Code Reviewer",
            "description": "Another reviewer.",
            "system_prompt": "Strict code audit.",
        }
        res2 = self.client.post("/api/personas", json=payload2)
        self.assertEqual(res2.status_code, 201)
        data2 = res2.get_json()
        self.assertEqual(data2["filename"], "code_reviewer_1.json")

        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, "code_reviewer.json")))
        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, "code_reviewer_1.json")))

    def test_update_persona_template(self):
        payload = {
            "name": "Creative Writer",
            "description": "Fantasy author.",
            "system_prompt": "Write vivid stories.",
        }
        create_res = self.client.post("/api/personas", json=payload)
        filename = create_res.get_json()["filename"]

        update_payload = {
            "name": "Creative Writer Pro",
            "description": "Bestselling author.",
            "system_prompt": "Write epic fantasy fiction.",
            "voice": "am_adam",
        }
        update_res = self.client.put(f"/api/personas/{filename}", json=update_payload)
        self.assertEqual(update_res.status_code, 200)
        data = update_res.get_json()
        self.assertEqual(data["name"], "Creative Writer Pro")
        self.assertEqual(data["voice"], "am_adam")

    def test_delete_persona_template(self):
        payload = {
            "name": "Temp Persona",
            "description": "Short lived.",
        }
        create_res = self.client.post("/api/personas", json=payload)
        filename = create_res.get_json()["filename"]
        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, filename)))

        del_res = self.client.delete(f"/api/personas/{filename}")
        self.assertEqual(del_res.status_code, 200)
        self.assertFalse(os.path.isfile(os.path.join(self.test_dir, filename)))

    def test_upload_persona_avatar(self):
        import io
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        data = {
            "file": (io.BytesIO(fake_png), "avatar.png", "image/png")
        }
        res = self.client.post("/api/personas/avatar", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 200)
        json_data = res.get_json()
        self.assertIn("picture", json_data)
        self.assertTrue(json_data["picture"].startswith("data:image/png;base64,"))


if __name__ == "__main__":
    unittest.main()
