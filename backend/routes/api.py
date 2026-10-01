import urllib.error
import urllib.request
from flask import Blueprint

from routes.attachments import attachments_bp
from routes.chats import chats_bp
from routes.folders import folders_bp
from routes.generate import generate_bp, clean_base64_image, evaluate_lorebook_entries
from routes.instances import instances_bp, fetch_live_instance_models
from routes.messages import messages_bp
from routes.model_preferences import model_preferences_bp
from routes.search import search_bp
from routes.tts import tts_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")

api_bp.register_blueprint(folders_bp)
api_bp.register_blueprint(chats_bp)
api_bp.register_blueprint(messages_bp)
api_bp.register_blueprint(attachments_bp)
api_bp.register_blueprint(instances_bp)
api_bp.register_blueprint(model_preferences_bp)
api_bp.register_blueprint(search_bp)
api_bp.register_blueprint(tts_bp)
api_bp.register_blueprint(generate_bp)
