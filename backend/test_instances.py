import unittest
from main import create_app
from models import db


class InstanceTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_create_and_put_update_instance_by_id(self):
        # 1. Create instance via POST /api/instances
        create_res = self.client.post(
            "/api/instances",
            json={
                "id": "ollama-local",
                "type": "ollama",
                "pinned": True,
                "properties": {"host": "http://localhost:11434"},
            },
        )
        self.assertEqual(create_res.status_code, 200)
        created_data = create_res.get_json()
        self.assertEqual(created_data["id"], "ollama-local")
        self.assertEqual(created_data["properties"]["host"], "http://localhost:11434")

        # 2. Update instance via PUT /api/instances/ollama-local
        put_res = self.client.put(
            "/api/instances/ollama-local",
            json={
                "type": "ollama",
                "properties": {"host": "http://192.168.1.50:11434", "api_key": "secret"},
            },
        )
        self.assertEqual(put_res.status_code, 200)
        updated_data = put_res.get_json()
        self.assertEqual(updated_data["id"], "ollama-local")
        self.assertEqual(updated_data["properties"]["host"], "http://192.168.1.50:11434")
        self.assertEqual(updated_data["properties"]["api_key"], "secret")

        # 3. Verify via GET /api/instances
        get_res = self.client.get("/api/instances")
        self.assertEqual(get_res.status_code, 200)
        instances_list = get_res.get_json()
        self.assertEqual(len(instances_list), 1)
        self.assertEqual(instances_list[0]["properties"]["host"], "http://192.168.1.50:11434")


if __name__ == "__main__":
    unittest.main()
