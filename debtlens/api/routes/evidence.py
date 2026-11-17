"""Repository evidence (CLI scans, GitHub mining, TODO/FIXME markers) and data imports."""

from __future__ import annotations

import hashlib
import os

from flask import Blueprint, request
from sqlalchemy import func, select

from ...core import ingest as ING
from ...core import mining as MIN
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import args_int, db, me, ok, project, rate_limit
from ..errors import ApiError
from ..models import FileMetric, Incident, RepoScan, SatdMarker, TechnicalDebt
from ..security import require
from ..services import iso

bp = Blueprint("evidence", __name__)


@bp.get("/projects/<int:pid>/evidence")
@require("read")
def evidence(pid: int):
    proj = project(pid)
    s = db()
    mods = serial.module_names(s, proj.id)
    limit = args_int("limit", 150, 1, 2000)
    files = s.execute(select(FileMetric).where(FileMetric.project_id == proj.id)
                      .order_by(FileMetric.hotspot_score.desc()).limit(limit)).scalars().all()
    total_files = s.execute(select(func.count(FileMetric.id)).where(FileMetric.project_id == proj.id)).scalar_one()
    satd = s.execute(select(SatdMarker).where(SatdMarker.project_id == proj.id).order_by(SatdMarker.file_path,
                                                                                      SatdMarker.line_no)).scalars().all()
    scans = s.execute(select(RepoScan).where(RepoScan.project_id == proj.id).order_by(RepoScan.id.desc()).limit(10)).scalars()
    debt_keys = {d.id: d.debt_key for d in s.execute(select(TechnicalDebt).where(TechnicalDebt.project_id == proj.id)).scalars()}
    return ok({
        "files": [{"path": f.file_path, "module": mods.get(f.module_id, "root"), "language": f.language, "churn": f.churn,
                   "lines_changed": f.lines_changed, "complexity": f.complexity,
                   "max_function_complexity": f.max_function_complexity, "loc": f.loc, "authors": f.authors,
                   "hotspot_score": f.hotspot_score, "last_modified": iso(f.last_modified)} for f in files],
        "total_files": total_files,
        "satd": [{"id": x.id, "path": x.file_path, "line": x.line_no, "marker": x.marker, "text": x.text,
                  "module": mods.get(x.module_id, "root"), "status": x.status, "debt_key": debt_keys.get(x.debt_id)}
                 for x in satd],
        "scans": [{"id": r.id, "source": r.source, "repository": r.repository, "commit": r.commit_sha, "branch": r.branch,
                   "commits_analyzed": r.commits_analyzed, "files_analyzed": r.files_analyzed,
                   "window_days": r.window_days, "warnings": r.warnings, "scanned_by": r.scanned_by,
                   "scanned_at": iso(r.scanned_at)} for r in scans],
        "repository_url": proj.repository_url,
    })


def _check_scan(scan) -> dict:
    if not isinstance(scan, dict) or not isinstance(scan.get("files"), list):
        raise ApiError(400, "expected a scan result from `debtlens scan --json`")
    for f in scan["files"][:5]:
        if not isinstance(f, dict) or "path" not in f:
            raise ApiError(400, "scan files need a 'path'")
    return scan


@bp.post("/projects/<int:pid>/evidence/scan")
@require("evidence.write")
def upload_scan(pid: int):
    """Receive a full local git-history scan from the CLI (`debtlens scan --push`)."""
    proj = project(pid)
    s = db()
    scan = _check_scan(V.body(request))
    p = me()
    summary = S.apply_scan(s, proj, scan, p.name)
    S.audit(s, proj.id, p, "evidence.scan", scan.get("repository") or scan.get("root"), **summary)
    s.commit()
    return ok({"applied": summary}, 201)


@bp.post("/projects/<int:pid>/evidence/github")
@require("evidence.write")
def github(pid: int):
    """Mine a public GitHub repository from the website (no git needed on the server)."""
    proj = project(pid)
    s = db()
    data = V.body(request)
    url = V.text(data, "url", max_len=300) or proj.repository_url
    if not url:
        raise ApiError(400, "enter a GitHub repository URL")
    rate_limit("evidence.github", 12, 60)
    try:
        MIN.parse_github_url(url)
        scan = MIN.github_scan(url, os.environ.get("GITHUB_TOKEN"), max_commits=int(V.number(data, "max_commits",
                                                                                                default=120, lo=10, hi=300)))
    except ValueError as e:
        raise ApiError(400, str(e)) from e
    except Exception as e:
        raise ApiError(502, f"could not read the repository from GitHub ({type(e).__name__})") from e
    from ..deps import note

    note("evidence.github")
    p = me()
    summary = S.apply_scan(s, proj, scan, p.name)
    if not proj.repository_url:
        proj.repository_url = url
    S.audit(s, proj.id, p, "evidence.github", scan.get("repository"), **summary)
    s.commit()
    return ok({"applied": summary, "warnings": scan.get("warnings") or [], "seconds": scan.get("seconds"),
               "commits_analyzed": scan.get("commits_analyzed"), "files_analyzed": scan.get("files_analyzed")}, 201)


