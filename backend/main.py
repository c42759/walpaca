import os
from flask import Flask, jsonify
from flask_cors import CORS
from models import db
from routes.api import api_bp


def create_app(test_config=None):
    app = Flask(__name__)

    # Default configuration pointing to root alpaca.db
    base_dir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.getenv(
        "ALPACA_DB_PATH", os.path.abspath(os.path.join(base_dir, "..", "alpaca.db"))
    )
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    if test_config:
        app.config.update(test_config)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": "*",
                "allow_headers": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            }
        },
    )
    db.init_app(app)

    app.register_blueprint(api_bp)

    @app.route("/health")
    def health():
        return jsonify({"status": "healthy", "database": db_path})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
