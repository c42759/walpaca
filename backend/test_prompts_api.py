import os
import shutil
import tempfile
import unittest

from main import create_app


class PromptsAPITestCase(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        os.environ["PROMPTS_DIR_PATH"] = self.test_dir
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_list_prompts_empty(self):
        response = self.client.get("/api/prompts")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_create_prompt_auto_filename_and_uniqueness(self):
        payload1 = {
            "title": "Code Reviewer",
            "content": "Please review this code for performance and security.",
        }
        response1 = self.client.post("/api/prompts", json=payload1)
        self.assertEqual(response1.status_code, 201)
        data1 = response1.get_json()
        self.assertEqual(data1["title"], "Code Reviewer")
        self.assertEqual(data1["filename"], "code_reviewer.json")
        self.assertEqual(data1["content"], "Please review this code for performance and security.")

        # Duplicate title - should auto-generate unique filename
        payload2 = {
            "title": "Code Reviewer",
            "content": "Second version of code review prompt.",
        }
        response2 = self.client.post("/api/prompts", json=payload2)
        self.assertEqual(response2.status_code, 201)
        data2 = response2.get_json()
        self.assertEqual(data2["filename"], "code_reviewer_1.json")

        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, "code_reviewer.json")))
        self.assertTrue(os.path.isfile(os.path.join(self.test_dir, "code_reviewer_1.json")))

    def test_get_prompt(self):
        payload = {
            "title": "Story Generator",
            "content": "Write an engaging sci-fi short story.",
        }
        create_res = self.client.post("/api/prompts", json=payload)
        self.assertEqual(create_res.status_code, 201)
        filename = create_res.get_json()["filename"]

        get_res = self.client.get(f"/api/prompts/{filename}")
        self.assertEqual(get_res.status_code, 200)
        data = get_res.get_json()
        self.assertEqual(data["title"], "Story Generator")
        self.assertEqual(data["content"], "Write an engaging sci-fi short story.")

    def test_update_prompt(self):
        payload = {
            "title": "Translator",
            "content": "Translate the following to French.",
        }
        create_res = self.client.post("/api/prompts", json=payload)
        self.assertEqual(create_res.status_code, 201)
        filename = create_res.get_json()["filename"]

        update_payload = {
            "title": "French Translator",
            "content": "Translate the following to Parisian French.",
        }
        update_res = self.client.put(f"/api/prompts/{filename}", json=update_payload)
        self.assertEqual(update_res.status_code, 200)
        data = update_res.get_json()
        self.assertEqual(data["title"], "French Translator")
        self.assertEqual(data["content"], "Translate the following to Parisian French.")

    def test_delete_prompt(self):
        payload = {
            "title": "Temporary Prompt",
            "content": "To be deleted.",
        }
        create_res = self.client.post("/api/prompts", json=payload)
        self.assertEqual(create_res.status_code, 201)
        filename = create_res.get_json()["filename"]

        delete_res = self.client.delete(f"/api/prompts/{filename}")
        self.assertEqual(delete_res.status_code, 200)
        self.assertFalse(os.path.isfile(os.path.join(self.test_dir, filename)))

        # Subsequent delete returns 404
        delete_res_404 = self.client.delete(f"/api/prompts/{filename}")
        self.assertEqual(delete_res_404.status_code, 404)


if __name__ == "__main__":
    unittest.main()
