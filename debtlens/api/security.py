"""Authentication (bcrypt + JWT + API tokens) and role-based permissions.

Every protected endpoint declares the permission it needs; the check runs on the
server, so the role shown in the browser cannot be used to bypass it.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from flask import g, request

from .errors import ApiError

ROLE_LABELS = {
    "admin": "Admin", "tech_lead": "Tech Lead", "developer": "Developer",
    "qa": "QA Engineer", "manager": "Manager", "viewer": "Viewer",
}

# permission -> roles that hold it
PERMISSIONS = {
    "read": set(ROLE_LABELS),
    "simulate": set(ROLE_LABELS),
    "incident.write": {"admin", "tech_lead", "developer", "qa"},
    "rca.write": {"admin", "tech_lead", "developer", "qa"},
    "debt.write": {"admin", "tech_lead", "developer"},
    "debt.prioritize": {"admin", "tech_lead"},
    "plan.approve": {"admin", "tech_lead", "manager"},
    "evidence.write": {"admin", "tech_lead", "developer"},
    "import.write": {"admin", "tech_lead", "developer", "qa"},
    "module.write": {"admin", "tech_lead"},
    "settings.write": {"admin", "tech_lead"},
    "project.manage": {"admin"},
}


def permissions_for(role: str) -> list[str]:
    return sorted(p for p, roles in PERMISSIONS.items() if role in roles)


def secret_key() -> str:
    """JWT signing key: JWT_SECRET if set; otherwise, in production, a key derived (HMAC)
    from the database credentials, which are already secret.  Never a fixed value online."""
    key = os.environ.get("JWT_SECRET")
    if key:
        return key
    production = os.environ.get("VERCEL") or os.environ.get("DEBTLENS_ENV") == "production"
    if production:
        material = (os.environ.get("DATABASE_URL") or os.environ.get("TIDB_DATABASE_URL")
                    or os.environ.get("TIDB_PASSWORD"))
        if not material:
            raise RuntimeError("set JWT_SECRET (or connect a database) before running in production")
        import hmac

        return hmac.new(material.encode(), b"debtlens-jwt-v2", hashlib.sha256).hexdigest()
    return "debtlens-local-development-only-not-for-production"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=11)).decode()


def check_password(pw: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def issue_jwt(claims: dict, hours: float = 12) -> str:
    now = datetime.now(timezone.utc)
    payload = {**claims, "iat": now, "exp": now + timedelta(hours=hours)}
    return jwt.encode(payload, secret_key(), algorithm="HS256")


def new_api_token() -> tuple[str, str, str]:
    raw = "dlt_" + secrets.token_urlsafe(30)
    return raw, raw[:10], hashlib.sha256(raw.encode()).hexdigest()


@dataclass
class Principal:
    kind: str                 # "user" | "sandbox"
    role: str
    name: str
    user_id: int | None = None
    org_id: int | None = None
    project_id: int | None = None   # sandbox: the only project it may touch
    email: str | None = None

    def can(self, perm: str) -> bool:
        return self.role in PERMISSIONS.get(perm, set())

    def to_dict(self) -> dict:
        return {"kind": self.kind, "role": self.role, "role_label": ROLE_LABELS.get(self.role, self.role),
                "name": self.name, "user_id": self.user_id, "org_id": self.org_id, "email": self.email,
                "sandbox_project_id": self.project_id if self.kind == "sandbox" else None,
                "permissions": permissions_for(self.role)}


def _resolve_principal() -> Principal | None:
    from . import db
    from .models import ApiToken, User, utcnow

    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else request.args.get("token")
    if not token:
        return None
    s = db.session()
    try:
        if token.startswith("dlt_"):
            row = s.query(ApiToken).filter_by(token_hash=hashlib.sha256(token.encode()).hexdigest(), revoked=False).first()
            if not row:
                raise ApiError(401, "invalid API token")
            u = s.get(User, row.user_id)
            if not u or not u.is_active:
                raise ApiError(401, "user disabled")
            row.last_used_at = utcnow()
            s.commit()
            return Principal("user", u.role, u.name, u.id, u.org_id, email=u.email)
        try:
            claims = jwt.decode(token, secret_key(), algorithms=["HS256"])
        except jwt.ExpiredSignatureError as e:
            raise ApiError(401, "session expired, sign in again") from e
        except jwt.InvalidTokenError as e:
            raise ApiError(401, "invalid token") from e
        if claims.get("typ") == "sandbox":
            name = str(claims.get("name") or "")[:80] or f"Sandbox visitor ({ROLE_LABELS.get(claims['role'], '')})"
            return Principal("sandbox", claims["role"], name, project_id=int(claims["pid"]))
        u = s.get(User, int(claims["sub"]))
        if not u or not u.is_active:
            raise ApiError(401, "user disabled")
        return Principal("user", u.role, u.name, u.id, u.org_id, email=u.email)
    finally:
        s.close()


def current() -> Principal:
    if "principal" not in g:
        g.principal = _resolve_principal()
    if g.principal is None:
        raise ApiError(401, "sign in or open a sandbox first")
    return g.principal


def optional_principal() -> Principal | None:
    if "principal" not in g:
        g.principal = _resolve_principal()
    return g.principal


def require(perm: str = "read"):
    """Decorator: authenticated principal holding ``perm``."""

    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            p = current()
            if not p.can(perm):
                raise ApiError(403, f"your role ({ROLE_LABELS.get(p.role, p.role)}) cannot do this — needs '{perm}'")
            return fn(*a, **kw)

        wrapper.permission = perm  # type: ignore[attr-defined]
        return wrapper

    return deco
