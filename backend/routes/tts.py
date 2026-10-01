import json
import os
import urllib.request
import urllib.error
from flask import Blueprint, request, jsonify, Response, stream_with_context

tts_bp = Blueprint("tts", __name__)


@tts_bp.route("/tts", methods=["GET", "POST", "OPTIONS"])
def text_to_speech():
    if request.method == "OPTIONS":
        resp = Response("", status=200)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    if request.method == "POST":
        data = request.get_json(silent=True) or request.form or {}
    else:
        data = request.args

    text = data.get("text") or data.get("input")
    if not text or not str(text).strip():
        return jsonify({"error": "Missing required parameter 'text' or 'input'"}), 400

    voice = data.get("voice") or "af_heart"
    model = data.get("model") or "kokoro"
    try:
        speed = float(data.get("speed", 1.0))
    except (ValueError, TypeError):
        speed = 1.0

    response_format = data.get("response_format") or "mp3"

    payload = {
        "model": model,
        "input": str(text).strip(),
        "voice": voice,
        "speed": speed,
        "response_format": response_format,
    }

    tts_server_url = os.getenv("TTS_SERVER_URL", "http://kokoro:8880").rstrip("/")
    tts_api_key = os.getenv("TTS_API_KEY")

    target_url = f"{tts_server_url}/v1/audio/speech"

    payload_bytes = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if tts_api_key:
        headers["Authorization"] = f"Bearer {tts_api_key}"

    req = urllib.request.Request(
        target_url, data=payload_bytes, headers=headers, method="POST"
    )

    try:
        resp = urllib.request.urlopen(req, timeout=60)
        content_type = (
            resp.headers.get("Content-Type") or f"audio/{response_format}"
        )

        def generate():
            while True:
                chunk = resp.read(4096)
                if not chunk:
                    break
                yield chunk

        res = Response(stream_with_context(generate()), content_type=content_type)
        res.headers["Access-Control-Allow-Origin"] = "*"
        return res

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        return (
            jsonify(
                {
                    "error": "TTS server error",
                    "status_code": e.code,
                    "detail": detail,
                }
            ),
            e.code,
        )
    except urllib.error.URLError as e:
        return (
            jsonify(
                {
                    "error": "Failed to reach TTS server",
                    "detail": str(e.reason),
                }
            ),
            502,
        )
