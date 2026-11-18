"""Database-side logic shared by the routes: access control, snapshots for the engine,
scenario seeding, visitor sandboxes, 5-Whys convergence, embeddings, scans and imports."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from ..core import embeddings as EMB
from ..core import engine as E
from ..core import scenarios as SC
from ..core import text as T
from .errors import ApiError
from .models import (ApiToken, Assignment, AuditLog, CauseEdge, CauseNode, DebtDependency, DebtIncident, DebtPlaybook,
                     EmbeddingCache,
                     FileMetric, Incident, Module, ModuleDependency, Organization, Project, ProjectMember,
                     RemediationPlan, RepoScan, Resolution, RootCause, SatdMarker, SimulationRun, TechnicalDebt, User,
                     utcnow)
from .security import Principal

SANDBOX_HOURS = 24
SANDBOX_ORG_SLUG = "public-sandboxes"


def iso(d: datetime | None) -> str | None:
    return d.isoformat(timespec="seconds") if d else None


def parse_dt(v) -> datetime | None:
    if not v:
        return None
    if isinstance(v, datetime):
        return v
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d.replace(tzinfo=None)


# ----------------------------------------------------------------------------- access

def get_project(s: Session, pid: int, p: Principal) -> Project:
    proj = s.get(Project, pid)
    if proj is None:
        raise ApiError(404, "project not found")
    if p.kind == "sandbox":
        if proj.id != p.project_id:
            raise ApiError(403, "this sandbox token belongs to another project")
        if proj.expires_at and proj.expires_at < utcnow():
            raise ApiError(410, "sandbox expired — open a new one")
    elif proj.org_id != p.org_id:
        raise ApiError(404, "project not found")
    return proj


def audit(s: Session, project_id: int | None, p: Principal | None, action: str, entity: str | None = None, **detail) -> None:
    s.add(AuditLog(project_id=project_id, actor=p.name if p else "system", role=p.role if p else None,
                   action=action, entity=entity, detail=detail or None))


def next_key(proj: Project, kind: str) -> str:
    if kind == "incident":
        n = proj.next_incident_no
        proj.next_incident_no = n + 1
        return f"INC-{n}"
    n = proj.next_debt_no
    proj.next_debt_no = n + 1
    return f"DEBT-{n}"


def module_id(s: Session, proj: Project, name: str | None, create: bool = True) -> int | None:
    name = (name or "").strip().lower()[:100]
    if not name:
        return None
    m = s.execute(select(Module).where(Module.project_id == proj.id, Module.module_name == name)).scalar_one_or_none()
    if m is None and create:
        m = Module(project_id=proj.id, module_name=name)
        s.add(m)
        s.flush()
    return m.id if m else None


# ----------------------------------------------------------------------------- snapshot

def snapshot(s: Session, proj: Project, with_embeddings: bool = True) -> dict:
    pid = proj.id
    mods = s.execute(select(Module).where(Module.project_id == pid)).scalars().all()
    mname = {m.id: m.module_name for m in mods}
    incs = s.execute(select(Incident).where(Incident.project_id == pid).order_by(Incident.reported_at)).scalars().all()
    inc_ids = [i.id for i in incs]
    debts = s.execute(select(TechnicalDebt).where(TechnicalDebt.project_id == pid).order_by(TechnicalDebt.id)).scalars().all()
    debt_ids = [d.id for d in debts]
    links: dict[int, list[int]] = {}
    if debt_ids:
        for dl in s.execute(select(DebtIncident).where(DebtIncident.debt_id.in_(debt_ids))).scalars():
            links.setdefault(dl.debt_id, []).append(dl.incident_id)
    prereq: dict[int, list[int]] = {}
    if debt_ids:
        for dd in s.execute(select(DebtDependency).where(DebtDependency.debt_id.in_(debt_ids))).scalars():
            prereq.setdefault(dd.debt_id, []).append(dd.prerequisite_debt_id)
    causes = s.execute(select(CauseNode).where(CauseNode.project_id == pid)).scalars().all()
    rcs = s.execute(select(RootCause).where(RootCause.incident_id.in_(inc_ids))).scalars().all() if inc_ids else []
    res = s.execute(select(Resolution).where(Resolution.incident_id.in_(inc_ids))).scalars().all() if inc_ids else []
    return {
        "project": {"id": proj.id, "name": proj.project_name, "key": proj.project_key, "description": proj.description,
                    "repository_url": proj.repository_url, "scenario": proj.scenario_code, "industry": proj.industry},
        "now": iso(utcnow()),
        "modules": [{"id": m.id, "name": m.module_name, "path": m.path, "description": m.description, "churn": m.churn,
                     "complexity": m.complexity, "loc": m.loc, "files": m.files} for m in mods],
        "dependencies": [{"source": mname.get(d.source_module_id), "target": mname.get(d.target_module_id)}
                         for d in s.execute(select(ModuleDependency).where(ModuleDependency.project_id == pid)).scalars()
                         if d.source_module_id in mname and d.target_module_id in mname],
        "files": [{"path": f.file_path, "module": mname.get(f.module_id, "root"), "churn": f.churn,
                   "lines_changed": f.lines_changed, "complexity": f.complexity, "loc": f.loc, "authors": f.authors,
                   "hotspot_score": f.hotspot_score, "language": f.language,
                   "max_function_complexity": f.max_function_complexity, "last_modified": iso(f.last_modified)}
                  for f in s.execute(select(FileMetric).where(FileMetric.project_id == pid)).scalars()],
        "satd": [{"id": x.id, "path": x.file_path, "line": x.line_no, "marker": x.marker, "text": x.text,
                  "module": mname.get(x.module_id, "root"), "status": x.status, "debt_id": x.debt_id}
                 for x in s.execute(select(SatdMarker).where(SatdMarker.project_id == pid)).scalars()],
        "incidents": [{"id": i.id, "key": i.incident_key, "title": i.title, "description": i.description,
                       "module": mname.get(i.module_id, "unassigned"), "severity": i.severity, "status": i.status,
                       "reported_at": iso(i.reported_at), "resolved_at": iso(i.resolved_at), "effort_hours": i.effort_hours,
                       "reported_by": i.reporter_name, "source": i.source, "occurrences": i.occurrences,
                       "group": i.group_label,
                       "embedding": EMB.unpack(i.embedding) if with_embeddings else None} for i in incs],
        "causes": [{"id": c.id, "label": c.label, "category": c.category,
                    "embedding": EMB.unpack(c.embedding) if with_embeddings else None} for c in causes],
        "cause_edges": [{"source": e.source_node_id, "target": e.target_node_id, "weight": e.weight}
                        for e in s.execute(select(CauseEdge).where(CauseEdge.project_id == pid)).scalars()],
        "root_causes": [{"incident_id": r.incident_id, "level": r.why_level, "cause_id": r.cause_node_id,
                         "explanation": r.explanation} for r in rcs if r.cause_node_id],
        "resolutions": [{"incident_id": r.incident_id, "action": r.action_taken, "lessons": r.lessons_learned,
                         "resolved_by": r.fixed_by_name, "resolved_at": iso(r.resolved_at)} for r in res],
        "debts": [{"id": d.id, "key": d.debt_key, "title": d.title, "description": d.description,
                   "module": mname.get(d.module_id, "unassigned"), "category": d.category, "priority": d.priority,
                   "principal": d.principal_hours, "status": d.status, "assigned_to": d.assignee_name,
                   "root_cause_id": d.root_cause_node_id, "incident_ids": links.get(d.id, []),
                   "prerequisite_ids": prereq.get(d.id, []), "created_at": iso(d.created_at), "file_path": d.file_path,
                   "source": d.source} for d in debts],
    }


def playbook_state(s: Session, pid: int) -> tuple[dict, dict, dict]:
    """(project playbook edits, chosen playbook per debt id, steps done per debt id)."""
    rows = s.execute(select(DebtPlaybook).join(TechnicalDebt, TechnicalDebt.id == DebtPlaybook.debt_id)
                     .where(TechnicalDebt.project_id == pid)).scalars().all()
    chosen = {r.debt_id: r.playbook_key for r in rows if r.playbook_key}
    done = {r.debt_id: list(r.steps_done or []) for r in rows}
    proj = s.get(Project, pid)
    edits = dict(((proj.settings or {}).get("playbooks") or {})) if proj else {}
    return edits, chosen, done


def project_params(proj: Project) -> dict:
    return dict((proj.settings or {}).get("economics") or {})


def project_alpha_tau(proj: Project) -> tuple[float, float]:
    from ..core.similarity import DEFAULT_ALPHA, DEFAULT_TAU

    st = proj.settings or {}
    return float(st.get("alpha", DEFAULT_ALPHA)), float(st.get("tau", DEFAULT_TAU))


# ----------------------------------------------------------------------------- embeddings

def _h(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def embed_texts(s: Session, texts: list[str], download: bool = True) -> list[list[float]] | None:
    """MiniLM vectors via the shared cache; None when the model is unavailable."""
    if not texts:
        return []
    keys = [_h(t) for t in texts]
    found = {r.text_hash: EMB.unpack(r.vector) for r in
             s.execute(select(EmbeddingCache).where(EmbeddingCache.text_hash.in_(set(keys)))).scalars()}
    missing = [(k, t) for k, t in zip(keys, texts) if k not in found]
    if missing:
        model = EMB.get_embedder(download=download)
        if model is None:
            return None
        uniq = dict(missing)
        vecs = model.embed(list(uniq.values()))
        rows = []
        for k, v in zip(uniq.keys(), vecs):
            found[k] = v
            rows.append({"text_hash": k, "vector": EMB.pack(v), "created_at": utcnow()})
        try:
            s.execute(insert(EmbeddingCache), rows)
        except Exception:
            s.rollback()
    return [found[k] for k in keys]


def ensure_embeddings(s: Session, proj: Project) -> bool:
    """Fill missing incident and cause vectors.  Returns True when MiniLM is in use."""
    incs = s.execute(select(Incident).where(Incident.project_id == proj.id, Incident.embedding.is_(None))).scalars().all()
    causes = s.execute(select(CauseNode).where(CauseNode.project_id == proj.id, CauseNode.embedding.is_(None))).scalars().all()
    if not incs and not causes:
        return True
    from ..core.similarity import incident_text

    texts = [incident_text({"title": i.title, "description": i.description}) for i in incs] + [c.label for c in causes]
    vecs = embed_texts(s, texts)
    if vecs is None:
        return False
    for obj, v in zip(list(incs) + list(causes), vecs):
        obj.embedding = EMB.pack(v)
    s.commit()
    return True


def embed_fn_for(s: Session):
    def fn(texts: list[str]) -> list[list[float]]:
        out = embed_texts(s, texts)
        if out is None:
            raise RuntimeError("model unavailable")
        return out

    return fn if EMB.get_embedder(download=True) is not None else None


# ----------------------------------------------------------------------------- 5 Whys

def record_whys(s: Session, proj: Project, inc: Incident, whys: list[str], use_model: bool = True) -> list[dict]:
    """Store a 5-Whys chain: every answer becomes (or merges into) a reusable cause node,
    consecutive answers are linked symptom -> deeper cause."""
    whys = [w.strip()[:300] for w in whys if w and w.strip()][:7]
    s.execute(delete(RootCause).where(RootCause.incident_id == inc.id))
    causes = [{"id": c.id, "label": c.label, "embedding": EMB.unpack(c.embedding)} for c in
              s.execute(select(CauseNode).where(CauseNode.project_id == proj.id)).scalars()]
    fn = embed_fn_for(s) if use_model else None
    out, prev = [], None
    for level, why in enumerate(whys, 1):
        match, score, method = E.converge_cause(why, causes, fn)
        if match is None:
            cat = "SYMPTOM" if level == 1 else ("ROOT" if level == len(whys) else "MECHANISM")
            node = CauseNode(project_id=proj.id, label=why, normalized_label=T.normalize_cause(why)[:300], category=cat)
            if fn:
                try:
                    node.embedding = EMB.pack(fn([why])[0])
                except Exception:
                    pass
            s.add(node)
            s.flush()
            causes.append({"id": node.id, "label": why, "embedding": EMB.unpack(node.embedding)})
            nid, merged = node.id, False
        else:
            nid, merged = match, True
        s.add(RootCause(incident_id=inc.id, why_level=level, explanation=why, cause_node_id=nid))
        if prev is not None and prev != nid:
            e = s.execute(select(CauseEdge).where(CauseEdge.source_node_id == prev, CauseEdge.target_node_id == nid)).scalar_one_or_none()
            if e:
                e.weight += 1
            else:
                s.add(CauseEdge(project_id=proj.id, source_node_id=prev, target_node_id=nid))
        out.append({"level": level, "answer": why, "cause_id": nid, "merged": merged,
                    "similarity": score, "method": method})
        prev = nid
    s.flush()
    return out


# ----------------------------------------------------------------------------- seeding

def seed_scenario(s: Session, org: Organization, code: str, *, sandbox_key: str | None = None,
                  expires_at: datetime | None = None, name: str | None = None) -> Project:
    snap = SC.materialize(code)
    sc = SC.get(code)
    now = utcnow()
    proj = Project(org_id=org.id, project_name=name or snap["project"]["name"], project_key=snap["project"]["key"],
                   description=snap["project"]["description"], repository_url=snap["project"]["repository_url"],
                   industry=snap["project"]["industry"], scenario_code=code, is_sandbox=sandbox_key is not None,
                   sandbox_key=sandbox_key, expires_at=expires_at,
                   next_incident_no=_next_no([i["key"] for i in snap["incidents"]]),
                   next_debt_no=_next_no([d["key"] for d in snap["debts"]]), created_at=now)
    s.add(proj)
    s.flush()
    mid = {}
    for m in snap["modules"]:
        row = Module(project_id=proj.id, module_name=m["name"], path=m["path"], description=m["description"],
                     churn=m["churn"], complexity=m["complexity"], loc=m["loc"], files=m["files"])
        s.add(row)
        s.flush()
        mid[m["name"]] = row.id
    for name_ in {i["module"] for i in snap["incidents"]} | {d["module"] for d in snap["debts"]}:
        if name_ not in mid:
            row = Module(project_id=proj.id, module_name=name_)
            s.add(row)
            s.flush()
            mid[name_] = row.id
    dep_rows = [{"project_id": proj.id, "source_module_id": mid[d["source"]], "target_module_id": mid[d["target"]], "weight": 1}
                for d in snap["dependencies"] if d["source"] in mid and d["target"] in mid]
    if dep_rows:
        s.execute(insert(ModuleDependency), dep_rows)
    files = [{"project_id": proj.id, "module_id": mid.get(f["module"]), "file_path": f["path"], "churn": f["churn"],
              "lines_changed": f.get("lines_changed", 0), "complexity": f["complexity"], "loc": f["loc"],
              "authors": f.get("authors", 0), "hotspot_score": f.get("hotspot_score", 0)} for f in snap["files"]]
    if files:
        s.execute(insert(FileMetric), files)
    sat = [{"project_id": proj.id, "module_id": mid.get(x["module"]), "file_path": x["path"], "line_no": x["line"],
            "marker": x["marker"], "text": x["text"][:300], "status": "DETECTED"} for x in snap["satd"]]
    if sat:
        s.execute(insert(SatdMarker), sat)
    # cause nodes (with cached vectors when available)
    cached = _cached_vectors(s, [c["label"] for c in snap["causes"]])
    cid = {}
    for c in snap["causes"]:
        row = CauseNode(project_id=proj.id, label=c["label"], normalized_label=T.normalize_cause(c["label"])[:300],
                        category=c["category"], embedding=cached.get(_h(c["label"])))
        s.add(row)
        s.flush()
        cid[c["id"]] = row.id
    from ..core.similarity import incident_text

    inc_cached = _cached_vectors(s, [incident_text(i) for i in snap["incidents"]])
    iid = {}
    for i in snap["incidents"]:
        row = Incident(project_id=proj.id, module_id=mid.get(i["module"]), incident_key=i["key"], title=i["title"],
                       description=i["description"], severity=i["severity"], status=i["status"],
                       reporter_name=i["reported_by"], reported_at=parse_dt(i["reported_at"]),
                       resolved_at=parse_dt(i["resolved_at"]), effort_hours=i["effort_hours"], source=i["source"],
                       group_label=i.get("group"), embedding=inc_cached.get(_h(incident_text(i))))
        s.add(row)
        s.flush()
        iid[i["id"]] = row.id
    rc_rows = [{"incident_id": iid[r["incident_id"]], "why_level": r["level"], "explanation": r["explanation"][:400],
                "cause_node_id": cid[r["cause_id"]]} for r in snap["root_causes"]]
    if rc_rows:
        s.execute(insert(RootCause), rc_rows)
    edge_rows = [{"project_id": proj.id, "source_node_id": cid[e["source"]], "target_node_id": cid[e["target"]],
                  "relation": "caused_by", "weight": e["weight"]} for e in snap["cause_edges"]]
    if edge_rows:
        s.execute(insert(CauseEdge), edge_rows)
    res_rows = [{"incident_id": iid[r["incident_id"]], "fixed_by_name": r["resolved_by"], "action_taken": r["action"],
                 "lessons_learned": r["lessons"], "resolved_at": parse_dt(r["resolved_at"]) or now}
                for r in snap["resolutions"]]
    if res_rows:
        s.execute(insert(Resolution), res_rows)
    did = {}
    for d in snap["debts"]:
        row = TechnicalDebt(project_id=proj.id, module_id=mid.get(d["module"]), debt_key=d["key"], title=d["title"],
                            description=d["description"], category=d["category"], priority=d["priority"],
                            status=d["status"], assignee_name=d["assigned_to"],
                            root_cause_node_id=cid.get(d["root_cause_id"]) if d["root_cause_id"] else None,
                            principal_hours=d["principal"], file_path=d["file_path"], source=d["source"],
                            created_at=parse_dt(d["created_at"]) or now, updated_at=now)
        s.add(row)
        s.flush()
        did[d["id"]] = row.id
    link_rows = [{"debt_id": did[d["id"]], "incident_id": iid[x]} for d in snap["debts"] for x in d["incident_ids"]]
    if link_rows:
        s.execute(insert(DebtIncident), link_rows)
    pre_rows = [{"debt_id": did[d["id"]], "prerequisite_debt_id": did[p]} for d in snap["debts"] for p in d["prerequisite_ids"]]
    if pre_rows:
        s.execute(insert(DebtDependency), pre_rows)
    pb_rows = [{"debt_id": did[d["id"]], "playbook_key": d["playbook"], "steps_done": []}
               for d in snap["debts"] if d.get("playbook")]
    if pb_rows:
        s.execute(insert(DebtPlaybook), pb_rows)
    owners = {}
    for m in sc["modules"]:
        if m.get("owner"):
            owners[m["name"]] = m["owner"]
    proj.settings = {"people": snap.get("people", {}), "tour": sc.get("tour"), "module_owners": owners}
    s.flush()
    return proj


def _next_no(keys: list[str]) -> int:
    nums = [int(k.split("-")[-1]) for k in keys if k.split("-")[-1].isdigit()]
    return (max(nums) + 1) if nums else 101


def _cached_vectors(s: Session, texts: list[str]) -> dict[str, bytes]:
    keys = list({_h(t) for t in texts})
    if not keys:
        return {}
    return {r.text_hash: r.vector for r in s.execute(select(EmbeddingCache).where(EmbeddingCache.text_hash.in_(keys))).scalars()}


def delete_project(s: Session, pid: int) -> None:
    """Explicit cascade (works whether or not the database enforces ON DELETE CASCADE)."""
    inc_ids = select(Incident.id).where(Incident.project_id == pid)
    debt_ids = select(TechnicalDebt.id).where(TechnicalDebt.project_id == pid)
    for stmt in (
        delete(DebtIncident).where(DebtIncident.debt_id.in_(debt_ids)),
        delete(DebtDependency).where(DebtDependency.debt_id.in_(debt_ids)),
        delete(DebtPlaybook).where(DebtPlaybook.debt_id.in_(debt_ids)),
        delete(RootCause).where(RootCause.incident_id.in_(inc_ids)),
        delete(Resolution).where(Resolution.incident_id.in_(inc_ids)),
        delete(SatdMarker).where(SatdMarker.project_id == pid),
        delete(TechnicalDebt).where(TechnicalDebt.project_id == pid),
        delete(CauseEdge).where(CauseEdge.project_id == pid),
        delete(Incident).where(Incident.project_id == pid),
        delete(CauseNode).where(CauseNode.project_id == pid),
        delete(FileMetric).where(FileMetric.project_id == pid),
        delete(ModuleDependency).where(ModuleDependency.project_id == pid),
        delete(Assignment).where(Assignment.project_id == pid),
        delete(Module).where(Module.project_id == pid),
        delete(RepoScan).where(RepoScan.project_id == pid),
        delete(RemediationPlan).where(RemediationPlan.project_id == pid),
        delete(SimulationRun).where(SimulationRun.project_id == pid),
        delete(AuditLog).where(AuditLog.project_id == pid),
        delete(ProjectMember).where(ProjectMember.project_id == pid),
        delete(Project).where(Project.id == pid),
    ):
        s.execute(stmt)


# ----------------------------------------------------------------------------- sandboxes

def sandbox_org(s: Session) -> Organization:
    org = s.execute(select(Organization).where(Organization.slug == SANDBOX_ORG_SLUG)).scalar_one_or_none()
    if org is None:
        org = Organization(name="Public sandboxes", slug=SANDBOX_ORG_SLUG, is_sandbox=True)
        s.add(org)
        s.flush()
    return org


def cleanup_sandboxes(s: Session, limit: int = 20) -> int:
    expired = s.execute(select(Project.id).where(Project.is_sandbox.is_(True), Project.expires_at < utcnow())
                        .limit(limit)).scalars().all()
    for pid in expired:
        delete_project(s, pid)
    return len(expired)


def create_sandbox(s: Session, code: str) -> Project:
    cleanup_sandboxes(s)
    org = sandbox_org(s)
    key = secrets.token_urlsafe(18)
    proj = seed_scenario(s, org, code, sandbox_key=key, expires_at=utcnow() + timedelta(hours=SANDBOX_HOURS))
    s.commit()
    return proj


def sandbox_count(s: Session) -> int:
    return s.execute(select(func.count(Project.id)).where(Project.is_sandbox.is_(True))).scalar_one()


# ----------------------------------------------------------------------------- repository evidence

def apply_scan(s: Session, proj: Project, scan: dict, who: str) -> dict:
    """Replace a project's repository evidence with a ScanResult (from the CLI or GitHub)."""
    s.execute(delete(FileMetric).where(FileMetric.project_id == proj.id))
    s.execute(delete(SatdMarker).where(SatdMarker.project_id == proj.id, SatdMarker.debt_id.is_(None)))
    s.execute(delete(ModuleDependency).where(ModuleDependency.project_id == proj.id))
    mods = {m.module_name: m for m in s.execute(select(Module).where(Module.project_id == proj.id)).scalars()}
    for m in scan.get("modules") or []:
        name = str(m.get("name") or "root").lower()[:100]
        row = mods.get(name)
        if row is None:
            row = Module(project_id=proj.id, module_name=name)
            s.add(row)
            s.flush()
            mods[name] = row
        row.churn = float(m.get("churn") or 0)
        row.complexity = float(m.get("complexity") or 0)
        row.loc = int(m.get("loc") or 0)
        row.files = int(m.get("files") or 0)

    def mid(name):
        name = str(name or "root").lower()[:100]
        if name not in mods:
            row = Module(project_id=proj.id, module_name=name)
            s.add(row)
            s.flush()
            mods[name] = row
        return mods[name].id

    rows = []
    for f in (scan.get("files") or [])[:5000]:
        rows.append({"project_id": proj.id, "module_id": mid(f.get("module")), "file_path": str(f["path"])[:255],
                     "language": f.get("language"), "churn": int(f.get("churn") or 0),
                     "lines_changed": int(f.get("lines_changed") or 0), "complexity": float(f.get("complexity") or 0),
                     "max_function_complexity": f.get("max_function_complexity"), "loc": int(f.get("loc") or 0),
                     "authors": int(f.get("authors") or 0), "hotspot_score": float(f.get("hotspot_score") or 0),
                     "last_modified": parse_dt(f.get("last_modified"))})
    if rows:
        s.execute(insert(FileMetric), rows)
    known = {(x.file_path, x.line_no) for x in s.execute(select(SatdMarker).where(SatdMarker.project_id == proj.id)).scalars()}
    sat = [{"project_id": proj.id, "module_id": mid(x.get("module")), "file_path": str(x["path"])[:255],
            "line_no": int(x["line"]), "marker": str(x["marker"])[:15], "text": str(x.get("text") or "")[:300],
            "status": "DETECTED"} for x in (scan.get("satd") or [])[:3000] if (x["path"], x["line"]) not in known]
    if sat:
        s.execute(insert(SatdMarker), sat)
    deps = {}
    for d in scan.get("dependencies") or []:
        a, b = mid(d["source"]), mid(d["target"])
        if a != b:
            deps[(a, b)] = int(d.get("weight") or 1)
    if deps:
        s.execute(insert(ModuleDependency), [{"project_id": proj.id, "source_module_id": a, "target_module_id": b,
                                               "weight": w} for (a, b), w in deps.items()])
    s.add(RepoScan(project_id=proj.id, source=str(scan.get("source") or "cli")[:15],
                   repository=scan.get("repository") or scan.get("root"), commit_sha=scan.get("commit"),
                   branch=scan.get("branch"), commits_analyzed=int(scan.get("commits_analyzed") or 0),
                   files_analyzed=int(scan.get("files_analyzed") or 0), window_days=scan.get("window_days"),
                   warnings=scan.get("warnings") or [], scanned_by=who))
    s.flush()
    return {"files": len(rows), "satd_added": len(sat), "dependencies": len(deps), "modules": len(mods)}


