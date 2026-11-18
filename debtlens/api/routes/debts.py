"""Technical-debt registry (Demo-1 TECHNICAL_DEBT), the interest ledger and remediation plans."""

from __future__ import annotations

import csv
import io

from flask import Blueprint, Response, request
from sqlalchemy import delete, select, update

from ...core import engine as E
from ...core import graph as G
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import db, me, ok, project
from ..errors import ApiError
from ..models import (CauseNode, DebtDependency, DebtIncident, DebtPlaybook, Incident, RemediationPlan, SatdMarker,
                      TechnicalDebt,
                      User, utcnow)
from ..security import require
from ..services import iso

bp = Blueprint("debts", __name__)
PRIORITY_STATUSES = {"PRIORITIZED", "DEFERRED"}


def _debt(s, proj, did: int) -> TechnicalDebt:
    d = s.get(TechnicalDebt, did)
    if d is None or d.project_id != proj.id:
        raise ApiError(404, "debt item not found")
    return d


def _check_ids(s, proj, model, ids: list[int], what: str) -> list[int]:
    if not ids:
        return []
    found = {i for (i,) in s.execute(select(model.id).where(model.id.in_(ids), model.project_id == proj.id))}
    bad = [i for i in ids if i not in found]
    if bad:
        raise ApiError(400, f"unknown {what} ids: {bad[:5]}")
    return list(dict.fromkeys(ids))


def _set_links(s, proj, d: TechnicalDebt, data: dict) -> None:
    if "incident_ids" in data:
        ids = _check_ids(s, proj, Incident, data["incident_ids"], "incident")
        s.execute(delete(DebtIncident).where(DebtIncident.debt_id == d.id))
        for i in ids:
            s.add(DebtIncident(debt_id=d.id, incident_id=i))
    if "prerequisite_ids" in data:
        ids = [i for i in _check_ids(s, proj, TechnicalDebt, data["prerequisite_ids"], "debt") if i != d.id]
        # refuse a dependency cycle among debts
        edges = [(a, b) for a, b in s.execute(select(DebtDependency.debt_id, DebtDependency.prerequisite_debt_id)
                                              .join(TechnicalDebt, TechnicalDebt.id == DebtDependency.debt_id)
                                              .where(TechnicalDebt.project_id == proj.id)) if a != d.id]
        edges += [(d.id, p) for p in ids]
        nodes = {x for e in edges for x in e}
        if G.find_cycle(nodes, edges):
            raise ApiError(400, "these prerequisites would create a cycle")
        s.execute(delete(DebtDependency).where(DebtDependency.debt_id == d.id))
        for p in ids:
            s.add(DebtDependency(debt_id=d.id, prerequisite_debt_id=p))
    if "root_cause_id" in data:
        rid = data["root_cause_id"]
        if rid is not None:
            c = s.get(CauseNode, rid)
            if c is None or c.project_id != proj.id:
                raise ApiError(400, "unknown root cause")
        d.root_cause_node_id = rid


def _apply(s, proj, d: TechnicalDebt, data: dict) -> None:
    for k, attr in (("title", "title"), ("description", "description"), ("category", "category"),
                    ("priority", "priority"), ("status", "status"), ("principal", "principal_hours"),
                    ("file_path", "file_path")):
        if k in data:
            setattr(d, attr, data[k])
    if "module" in data:
        d.module_id = S.module_id(s, proj, data["module"])
    if "assigned_to" in data:
        name = data["assigned_to"]
        d.assignee_name = name
        u = s.execute(select(User).where(User.org_id == proj.org_id, User.name == name)).scalar_one_or_none() if name else None
        d.assigned_to = u.id if u else None


@bp.get("/projects/<int:pid>/debts")
@require("read")
def list_debts(pid: int):
    proj = project(pid)
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    led = {r["id"]: r for r in E.ledger(snap, S.project_params(proj))["rows"]}
    mods = serial.module_names(s, proj.id)
    status = {x.strip().upper() for x in request.args.get("status", "").split(",") if x.strip()}
    rows = []
    for d in s.execute(select(TechnicalDebt).where(TechnicalDebt.project_id == proj.id)).scalars():
        if status and d.status not in status:
            continue
        r = led.get(d.id, {})
        rows.append(serial.debt(d, mods, {k: r.get(k) for k in (
            "interest", "incident_interest", "churn_interest", "blast_interest", "risk", "break_even",
            "break_even_ratio", "linked_incidents", "incident_ids", "prerequisite_ids", "blast_radius", "churn_source")}))
    rows.sort(key=lambda r: (r["status"] == "REMEDIATED", -(r["risk"] or 0)))
    return ok({"items": rows, "total": len(rows)})


