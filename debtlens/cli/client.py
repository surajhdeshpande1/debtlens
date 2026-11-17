"""Tiny HTTP client for the DebtLens API (stdlib only) and the CLI's config file."""

from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class CliError(Exception):
    """A message for the user; the CLI prints it and exits with a non-zero code."""

    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


def config_dir() -> Path:
    base = os.environ.get("DEBTLENS_CONFIG_DIR")
    if base:
        return Path(base)
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", Path.home())) / "debtlens"
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "debtlens"


def load_config() -> dict:
    p = config_dir() / "config.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_config(cfg: dict) -> Path:
    d = config_dir()
    d.mkdir(parents=True, exist_ok=True)
    p = d / "config.json"
    p.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    try:
        os.chmod(p, 0o600)  # the file holds an API token
    except OSError:
        pass
    return p


class Api:
    def __init__(self, url: str | None = None, token: str | None = None):
        cfg = load_config()
        self.url = (url or os.environ.get("DEBTLENS_URL") or cfg.get("url") or "").rstrip("/")
        self.token = token or os.environ.get("DEBTLENS_TOKEN") or cfg.get("token")

    @property
    def ready(self) -> bool:
        return bool(self.url and self.token)

    def _request(self, method: str, path: str, body=None, raw: bool = False, timeout: float = 90.0):
        if not self.url:
            raise CliError("not connected — run `debtlens login <url>` first (or use --scenario for offline mode)")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + "/api/v1" + path, data=data, method=method)
        req.add_header("Accept", "application/json")
        req.add_header("User-Agent", "debtlens-cli")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("Authorization", "Bearer " + self.token)
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
                payload = r.read()
                if raw:
                    return payload
                return json.loads(payload) if payload else {}
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read()).get("error") or e.reason
            except ValueError:
                msg = e.reason
            if e.code == 401:
                msg = f"{msg} — run `debtlens login` again"
            raise CliError(f"server said {e.code}: {msg}") from None
        except urllib.error.URLError as e:
            raise CliError(f"cannot reach {self.url} ({e.reason})") from None

    def get(self, path: str, **params):
        q = {k: v for k, v in params.items() if v is not None}
        return self._request("GET", path + ("?" + urllib.parse.urlencode(q) if q else ""))

    def post(self, path: str, body=None, **kw):
        return self._request("POST", path, body if body is not None else {}, **kw)

    def put(self, path: str, body=None):
        return self._request("PUT", path, body or {})

    def patch(self, path: str, body=None):
        return self._request("PATCH", path, body or {})

    def download(self, path: str) -> bytes:
        return self._request("GET", path, raw=True)
