import json
import unittest
from unittest.mock import patch, MagicMock

from main import create_app
from models import db, McpServer, McpToolConfig


class TestMcpApi(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        })
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_mcp_server_crud(self):
        # 1. Create MCP server
        payload = {
            "name": "Brave Search",
            "description": "Web search integration",
            "transport_type": "sse",
            "url": "http://localhost:8000/sse",
            "env": {"BRAVE_API_KEY": "test-key"},
            "auto_sync": False,
        }
        res = self.client.post("/api/mcp/servers", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        server_id = data["id"]
        self.assertEqual(data["name"], "Brave Search")
        self.assertEqual(data["url"], "http://localhost:8000/sse")
        self.assertEqual(data["transport_type"], "sse")
        self.assertEqual(data["env"], {"BRAVE_API_KEY": "test-key"})

        # 2. Get server
        res = self.client.get(f"/api/mcp/servers/{server_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["name"], "Brave Search")

        # 3. Update server
        update_payload = {
            "name": "Brave Search Updated",
            "is_enabled": False,
        }
        res = self.client.put(f"/api/mcp/servers/{server_id}", json=update_payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["name"], "Brave Search Updated")
        self.assertFalse(res.get_json()["is_enabled"])

        # 4. List servers
        res = self.client.get("/api/mcp/servers")
        self.assertEqual(res.status_code, 200)
        servers = res.get_json()
        self.assertEqual(len(servers), 1)

        # 5. Delete server
        res = self.client.delete(f"/api/mcp/servers/{server_id}")
        self.assertEqual(res.status_code, 200)

        # Verify deletion
        res = self.client.get(f"/api/mcp/servers/{server_id}")
        self.assertEqual(res.status_code, 404)

    @patch("utils.mcp_manager.McpManager.fetch_server_tools")
    def test_mcp_sync_tools(self, mock_fetch):
        mock_fetch.return_value = [
            {
                "name": "brave_web_search",
                "description": "Searches the web using Brave",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"],
                },
            }
        ]

        # Create server
        res = self.client.post("/api/mcp/servers", json={
            "name": "Brave Server",
            "transport_type": "sse",
            "url": "http://localhost:8000/sse",
            "auto_sync": False,
        })
        server_id = res.get_json()["id"]

        # Sync
        res = self.client.post(f"/api/mcp/servers/{server_id}/sync")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["count"], 1)
        tool = data["tools"][0]
        tool_id = tool["id"]
        self.assertEqual(tool["name"], "brave_web_search")

        # Update tool config
        res = self.client.put(f"/api/mcp/tools/{tool_id}", json={"is_enabled": False, "requires_approval": True})
        self.assertEqual(res.status_code, 200)
        tool_updated = res.get_json()
        self.assertFalse(tool_updated["is_enabled"])
        self.assertTrue(tool_updated["requires_approval"])

        # List tools with filter
        res = self.client.get("/api/mcp/tools?enabled_only=true")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.get_json()), 0)

    @patch("utils.mcp_manager.McpManager.call_tool")
    @patch("utils.mcp_manager.McpManager.get_enabled_tools")
    @patch("ollama.Client")
    def test_generate_with_mcp_tool_calling_loop(self, mock_ollama_client_cls, mock_get_tools, mock_call_tool):
        from models import Instance, Chat, Message, Attachment

        with self.app.app_context():
            inst = Instance(
                id="test-ollama-inst",
                type="ollama",
                properties=json.dumps({"url": "http://localhost:11434"}),
                is_enabled=1,
            )
            db.session.add(inst)
            chat = Chat(id="test-tool-chat", name="Tool Chat")
            db.session.add(chat)
            db.session.commit()

        mock_server = MagicMock()
        mock_server.id = "srv-1"
        mock_tool = MagicMock()
        mock_tool.name = "web_search"
        mock_get_tools.return_value = [(mock_server, mock_tool)]
        mock_call_tool.return_value = {"results": "Sunny in Lisbon, 22C"}

        mock_client = MagicMock()
        mock_ollama_client_cls.return_value = mock_client

        # Turn 1: Model requests tool call
        chunk_tool = MagicMock()
        chunk_tool.message.content = ""
        chunk_tool.message.thinking = ""
        chunk_tool.message.tool_calls = [
            {"function": {"name": "web_search", "arguments": {"query": "Lisbon weather"}}}
        ]
        chunk_tool.done = False

        # Turn 2: Model answers after tool execution
        chunk_text = MagicMock()
        chunk_text.message.content = "It is sunny in Lisbon with 22°C."
        chunk_text.message.thinking = ""
        chunk_text.message.tool_calls = None
        chunk_text.done = True
        chunk_text.total_duration = 5000000

        mock_client.chat.side_effect = [
            iter([chunk_tool]),
            iter([chunk_text]),
        ]

        res = self.client.post("/api/chats/test-tool-chat/generate", json={
            "model": "llama3",
            "prompt": "What is the weather in Lisbon?",
            "instance_id": "test-ollama-inst",
        })
        self.assertEqual(res.status_code, 200)
        body = res.get_data(as_text=True)

        # Verify SSE events
        self.assertIn('"type": "tool_call"', body)
        self.assertIn('"name": "web_search"', body)
        self.assertIn('"type": "tool_result"', body)
        self.assertIn('"Sunny in Lisbon, 22C"', body)
        self.assertIn("It is sunny in Lisbon with 22°C.", body)

        # Verify ollama.Client.chat was called twice (turn 1 with prompt, turn 2 with tool result)
        self.assertEqual(mock_client.chat.call_count, 2)
        turn2_messages = mock_client.chat.call_args_list[1][1]["messages"]
        role_list = [m["role"] for m in turn2_messages]
        self.assertIn("user", role_list)
        self.assertIn("assistant", role_list)
        self.assertIn("tool", role_list)

        # Verify DB persisted answer and tool attachment
        with self.app.app_context():
            msg = Message.query.filter_by(chat_id="test-tool-chat", role="assistant").first()
            self.assertIsNotNone(msg)
            self.assertEqual(msg.content, "It is sunny in Lisbon with 22°C.")
            tool_att = Attachment.query.filter_by(message_id=msg.id, type="tool").first()
            self.assertIsNotNone(tool_att)
            self.assertIn("web_search", tool_att.name)


if __name__ == "__main__":
    unittest.main()
