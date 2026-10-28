import io
import unittest
from unittest.mock import patch, MagicMock
from main import create_app


class STTEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True})
        self.client = self.app.test_client()
        with self.app.app_context():
            from models import Preference, db
            pref = Preference.query.get("pin_security_enabled")
            if pref:
                pref.set_value(False)
            else:
                pref = Preference(key="pin_security_enabled")
                pref.set_value(False)
                db.session.add(pref)
            db.session.commit()

    def test_stt_missing_file_returns_400(self):
        response = self.client.post("/api/stt", data={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_stt_options_preflight(self):
        response = self.client.options(
            "/api/stt",
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

    @patch("routes.stt.requests.post")
    def test_stt_valid_file_proxies_to_whisper(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"text": "Hello, this is a test audio transcription."}
        mock_post.return_value = mock_resp

        audio_bytes = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt ")
        response = self.client.post(
            "/api/stt",
            data={
                "file": (audio_bytes, "test.wav", "audio/wav"),
                "model": "whisper-1",
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("text"), "Hello, this is a test audio transcription.")

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertTrue(args[0].endswith("/v1/audio/transcriptions"))
        self.assertIn("file", kwargs.get("files", {}))

    @patch("routes.stt.requests.post")
    def test_stt_whisper_error_response(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Whisper Error"
        mock_post.return_value = mock_resp

        audio_bytes = io.BytesIO(b"fake_audio_bytes")
        response = self.client.post(
            "/api/stt",
            data={
                "file": (audio_bytes, "test.webm", "audio/webm"),
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 500)
        data = response.get_json()
        self.assertIn("error", data)
        self.assertIn("Whisper transcription failed", data["error"])


if __name__ == "__main__":
    unittest.main()
