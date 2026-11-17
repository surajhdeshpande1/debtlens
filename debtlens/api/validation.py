"""Input validation for API payloads: every value that reaches the database passes here."""

from __future__ import annotations

import re

from ..core import ingest
from .errors import ApiError
from .models import DEBT_CATEGORIES, DEBT_STATUSES, INCIDENT_STATUSES, PRIORITIES, ROLES, SEVERITIES

EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,120}\.[a-z]{2,24}$", re.IGNORECASE)


def body(req) -> dict:
    data = req.get_json(silent=True)
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise ApiError(400, "expected a JSON object")
    return data


def text(data: dict, key: str, *, required: bool = False, max_len: int = 255, min_len: int = 0,
         default: str | None = None) -> str | None:
    v = data.get(key, default)
    if v is None:
        if required:
            raise ApiError(400, f"'{key}' is required")
        return None
    v = str(v).strip()
    if required and len(v) < max(min_len, 1):
        raise ApiError(400, f"'{key}' is required" + (f" (at least {min_len} characters)" if min_len > 1 else ""))
    if len(v) > max_len:
        raise ApiError(400, f"'{key}' is longer than {max_len} characters")
    return v


def number(data: dict, key: str, *, default: float | None = None, lo: float | None = None, hi: float | None = None) -> float | None:
    v = data.get(key, default)
    if v is None or v == "":
        return default
    try:
        f = float(v)
    except (TypeError, ValueError) as e:
        raise ApiError(400, f"'{key}' must be a number") from e
    if f != f or (lo is not None and f < lo) or (hi is not None and f > hi):
        raise ApiError(400, f"'{key}' must be between {lo} and {hi}")
    return f


def choice(data: dict, key: str, options, *, default: str | None = None) -> str | None:
    v = data.get(key, default)
    if v is None:
        return None
    v = str(v).strip().upper() if all(o.isupper() for o in options) else str(v).strip().lower()
    if v not in options:
        raise ApiError(400, f"'{key}' must be one of {', '.join(options)}")
    return v


def email(v) -> str:
    v = str(v or "").strip().lower()
    if not EMAIL.match(v):
        raise ApiError(400, "enter a valid email address")
    return v


def password(v) -> str:
    v = str(v or "")
    if len(v) < 8:
        raise ApiError(400, "password must be at least 8 characters")
    if len(v) > 128:
        raise ApiError(400, "password is too long")
    return v


def role(v, default: str = "developer") -> str:
    v = str(v or default).strip().lower().replace(" ", "_").replace("-", "_")
    if v == "techlead":
        v = "tech_lead"
    if v not in ROLES:
        raise ApiError(400, f"role must be one of {', '.join(ROLES)}")
    return v


def int_list(v, key: str) -> list[int]:
    if v is None:
        return []
    if not isinstance(v, list):
        raise ApiError(400, f"'{key}' must be a list")
    try:
        return [int(x) for x in v][:200]
    except (TypeError, ValueError) as e:
        raise ApiError(400, f"'{key}' must contain ids") from e


def clean_incident(data: dict, partial: bool = False) -> dict:
    out: dict = {}
    if not partial or "title" in data:
        out["title"] = text(data, "title", required=True, min_len=5, max_len=250)
    if not partial or "description" in data:
        out["description"] = text(data, "description", max_len=6000, default="") or ""
    if not partial or "module" in data:
        out["module"] = (text(data, "module", max_len=100, default="unassigned") or "unassigned").lower()
    if not partial or "severity" in data:
        out["severity"] = ingest.norm_severity(data.get("severity"), "") or choice(data, "severity", SEVERITIES, default="MEDIUM")
    if not partial or "status" in data:
        out["status"] = ingest.norm_status(data.get("status"), "") or choice(data, "status", INCIDENT_STATUSES, default="OPEN")
    if not partial or "effort_hours" in data:
        out["effort_hours"] = number(data, "effort_hours", default=4.0, lo=0, hi=1000)
    for k in ("reported_at", "resolved_at"):
        if k in data:
            out[k] = ingest.parse_date(data.get(k))
    if "reported_by" in data:
        out["reported_by"] = text(data, "reported_by", max_len=120)
    if "external_ref" in data:
        out["external_ref"] = text(data, "external_ref", max_len=300)
    return out


def clean_debt(data: dict, partial: bool = False) -> dict:
    out: dict = {}
    if not partial or "title" in data:
        out["title"] = text(data, "title", required=True, min_len=5, max_len=250)
    if not partial or "description" in data:
        out["description"] = text(data, "description", max_len=6000, default="") or ""
    if not partial or "module" in data:
        out["module"] = (text(data, "module", max_len=100, default="unassigned") or "unassigned").lower()
    if not partial or "category" in data:
        out["category"] = choice(data, "category", DEBT_CATEGORIES, default="CODE_SMELL")
    if not partial or "priority" in data:
        out["priority"] = choice(data, "priority", PRIORITIES, default="MEDIUM")
    if not partial or "status" in data:
        out["status"] = choice(data, "status", DEBT_STATUSES, default="IDENTIFIED")
    if not partial or "principal" in data:
        out["principal"] = number(data, "principal", default=8.0, lo=0.5, hi=2000)
    if "file_path" in data:
        out["file_path"] = text(data, "file_path", max_len=255) or None
    if "assigned_to" in data:
        out["assigned_to"] = text(data, "assigned_to", max_len=120) or None
    if "incident_ids" in data:
        out["incident_ids"] = int_list(data.get("incident_ids"), "incident_ids")
    if "prerequisite_ids" in data:
        out["prerequisite_ids"] = int_list(data.get("prerequisite_ids"), "prerequisite_ids")
    if "root_cause_id" in data:
        v = data.get("root_cause_id")
        out["root_cause_id"] = int(v) if v not in (None, "") else None
    return out


def clean_economics(data: dict) -> dict:
    """Economic parameters a Tech Lead may tune (what-if sliders use the same checks)."""
    out = {}
    for key, lo, hi in (("lambda_churn", 0, 5), ("lambda_blast", 0, 20), ("w_interest", 0, 1), ("w_blast", 0, 1),
                        ("w_severity", 0, 1), ("w_centrality", 0, 1), ("breakeven_boost", 1, 3)):
        if key in data and data[key] is not None:
            out[key] = number(data, key, lo=lo, hi=hi)
    if "severity_weight" in data and data["severity_weight"] is not None:
        sw = data["severity_weight"]
        if not isinstance(sw, dict):
            raise ApiError(400, "'severity_weight' must be an object")
        out["severity_weight"] = {s: number(sw, s, lo=0, hi=20) for s in SEVERITIES if s in sw}
    return out
