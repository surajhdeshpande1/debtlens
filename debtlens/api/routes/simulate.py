"""Simulation Lab: what-if economics, Monte Carlo sprint forecast, failure injection, load spikes."""

from __future__ import annotations

from flask import Blueprint, Response, request
from sqlalchemy import select

from ...core import engine as E
from ...core import report as REPORT
from ...core import simulation as SIM
from ...core import spike as SPIKE
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import db, me, ok, project
from ..errors import ApiError
from ..models import SimulationRun, utcnow
from ..security import require
from ..services import iso

bp = Blueprint("simulate", __name__)


def _save(proj, kind: str, params: dict, summary: dict) -> int:
    s = db()
    run = SimulationRun(project_id=proj.id, kind=kind, params=params, summary=summary, run_by=me().name)
    s.add(run)
    s.commit()
    return run.id


@bp.post("/projects/<int:pid>/simulate/whatif")
@require("simulate")
def whatif(pid: int):
    proj = project(pid)
    data = V.body(request)
    overrides = V.clean_economics(data.get("params") or {})
    budgets = data.get("budgets") or [8, 16, 24, 32, 40, 56, 80, 120]
    try:
        budgets = sorted({max(0.0, min(5000.0, float(b))) for b in budgets})[:16]
    except (TypeError, ValueError) as e:
        raise ApiError(400, "'budgets' must be numbers") from e
    snap = S.snapshot(db(), proj, with_embeddings=False)
    out = E.whatif(snap, overrides, budgets, S.project_params(proj))
    _save(proj, "whatif", {"params": overrides, "budgets": budgets},
          {"flips": out["flips"], "interest_before": out["summary_before"]["total_interest"],
           "interest_after": out["summary_after"]["total_interest"]})
    return ok(out)


@bp.post("/projects/<int:pid>/simulate/forecast")
@require("simulate")
def forecast(pid: int):
    proj = project(pid)
    data = V.body(request)
    cfg = {"budget": V.number(data, "budget", default=40, lo=0, hi=2000),
           "sprints": int(V.number(data, "sprints", default=12, lo=1, hi=26)),
           "runs": int(V.number(data, "runs", default=150, lo=10, hi=600)),
           "seed": int(V.number(data, "seed", default=7, lo=0, hi=10**9)),
           "inflow_rate": V.number(data, "inflow_rate", default=0.25, lo=0, hi=5),
           "hazard_scale": V.number(data, "hazard_scale", default=1.0, lo=0, hi=5),
           "sprint_days": int(V.number(data, "sprint_days", default=14, lo=5, hi=30))}
    pol = data.get("policies")
    if pol:
        bad = [x for x in pol if x not in SIM.POLICIES]
        if bad:
            raise ApiError(400, f"unknown policies {bad}")
        cfg["policies"] = pol
    snap = S.snapshot(db(), proj, with_embeddings=False)
    out = E.forecast(snap, cfg, S.project_params(proj))
    _save(proj, "forecast", cfg, {"comparisons": out["comparisons"],
                                  "final": {k: v["final_hours_mean"] for k, v in out["policies"].items()}})
    return ok(out)


@bp.post("/projects/<int:pid>/simulate/cascade")
@require("simulate")
def cascade(pid: int):
    """Inject a failure into one module and watch it spread to the modules that depend on it."""
    proj = project(pid)
    data = V.body(request)
    module = (V.text(data, "module", required=True, max_len=100) or "").lower()
    p = V.number(data, "p", default=0.35, lo=0.01, hi=1.0)
    runs = int(V.number(data, "runs", default=2000, lo=100, hi=10000))
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    try:
        out = E.cascade(snap, module, p, runs, int(V.number(data, "seed", default=11, lo=0, hi=10**9)))
    except ValueError as e:
        raise ApiError(400, str(e)) from e
    if data.get("create_incident"):
        pr = me()
        if not pr.can("incident.write"):
            raise ApiError(403, "your role cannot raise incidents")
        hit = [m["module"] for m in out["modules"] if m["module"] != module and m["probability"] >= 0.25]
        inc = S.create_incident(s, proj, pr, {
            "title": V.text(data, "title", max_len=250) or f"Failure drill: {module} outage",
            "description": (f"Injected failure in '{module}' (spread probability {p}). Simulated blast: "
                            f"{out['expected_affected']:.1f} dependent modules expected to fail; at risk: {', '.join(hit) or 'none'}."),
            "module": module, "severity": data.get("severity") or "HIGH", "status": "OPEN", "effort_hours": 2},
            source="simulation")
        S.audit(s, proj.id, pr, "simulation.inject", inc.incident_key, module=module)
        s.commit()
        out["incident"] = serial.incident(inc, serial.module_names(s, proj.id))
    _save(proj, "cascade", {"module": module, "p": p, "runs": runs},
          {"expected_affected": out["expected_affected"], "worst_case": out["worst_case_affected"]})
    return ok(out)