def _satd(s, proj, sid: int) -> SatdMarker:
    x = s.get(SatdMarker, sid)
    if x is None or x.project_id != proj.id:
        raise ApiError(404, "marker not found")
    return x


_CATEGORY_HINTS = (("SECURITY_DEBT", ("secur", "auth", "password", "token", "secret", "csrf", "xss", "inject", "encrypt")),
                   ("TEST_DEBT", ("test", "flaky", "coverage", "mock")),
                   ("DOCUMENTATION", ("doc", "comment", "readme")),
                   ("INFRASTRUCTURE", ("deploy", "infra", "config", "ci", "docker", "env", "pool", "timeout", "retry")),
                   ("ARCHITECTURAL", ("refactor", "architecture", "coupl", "split", "extract", "layer", "module")))


def guess_category(text: str) -> str:
    t = text.lower()
    for cat, words in _CATEGORY_HINTS:
        if any(w in t for w in words):
            return cat
    return "CODE_SMELL"


@bp.post("/projects/<int:pid>/satd/<int:sid>/debt")
@require("debt.write")
def satd_to_debt(pid: int, sid: int):
    proj = project(pid)
    s = db()
    x = _satd(s, proj, sid)
    if x.debt_id:
        raise ApiError(409, "already converted")
    data = V.body(request)
    d = TechnicalDebt(project_id=proj.id, debt_key=S.next_key(proj, "debt"), module_id=x.module_id,
                      title=(V.text(data, "title", max_len=250) or f"{x.marker}: {x.text}")[:250],
                      description=f"Self-admitted technical debt at {x.file_path}:{x.line_no} — “{x.text}”",
                      category=V.choice(data, "category", ("ARCHITECTURAL", "CODE_SMELL", "TEST_DEBT", "INFRASTRUCTURE",
                                                           "SECURITY_DEBT", "DOCUMENTATION"))
                      or guess_category(x.text),
                      principal_hours=V.number(data, "principal", default=4.0, lo=0.5, hi=500),
                      file_path=x.file_path, source="satd", status="IDENTIFIED", priority="MEDIUM")
    s.add(d)
    s.flush()
    x.debt_id, x.status = d.id, "CONVERTED"
    S.audit(s, proj.id, me(), "debt.from_satd", d.debt_key, path=x.file_path, line=x.line_no)
    s.commit()
    return ok({"debt": serial.debt(d, serial.module_names(s, proj.id))}, 201)


@bp.patch("/projects/<int:pid>/satd/<int:sid>")
@require("evidence.write")
def update_satd(pid: int, sid: int):
    proj = project(pid)
    s = db()
    x = _satd(s, proj, sid)
    status = V.choice(V.body(request), "status", ("DETECTED", "DISMISSED"))
    if x.debt_id:
        raise ApiError(409, "marker is linked to a debt item")
    x.status = status
    s.commit()
    return ok({"id": x.id, "status": x.status})


# ----------------------------------------------------------------------------- imports

def _existing_refs(s, proj) -> dict[str, Incident]:
    rows = s.execute(select(Incident).where(Incident.project_id == proj.id, Incident.external_ref.is_not(None))).scalars()
    return {r.external_ref: r for r in rows}


def _commit_incidents(s, proj, records: list[dict], source: str, dry_run: bool) -> dict:
    refs = _existing_refs(s, proj)
    keys = {k for (k,) in s.execute(select(Incident.incident_key).where(Incident.project_id == proj.id))}
    created, skipped, preview = [], [], []
    p = me()
    for r in records:
        ref = r.get("external_ref") or (f"{source}:{r['key']}" if r.get("key") else None)
        if (ref and ref in refs) or (r.get("key") and r["key"] in keys):
            skipped.append(r.get("key") or r["title"][:60])
            continue
        preview.append({k: r.get(k) for k in ("key", "title", "module", "severity", "status", "reported_at",
                                              "resolved_at", "effort_hours")})
        if not dry_run:
            inc = S.create_incident(s, proj, p, {**r, "external_ref": ref}, source=source)
            created.append(inc.incident_key)
    return {"would_create" if dry_run else "created": preview if dry_run else created, "skipped": skipped}