# ----------------------------------------------------------------------------- incidents

def create_incident(s: Session, proj: Project, p: Principal, data: dict, source: str = "manual") -> Incident:
    from .validation import clean_incident

    d = clean_incident(data)
    inc = Incident(project_id=proj.id, module_id=module_id(s, proj, d["module"]), incident_key=next_key(proj, "incident"),
                   title=d["title"], description=d["description"], severity=d["severity"], status=d["status"],
                   reported_by=p.user_id, reporter_name=d.get("reported_by") or p.name,
                   reported_at=parse_dt(d.get("reported_at")) or utcnow(), resolved_at=parse_dt(d.get("resolved_at")),
                   effort_hours=d["effort_hours"], source=source, external_ref=d.get("external_ref"),
                   occurrences=int(data.get("occurrences") or 1))
    if inc.status == "RESOLVED" and not inc.resolved_at:
        inc.resolved_at = utcnow()
    s.add(inc)
    s.flush()
    return inc


def user_name_map(s: Session, org_id: int) -> dict[int, str]:
    return {u.id: u.name for u in s.execute(select(User).where(User.org_id == org_id)).scalars()}


def tokens_for(s: Session, user_id: int) -> list[dict]:
    return [{"id": t.id, "name": t.name, "prefix": t.prefix, "created_at": iso(t.created_at),
             "last_used_at": iso(t.last_used_at), "revoked": t.revoked}
            for t in s.execute(select(ApiToken).where(ApiToken.user_id == user_id)).scalars()]