@bp.get("/projects/<int:pid>/simulate/spike/events")
@require("read")
def spike_events(pid: int):
    proj = project(pid)
    return ok({"events": SPIKE.events_for(S.spike_events(proj)), "journey": S.journey(proj)})


@bp.post("/projects/<int:pid>/simulate/spike")
@require("simulate")
def spike(pid: int):
    """Load spike: who overloads hour by hour, incidents and hours lost, and what to fix before the event."""
    proj = project(pid)
    data = V.body(request)
    event = data.get("event") or None
    if isinstance(event, dict):
        event = {"peak": V.number(event, "peak", default=5, lo=1, hi=50),
                 "start_hour": int(V.number(event, "start_hour", default=20, lo=0, hi=23)),
                 "duration": int(V.number(event, "duration", default=2, lo=1, hi=24)),
                 "ramp": int(V.number(event, "ramp", default=1, lo=0, hi=6)),
                 "name": V.text(event, "name", max_len=80) or "Custom spike"}
    elif event is not None and not isinstance(event, str):
        raise ApiError(400, "'event' must be a preset key or {peak, start_hour, duration, ramp}")
    budget = V.number(data, "budget", default=40, lo=0, hi=500)
    runs = int(V.number(data, "runs", default=300, lo=50, hi=1000))
    seed = int(V.number(data, "seed", default=17, lo=0, hi=10**9))
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    edits, chosen, _ = S.playbook_state(s, proj.id)
    try:
        out = E.spike(snap, event, budget, runs, seed, S.project_params(proj), edits, chosen)
    except ValueError as e:
        raise ApiError(400, str(e)) from e
    report = E.spike_report(snap, out, run_by=me().name, generated_at=iso(utcnow()))
    out["report"] = report
    if data.get("save") is False:  # replaying a saved run again: same seed, same day, nothing new to keep
        out["run_id"] = None
        return ok(out)
    out["run_id"] = _save(proj, "spike", {"event": out["event"]["key"], "event_name": out["event"]["name"],
                                          "kind": out["event"].get("kind"), "peak": out["peak"], "budget": budget,
                                          "runs": runs, "seed": seed,
                                          **({"custom": event} if isinstance(event, dict) else {})},
                          {"before_hours": out["before"]["hours_lost"], "after_hours": out["after"]["hours_lost"],
                           "failed_traffic_before": out["before"]["failed_traffic_pct"],
                           "failed_traffic_after": out["after"]["failed_traffic_pct"],
                           "plan": [x["key"] for x in out["plan"]["selected"]], "report": report})
    return ok(out)


def _row(r: SimulationRun) -> dict:
    summary = dict(r.summary or {})
    report = summary.pop("report", None)
    out = {"id": r.id, "kind": r.kind, "params": r.params, "summary": summary, "run_by": r.run_by,
           "created_at": iso(r.created_at), "has_report": bool(report)}
    if report:
        out["report_summary"] = REPORT.summary_row(report)
    return out


@bp.get("/projects/<int:pid>/simulations")
@require("read")
def history(pid: int):
    proj = project(pid)
    q = select(SimulationRun).where(SimulationRun.project_id == proj.id)
    kind = request.args.get("kind")
    if kind:
        q = q.where(SimulationRun.kind == kind[:15])
    rows = db().execute(q.order_by(SimulationRun.id.desc()).limit(50)).scalars()
    return ok({"runs": [_row(r) for r in rows]})


def _report(pid: int, rid: int) -> tuple:
    proj = project(pid)
    run = db().get(SimulationRun, rid)
    if run is None or run.project_id != proj.id:
        raise ApiError(404, "no such run in this project")
    report = (run.summary or {}).get("report")
    if not report:
        raise ApiError(404, "this run has no report (only load-spike and situation runs have one)")
    return proj, run, report


@bp.get("/projects/<int:pid>/simulations/<int:rid>")
@require("read")
def run_report(pid: int, rid: int):
    """One saved run with its full report: what happened, why, what the fixes change and what to do next."""
    _, run, report = _report(pid, rid)
    return ok({"run": _row(run), "report": report})


@bp.get("/projects/<int:pid>/simulations/<int:rid>/report.pdf")
@require("read")
def run_report_pdf(pid: int, rid: int):
    from .reports import build_run_pdf

    proj, run, report = _report(pid, rid)
    pdf = build_run_pdf(report)
    name = f"{proj.project_key}-run-{run.id}-{report['situation']['key']}.pdf"
    return Response(pdf, mimetype="application/pdf", headers={"Content-Disposition": f"attachment; filename={name}"})


@bp.get("/projects/<int:pid>/simulations/<int:rid>/report.txt")
@require("read")
def run_report_text(pid: int, rid: int):
    proj, run, report = _report(pid, rid)
    name = f"{proj.project_key}-run-{run.id}-{report['situation']['key']}.txt"
    return Response(REPORT.to_text(report), mimetype="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f"attachment; filename={name}"})
