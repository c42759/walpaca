import json
import unittest
from unittest.mock import patch, MagicMock
from main import create_app
from models import db, Instance, InstanceModel, ModelPreferences, Chat, ChatFolder, Preference


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

            # Create or reset test ModelPreferences
            mp = db.session.get(ModelPreferences, "test-mp-1")
            if not mp:
                mp = ModelPreferences(
                    id="test-mp-1",
                    instance_id="test-inst-1",
                    model_id="test-im-1",
                )
                db.session.add(mp)
            mp.character = json.dumps({
                "data": {
                    "name": "Detective Sherlock",
                    "system_prompt": "You are a master consulting detective solving mysteries in London.",
                }
            })

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

    def test_linked_lorebook_updates_propagate_to_model_preference_and_persona(self):
        import os
        import tempfile
        from routes.generate import evaluate_lorebook_entries

        with tempfile.TemporaryDirectory() as tmp_lore_dir, tempfile.TemporaryDirectory() as tmp_persona_dir:
            with patch.dict(
                os.environ,
                {
                    "LOREBOOK_DIR_PATH": tmp_lore_dir,
                    "PERSONAS_DIR_PATH": tmp_persona_dir,
                },
            ):
                # 1. Create a Lorebook entry via API
                create_res = self.client.post(
                    "/api/lorebook",
                    json={
                        "name": "Excalibur",
                        "keys": ["sword", "blade"],
                        "content": "Initial lore: A legendary sword in the stone.",
                    },
                )
                self.assertEqual(create_res.status_code, 201)
                lore_data = create_res.get_json()
                fname = lore_data["filename"]

                # 2. Create a Persona linking to this Lorebook entry
                p_res = self.client.post(
                    "/api/personas",
                    json={
                        "name": "King Arthur",
                        "system_prompt": "You are Arthur.",
                        "character_book": {
                            "name": "Arthur Lorebook",
                            "entries": [{"filename": fname, "enabled": True}],
                        },
                    },
                )
                self.assertEqual(p_res.status_code, 201)
                p_saved = p_res.get_json()
                persona_file = os.path.join(tmp_persona_dir, p_saved["filename"])
                with open(persona_file, "r", encoding="utf-8") as f:
                    raw_persona_on_disk = json.load(f)

                # Verify disk storage only saved the link (no copied content)
                disk_entry = raw_persona_on_disk["character_book"]["entries"][0]
                self.assertEqual(disk_entry, {"filename": fname, "enabled": True})
                self.assertNotIn("content", disk_entry)

                # 3. Assign Lorebook link to ModelPreferences
                mp_res = self.client.post(
                    "/api/model-preferences",
                    json={
                        "id": "test-mp-1",
                        "instance_id": "test-inst-1",
                        "model_id": "llama3:latest",
                        "character": {
                            "name": "Detective Sherlock",
                            "system_prompt": "You are Sherlock.",
                            "character_book": {
                                "name": "Sherlock Lorebook",
                                "entries": [{"filename": fname, "enabled": True}],
                            },
                        },
                    },
                )
                self.assertEqual(mp_res.status_code, 200)

                # Verify DB storage only saved the link (no copied content)
                with self.app.app_context():
                    mp_obj = db.session.get(ModelPreferences, "test-mp-1")
                    raw_char = json.loads(mp_obj.character)
                    db_entry = raw_char["character_book"]["entries"][0]
                    self.assertEqual(db_entry, {"filename": fname, "enabled": True})
                    self.assertNotIn("content", db_entry)

                    # Evaluate prompt before lore update
                    sys_before = evaluate_lorebook_entries(
                        model_id="test-mp-1",
                        messages=[{"role": "user", "content": "Tell me about the sword."}],
                        pref=mp_obj,
                    )
                    self.assertIn("Initial lore: A legendary sword in the stone.", sys_before)

                # 4. Update the Lorebook entry in place
                upd_res = self.client.put(
                    f"/api/lorebook/{fname}",
                    json={
                        "name": "Excalibur Reforged",
                        "keys": ["sword", "caliburn"],
                        "content": "Updated lore: Forged in Avalon with magical steel.",
                    },
                )
                self.assertEqual(upd_res.status_code, 200)

                # 5. Verify Persona GET and ModelPreference GET & evaluation reflect the update automatically
                personas_list = self.client.get("/api/personas").get_json()
                arthur = next(p for p in personas_list if p["filename"] == p_saved["filename"])
                arthur_entry = arthur["character_book"]["entries"][0]
                self.assertEqual(arthur_entry["name"], "Excalibur Reforged")
                self.assertEqual(arthur_entry["content"], "Updated lore: Forged in Avalon with magical steel.")

                mp_get = self.client.get("/api/model-preferences/test-mp-1").get_json()
                mp_entry = mp_get["character"]["character_book"]["entries"][0]
                self.assertEqual(mp_entry["name"], "Excalibur Reforged")
                self.assertEqual(mp_entry["content"], "Updated lore: Forged in Avalon with magical steel.")

                with self.app.app_context():
                    mp_obj = db.session.get(ModelPreferences, "test-mp-1")
                    sys_after = evaluate_lorebook_entries(
                        model_id="test-mp-1",
                        messages=[{"role": "user", "content": "What is caliburn?"}],
                        pref=mp_obj,
                    )
                    self.assertIn("Excalibur Reforged: Updated lore: Forged in Avalon with magical steel.", sys_after)

    @patch("ollama.Client")
    def test_generate_appends_folder_and_chat_info_to_system_prompt(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        chunk = MagicMock()
        chunk.message.content = "Folder context received."
        chunk.message.thinking = ""
        chunk.done = True
        chunk.total_duration = 1000000
        mock_client.chat.return_value = iter([chunk])

        with self.app.app_context():
            folder = db.session.get(ChatFolder, "folder-uuid-123")
            if not folder:
                folder = ChatFolder(id="folder-uuid-123", name="Project Alpha Workspace")
                db.session.add(folder)

            chat = db.session.get(Chat, "chat-uuid-456")
            if not chat:
                chat = Chat(id="chat-uuid-456", name="Architecture Discussion", folder="folder-uuid-123")
                db.session.add(chat)
            else:
                chat.name = "Architecture Discussion"
                chat.folder = "folder-uuid-123"
            db.session.commit()

        response = self.client.post(
            "/api/chats/chat-uuid-456/generate",
            json={
                "model": "test-mp-1",
                "instance_id": "test-inst-1",
                "prompt": "What workspace are we in?",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(mock_client.chat.called)
        messages = mock_client.chat.call_args[1].get("messages", [])
        system_msgs = [m for m in messages if m.get("role") == "system"]
        self.assertTrue(len(system_msgs) > 0)
        sys_content = system_msgs[0].get("content", "")
        self.assertIn("Folder Name: Project Alpha Workspace", sys_content)
        self.assertIn("Folder ID: folder-uuid-123", sys_content)
        self.assertIn("Chat Name: Architecture Discussion", sys_content)
        self.assertIn("Chat ID: chat-uuid-456", sys_content)


if __name__ == "__main__":
    unittest.main()
