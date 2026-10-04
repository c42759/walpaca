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

    def test_single_instance_enabled_rule(self):
        # Create instance 1 enabled
        res1 = self.client.post(
            "/api/instances",
            json={"id": "inst-1", "type": "ollama", "is_enabled": True},
        )
        self.assertEqual(res1.status_code, 200)
        self.assertTrue(res1.get_json()["is_enabled"])

        # Create instance 2 enabled -> instance 1 should be disabled
        res2 = self.client.post(
            "/api/instances",
            json={"id": "inst-2", "type": "gemini", "is_enabled": True},
        )
        self.assertEqual(res2.status_code, 200)
        self.assertTrue(res2.get_json()["is_enabled"])

        # Check instances list: only inst-2 should be enabled
        list_res = self.client.get("/api/instances").get_json()
        inst1_data = next(i for i in list_res if i["id"] == "inst-1")
        inst2_data = next(i for i in list_res if i["id"] == "inst-2")
        self.assertFalse(inst1_data["is_enabled"])
        self.assertTrue(inst2_data["is_enabled"])

        # Switch back to inst-1 via PUT
        put_res = self.client.put(
            "/api/instances/inst-1",
            json={"is_enabled": True},
        )
        self.assertEqual(put_res.status_code, 200)

        list_res2 = self.client.get("/api/instances").get_json()
        inst1_data2 = next(i for i in list_res2 if i["id"] == "inst-1")
        inst2_data2 = next(i for i in list_res2 if i["id"] == "inst-2")
        self.assertTrue(inst1_data2["is_enabled"])
        self.assertFalse(inst2_data2["is_enabled"])

        # Delete enabled instance inst-1 -> inst-2 should become enabled
        del_res = self.client.delete("/api/instances/inst-1")
        self.assertEqual(del_res.status_code, 200)

        list_res3 = self.client.get("/api/instances").get_json()
        self.assertEqual(len(list_res3), 1)
        self.assertTrue(list_res3[0]["is_enabled"])
        self.assertEqual(list_res3[0]["id"], "inst-2")

    def test_preferences_endpoint_drops_active_instance_id(self):
        # 1. GET /api/preferences should not contain active_instance_id
        get_res = self.client.get("/api/preferences")
        self.assertEqual(get_res.status_code, 200)
        self.assertNotIn("active_instance_id", get_res.get_json())

        # 2. POST /api/preferences with active_instance_id should drop it
        post_res = self.client.post(
            "/api/preferences",
            json={"active_instance_id": "dummy-id", "auto_scroll": True},
        )
        self.assertEqual(post_res.status_code, 200)
        self.assertNotIn("active_instance_id", post_res.get_json())

    def test_instance_model_and_model_preferences_with_assistant_fallback(self):
        from models import Chat, Message, InstanceModel, ModelPreferences

        # 1. Create an enabled instance
        self.client.post(
            "/api/instances",
            json={"id": "active-inst", "type": "ollama", "is_enabled": True},
        )

        # 2. Sync instance models via POST /api/instances/<id>/models
        models_res = self.client.post(
            "/api/instances/active-inst/models",
            json={"list": [{"id": "llama3:8b", "name": "Llama 3 8B"}]},
        )
        self.assertEqual(models_res.status_code, 200)

        # Verify InstanceModel was stored with UUID
        with self.app.app_context():
            im = InstanceModel.query.filter_by(instance_id="active-inst", model_id="llama3:8b").first()
            self.assertIsNotNone(im)
            self.assertIsNotNone(im.id)
            self.assertEqual(im.model_id, "llama3:8b")

        # 3. Create a chat with assistant message having model="llama3:8b"
        with self.app.app_context():
            chat = Chat(id="chat-1", name="Test Chat")
            db.session.add(chat)
            msg = Message(
                id="msg-1",
                chat_id="chat-1",
                role="assistant",
                model="llama3:8b",
                content="Hello world",
            )
            db.session.add(msg)
            db.session.commit()

        # 4. Save model preference WITHOUT model in request
        pref_post_res = self.client.post(
            "/api/model-preferences",
            json={
                "chat_id": "chat-1",
                "voice": "af_heart",
                "character": {"name": "Llama Bot"},
            },
        )
        self.assertEqual(pref_post_res.status_code, 200)
        pref_data = pref_post_res.get_json()
        self.assertEqual(pref_data["instance_id"], "active-inst")
        self.assertIsNotNone(pref_data["model_id"])
        self.assertEqual(pref_data["voice"], "af_heart")
        self.assertEqual(pref_data["character"]["name"], "Llama Bot")

        # 5. Verify GET by model name resolves correctly
        get_pref = self.client.get("/api/model-preferences/llama3:8b")
        self.assertEqual(get_pref.status_code, 200)
        self.assertEqual(get_pref.get_json()["voice"], "af_heart")


if __name__ == "__main__":
    unittest.main()