@bp.post("/projects/<int:pid>/debts")
@require("debt.write")
def create_debt(pid: int):
    proj = project(pid)
    s = db()
    raw = V.body(request)
    data = V.clean_debt(raw)
    p = me()
    if (data.get("status") in PRIORITY_STATUSES or raw.get("priority") in ("CRITICAL",)) and not p.can("debt.prioritize"):
        data["status"] = "IDENTIFIED" if data.get("status") in PRIORITY_STATUSES else data["status"]
    d = TechnicalDebt(project_id=proj.id, debt_key=S.next_key(proj, "debt"), source=raw.get("source") or "manual")
    _apply(s, proj, d, data)
    s.add(d)
    s.flush()
    _set_links(s, proj, d, data)
    S.audit(s, proj.id, p, "debt.created", d.debt_key, principal=d.principal_hours)
    s.commit()
    return ok({"debt": serial.debt(d, serial.module_names(s, proj.id))}, 201)


@bp.get("/projects/<int:pid>/debts/<int:did>")
@require("read")
def debt_detail(pid: int, did: int):
    proj = project(pid)
    s = db()
    d = _debt(s, proj, did)
    mods = serial.module_names(s, proj.id)
    snap = S.snapshot(s, proj, with_embeddings=False)
    led = next((r for r in E.ledger(snap, S.project_params(proj))["rows"] if r["id"] == d.id), None)
    inc_ids = [i for (i,) in s.execute(select(DebtIncident.incident_id).where(DebtIncident.debt_id == d.id))]
    incs = [serial.incident(i, mods) for i in s.execute(select(Incident).where(Incident.id.in_(inc_ids))).scalars()] \
        if inc_ids else []
    pre_ids = [i for (i,) in s.execute(select(DebtDependency.prerequisite_debt_id).where(DebtDependency.debt_id == d.id))]
    dep_ids = [i for (i,) in s.execute(select(DebtDependency.debt_id).where(DebtDependency.prerequisite_debt_id == d.id))]
    brief = lambda x: {"id": x.id, "key": x.debt_key, "title": x.title, "status": x.status}  # noqa: E731
    pre = [brief(x) for x in s.execute(select(TechnicalDebt).where(TechnicalDebt.id.in_(pre_ids))).scalars()] if pre_ids else []
    dep = [brief(x) for x in s.execute(select(TechnicalDebt).where(TechnicalDebt.id.in_(dep_ids))).scalars()] if dep_ids else []
    cause = s.get(CauseNode, d.root_cause_node_id) if d.root_cause_node_id else None
    satd = [{"path": x.file_path, "line": x.line_no, "marker": x.marker, "text": x.text}
            for x in s.execute(select(SatdMarker).where(SatdMarker.debt_id == d.id)).scalars()]
    return ok({"debt": serial.debt(d, mods), "ledger": led, "incidents": incs, "prerequisites": pre, "unlocks": dep,
               "root_cause": {"id": cause.id, "label": cause.label, "category": cause.category} if cause else None,
               "satd": satd})


@bp.patch("/projects/<int:pid>/debts/<int:did>")
@require("debt.write")
def update_debt(pid: int, did: int):
    proj = project(pid)
    s = db()
    d = _debt(s, proj, did)
    raw = V.body(request)
    data = V.clean_debt(raw, partial=True)
    p = me()
    if ("priority" in data and data["priority"] != d.priority) or data.get("status") in PRIORITY_STATUSES:
        if not p.can("debt.prioritize"):
            raise ApiError(403, "only a Tech Lead or Admin can change priority, prioritise or defer debt")
    _apply(s, proj, d, data)
    _set_links(s, proj, d, data)
    d.updated_at = utcnow()
    S.audit(s, proj.id, p, "debt.updated", d.debt_key, fields=sorted(data))
    s.commit()
    return ok({"debt": serial.debt(d, serial.module_names(s, proj.id))})


@bp.delete("/projects/<int:pid>/debts/<int:did>")
@require("debt.prioritize")
def delete_debt(pid: int, did: int):
    proj = project(pid)
    s = db()
    d = _debt(s, proj, did)
    s.execute(delete(DebtIncident).where(DebtIncident.debt_id == d.id))
    s.execute(delete(DebtDependency).where((DebtDependency.debt_id == d.id) | (DebtDependency.prerequisite_debt_id == d.id)))
    s.execute(delete(DebtPlaybook).where(DebtPlaybook.debt_id == d.id))
    s.execute(update(SatdMarker).where(SatdMarker.debt_id == d.id).values(debt_id=None, status="DETECTED"))
    S.audit(s, proj.id, me(), "debt.deleted", d.debt_key)
    s.delete(d)
    s.commit()
    return ok({"deleted": True})


