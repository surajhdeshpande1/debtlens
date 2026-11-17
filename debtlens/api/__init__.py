"""DebtLens REST API (Flask).  ``create_app()`` is used by Vercel (app.py), by
``debtlens serve`` for the offline MySQL demo, and by the tests."""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from .. import __version__
from . import db as DB
from .errors import ApiError

_REPO_PUBLIC = Path(__file__).resolve().parents[2] / "public"   # running from the git checkout / Vercel
_PKG_PUBLIC = Path(__file__).resolve().parents[1] / "web"        # installed from PyPI (`debtlens serve`)
PUBLIC_DIR = _REPO_PUBLIC if (_REPO_PUBLIC / "index.html").is_file() else _PKG_PUBLIC
log = logging.getLogger("debtlens")


def create_app(database_url: str | None = None, testing: bool = False) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=12 * 1024 * 1024, JSON_SORT_KEYS=False, TESTING=testing)
    app.json.sort_keys = False  # type: ignore[attr-defined]
    if database_url:
        DB.configure(database_url)

    from .routes import ALL

    for bp in ALL:
        app.register_blueprint(bp, url_prefix="/api/v1")

    @app.before_request
    def _start():
        g.t0 = time.perf_counter()
        if request.path.startswith("/api/"):
            DB.init_db()

    @app.after_request
    def _headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if request.path.startswith("/api/"):
            resp.headers.setdefault("Cache-Control", "no-store")
            resp.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - g.get('t0', time.perf_counter())) * 1000:.0f}"
        else:
            resp.headers.setdefault("X-Frame-Options", "DENY")
        return resp

    @app.teardown_appcontext
    def _close(exc):
        s = g.pop("db", None)
        if s is not None:
            if exc is not None:
                s.rollback()
            s.close()

    @app.errorhandler(ApiError)
    def _api_error(e: ApiError):
        s = g.get("db")
        if s is not None:
            s.rollback()
        resp = jsonify({"error": e.message, **e.extra})
        resp.status_code = e.status
        return resp

    @app.errorhandler(HTTPException)
    def _http_error(e: HTTPException):
        if request.path.startswith("/api/"):
            resp = jsonify({"error": e.description if e.code != 404 else "no such endpoint"})
            resp.status_code = e.code or 500
            return resp
        return e

    @app.errorhandler(Exception)
    def _crash(e: Exception):
        log.exception("unhandled error on %s %s", request.method, request.path)
        s = g.get("db")
        if s is not None:
            s.rollback()
        if testing:
            raise e
        resp = jsonify({"error": "internal error — the incident has been logged", "type": type(e).__name__})
        resp.status_code = 500
        return resp

    # The website (plain HTML/CSS/JS).  On Vercel the CDN serves public/ directly.
    @app.get("/")
    def _index():
        return send_from_directory(PUBLIC_DIR, "index.html")

    @app.get("/<path:path>")
    def _static(path: str):
        if path.startswith("api/"):
            return jsonify({"error": "no such endpoint"}), 404
        full = PUBLIC_DIR / path
        if full.is_file():
            return send_from_directory(PUBLIC_DIR, path)
        if (full / "index.html").is_file():
            return send_from_directory(full, "index.html")
        return send_from_directory(PUBLIC_DIR, "index.html")

    app.config["DEBTLENS_VERSION"] = __version__
    if os.environ.get("DEBTLENS_LOG_LEVEL"):
        logging.basicConfig(level=os.environ["DEBTLENS_LOG_LEVEL"])
    return app
