import json
import unittest
from unittest.mock import patch, MagicMock
from main import create_app
from models import db, Instance, InstanceModel, ModelPreferences, Chat, Preference


class GeneratePrefResolutionTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True})
        self.client = self.app.test_client()
        with self.app.app_context():
            pref = db.session.get(Preference, "pin_security_enabled")
            if pref:
                pref.set_value(False)
            else:
                pref = Preference(key="pin_security_enabled")
                pref.set_value(False)
                db.session.add(pref)

            # Create test Instance
            inst = db.session.get(Instance, "test-inst-1")
            if not inst:
                inst = Instance(
                    id="test-inst-1",
                    type="ollama",
                    properties=json.dumps({"name": "Test Ollama Instance", "url": "http://localhost:11434"}),
                    is_enabled=1,
                )
                db.session.add(inst)

            # Create test InstanceModel
            im = db.session.get(InstanceModel, "test-im-1")
            if not im:
                im = InstanceModel(
                    id="test-im-1",
                    instance_id="test-inst-1",
                    model_id="llama3:latest",
                )
                db.session.add(im)

            # Create test ModelPreferences
            mp = db.session.get(ModelPreferences, "test-mp-1")
            if not mp:
                mp = ModelPreferences(
                    id="test-mp-1",
                    instance_id="test-inst-1",
                    model_id="test-im-1",
                    character=json.dumps({
                        "data": {
                            "name": "Detective Sherlock",
                            "system_prompt": "You are a master consulting detective solving mysteries in London.",
                        }
                    }),
                )
                db.session.add(mp)

            # Create test Chat
            chat = db.session.get(Chat, "test-chat-auto-sys")
            if not chat:
                chat = Chat(id="test-chat-auto-sys", name="Detective Chat")
                db.session.add(chat)

            db.session.commit()

    @patch("ollama.Client")
    def test_generate_without_system_resolves_model_preference_by_pref_id(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        chunk = MagicMock()
        chunk.message.content = "Elementary."
        chunk.message.thinking = ""
        chunk.done = True
        chunk.total_duration = 1000000

        mock_client.chat.return_value = iter([chunk])

        # Request WITHOUT "system" field, using preference ID as model
        response = self.client.post(
            "/api/chats/test-chat-auto-sys/generate",
            json={
                "model": "test-mp-1",
                "instance_id": "test-inst-1",
                "prompt": "Who is the culprit?",
            },
        )
        self.assertEqual(response.status_code, 200)

        # Inspect the payload sent to upstream Ollama client
        self.assertTrue(mock_client.chat.called)
        call_kwargs = mock_client.chat.call_args[1]

        # Upstream model name should be resolved from InstanceModel
        self.assertEqual(call_kwargs.get("model"), "llama3:latest")

        # Upstream messages should contain system message extracted from ModelPreferences
        messages = call_kwargs.get("messages", [])
        system_msgs = [m for m in messages if m.get("role") == "system"]
        self.assertTrue(len(system_msgs) > 0)
        self.assertIn("Detective Sherlock", system_msgs[0].get("content"))
        self.assertIn("master consulting detective", system_msgs[0].get("content"))

    @patch("ollama.Client")
    def test_generate_without_system_resolves_model_preference_by_model_name(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        chunk = MagicMock()
        chunk.message.content = "Elementary."
        chunk.message.thinking = ""
        chunk.done = True
        chunk.total_duration = 1000000

        mock_client.chat.return_value = iter([chunk])

        # Request WITHOUT "system" field, passing model string "llama3:latest"
        response = self.client.post(
            "/api/chats/test-chat-auto-sys/generate",
            json={
                "model": "llama3:latest",
                "instance_id": "test-inst-1",
                "prompt": "Analyze the clues.",
            },
        )
        self.assertEqual(response.status_code, 200)

        self.assertTrue(mock_client.chat.called)
        call_kwargs = mock_client.chat.call_args[1]

        messages = call_kwargs.get("messages", [])
        system_msgs = [m for m in messages if m.get("role") == "system"]
        self.assertTrue(len(system_msgs) > 0)
        self.assertIn("master consulting detective", system_msgs[0].get("content"))



if __name__ == "__main__":
    unittest.main()