@bp.get("/projects/<int:pid>/debts.csv")
@require("read")
def export_csv(pid: int):
    proj = project(pid)
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["key", "title", "module", "category", "status", "principal_h", "interest_h_per_month", "risk",
                "break_even", "linked_incidents", "prerequisites"])
    key_of = {d["id"]: d["key"] for d in snap["debts"]}
    for r in E.ledger(snap, S.project_params(proj))["rows"]:
        w.writerow([r["key"], r["title"], r["module"], r["category"], r["status"], r["principal"], r["interest"],
                    r["risk"], "yes" if r["break_even"] else "no", " ".join(map(str, r["linked_incidents"])),
                    " ".join(key_of.get(i, "") for i in r["prerequisite_ids"])])
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={proj.project_key}-debt-ledger.csv"})


# ----------------------------------------------------------------------------- ledger & plans

@bp.get("/projects/<int:pid>/ledger")
@require("read")
def ledger(pid: int):
    proj = project(pid)
    snap = S.snapshot(db(), proj, with_embeddings=False)
    return ok(E.ledger(snap, S.project_params(proj)))


def _plan_args(data: dict) -> dict:
    budget = V.number(data, "budget", default=40, lo=0, hi=5000)
    method = (data.get("method") or "auto").lower()
    if method not in ("auto", "tree_dp", "branch_and_bound", "greedy", "naive_dp", "brute_force"):
        raise ApiError(400, "unknown method")
    force = V.int_list(data.get("force"), "force")
    cats = data.get("categories") or None
    return {"budget": budget, "method": method, "force": force, "categories": cats}


@bp.post("/projects/<int:pid>/plan")
@require("read")
def plan(pid: int):
    proj = project(pid)
    a = _plan_args(V.body(request))
    snap = S.snapshot(db(), proj, with_embeddings=False)
    try:
        out = E.plan(snap, a["budget"], S.project_params(proj), a["method"], a["force"], a["categories"])
    except ValueError as e:
        raise ApiError(400, str(e)) from e
    return ok(out)


@bp.post("/projects/<int:pid>/plans")
@require("plan.approve")
def approve_plan(pid: int):
    """Approve a remediation plan: selected debts become PRIORITIZED (sprint backlog)."""
    proj = project(pid)
    s = db()
    data = V.body(request)
    a = _plan_args(data)
    snap = S.snapshot(s, proj, with_embeddings=False)
    out = E.plan(snap, a["budget"], S.project_params(proj), a["method"], a["force"], a["categories"], compare=False)
    keys = [x["key"] for x in out["selected_items"]]
    sel = set(out["selected"])
    for d in s.execute(select(TechnicalDebt).where(TechnicalDebt.id.in_(sel))).scalars():
        if d.status in ("IDENTIFIED", "DEFERRED"):
            d.status = "PRIORITIZED"
    p = me()
    rp = RemediationPlan(project_id=proj.id, budget_hours=a["budget"], method=out["method"], selected_keys=keys,
                         total_value=out["total_value"], total_hours=out["total_weight"],
                         notes=V.text(data, "notes", max_len=2000), approved_by=p.name)
    s.add(rp)
    S.audit(s, proj.id, p, "plan.approved", f"plan:{a['budget']}h", items=keys)
    s.commit()
    return ok({"plan": _plan_row(rp), "result": out}, 201)


def _plan_row(rp: RemediationPlan) -> dict:
    return {"id": rp.id, "budget_hours": rp.budget_hours, "method": rp.method, "selected_keys": rp.selected_keys,
            "total_value": rp.total_value, "total_hours": rp.total_hours, "status": rp.status, "notes": rp.notes,
            "approved_by": rp.approved_by, "created_at": iso(rp.created_at)}


@bp.get("/projects/<int:pid>/plans")
@require("read")
def list_plans(pid: int):
    proj = project(pid)
    rows = db().execute(select(RemediationPlan).where(RemediationPlan.project_id == proj.id)
                        .order_by(RemediationPlan.id.desc()).limit(50)).scalars()
    return ok({"plans": [_plan_row(r) for r in rows]})