# ----------------------------------------------------------------------------- warm-up

def warm_cache(s: Session, budget_s: float = 25.0) -> dict:
    """Load MiniLM and embed every bundled scenario text that is not cached yet, so new
    sandboxes start with vectors (called by the deploy check: /api/v1/health?warm=1)."""
    import time

    from ..core.similarity import incident_text

    t0 = time.time()
    model = EMB.get_embedder(download=True)
    if model is None:
        return {"model": False, "error": EMB.status().get("error")}
    added = 0
    for sc in SC.list_scenarios():
        if time.time() - t0 > budget_s:
            break
        snap = SC.materialize(sc["code"])
        texts = [incident_text(i) for i in snap["incidents"]] + [c["label"] for c in snap["causes"]]
        keys = {_h(t): t for t in texts}
        have = {r for (r,) in s.execute(select(EmbeddingCache.text_hash).where(EmbeddingCache.text_hash.in_(list(keys))))}
        todo = [t for k, t in keys.items() if k not in have]
        if todo:
            embed_texts(s, todo)
            s.commit()
            added += len(todo)
    return {"model": True, "embedded": added, "seconds": round(time.time() - t0, 2)}


def intel(s: Session, proj: Project):
    """Snapshot with MiniLM vectors where possible, plus the project's α/τ and an embed function."""
    use_model = ensure_embeddings(s, proj)
    snap = snapshot(s, proj, with_embeddings=True)
    alpha, tau = project_alpha_tau(proj)
    fn = embed_fn_for(s) if use_model else None
    return snap, alpha, tau, fn


