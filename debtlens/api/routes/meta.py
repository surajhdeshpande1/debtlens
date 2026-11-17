"""Health, capabilities and reference data used by the website and the CLI."""

from __future__ import annotations

import time

from flask import Blueprint, request

from ... import APP_NAME, APP_TAGLINE, __version__
from ...core import embeddings as EMB
from ...core import scenarios as SC
from ...core import simulation as SIM
from ...core.economics import EconomicParams
from ...core.similarity import DEFAULT_ALPHA, DEFAULT_TAU
from .. import db as DB
from .. import services as S
from ..deps import db, ok
from ..models import DEBT_CATEGORIES, DEBT_STATUSES, INCIDENT_STATUSES, PRIORITIES, ROLES, SEVERITIES
from ..security import PERMISSIONS, ROLE_LABELS

bp = Blueprint("meta", __name__)


@bp.get("/health")
def health():
    out = {"ok": True, "app": APP_NAME, "version": __version__, "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    try:
        out["database"] = DB.ping()
    except Exception as e:  # never leak connection strings
        out["ok"] = False
        out["database"] = {"error": type(e).__name__}
    if request.args.get("warm") == "1":
        out["warm"] = S.warm_cache(db(), budget_s=float(request.args.get("budget", 25)))
    out["model"] = EMB.status()
    return ok(out, 200 if out["ok"] else 503)


@bp.get("/meta")
def meta():
    return ok({
        "app": APP_NAME, "tagline": APP_TAGLINE, "version": __version__,
        "roles": [{"code": r, "label": ROLE_LABELS[r]} for r in ROLES],
        "permissions": {perm: sorted(roles) for perm, roles in PERMISSIONS.items()},
        "enums": {"severity": SEVERITIES, "incident_status": INCIDENT_STATUSES, "debt_status": DEBT_STATUSES,
                  "debt_category": DEBT_CATEGORIES, "priority": PRIORITIES},
        "defaults": {"alpha": DEFAULT_ALPHA, "tau": DEFAULT_TAU, "economics": EconomicParams().to_dict(),
                     "forecast": {k: v for k, v in SIM.ForecastConfig().__dict__.items()},
                     "policies": SIM.POLICIES},
        "scenarios": SC.list_scenarios(),
        "model": EMB.status(),
    })


@bp.get("/scenarios")
def scenarios():
    return ok({"scenarios": SC.list_scenarios()})


@bp.get("/scenarios/compare")
def compare():
    """The same engine run over every industry scenario, side by side (no sign-in needed)."""
    try:
        budget = max(4.0, min(400.0, float(request.args.get("budget", 40))))
    except ValueError:
        budget = 40.0
    return ok(S.compare_scenarios(db(), budget))
