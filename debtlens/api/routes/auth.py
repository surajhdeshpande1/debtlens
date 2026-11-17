"""Accounts: register a team, sign in, API tokens for the CLI, team members."""

from __future__ import annotations

import re

from flask import Blueprint, request
from sqlalchemy import func, select

from .. import serial
from .. import validation as V
from ..deps import db, me, note, ok, rate_limit
from ..errors import ApiError
from ..models import ApiToken, Organization, Project, User, utcnow
from ..security import ROLE_LABELS, check_password, hash_password, issue_jwt, new_api_token, require
from ..services import audit, iso

bp = Blueprint("auth", __name__)
_DUMMY_HASH = hash_password("timing-equaliser-not-a-password")


def _slug(s, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "team"
    slug, n = base, 1
    while s.execute(select(Organization.id).where(Organization.slug == slug)).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


def _session(u: User, org: Organization) -> dict:
    token = issue_jwt({"sub": str(u.id), "typ": "user", "org": org.id}, hours=12)
    return {"token": token, "user": serial.user(u), "org": {"id": org.id, "name": org.name, "slug": org.slug}}


@bp.post("/auth/register")
def register():
    data = V.body(request)
    rate_limit("auth.register", 10, 60)
    name = V.text(data, "name", required=True, min_len=2, max_len=120)
    email = V.email(data.get("email"))
    pw = V.password(data.get("password"))
    org_name = V.text(data, "org_name", max_len=120) or f"{name.split()[0]}'s team"
    s = db()
    if s.execute(select(User.id).where(User.email == email)).first():
        raise ApiError(409, "an account with this email already exists — sign in instead")
    org = Organization(name=org_name, slug=_slug(s, org_name))
    s.add(org)
    s.flush()
    u = User(org_id=org.id, name=name, email=email, password_hash=hash_password(pw), role="admin",
             title=V.text(data, "title", max_len=160) or "Team administrator", last_login_at=utcnow())
    s.add(u)
    s.flush()
    note("auth.register")
    audit(s, None, None, "team.created", f"org:{org.id}", by=name)
    s.commit()
    return ok(_session(u, org), 201)


@bp.post("/auth/login")
def login():
    data = V.body(request)
    rate_limit("auth.fail", 12, 15)
    email = str(data.get("email") or "").strip().lower()
    pw = str(data.get("password") or "")
    s = db()
    u = s.execute(select(User).where(User.email == email)).scalar_one_or_none() if email else None
    if u is None or not u.can_login:
        check_password(pw, _DUMMY_HASH)
        note("auth.fail")
        s.commit()
        raise ApiError(401, "wrong email or password")
    if not check_password(pw, u.password_hash):
        note("auth.fail")
        s.commit()
        raise ApiError(401, "wrong email or password")
    if not u.is_active:
        raise ApiError(403, "this account has been disabled by your admin")
    u.last_login_at = utcnow()
    org = s.get(Organization, u.org_id)
    s.commit()
    return ok(_session(u, org))


@bp.get("/auth/me")
@require("read")
def whoami():
    p = me()
    s = db()
    out = {"principal": p.to_dict(), "role_labels": ROLE_LABELS}
    if p.kind == "user":
        org = s.get(Organization, p.org_id)
        out["org"] = {"id": org.id, "name": org.name, "slug": org.slug}
        out["user"] = serial.user(s.get(User, p.user_id))
    else:
        proj = s.get(Project, p.project_id)
        if proj is None:
            raise ApiError(410, "sandbox expired — open a new one")
        out["sandbox"] = {"project": serial.project(proj), "persona": serial.persona(proj, p),
                          "expires_at": iso(proj.expires_at)}
    return ok(out)


@bp.post("/auth/password")
@require("read")
def change_password():
    p = me()
    if p.kind != "user":
        raise ApiError(403, "sandbox visitors have no password")
    data = V.body(request)
    s = db()
    u = s.get(User, p.user_id)
    if not check_password(str(data.get("current") or ""), u.password_hash):
        raise ApiError(400, "current password is wrong")
    u.password_hash = hash_password(V.password(data.get("new")))
    s.commit()
    return ok({"changed": True})


# ----------------------------------------------------------------------------- API tokens (CLI / CI)

@bp.get("/auth/tokens")
@require("read")
def list_tokens():
    p = me()
    if p.kind != "user":
        return ok({"tokens": []})
    rows = db().execute(select(ApiToken).where(ApiToken.user_id == p.user_id).order_by(ApiToken.id.desc())).scalars()
    return ok({"tokens": [{"id": t.id, "name": t.name, "prefix": t.prefix, "revoked": t.revoked,
                           "created_at": iso(t.created_at), "last_used_at": iso(t.last_used_at)} for t in rows]})


@bp.post("/auth/tokens")
@require("read")
def create_token():
    p = me()
    if p.kind != "user":
        raise ApiError(403, "sign in with a real account to create API tokens")
    data = V.body(request)
    name = V.text(data, "name", max_len=80) or "debtlens CLI"
    s = db()
    active = s.execute(select(func.count(ApiToken.id)).where(ApiToken.user_id == p.user_id,
                                                             ApiToken.revoked.is_(False))).scalar_one()
    if active >= 20:
        raise ApiError(400, "revoke an old token first (20 active tokens max)")
    raw, prefix, digest = new_api_token()
    t = ApiToken(user_id=p.user_id, name=name, prefix=prefix, token_hash=digest)
    s.add(t)
    audit(s, None, p, "token.created", f"token:{prefix}")
    s.commit()
    return ok({"id": t.id, "name": name, "prefix": prefix, "token": raw,
               "note": "Copy this token now — it is shown only once."}, 201)


@bp.delete("/auth/tokens/<int:tid>")
@require("read")
def revoke_token(tid: int):
    p = me()
    s = db()
    t = s.get(ApiToken, tid)
    if t is None or t.user_id != p.user_id:
        raise ApiError(404, "token not found")
    t.revoked = True
    s.commit()
    return ok({"revoked": True})


# ----------------------------------------------------------------------------- team

@bp.get("/team")
@require("read")
def team():
    p = me()
    s = db()
    if p.kind == "sandbox":
        proj = s.get(Project, p.project_id)
        people = (proj.settings or {}).get("people") or {}
        return ok({"members": [{"id": k, "name": v["name"], "role": v["role"], "title": v.get("title"),
                                "role_label": ROLE_LABELS.get(v["role"]), "persona": True} for k, v in people.items()],
                   "sandbox": True})
    users = s.execute(select(User).where(User.org_id == p.org_id).order_by(User.id)).scalars().all()
    return ok({"members": [serial.user(u, show_email=p.role in ("admin", "tech_lead")) for u in users]})


@bp.post("/team")
@require("project.manage")
def add_member():
    p = me()
    if p.kind != "user":
        raise ApiError(403, "sandbox teams are fixed personas")
    data = V.body(request)
    s = db()
    email = V.email(data.get("email"))
    if s.execute(select(User.id).where(User.email == email)).first():
        raise ApiError(409, "that email already has an account")
    u = User(org_id=p.org_id, name=V.text(data, "name", required=True, min_len=2, max_len=120), email=email,
             password_hash=hash_password(V.password(data.get("password"))), role=V.role(data.get("role")),
             title=V.text(data, "title", max_len=160))
    s.add(u)
    audit(s, None, p, "member.added", f"user:{email}", role=u.role)
    s.commit()
    return ok({"member": serial.user(u)}, 201)


@bp.patch("/team/<int:uid>")
@require("project.manage")
def update_member(uid: int):
    p = me()
    data = V.body(request)
    s = db()
    u = s.get(User, uid)
    if u is None or u.org_id != p.org_id:
        raise ApiError(404, "member not found")
    if "role" in data:
        new_role = V.role(data["role"])
        if u.role == "admin" and new_role != "admin":
            admins = s.execute(select(func.count(User.id)).where(User.org_id == p.org_id, User.role == "admin",
                                                                 User.is_active.is_(True))).scalar_one()
            if admins <= 1:
                raise ApiError(400, "a team needs at least one admin")
        u.role = new_role
    if "title" in data:
        u.title = V.text(data, "title", max_len=160)
    if "name" in data:
        u.name = V.text(data, "name", required=True, min_len=2, max_len=120)
    if "is_active" in data:
        if uid == p.user_id and not data["is_active"]:
            raise ApiError(400, "you cannot disable yourself")
        u.is_active = bool(data["is_active"])
    if data.get("password"):
        u.password_hash = hash_password(V.password(data["password"]))
    audit(s, None, p, "member.updated", f"user:{uid}", **{k: data[k] for k in ("role", "is_active") if k in data})
    s.commit()
    return ok({"member": serial.user(u)})


DEMO_TEAM = [("tech_lead", "Tech Lead (demo)", "Owns architecture and remediation priorities"),
             ("developer", "Developer (demo)", "Fixes incidents, records 5 Whys, pays down debt"),
             ("qa", "QA Engineer (demo)", "Verifies fixes, watches regressions"),
             ("manager", "Manager (demo)", "Approves remediation budgets"),
             ("viewer", "Viewer (demo)", "Read-only stakeholder")]


@bp.post("/team/demo")
@require("project.manage")
def demo_team():
    """One account per role inside *your* team, for a viva or a walkthrough."""
    p = me()
    if p.kind != "user":
        raise ApiError(403, "sign in with a real account first")
    data = V.body(request)
    pw = V.password(data.get("password"))
    s = db()
    org = s.get(Organization, p.org_id)
    created, existing = [], []
    for role, name, title in DEMO_TEAM:
        email = f"{role.replace('_', '.')}@{org.slug}.demo"
        u = s.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if u is None:
            s.add(User(org_id=org.id, name=name, email=email, password_hash=hash_password(pw), role=role, title=title))
            created.append({"email": email, "role": role})
        elif u.org_id == org.id:
            u.password_hash = hash_password(pw)
            existing.append({"email": email, "role": role})
    audit(s, None, p, "member.demo_team", f"org:{org.id}", created=len(created))
    s.commit()
    return ok({"created": created, "updated": existing})
