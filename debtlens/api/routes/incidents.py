"""Incidents (Demo-1 INCIDENT, ROOT_CAUSE, RESOLUTION), 5-Whys, duplicate check and the causal graph."""

from __future__ import annotations

import csv
import io

from flask import Blueprint, Response, request
from sqlalchemy import delete, func, or_, select, update

from ...core import engine as E
from ...core import similarity as SIM
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import args_float, args_int, db, me, ok, project
from ..errors import ApiError
from ..models import (CauseEdge, CauseNode, DebtIncident, Incident, Module, Resolution, RootCause, TechnicalDebt,
                      utcnow)
from ..security import require
from ..services import iso, parse_dt

bp = Blueprint("incidents", __name__)


def _incident(s, proj, iid: int) -> Incident:
    inc = s.get(Incident, iid)
    if inc is None or inc.project_id != proj.id:
        raise ApiError(404, "incident not found")
    return inc


@bp.get("/projects/<int:pid>/incidents")
@require("read")
def list_incidents(pid: int):
    proj = project(pid)
    s = db()
    q = select(Incident).where(Incident.project_id == proj.id)
    if request.args.get("status"):
        q = q.where(Incident.status.in_([x.strip().upper() for x in request.args["status"].split(",")]))
    if request.args.get("severity"):
        q = q.where(Incident.severity.in_([x.strip().upper() for x in request.args["severity"].split(",")]))
    if request.args.get("source"):
        q = q.where(Incident.source == request.args["source"])
    if request.args.get("module"):
        mid = S.module_id(s, proj, request.args["module"], create=False)
        q = q.where(Incident.module_id == (mid or -1))
    if request.args.get("q"):
        term = "%" + request.args["q"].strip()[:100].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        q = q.where(or_(Incident.title.like(term, escape="\\"), Incident.description.like(term, escape="\\"),
                        Incident.incident_key.like(term, escape="\\")))
    total = s.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    limit, offset = args_int("limit", 200, 1, 1000), args_int("offset", 0, 0, 10**6)
    rows = s.execute(q.order_by(Incident.reported_at.desc(), Incident.id.desc()).limit(limit).offset(offset)).scalars().all()
    mods = serial.module_names(s, proj.id)
    extra = serial.incident_extras(s, [r.id for r in rows])
    items = []
    for r in rows:
        d = serial.incident(r, mods, extra[r.id])
        d["description"] = (d["description"] or "")[:280]
        items.append(d)
    return ok({"items": items, "total": total, "limit": limit, "offset": offset})


@bp.post("/projects/<int:pid>/incidents")
@require("incident.write")
def create_incident(pid: int):
    proj = project(pid)
    s = db()
    data = V.body(request)
    p = me()
    inc = S.create_incident(s, proj, p, data)
    chain = []
    if data.get("whys"):
        if not p.can("rca.write"):
            raise ApiError(403, "your role cannot record root causes")
        if not isinstance(data["whys"], list):
            raise ApiError(400, "'whys' must be a list of answers")
        chain = S.record_whys(s, proj, inc, [str(w) for w in data["whys"]])
    if inc.status == "RESOLVED" and (data.get("action_taken") or data.get("lessons_learned")):
        s.add(Resolution(incident_id=inc.id, fixed_by=p.user_id, fixed_by_name=p.name,
                         action_taken=V.text(data, "action_taken", max_len=6000) or "",
                         lessons_learned=V.text(data, "lessons_learned", max_len=6000) or "",
                         resolved_at=inc.resolved_at or utcnow()))
    S.audit(s, proj.id, p, "incident.created", inc.incident_key, severity=inc.severity)
    s.commit()
    return ok({"incident": serial.incident(inc, serial.module_names(s, proj.id)), "whys": chain}, 201)


@bp.post("/projects/<int:pid>/incidents/check")
@require("read")
def check_duplicates(pid: int):
    """Before reporting: has this happened before, and what fixed it?"""
    proj = project(pid)
    s = db()
    data = V.body(request)
    title = V.text(data, "title", required=True, min_len=3, max_len=250)
    query = SIM.incident_text({"title": title, "description": V.text(data, "description", max_len=6000) or ""})
    module = (data.get("module") or "").strip().lower()
    snap, alpha, tau, fn = S.intel(s, proj)
    incs = snap["incidents"]
    if not incs:
        return ok({"matches": [], "verdict": "new", "method": None})
    res_by = {r["incident_id"]: r for r in snap["resolutions"]}
    hits, method = SIM.query_similar(query, [SIM.incident_text(i) for i in incs], alpha,
                                     [i.get("embedding") for i in incs], None, fn, k=6, threshold=0.2)
    matches = []
    for j, sc in hits:
        o = incs[j]
        r = res_by.get(o["id"])
        same = bool(module) and module == o["module"]
        matches.append({"id": o["id"], "key": o["key"], "title": o["title"], "module": o["module"],
                        "severity": o["severity"], "status": o["status"], "reported_at": o["reported_at"],
                        "resolved_at": o["resolved_at"], **sc, "same_module": same,
                        "fix": r["action"] if r else None, "lessons": r["lessons"] if r else None,
                        "would_be_regression": same and o["status"] == "RESOLVED" and sc["hybrid"] >= tau})
    verdict = "new"
    if matches:
        top = matches[0]
        if top["status"] != "RESOLVED" and top["hybrid"] >= 0.6:
            verdict = "duplicate"
        elif any(m["would_be_regression"] for m in matches):
            verdict = "regression"
        elif top["hybrid"] >= tau:
            verdict = "related"
    return ok({"matches": matches, "verdict": verdict, "method": method, "alpha": alpha, "tau": tau})


