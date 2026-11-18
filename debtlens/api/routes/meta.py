"""Health, capabilities and reference data used by the website and the CLI."""

from __future__ import annotations

import time

from flask import Blueprint, Response, request

from ... import APP_NAME, APP_TAGLINE, __version__
from ...core import embeddings as EMB
from ...core import packs as PK
from ...core import scenarios as SC
from ...core import simulation as SIM
from ...core.economics import EconomicParams
from ...core.similarity import DEFAULT_ALPHA, DEFAULT_TAU
from .. import db as DB
from .. import services as S
from ..deps import db, ok
from ..errors import ApiError
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
        "packs": PK.list_packs(),
        "pack_format": {"format": PK.FORMAT, "max_kb": PK.MAX_BYTES // 1000, "limits": PK.LIMITS},
        "model": EMB.status(),
    })


@bp.get("/scenarios")
def scenarios():
    return ok({"scenarios": SC.list_scenarios(), "packs": PK.list_packs()})


@bp.get("/packs")
def packs():
    """The bundled scenario packs (cards), plus the format any uploaded pack must follow."""
    return ok({"packs": PK.list_packs(), "format": PK.FORMAT, "max_kb": PK.MAX_BYTES // 1000, "limits": PK.LIMITS})


@bp.get("/packs/<code>")
def pack_file(code: str):
    """Download a bundled pack as a .json file (edit it, then upload it or pass it to the terminal)."""
    try:
        pack = PK.get(str(code).lower().removesuffix(".json"))
    except KeyError:
        raise ApiError(404, f"no pack called '{code}'") from None
    resp = Response(PK.dump(pack), mimetype="application/json")
    resp.headers["Content-Disposition"] = f'attachment; filename="{pack["code"]}.debtlens-pack.json"'
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp


@bp.post("/packs/validate")
def pack_validate():
    """Check a pack without opening it: every problem at once, plus what it contains."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "send the pack as a JSON object")
    try:
        pack, warnings = PK.validate(data.get("pack", data))
    except PK.PackError as e:
        return ok({"valid": False, "problems": e.problems[:100], "warnings": []})
    return ok({"valid": True, "problems": [], "warnings": warnings[:100], "info": PK.info(pack)})


@bp.get("/scenarios/compare")
def compare():
    """The same engine run over every industry scenario, side by side (no sign-in needed)."""
    try:
        budget = max(4.0, min(400.0, float(request.args.get("budget", 40))))
    except ValueError:
        budget = 40.0
    return ok(S.compare_scenarios(db(), budget))
