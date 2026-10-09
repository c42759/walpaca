import os
import re

from models import db, Preference, PinSession
from flask import Flask, jsonify, request
from flask_cors import CORS
from routes.api import api_bp
from utils.logger import init_logging_middleware


def create_app(test_config=None):
    app = Flask(__name__)
    init_logging_middleware(app)

    # Default configuration pointing to root alpaca.db
    base_dir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.getenv(
        "ALPACA_DB_PATH", os.path.abspath(os.path.join(base_dir, "..", "alpaca.db"))
    )
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    if test_config:
        app.config.update(test_config)

    cors_domains_env = os.getenv("CORS_DOMAINS", "").strip()
    if cors_domains_env and cors_domains_env != "*":
        origins = [domain.strip() for domain in cors_domains_env.split(",") if domain.strip()]
    else:
        origins = [re.compile(r"^https?://.*$"), re.compile(r"^null$")]

    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/*": {
                "origins": origins,
                "allow_headers": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "supports_credentials": True,
            }
        },
    )
    db.init_app(app)

    with app.app_context():
        db.create_all()
        try:
            with db.engine.connect() as conn:
                res_inst = conn.execute(db.text("PRAGMA table_info(instance)")).fetchall()
                inst_cols = [r[1] for r in res_inst]
                if "is_enabled" not in inst_cols and res_inst:
                    conn.execute(db.text("ALTER TABLE instance ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 0"))
                    conn.execute(db.text("UPDATE instance SET is_enabled = 1 WHERE rowid = (SELECT rowid FROM instance LIMIT 1)"))
                    conn.commit()

                res_pref = conn.execute(db.text("PRAGMA table_info(model_preferences)")).fetchall()
                pref_cols = [r[1] for r in res_pref]
                if "instance_id" not in pref_cols and res_pref:
                    conn.execute(db.text("ALTER TABLE model_preferences ADD COLUMN instance_id TEXT"))
                    conn.commit()
                if "model_id" not in pref_cols and res_pref:
                    conn.execute(db.text("ALTER TABLE model_preferences ADD COLUMN model_id TEXT"))
                    conn.commit()
        except Exception as e:
            app.logger.warning(f"Database schema auto-check: {e}")

    app.register_blueprint(api_bp)

    @app.before_request
    def enforce_pin_security():
        if request.method == "OPTIONS" or request.path == "/health":
            return None

        # Public auth routes
        if request.path.startswith("/api/auth/"):
            return None

        # Guard all protected API routes if PIN security is enabled
        if request.path.startswith("/api/"):
            try:
                pref = db.session.get(Preference, "pin_security_enabled")
                if pref and pref.get_value() is True:
                    token = request.cookies.get("walpaca_session")
                    if not token:
                        auth_header = request.headers.get("Authorization", "")
                        if auth_header.startswith("Bearer "):
                            token = auth_header[7:].strip()
                        elif request.headers.get("X-Walpaca-Session"):
                            token = request.headers.get("X-Walpaca-Session").strip()

                    if not token:
                        return jsonify({
                            "error": "PIN authentication required",
                            "auth_required": True,
                        }), 401

                    session = db.session.get(PinSession, token)
                    if not session or not session.is_valid():
                        if session and not session.is_valid():
                            db.session.delete(session)
                            db.session.commit()
                        return jsonify({
                            "error": "PIN session expired or invalid",
                            "auth_required": True,
                        }), 401
            except Exception as e:
                app.logger.error(f"Error checking PIN security: {e}")
                # In case table or query fails during startup/migration
                pass

        return None

    @app.route("/health")
    def health():
        return jsonify({"status": "healthy", "database": db_path})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
