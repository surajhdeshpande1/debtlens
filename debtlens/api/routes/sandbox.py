"""Visitor sandboxes: a private, resettable copy of an industry scenario (no account needed)."""

from __future__ import annotations

from flask import Blueprint, request

from ...core import scenarios as SC
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import db, me, note, ok, rate_limit
from ..errors import ApiError
from ..models import Project, utcnow
from ..security import issue_jwt, require
from ..services import iso

bp = Blueprint("sandbox", __name__)


def _payload(proj: Project, role: str) -> dict:
    hours = max(0.1, (proj.expires_at - utcnow()).total_seconds() / 3600) if proj.expires_at else 24
    token = issue_jwt({"typ": "sandbox", "pid": proj.id, "role": role}, hours=hours)

    class _P:  # minimal principal for persona lookup
        pass

    pr = _P()
    pr.role = role
    return {"token": token, "role": role, "project": serial.project(proj), "persona": serial.persona(proj, pr),
            "expires_at": iso(proj.expires_at)}


def _scenario_code(data: dict, default: str = "fintech") -> str:
    code = str(data.get("scenario") or default).strip().lower()
    if code not in {s["code"] for s in SC.list_scenarios()}:
        raise ApiError(400, f"unknown scenario '{code}'")
    return code


@bp.post("/sandbox")
def create():
    data = V.body(request)
    code = _scenario_code(data)
    role = V.role(data.get("role"), "tech_lead")
    s = db()
    rate_limit("sandbox.create", 40, 60)
    if S.sandbox_count(s) > 3000:
        raise ApiError(503, "too many open sandboxes right now — please try again later")
    proj = S.create_sandbox(s, code)
    note("sandbox.create", project_id=None)
    S.audit(s, proj.id, None, "sandbox.opened", f"scenario:{code}", role=role)
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
    code = _scenario_code(data, old.scenario_code if old else "fintech")
    rate_limit("sandbox.create", 40, 60)
    if old is not None:
        S.delete_project(s, old.id)
        s.commit()
    proj = S.create_sandbox(s, code)
    note("sandbox.create")
    s.commit()
    return ok(_payload(proj, V.role(data.get("role"), p.role)), 201)
