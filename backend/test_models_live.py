import json
import unittest

from unittest.mock import patch
from unittest.mock import MagicMock
from main import create_app
from models import db
from models import Instance


class LiveInstanceModelsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @patch("routes.api.urllib.request.urlopen")
    def test_get_models_queries_ollama_instance_with_details(self, mock_urlopen):
        with self.app.app_context():
            inst = Instance(id="ollama-inst", type="ollama")
            inst.set_properties({"url": "http://localhost:11434"})
            db.session.add(inst)
            db.session.commit()

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "models": [
                {
                    "name": "gemma4:31b",
                    "modified_at": "2026-09-22T18:39:00Z",
                    "details": {
                        "family": "gemma4",
                        "parameter_size": "31.3B",
                        "quantization_level": "Q4_K_M"
                    }
                },
                {
                    "name": "deepseek-r1:8b",
                    "modified_at": "2026-09-20T10:00:00Z",
                    "details": {
                        "family": "deepseek",
                        "parameter_size": "8.0B",
                        "quantization_level": "Q4_0"
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        response = self.client.get("/api/instances/ollama-inst/models")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(len(data), 2)

        # First model check
        self.assertEqual(data[0]["id"], "gemma4:31b")
        self.assertEqual(data[0]["family"], "gemma4")
        self.assertEqual(data[0]["parameter_size"], "31.3B")
        self.assertEqual(data[0]["quantization_level"], "Q4_K_M")
        self.assertEqual(data[0]["tag"], "31b")
        self.assertEqual(data[0]["modified_at"], "2026-09-22T18:39:00Z")

        # Second model capability check (reasoning)
        self.assertIn("reasoning", data[1]["capabilities"])

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.full_url, "http://localhost:11434/api/tags")

    @patch("routes.api.urllib.request.urlopen")
    def test_get_models_queries_openai_compatible_instance(self, mock_urlopen):
        with self.app.app_context():
            inst = Instance(id="openai-inst", type="openai")
            inst.set_properties({"url": "https://api.openai.com/v1", "apiKey": "sk-test123"})
            db.session.add(inst)
            db.session.commit()

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "data": [
                {"id": "gpt-4o"},
                {"id": "gpt-4o-mini"}
            ]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        response = self.client.get("/api/instances/openai-inst/models")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["id"], "gpt-4o")

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.full_url, "https://api.openai.com/v1/models")
        self.assertEqual(req.headers.get("Authorization"), "Bearer sk-test123")


if __name__ == "__main__":
    unittest.main()
