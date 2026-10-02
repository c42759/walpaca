import json
import unittest

from unittest.mock import patch
from unittest.mock import MagicMock
from main import create_app


class TTSEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True})
        self.client = self.app.test_client()

    def test_tts_missing_text_returns_400(self):
        response = self.client.post("/api/tts", json={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_tts_options_preflight(self):
        response = self.client.options(
            "/api/tts",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(
            response.headers.get("Access-Control-Allow-Origin"),
            ["*", "http://localhost:3000"],
        )

    @patch("routes.api.urllib.request.urlopen")
    def test_tts_valid_request_proxies_to_kokoro(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.headers = {"Content-Type": "audio/mpeg"}
        mock_response.read.side_effect = [b"fake_audio_bytes", b""]
        mock_urlopen.return_value = mock_response

        response = self.client.post(
            "/api/tts",
            json={
                "text": "Hello world",
                "voice": "af_heart",
                "speed": 1.0,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Content-Type"), "audio/mpeg")
        self.assertEqual(response.data, b"fake_audio_bytes")

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.full_url, "http://kokoro:8880/v1/audio/speech")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(
            json.loads(req.data.decode("utf-8")),
            {
                "model": "kokoro",
                "input": "Hello world",
                "voice": "af_heart",
                "speed": 1.0,
                "response_format": "mp3",
            },
        )


if __name__ == "__main__":
    unittest.main()
