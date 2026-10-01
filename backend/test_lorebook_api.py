import json
import os
import shutil
import tempfile
import unittest
from main import create_app


class LorebookAPITestCase(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        os.environ["LOREBOOK_DIR_PATH"] = self.test_dir
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_list_lorebook_templates_empty(self):
        response = self.client.get("/api/lorebook")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_create_lorebook_template_auto_filename_and_uniqueness(self):
        payload1 = {
            "name": "Knight Templar",
            "keys": ["knight", "sword"],
            "content": "First knight.",
        }
        response1 = self.client.post("/api/lorebook", json=payload1)
        self.assertEqual(response1.status_code, 201)
        data1 = response1.get_json()
        self.assertEqual(data1["name"], "Knight Templar")
        self.assertEqual(data1["filename"], "knight_templar.json")

        # Create duplicate name - should auto-generate unique filename with counter
        payload2 = {
            "name": "Knight Templar",
            "keys": ["knight", "shield"],
            "content": "Second knight.",
        }
        response2 = self.client.post("/api/lorebook", json=payload2)
        self.assertEqual(response2.status_code, 201)
        data2 = response2.get_json()
        self.assertEqual(data2["filename"], "knight_templar_1.json")

        # Verify files exist on disk
        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, "knight_templar.json")))
        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, "knight_templar_1.json")))

    def test_update_lorebook_template(self):
        # Create
        payload = {
            "name": "Cyberpunk Racer",
            "keys": ["name", "car"],
            "content": "Speed demon of Night City.",
        }
        create_res = self.client.post("/api/lorebook", json=payload)
        self.assertEqual(create_res.status_code, 201)
        filename = create_res.get_json()["filename"]

        # Update
        update_payload = {
            "name": "Cyberpunk Racer Deluxe",
            "keys": ["racer", "car", "turbo"],
            "content": "Upgraded speed demon.",
        }
        update_res = self.client.put(f"/api/lorebook/{filename}", json=update_payload)
        self.assertEqual(update_res.status_code, 200)
        data = update_res.get_json()
        self.assertEqual(data["name"], "Cyberpunk Racer Deluxe")
        self.assertEqual(data["keys"], ["racer", "car", "turbo"])
        self.assertEqual(data["content"], "Upgraded speed demon.")

    def test_delete_lorebook_template(self):
        payload = {
            "name": "Temporary Hero",
            "keys": ["hero"],
            "content": "Short lived character.",
        }
        create_res = self.client.post("/api/lorebook", json=payload)
        filename = create_res.get_json()["filename"]
        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, filename)))

        del_res = self.client.delete(f"/api/lorebook/{filename}")
        self.assertEqual(del_res.status_code, 200)
        self.assertFalse(os.path.isfile(os.path.join(self.test_dir, filename)))


if __name__ == "__main__":
    unittest.main()
