"""Incident intelligence (similarity, regressions, knowledge search, evaluation) and role home views."""

from __future__ import annotations

from datetime import timedelta

from flask import Blueprint, request
from sqlalchemy import select

from ...core import engine as E
from ...core import scenarios as SC
from ...core import similarity as SIM
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import args_float, args_int, db, me, ok, project
from ..errors import ApiError
from ..models import Assignment, Module, SatdMarker, utcnow
from ..security import ROLE_LABELS, require

bp = Blueprint("intelligence", __name__)


@bp.get("/projects/<int:pid>/similar/<int:iid>")
@require("read")
def similar(pid: int, iid: int):
    proj = project(pid)
    snap, alpha, tau, fn = S.intel(db(), proj)
    alpha = args_float("alpha", alpha, 0, 1)
    try:
        return ok(E.similar_incidents(snap, iid, args_int("k", 6, 1, 25), args_float("threshold", 0.2, 0, 1), alpha, fn))
    except KeyError as e:
        raise ApiError(404, "incident not found") from e


@bp.post("/projects/<int:pid>/search")
@require("read")
def knowledge_search(pid: int):
    """Knowledge base: search past incidents and what fixed them, in plain words."""
    proj = project(pid)
    s = db()
    q = V.text(V.body(request), "query", required=True, min_len=3, max_len=500)
    snap, alpha, tau, fn = S.intel(s, proj)
    incs = snap["incidents"]
    if not incs:
        return ok({"results": [], "method": None})
    res_by = {r["incident_id"]: r for r in snap["resolutions"]}
    hits, method = SIM.query_similar(q, [SIM.incident_text(i) for i in incs], alpha,
                                     [i.get("embedding") for i in incs], None, fn, k=8, threshold=0.12)
    out = []
    for j, sc in hits:
        o = incs[j]
        r = res_by.get(o["id"])
        out.append({"id": o["id"], "key": o["key"], "title": o["title"], "module": o["module"],
                    "severity": o["severity"], "status": o["status"], **sc,
                    "fix": r["action"] if r else None, "lessons": r["lessons"] if r else None,
                    "fixed_by": r["resolved_by"] if r else None})
    return ok({"results": out, "method": method, "alpha": alpha})


@bp.get("/projects/<int:pid>/regressions")
@require("read")
def regressions(pid: int):
    proj = project(pid)
    snap, alpha, tau, fn = S.intel(db(), proj)
    tau = args_float("tau", tau, 0.05, 0.99)
    return ok(E.regressions(snap, tau, alpha, fn))


@bp.get("/projects/<int:pid>/evaluation")
@require("read")
def evaluation(pid: int):
    """Measured accuracy of the similarity engine against the scenario's labelled ground truth."""
    proj = project(pid)
    if not proj.scenario_code:
        raise ApiError(400, "evaluation needs labelled data — open an industry scenario")
    snap, alpha, tau, fn = S.intel(db(), proj)
    labels = SC.labels(proj.scenario_code)
    return ok(E.evaluate(snap, labels, fn, alpha, tau))


@bp.get("/projects/<int:pid>/dashboard")
@require("read")
def dashboard(pid: int):
    proj = project(pid)
    s = db()
    snap, alpha, tau, fn = S.intel(s, proj)
    bundle = E.similarity_bundle(snap, alpha, fn) if snap["incidents"] else None
    out = E.dashboard(snap, S.project_params(proj), bundle=bundle)
    out["semantic_method"] = bundle.semantic_method if bundle else None
    return ok(out)


def _my_modules(s, proj, p) -> tuple[str | None, set[str]]:
    """Who 'I' am in this project and which modules I own."""
    if p.kind == "sandbox":
        persona = serial.persona(proj, p)
        if not persona:
            return None, set()
        owners = (proj.settings or {}).get("module_owners") or {}
        return persona["name"], {m for m, k in owners.items() if k == persona["key"]}
    mods = {m.id: m.module_name for m in s.execute(select(Module).where(Module.project_id == proj.id)).scalars()}
    mine = {mods[a.module_id] for a in s.execute(select(Assignment).where(Assignment.project_id == proj.id,
                                                                          Assignment.user_id == p.user_id)).scalars()
            if a.module_id in mods}
    return p.name, mine


@bp.get("/projects/<int:pid>/home")
@require("read")
def home(pid: int):
    """Everything a role's home screen needs, computed once on the server."""
    proj = project(pid)
    s = db()
    p = me()
    snap, alpha, tau, fn = S.intel(s, proj)
    params = S.project_params(proj)
    bundle = E.similarity_bundle(snap, alpha, fn) if snap["incidents"] else None
    dash = E.dashboard(snap, params, bundle=bundle)
    name, my_mods = _my_modules(s, proj, p)
    led = E.ledger(snap, params)
    rows = [r for r in led["rows"] if r["is_open"]]
    debts = {d["id"]: d for d in snap["debts"]}
    incs = snap["incidents"]
    regs = E.regressions(snap, tau, bundle=bundle)["regressions"] if bundle else []
    now = E.reference_now(snap)
    out = {"role": p.role, "role_label": ROLE_LABELS.get(p.role, p.role), "me": name, "my_modules": sorted(my_mods),
           "dashboard": dash, "semantic_method": bundle.semantic_method if bundle else None}

    def card(r):
        return {k: r[k] for k in ("id", "key", "title", "module", "principal", "interest", "risk", "break_even", "status")}

    if p.role == "developer":
        mine = [card(r) for r in rows if debts[r["id"]].get("assigned_to") == name or r["module"] in my_mods]
        out["my_debts"] = mine[:12]
        out["my_open_incidents"] = [i for i in incs if i["status"] != "RESOLVED" and i["module"] in my_mods][:12]
        out["my_satd"] = [x for x in snap["satd"] if x["module"] in my_mods and x["status"] == "DETECTED"][:12]
        out["my_regressions"] = [r for r in regs if r["module"] in my_mods][:6]
    elif p.role in ("tech_lead", "admin"):
        g = E.causal_graph(snap)
        out["top_risks"] = [card(r) for r in rows[:8]]
        out["systemic_causes"] = g["nodes"][:6]
        out["needs_rca"] = [i for i in incs if i["status"] != "RESOLVED" and
                            not any(rc["incident_id"] == i["id"] for rc in snap["root_causes"])][:10]
        plan = E.plan(snap, 40, params, compare=True, led=led)
        out["plan_preview"] = {k: plan[k] for k in ("total_value", "total_weight", "utilization", "selected_items",
                                                    "interest_retired", "comparison")}
    elif p.role == "qa":
        out["regressions"] = regs[:10]
        week = (now - timedelta(days=14)).isoformat()
        out["verify_fixes"] = [i for i in incs if i["status"] == "RESOLVED" and (i["resolved_at"] or "") >= week][:10]
        out["unverified_open"] = [i for i in incs if i["status"] == "OPEN"][:10]
    elif p.role == "manager":
        plan = E.plan(snap, 40, params, compare=True, led=led)
        out["plan_preview"] = {k: plan[k] for k in ("total_value", "total_weight", "utilization", "selected_items",
                                                    "interest_retired", "comparison")}
        out["interest_by_module"] = led["summary"]["by_module"]
        out["forecast_quick"] = E.forecast(snap, {"runs": 60, "sprints": 8, "budget": 40,
                                                  "policies": ["optimal", "none"]}, params)["comparisons"]
    out["satd_open"] = s.execute(select(SatdMarker.id).where(SatdMarker.project_id == proj.id,
                                                             SatdMarker.status == "DETECTED")).all().__len__()
    out["generated_at"] = utcnow().isoformat()
    return ok(out)
