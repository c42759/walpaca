import unittest
from unittest.mock import patch
from unittest.mock import MagicMock
from main import create_app
from models import db
from models import Preference
from models import Chat


class CorsHeadersTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True,
            "CORS_DOMAINS": "http://localhost:3100,http://100.109.217.63:3100,http://100.109.217.63:5100",
        })
        self.client = self.app.test_client()
        with self.app.app_context():
            pref = Preference.query.get("pin_security_enabled")
            if pref:
                pref.set_value(False)
            else:
                pref = Preference(key="pin_security_enabled")
                pref.set_value(False)
                db.session.add(pref)

            # Create dummy chat for generate route
            chat = Chat.query.get("test-chat-cors")
            if not chat:
                chat = Chat(id="test-chat-cors", name="Test Chat")
                db.session.add(chat)
            db.session.commit()

    def test_preflight_cors_options(self):
        response = self.client.options(
            "/api/chats/test-chat-cors/generate",
            headers={
                "Origin": "http://100.109.217.63:5100",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization,x-walpaca-session",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            "http://100.109.217.63:5100",
        )
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Credentials"),
            "true",
        )

    def test_preflight_vpn_3100(self):
        response = self.client.options(
            "/api/chats/test-chat-cors/generate",
            headers={
                "Origin": "http://100.109.217.63:3100",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            "http://100.109.217.63:3100",
        )
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Credentials"),
            "true",
        )

    @patch("ollama.Client")
    def test_generate_post_origin_header_not_wildcard(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        chunk = MagicMock()
        chunk.message.content = "hi"
        chunk.message.thinking = ""
        chunk.done = True
        mock_client.chat.return_value = iter([chunk])

        response = self.client.post(
            "/api/chats/test-chat-cors/generate",
            json={"prompt": "hello"},
            headers={
                "Origin": "http://100.109.217.63:5100",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            "http://100.109.217.63:5100",
        )
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Credentials"),
            "true",
        )


if __name__ == "__main__":
    unittest.main()
