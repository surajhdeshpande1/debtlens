"""Visitor sandboxes: a private, resettable copy of an industry scenario (no account needed)."""

from __future__ import annotations

from flask import Blueprint, request

from ...core import packs as PK
from ...core import scenarios as SC
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import db, me, note, ok, rate_limit
from ..errors import ApiError
from ..models import Project, utcnow
from ..security import Principal, issue_jwt, require
from ..services import iso

bp = Blueprint("sandbox", __name__)


def _payload(proj: Project, role: str) -> dict:
    hours = max(0.1, (proj.expires_at - utcnow()).total_seconds() / 3600) if proj.expires_at else 24
    persona = serial.persona(proj, Principal("sandbox", role, "", project_id=proj.id))
    claims = {"typ": "sandbox", "pid": proj.id, "role": role}
    if persona:
        claims["name"] = f"{persona['name']} (sandbox)"
    token = issue_jwt(claims, hours=hours)
    return {"token": token, "role": role, "project": serial.project(proj), "persona": persona,
            "expires_at": iso(proj.expires_at)}


def _scenario_code(data: dict, default: str = "fintech") -> str:
    code = str(data.get("scenario") or default).strip().lower()
    if not SC.known(code):
        raise ApiError(400, f"unknown scenario '{code}'")
    return code


def _source(data: dict, default: str = "fintech") -> str | dict:
    """A scenario or bundled pack code, or an uploaded pack (validated here: it comes from anyone)."""
    if data.get("pack") is not None:
        try:
            pack, _ = PK.validate(data["pack"])
        except PK.PackError as e:
            raise ApiError(400, str(e), problems=e.problems[:50]) from None
        return pack
    return _scenario_code(data, default)


@bp.post("/sandbox")
def create():
    data = V.body(request)
    src = _source(data)
    role = V.role(data.get("role"), "tech_lead")
    s = db()
    rate_limit("sandbox.create", 40, 60)
    if S.sandbox_count(s) > 3000:
        raise ApiError(503, "too many open sandboxes right now — please try again later")
    proj = S.create_sandbox(s, src)
    note("sandbox.create", project_id=None)
    S.audit(s, proj.id, None, "sandbox.opened",
            f"pack:{src['code']}" if isinstance(src, dict) else f"scenario:{src}", role=role)
    s.commit()
    return ok(_payload(proj, role), 201)


@bp.post("/sandbox/role")
@require("read")
def switch_role():
    p = me()
    if p.kind != "sandbox":
        raise ApiError(400, "role switching is only for sandboxes — ask your admin to change your role")
    role = V.role(V.body(request).get("role"))
    proj = S.get_project(db(), p.project_id, p)
    return ok(_payload(proj, role))


@bp.post("/sandbox/reset")
@require("read")
def reset():
    p = me()
    if p.kind != "sandbox":
        raise ApiError(400, "only sandboxes can be reset")
    data = V.body(request)
    s = db()
    old = s.get(Project, p.project_id)
    kept = ((old.settings or {}).get("pack") if old is not None else None)
    if data.get("scenario") or data.get("pack") is not None or not isinstance(kept, dict):
        src = _source(data, old.scenario_code if old is not None and old.scenario_code != S.UPLOADED else "fintech")
    else:
        src = kept  # an uploaded pack resets to itself
    rate_limit("sandbox.create", 40, 60)
    if old is not None:
        S.delete_project(s, old.id)
        s.commit()
    proj = S.create_sandbox(s, src)
    note("sandbox.create")
    s.commit()
    return ok(_payload(proj, V.role(data.get("role"), p.role)), 201)
