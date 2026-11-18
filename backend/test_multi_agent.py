import unittest
from unittest.mock import MagicMock, patch

from main import create_app
from models import (
    db,
    Chat,
    ChatFolder,
    Message,
    Preference,
    ModelPreferences,
    get_chat_agents,
    set_chat_agents,
    delete_chat_agents,
)
from routes.generate import (
    _resolve_agent_info,
    _build_messages_payload,
    _build_chat_context_prompt,
    _strip_agent_prefix,
)


class MultiAgentTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
        )
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_global_agent_preference(self):
        res = self.client.get("/api/preferences")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("global_agent_id", data)
        self.assertEqual(data["global_agent_id"], "")

        # Save global_agent_id
        res2 = self.client.post("/api/preferences", json={"global_agent_id": "agent-lead"})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.get_json()["global_agent_id"], "agent-lead")

        # Set an internal chat_agents key directly and verify it is hidden from preferences API
        with self.app.app_context():
            pref = Preference(key="chat_agents:chat-123")
            pref.set_value(["agent-1", "agent-2"])
            db.session.add(pref)
            db.session.commit()

        res3 = self.client.get("/api/preferences")
        data3 = res3.get_json()
        self.assertNotIn("chat_agents:chat-123", data3)

    def test_chat_agents_persistence_helpers(self):
        with self.app.app_context():
            chat = Chat(id="c-test", name="Team Chat")
            db.session.add(chat)
            db.session.commit()

            # Initially empty
            self.assertEqual(get_chat_agents("c-test"), [])

            # Set agents with duplicates and case variants
            cleaned = set_chat_agents("c-test", ["Agent-A", "agent-b", "AGENT-A", "  Agent-C  ", ""])
            db.session.commit()
            self.assertEqual(cleaned, ["Agent-A", "agent-b", "Agent-C"])
            self.assertEqual(get_chat_agents("c-test"), ["Agent-A", "agent-b", "Agent-C"])

            # Verify Chat.to_dict includes agents
            c_dict = chat.to_dict()
            self.assertEqual(c_dict["agents"], ["Agent-A", "agent-b", "Agent-C"])

            # Delete
            delete_chat_agents("c-test")
            db.session.commit()
            self.assertEqual(get_chat_agents("c-test"), [])

    def test_chat_routes_agent_lifecycle(self):
        # 1. POST /api/chats with agents
        res = self.client.post("/api/chats", json={"name": "Multi-Agent Chat", "agents": ["alice", "bob"]})
        self.assertEqual(res.status_code, 201)
        chat_data = res.get_json()
        chat_id = chat_data["id"]
        self.assertEqual(chat_data["agents"], ["alice", "bob"])

        # 2. PUT /api/chats/<id> updating agents
        res2 = self.client.put(f"/api/chats/{chat_id}", json={"agents": ["alice", "bob", "charlie"]})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.get_json()["agents"], ["alice", "bob", "charlie"])

        # 2b. GET /api/chats/<id> returns agents
        res_get = self.client.get(f"/api/chats/{chat_id}")
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.get_json()["agents"], ["alice", "bob", "charlie"])

        # 3. Duplicate chat copies agents
        res3 = self.client.post(f"/api/chats/{chat_id}/duplicate")
        self.assertEqual(res3.status_code, 201)
        dup_data = res3.get_json()
        self.assertEqual(dup_data["agents"], ["alice", "bob", "charlie"])

        # 3b. DELETE /api/chats/<id> cleans up chat_agents preference
        dup_id = dup_data["id"]
        res_del = self.client.delete(f"/api/chats/{dup_id}")
        self.assertEqual(res_del.status_code, 200)
        with self.app.app_context():
            self.assertEqual(get_chat_agents(dup_id), [])

        # 4. Fork chat copies agents
        with self.app.app_context():
            msg = Message(id="m-1", chat_id=chat_id, role="user", content="Hello team")
            db.session.add(msg)
            db.session.commit()

        res4 = self.client.post(f"/api/chats/{chat_id}/fork", json={"message_id": "m-1"})
        self.assertEqual(res4.status_code, 201)
        fork_data = res4.get_json()
        self.assertEqual(fork_data["agents"], ["alice", "bob", "charlie"])

        # 5. Import chat restores agents
        res5 = self.client.post("/api/chats/import", json={
            "chats": [
                {"name": "Imported Multi", "agents": ["djin", "jay"], "messages": []}
            ]
        })
        self.assertEqual(res5.status_code, 201)
        imported_chats = res5.get_json()
        self.assertEqual(imported_chats[0]["agents"], ["djin", "jay"])

    def test_speaker_attribution_and_context(self):
        with self.app.app_context():
            # Create a model preference for custom display name
            pref = ModelPreferences(id="pref-jarvis", picture=None, voice=None)
            pref.set_character({"name": "Jarvis", "description": "AI Assistant"})
            db.session.add(pref)

            # Test _resolve_agent_info
            info_pref = _resolve_agent_info("pref-jarvis")
            self.assertEqual(info_pref["display_name"], "Jarvis")
            self.assertEqual(info_pref["description"], "AI Assistant")

            info_plain = _resolve_agent_info("llama3")
            self.assertEqual(info_plain["display_name"], "llama3")

            # Setup multi-agent chat
            chat = Chat(id="chat-collab", name="Project Collab")
            db.session.add(chat)
            set_chat_agents("chat-collab", ["pref-jarvis", "llama3"])

            # Add message from Jarvis and message from llama3
            msg1 = Message(id="m-j", chat_id="chat-collab", role="assistant", model="pref-jarvis", content="Jarvis analysis.")
            msg2 = Message(id="m-l", chat_id="chat-collab", role="assistant", model="llama3", content="Llama calculation.")
            msg3 = Message(id="m-u", chat_id="chat-collab", role="user", content="Next step?")
            db.session.add_all([msg1, msg2, msg3])
            db.session.commit()

            # When Jarvis is the currently generating agent:
            # - Jarvis's own message (msg1) should NOT have [Agent: Jarvis]: prefix
            # - Llama's message (msg2) MUST have [Agent: llama3]: prefix
            payload_for_jarvis = _build_messages_payload(
                {}, "chat-collab", active_model="pref-jarvis", active_pref=pref
            )
            self.assertEqual(payload_for_jarvis[0]["content"], "Jarvis analysis.")
            self.assertTrue(payload_for_jarvis[1]["content"].startswith("[Agent: llama3]:\nLlama calculation."))

            # Test _build_chat_context_prompt contains Multi-Agent block
            ctx_prompt = _build_chat_context_prompt("chat-collab", {}, active_model="pref-jarvis", active_pref=pref)
            self.assertIn("- Multi-Agent Chat Context:", ctx_prompt)
            self.assertIn("You are responding as: Jarvis", ctx_prompt)
            self.assertIn("@Jarvis", ctx_prompt)
            self.assertIn("@llama3", ctx_prompt)

    @patch("ollama.Client")
    def test_routing_endpoint(self, mock_client_cls):
        mock_instance = MagicMock()
        mock_client_cls.return_value = mock_instance
        mock_response = MagicMock()
        mock_response.message.content = '{"coordinator_message": "Delegating to Jarvis.", "agents": ["Jarvis", "llama3"]}'
        mock_instance.chat.return_value = mock_response

        with self.app.app_context():
            pref = ModelPreferences(id="pref-jarvis", picture=None, voice=None)
            pref.set_character({"name": "Jarvis", "description": "AI Assistant"})
            db.session.add(pref)

            chat = Chat(id="chat-route", name="Routing Chat")
            db.session.add(chat)
            set_chat_agents("chat-route", ["pref-jarvis", "llama3"])
            msg_u = Message(id="m-u1", chat_id="chat-route", role="user", content="How do we deploy?")
            db.session.add(msg_u)
            db.session.commit()

        res = self.client.post("/api/chats/chat-route/route", json={
            "global_agent_id": "pref-jarvis",
            "persist_message": True,
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["global_agent_id"], "pref-jarvis")
        self.assertEqual(data["coordinator_message"], "Delegating to Jarvis.")
        self.assertEqual(data["agents"], ["pref-jarvis", "llama3"])
        self.assertIsNotNone(data["coordinator_message_obj"])

        # Verify message was stored in DB
        with self.app.app_context():
            stored_msg = Message.query.filter_by(chat_id="chat-route", model="pref-jarvis").first()
            self.assertIsNotNone(stored_msg)
            self.assertEqual(stored_msg.content, "Delegating to Jarvis.")

    def test_strip_agent_prefix(self):
        self.assertEqual(_strip_agent_prefix("[Agent: Narrator]: Hello there!"), "Hello there!")
        self.assertEqual(_strip_agent_prefix("[Agent: Rute]:\nHow are you?"), "How are you?")
        self.assertEqual(_strip_agent_prefix("  [Speaker: Anna]: Test"), "Test")
        self.assertEqual(_strip_agent_prefix("[Agent: A]: [Agent: B]: Double"), "Double")
        self.assertEqual(_strip_agent_prefix("No prefix here"), "No prefix here")
        self.assertEqual(_strip_agent_prefix("[Thinking]: kept intact"), "[Thinking]: kept intact")

    def test_role_enforcement_in_context_prompt(self):
        with self.app.app_context():
            p_coord = Preference(key="global_agent_id")
            p_coord.set_value("narrator-id")
            db.session.add(p_coord)

            pref_narrator = ModelPreferences(id="narrator-id")
            pref_narrator.set_character({"name": "Narrator", "description": "Story narrator"})

            pref_rute = ModelPreferences(id="rute-id")
            pref_rute.set_character({"name": "Rute", "description": "Quiet accountant"})
            db.session.add_all([pref_narrator, pref_rute])

            chat = Chat(id="chat-role-test", name="Story Chat")
            db.session.add(chat)
            set_chat_agents("chat-role-test", ["narrator-id", "rute-id"])
            db.session.commit()

            # When current agent is the Narrator (Coordinator):
            prompt_narrator = _build_chat_context_prompt("chat-role-test", {}, active_model="narrator-id", active_pref=pref_narrator)
            self.assertIn("Role Enforcement: You are the Global Coordinator / Narrator (Narrator)", prompt_narrator)
            self.assertIn("NEVER write dialogue or speak in the name of other participating agents", prompt_narrator)

            # When current agent is Rute (Character):
            prompt_rute = _build_chat_context_prompt("chat-role-test", {}, active_model="rute-id", active_pref=pref_rute)
            self.assertIn("Role Enforcement: You ARE Rute. Respond ONLY in character as Rute in your own voice", prompt_rute)
            self.assertIn("NEVER act as the Narrator", prompt_rute)

    @patch("ollama.Client")
    def test_routing_fallback_to_mentioned_character(self, mock_client_cls):
        mock_instance = MagicMock()
        mock_client_cls.return_value = mock_instance
        # Mock coordinator returning empty or malformed agents list
        mock_response = MagicMock()
        mock_response.message.content = '{"coordinator_message": "", "agents": []}'
        mock_instance.chat.return_value = mock_response

        with self.app.app_context():
            p_coord = Preference(key="global_agent_id")
            p_coord.set_value("narrator-id")
            db.session.add(p_coord)

            pref_rute = ModelPreferences(id="rute-id")
            pref_rute.set_character({"name": "Rute", "description": "Quiet accountant"})

            pref_anna = ModelPreferences(id="anna-id")
            pref_anna.set_character({"name": "Anna", "description": "Librarian"})

            db.session.add_all([pref_rute, pref_anna])

            chat = Chat(id="chat-fallback", name="Fallback Test")
            db.session.add(chat)
            set_chat_agents("chat-fallback", ["narrator-id", "rute-id", "anna-id"])
            db.session.commit()

        # User specifically asks Rute: "Rute, estás bem?"
        res = self.client.post("/api/chats/chat-fallback/route", json={
            "prompt": "Rute, estás bem?",
            "global_agent_id": "narrator-id",
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        # Fallback should detect "Rute" in user prompt and return rute-id!
        self.assertEqual(data["agents"], ["rute-id"])

        # Check that think=False and options={"think": False, "temperature": 0.2} were passed
        mock_instance.chat.assert_called_once()
        _, call_kwargs = mock_instance.chat.call_args
        self.assertFalse(call_kwargs.get("think"))
        self.assertEqual(call_kwargs.get("options"), {"think": False, "temperature": 0.2})


if __name__ == "__main__":
    unittest.main()