@bp.post("/projects/<int:pid>/import/incidents")
@require("import.write")
def import_incidents(pid: int):
    """CSV or JSON (Jira/ServiceNow/PagerDuty exports — common column names are recognised)."""
    proj = project(pid)
    s = db()
    data = V.body(request)
    dry = bool(data.get("dry_run", True))
    fmt = (data.get("format") or "csv").lower()
    debts = []
    try:
        if fmt == "csv":
            recs, errors = ING.parse_csv(str(data.get("text") or ""))
        elif fmt == "json":
            recs, debts, errors = ING.parse_json(data.get("data") if data.get("data") is not None else data.get("text") or "[]")
        else:
            raise ApiError(400, "format must be csv or json")
    except ApiError:
        raise
    except Exception as e:
        raise ApiError(400, f"could not parse the file: {e}") from e
    if len(recs) > 2000:
        raise ApiError(400, "import at most 2000 incidents at a time")
    out = _commit_incidents(s, proj, recs, "import", dry)
    if debts:
        if not me().can("debt.write"):
            errors.append("debts skipped: your role cannot create debt items")
        elif not dry:
            for d in debts[:500]:
                clean = V.clean_debt({**d, "status": d.get("status") if d.get("status") in
                                      ("IDENTIFIED", "IN_PROGRESS", "REMEDIATED") else "IDENTIFIED"})
                row = TechnicalDebt(project_id=proj.id, debt_key=S.next_key(proj, "debt"), source="import",
                                    title=clean["title"], description=clean["description"], category=clean["category"],
                                    priority=clean["priority"], status=clean["status"], principal_hours=clean["principal"],
                                    module_id=S.module_id(s, proj, clean["module"]))
                s.add(row)
        out["debts"] = len(debts)
    out["errors"] = errors[:50]
    out["dry_run"] = dry
    if not dry:
        S.audit(s, proj.id, me(), "import.incidents", fmt, created=len(out.get("created", [])))
        s.commit()
    else:
        s.rollback()
    return ok(out)


@bp.post("/projects/<int:pid>/import/github-issues")
@require("import.write")
def import_github(pid: int):
    proj = project(pid)
    s = db()
    data = V.body(request)
    repo = V.text(data, "repo", max_len=300) or proj.repository_url
    if not repo:
        raise ApiError(400, "enter a GitHub repository")
    rate_limit("import.github", 20, 60)
    try:
        recs = ING.github_issues(repo, os.environ.get("GITHUB_TOKEN"), labels=str(data.get("labels") or "bug"),
                                 state=str(data.get("state") or "all"), limit=int(V.number(data, "limit", default=100,
                                                                                          lo=1, hi=500)))
    except ValueError as e:
        raise ApiError(400, str(e)) from e
    except Exception as e:
        raise ApiError(502, f"GitHub request failed ({type(e).__name__})") from e
    from ..deps import note

    note("import.github")
    dry = bool(data.get("dry_run", True))
    out = _commit_incidents(s, proj, recs, "github", dry)
    out["dry_run"] = dry
    if dry:
        s.commit()  # keep the rate-limit note
    else:
        S.audit(s, proj.id, me(), "import.github", repo, created=len(out["created"]))
        s.commit()
    return ok(out)


@bp.post("/projects/<int:pid>/import/logs")
@require("import.write")
def import_logs(pid: int):
    """Turn raw application logs into incidents: errors grouped by signature (masked message
    + exception + top frame).  A signature that returns after its incident was resolved is
    raised again — and is then flagged as a regression by the similarity engine."""
    proj = project(pid)
    s = db()
    data = V.body(request)
    txt = str(data.get("text") or "")
    if not txt.strip():
        raise ApiError(400, "paste some log lines")
    parsed = ING.parse_logs(txt)
    order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    floor = order.index(ING.norm_severity(data.get("min_severity") or "LOW"))
    groups = [g for g in parsed["groups"] if order.index(g["severity"]) >= floor]
    dry = bool(data.get("dry_run", True))
    refs: dict[str, Incident] = {}
    for r in s.execute(select(Incident).where(Incident.project_id == proj.id,
                                              Incident.external_ref.like("log:%"))).scalars():
        base = ":".join(r.external_ref.split(":")[:2])
        if base not in refs or r.id > refs[base].id:
            refs[base] = r
    out_groups = []
    p = me()
    for g in groups[:300]:
        ref = "log:" + hashlib.sha256(g["signature"].encode()).hexdigest()[:24]
        prev = refs.get(ref)
        action = "create"
        if prev is not None and prev.status != "RESOLVED":
            action = "count"
        elif prev is not None:
            action = "recurred"
        row = {k: g[k] for k in ("title", "module", "severity", "count", "first_seen", "last_seen", "file", "exception",
                                 "template", "sample")}
        row["action"] = action
        row["existing_key"] = prev.incident_key if prev else None
        if not dry:
            if action == "count":
                prev.occurrences += g["count"]
            else:
                inc = S.create_incident(s, proj, p, {"title": g["title"], "description": g["description"],
                                                     "module": g["module"], "severity": g["severity"], "status": "OPEN",
                                                     "reported_at": g["first_seen"], "effort_hours": 4,
                                                     "external_ref": None if action == "recurred" else ref,
                                                     "occurrences": g["count"]}, source="logs")
                if action == "recurred":
                    inc.external_ref = ref + ":" + inc.incident_key
                row["created_key"] = inc.incident_key
        out_groups.append(row)
    if not dry:
        S.audit(s, proj.id, p, "import.logs", None, groups=len(out_groups))
        s.commit()
    return ok({"lines": parsed["lines"], "events": parsed["events"], "groups": out_groups, "dry_run": dry})
