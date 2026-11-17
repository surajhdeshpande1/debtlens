"""Per-request helpers shared by the route modules."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from flask import g, jsonify, request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import db as DB
from .errors import ApiError
from .models import AuditLog, Project, utcnow
from .security import Principal, current
from .services import get_project


def db() -> Session:
    if "db" not in g:
        g.db = DB.session()
    return g.db


def me() -> Principal:
    return current()


def project(pid: int) -> Project:
    return get_project(db(), pid, current())


def ok(data=None, status: int = 200, **extra):
    payload = data if data is not None else {}
    if extra:
        payload = {**payload, **extra}
    resp = jsonify(payload)
    resp.status_code = status
    return resp


def client_ip() -> str:
    fwd = request.headers.get("X-Forwarded-For", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.headers.get("X-Real-IP") or request.remote_addr or "?")
    return hashlib.sha256(("debtlens:" + ip).encode()).hexdigest()[:24]


def rate_limit(action: str, limit: int, minutes: int = 60, key: str | None = None) -> None:
    """Simple limiter backed by the audit log (no extra infrastructure on Vercel)."""
    key = key or client_ip()
    since = utcnow() - timedelta(minutes=minutes)
    n = db().execute(select(func.count(AuditLog.id)).where(AuditLog.action == action, AuditLog.entity == key,
                                                           AuditLog.created_at >= since)).scalar_one()
    if n >= limit:
        raise ApiError(429, f"too many requests — try again in a few minutes ({limit} per {minutes} min)")


def note(action: str, key: str | None = None, project_id: int | None = None, actor: str = "anonymous") -> None:
    db().add(AuditLog(project_id=project_id, actor=actor, action=action, entity=key or client_ip()))


def args_int(name: str, default: int, lo: int, hi: int) -> int:
    try:
        v = int(request.args.get(name, default))
    except ValueError as e:
        raise ApiError(400, f"'{name}' must be an integer") from e
    return max(lo, min(hi, v))


def args_float(name: str, default: float, lo: float, hi: float) -> float:
    try:
        v = float(request.args.get(name, default))
    except ValueError as e:
        raise ApiError(400, f"'{name}' must be a number") from e
    return max(lo, min(hi, v))