# ----------------------------------------------------------------------------- cross-scenario comparison

_COMPARE_CACHE: dict = {}


def compare_scenarios(s: Session, budget: float = 40.0) -> dict:
    """Run the same engine over every bundled industry scenario and line the results up.
    (Simulation Lab → Scenarios.)  Cached per process for ten minutes."""
    import time

    from ..core.similarity import incident_text

    key = round(float(budget), 1)
    hit = _COMPARE_CACHE.get(key)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    t0 = time.time()
    rows = []
    for sc in SC.list_scenarios():
        snap = SC.materialize(sc["code"])
        texts = [incident_text(i) for i in snap["incidents"]]
        cached = _cached_vectors(s, texts + [c["label"] for c in snap["causes"]])
        for i, t in zip(snap["incidents"], texts):
            v = cached.get(_h(t))
            i["embedding"] = EMB.unpack(v) if v else None
        for c in snap["causes"]:
            v = cached.get(_h(c["label"]))
            c["embedding"] = EMB.unpack(v) if v else None
        led = E.ledger(snap)
        bundle = E.similarity_bundle(snap)
        dash = E.dashboard(snap, bundle=bundle)
        pl = E.plan(snap, budget, led=led)
        fc = E.forecast(snap, {"runs": 60, "sprints": 8, "budget": budget, "policies": ["optimal", "none"]})
        cmp_ = fc["comparisons"].get("optimal_vs_none", {})
        g = E.causal_graph(snap)
        top = g["nodes"][0] if g["nodes"] else None
        inc = dash["incidents"]
        rows.append({
            "code": sc["code"], "name": sc["name"], "industry": sc["industry"], "tagline": sc["tagline"],
            "incidents": inc["total"], "open_incidents": inc["open"] + inc["investigating"], "mttr_hours": inc["mttr_hours"],
            "modules": len(snap["modules"]), "open_debts": led["summary"]["open_items"],
            "principal": led["summary"]["total_principal"], "interest": led["summary"]["total_interest"],
            "break_even_pct": led["summary"]["break_even_pct"], "regressions": dash["regression_count"],
            "satd": dash["satd_count"], "systemic_cause": top["label"] if top else None,
            "plan_items": len(pl["selected"]), "plan_hours": pl["total_weight"], "interest_retired": pl["interest_retired"],
            "gain_vs_greedy_pct": pl["comparison"]["gain_vs_greedy_pct"], "gain_vs_naive_pct": pl["comparison"]["gain_vs_naive_pct"],
            "hours_saved_8_sprints": cmp_.get("hours_saved_mean"), "pct_saved_8_sprints": cmp_.get("pct_saved"),
            "ci95": cmp_.get("ci95"), "semantic_method": bundle.semantic_method,
        })
    out = {"budget": budget, "scenarios": rows, "seconds": round(time.time() - t0, 2)}
    _COMPARE_CACHE[key] = (time.time(), out)
    return out