@bp.get("/projects/<int:pid>/incidents/<int:iid>")
@require("read")
def incident_detail(pid: int, iid: int):
    proj = project(pid)
    s = db()
    inc = _incident(s, proj, iid)
    mods = serial.module_names(s, proj.id)
    rcs = s.execute(select(RootCause).where(RootCause.incident_id == inc.id).order_by(RootCause.why_level)).scalars().all()
    node_ids = [r.cause_node_id for r in rcs if r.cause_node_id]
    nodes = {c.id: c for c in s.execute(select(CauseNode).where(CauseNode.id.in_(node_ids))).scalars()} if node_ids else {}
    shared = {}
    if node_ids:
        for nid, n in s.execute(select(RootCause.cause_node_id, func.count(func.distinct(RootCause.incident_id)))
                                .where(RootCause.cause_node_id.in_(node_ids)).group_by(RootCause.cause_node_id)):
            shared[nid] = n
    whys = [{"level": r.why_level, "answer": r.explanation, "cause_id": r.cause_node_id,
             "cause_label": nodes[r.cause_node_id].label if r.cause_node_id in nodes else None,
             "category": nodes[r.cause_node_id].category if r.cause_node_id in nodes else None,
             "shared_with": max(0, shared.get(r.cause_node_id, 1) - 1)} for r in rcs]
    res = s.execute(select(Resolution).where(Resolution.incident_id == inc.id)).scalar_one_or_none()
    debt_ids = [d for (d,) in s.execute(select(DebtIncident.debt_id).where(DebtIncident.incident_id == inc.id))]
    debts = [serial.debt(d, mods) for d in s.execute(select(TechnicalDebt).where(TechnicalDebt.id.in_(debt_ids))).scalars()] \
        if debt_ids else []
    snap, alpha, tau, fn = S.intel(s, proj)
    bundle = E.similarity_bundle(snap, alpha, fn)
    similar = E.similar_incidents(snap, inc.id, k=6, threshold=0.2, bundle=bundle)
    regs = [r for r in E.regressions(snap, tau, bundle=bundle)["regressions"]
            if r["incident_id"] == inc.id or r["regressed_from_id"] == inc.id]
    return ok({"incident": serial.incident(inc, mods), "whys": whys,
               "resolution": {"action_taken": res.action_taken, "lessons_learned": res.lessons_learned,
                              "fixed_by": res.fixed_by_name, "resolved_at": iso(res.resolved_at),
                              "effort_hours": res.effort_hours} if res else None,
               "debts": debts, "similar": similar, "regressions": regs, "tau": tau})


@bp.patch("/projects/<int:pid>/incidents/<int:iid>")
@require("incident.write")
def update_incident(pid: int, iid: int):
    proj = project(pid)
    s = db()
    inc = _incident(s, proj, iid)
    data = V.clean_incident(V.body(request), partial=True)
    for k in ("title", "description", "severity", "effort_hours", "external_ref"):
        if k in data:
            setattr(inc, k, data[k])
    if "title" in data or "description" in data:
        inc.embedding = None
    if "module" in data:
        inc.module_id = S.module_id(s, proj, data["module"])
    if "reported_at" in data and data["reported_at"]:
        inc.reported_at = parse_dt(data["reported_at"])
    if "status" in data:
        inc.status = data["status"]
        if inc.status == "RESOLVED":
            inc.resolved_at = parse_dt(data.get("resolved_at")) or inc.resolved_at or utcnow()
        else:
            inc.resolved_at = None
    elif data.get("resolved_at"):
        inc.resolved_at = parse_dt(data["resolved_at"])
    S.audit(s, proj.id, me(), "incident.updated", inc.incident_key, fields=sorted(data))
    s.commit()
    return ok({"incident": serial.incident(inc, serial.module_names(s, proj.id))})


