import os
import requests
from flask import Blueprint, request, jsonify
from models import Preference

stt_bp = Blueprint("stt", __name__)


@stt_bp.route("/stt", methods=["POST"])
def transcribe_audio():
    if "file" not in request.files and "audio" not in request.files:
        return jsonify({"error": "Missing audio file in request ('file' or 'audio')"}), 400

    uploaded_file = request.files.get("file") or request.files.get("audio")
    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "Empty audio file"}), 400

    pref_row = Preference.query.get("stt_server_url")
    custom_stt_url = pref_row.get_value() if pref_row else None
    if custom_stt_url and str(custom_stt_url).strip():
        whisper_server_url = str(custom_stt_url).strip().rstrip("/")
    else:
        whisper_server_url = os.getenv("WHISPER_SERVER_URL", "http://whisper:9000").rstrip("/")

    whisper_api_key = os.getenv("WHISPER_API_KEY")

    target_url = f"{whisper_server_url}/v1/audio/transcriptions"

    headers = {}
    if whisper_api_key:
        headers["Authorization"] = f"Bearer {whisper_api_key}"

    model = request.form.get("model", "whisper-1")
    language = request.form.get("language")
    response_format = request.form.get("response_format", "json")
    temperature = request.form.get("temperature", "0.0")

    data = {
        "model": model,
        "response_format": response_format,
        "temperature": temperature,
    }
    if language:
        data["language"] = language

    files = {
        "file": (
            uploaded_file.filename or "recording.webm",
            uploaded_file.stream,
            uploaded_file.content_type or "audio/webm",
        )
    }

    try:
        resp = requests.post(target_url, files=files, data=data, headers=headers, timeout=120)
        if resp.status_code != 200:
            return jsonify({
                "error": "Whisper transcription failed",
                "status_code": resp.status_code,
                "detail": resp.text[:500],
            }), resp.status_code

        return jsonify(resp.json())
    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": "Failed to reach Whisper server",
            "detail": str(e),
        }), 502
