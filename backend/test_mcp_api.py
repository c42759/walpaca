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


if __name__ == "__main__":
    unittest.main()