@bp.delete("/projects/<int:pid>/incidents/<int:iid>")
@require("settings.write")
def delete_incident(pid: int, iid: int):
    proj = project(pid)
    s = db()
    inc = _incident(s, proj, iid)
    s.execute(delete(RootCause).where(RootCause.incident_id == inc.id))
    s.execute(delete(Resolution).where(Resolution.incident_id == inc.id))
    s.execute(delete(DebtIncident).where(DebtIncident.incident_id == inc.id))
    S.audit(s, proj.id, me(), "incident.deleted", inc.incident_key)
    s.delete(inc)
    s.commit()
    return ok({"deleted": True})


@bp.put("/projects/<int:pid>/incidents/<int:iid>/whys")
@require("rca.write")
def put_whys(pid: int, iid: int):
    proj = project(pid)
    s = db()
    inc = _incident(s, proj, iid)
    whys = V.body(request).get("whys")
    if not isinstance(whys, list) or not [w for w in whys if str(w or "").strip()]:
        raise ApiError(400, "send 'whys' as a list of 1–7 answers, symptom first")
    chain = S.record_whys(s, proj, inc, [str(w) for w in whys])
    if inc.status == "OPEN":
        inc.status = "INVESTIGATING"
    S.audit(s, proj.id, me(), "rca.recorded", inc.incident_key, levels=len(chain),
            merged=sum(1 for c in chain if c["merged"]))
    s.commit()
    return ok({"whys": chain, "converged": [c for c in chain if c["merged"]]})


@bp.put("/projects/<int:pid>/incidents/<int:iid>/resolution")
@require("incident.write")
def put_resolution(pid: int, iid: int):
    proj = project(pid)
    s = db()
    inc = _incident(s, proj, iid)
    data = V.body(request)
    action = V.text(data, "action_taken", required=True, min_len=5, max_len=6000)
    p = me()
    res = s.execute(select(Resolution).where(Resolution.incident_id == inc.id)).scalar_one_or_none()
    if res is None:
        res = Resolution(incident_id=inc.id)
        s.add(res)
    res.action_taken = action
    res.lessons_learned = V.text(data, "lessons_learned", max_len=6000) or ""
    res.fixed_by, res.fixed_by_name = p.user_id, V.text(data, "fixed_by", max_len=120) or p.name
    res.effort_hours = V.number(data, "effort_hours", lo=0, hi=1000)
    res.resolved_at = parse_dt(data.get("resolved_at")) or utcnow()
    inc.status, inc.resolved_at = "RESOLVED", res.resolved_at
    if res.effort_hours is not None:
        inc.effort_hours = res.effort_hours
    S.audit(s, proj.id, p, "incident.resolved", inc.incident_key)
    s.commit()
    return ok({"resolved": True, "incident": serial.incident(inc, serial.module_names(s, proj.id))})


@bp.get("/projects/<int:pid>/incidents.csv")
@require("read")
def export_csv(pid: int):
    proj = project(pid)
    s = db()
    mods = serial.module_names(s, proj.id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["key", "title", "module", "severity", "status", "reported_at", "resolved_at", "effort_hours",
                "source", "reported_by", "description"])
    for i in s.execute(select(Incident).where(Incident.project_id == proj.id).order_by(Incident.reported_at)).scalars():
        w.writerow([i.incident_key, i.title, mods.get(i.module_id, "unassigned"), i.severity, i.status,
                    iso(i.reported_at), iso(i.resolved_at) or "", i.effort_hours, i.source, i.reporter_name or "",
                    i.description])
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={proj.project_key}-incidents.csv"})


# ----------------------------------------------------------------------------- causal graph

@bp.get("/projects/<int:pid>/causal-graph")
@require("read")
def causal_graph(pid: int):
    proj = project(pid)
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    g = E.causal_graph(snap)
    key_of = {i["id"]: i["key"] for i in snap["incidents"]}
    incs: dict = {}
    for rc in snap["root_causes"]:
        incs.setdefault(rc["cause_id"], set()).add(key_of.get(rc["incident_id"]))
    debts: dict = {}
    for d in snap["debts"]:
        if d.get("root_cause_id"):
            debts.setdefault(d["root_cause_id"], []).append(d["key"])
    for n in g["nodes"]:
        n["incident_keys"] = sorted(k for k in incs.get(n["id"], ()) if k)
        n["debt_keys"] = debts.get(n["id"], [])
    return ok(g)


def _cause(s, proj, cid: int) -> CauseNode:
    c = s.get(CauseNode, cid)
    if c is None or c.project_id != proj.id:
        raise ApiError(404, "cause not found")
    return c


@bp.get("/projects/<int:pid>/causes/<int:cid>")
@require("read")
def cause_detail(pid: int, cid: int):
    proj = project(pid)
    s = db()
    c = _cause(s, proj, cid)
    mods = serial.module_names(s, proj.id)
    inc_ids = {r for (r,) in s.execute(select(RootCause.incident_id).where(RootCause.cause_node_id == c.id))}
    incs = [serial.incident(i, mods) for i in s.execute(select(Incident).where(Incident.id.in_(inc_ids))).scalars()] \
        if inc_ids else []
    up = [{"id": e.source_node_id, "label": s.get(CauseNode, e.source_node_id).label, "weight": e.weight}
          for e in s.execute(select(CauseEdge).where(CauseEdge.target_node_id == c.id)).scalars()]
    down = [{"id": e.target_node_id, "label": s.get(CauseNode, e.target_node_id).label, "weight": e.weight}
            for e in s.execute(select(CauseEdge).where(CauseEdge.source_node_id == c.id)).scalars()]
    debts = [serial.debt(d, mods) for d in
             s.execute(select(TechnicalDebt).where(TechnicalDebt.root_cause_node_id == c.id)).scalars()]
    snap = S.snapshot(s, proj, with_embeddings=False)
    m = E.causal_metrics(snap).get(c.id, {})
    return ok({"cause": {"id": c.id, "label": c.label, "category": c.category, **m},
               "incidents": incs, "symptoms": up, "deeper_causes": down, "debts": debts})


@bp.patch("/projects/<int:pid>/causes/<int:cid>")
@require("rca.write")
def update_cause(pid: int, cid: int):
    proj = project(pid)
    s = db()
    c = _cause(s, proj, cid)
    data = V.body(request)
    if "label" in data:
        c.label = V.text(data, "label", required=True, min_len=3, max_len=300)
        from ...core import text as T

        c.normalized_label = T.normalize_cause(c.label)[:300]
        c.embedding = None
    if "category" in data:
        c.category = V.choice(data, "category", ("SYMPTOM", "MECHANISM", "ROOT", "PROCESS", "GENERAL"))
    s.commit()
    return ok({"cause": {"id": c.id, "label": c.label, "category": c.category}})


@bp.post("/projects/<int:pid>/causes/merge")
@require("rca.write")
def merge_causes(pid: int):
    """Curate the graph: fold duplicate cause nodes into one."""
    proj = project(pid)
    s = db()
    data = V.body(request)
    keep = _cause(s, proj, int(data.get("keep_id") or 0))
    merge = [_cause(s, proj, i) for i in V.int_list(data.get("merge_ids"), "merge_ids") if i != keep.id]
    if not merge:
        raise ApiError(400, "choose at least one cause to merge into the kept one")
    ids = [m.id for m in merge]
    s.execute(update(RootCause).where(RootCause.cause_node_id.in_(ids)).values(cause_node_id=keep.id))
    s.execute(update(TechnicalDebt).where(TechnicalDebt.root_cause_node_id.in_(ids)).values(root_cause_node_id=keep.id))
    weights: dict = {}
    for e in s.execute(select(CauseEdge).where(CauseEdge.project_id == proj.id)).scalars().all():
        a = keep.id if e.source_node_id in ids else e.source_node_id
        b = keep.id if e.target_node_id in ids else e.target_node_id
        if a != b:
            weights[(a, b)] = weights.get((a, b), 0) + e.weight
    s.execute(delete(CauseEdge).where(CauseEdge.project_id == proj.id))
    s.flush()
    for (a, b), w in weights.items():
        s.add(CauseEdge(project_id=proj.id, source_node_id=a, target_node_id=b, weight=w))
    s.execute(delete(CauseNode).where(CauseNode.id.in_(ids)))
    S.audit(s, proj.id, me(), "cause.merged", f"cause:{keep.id}", merged=ids)
    s.commit()
    return ok({"kept": keep.id, "merged": ids})


@bp.get("/projects/<int:pid>/clusters")
@require("read")
def clusters(pid: int):
    proj = project(pid)
    s = db()
    snap, alpha, tau, fn = S.intel(s, proj)
    eps = request.args.get("eps")
    out = E.cause_clusters(snap, float(eps) if eps else None, args_int("min_samples", 2, 2, 10), fn)
    key_of = {i["id"]: i["key"] for i in snap["incidents"]}
    by_cause: dict = {}
    for rc in snap["root_causes"]:
        by_cause.setdefault(rc["cause_id"], set()).add(key_of.get(rc["incident_id"]))
    for c in out["clusters"]:
        keys = set()
        for cid in c.get("member_ids") or []:
            keys |= by_cause.get(cid, set())
        c["incident_keys"] = sorted(k for k in keys if k)
    return ok(out)
