"""Bulk intake (synopsis §5.4): error logs → incidents, CSV/JSON backlog import, GitHub issues.

Log ingestion groups raw error events by a *signature* —
    exception type | message with variables masked | top stack-frame file
so 4,000 lines of the same timeout become one incident with "seen 4,000×",
not 4,000 incidents.  Each group is then matched against existing incidents
(hybrid similarity) so a recurring error is attached to the known incident.
"""

from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from datetime import datetime

from .mining import module_of

SEV_ALIASES = {
    "CRITICAL": ("critical", "crit", "blocker", "p0", "p1", "sev1", "s1", "fatal", "urgent"),
    "HIGH": ("high", "major", "p2", "sev2", "s2", "important"),
    "MEDIUM": ("medium", "med", "normal", "moderate", "p3", "sev3", "s3"),
    "LOW": ("low", "minor", "trivial", "p4", "p5", "sev4", "s4", "cosmetic"),
}
STATUS_ALIASES = {
    "OPEN": ("open", "new", "todo", "to do", "triage", "reported", "reopened", "backlog"),
    "INVESTIGATING": ("investigating", "in progress", "in-progress", "doing", "assigned", "active", "wip"),
    "RESOLVED": ("resolved", "closed", "done", "fixed", "complete", "completed", "verified"),
}
COLUMNS = {
    "key": ("key", "id", "incident_id", "number", "ticket", "issue"),
    "title": ("title", "summary", "subject", "name", "headline"),
    "description": ("description", "details", "body", "desc", "text", "notes"),
    "severity": ("severity", "priority", "sev", "impact"),
    "module": ("module", "component", "service", "area", "subsystem"),
    "status": ("status", "state"),
    "reported_at": ("reported_at", "created_at", "created", "opened", "date", "reported", "opened_at"),
    "resolved_at": ("resolved_at", "closed_at", "closed", "resolved", "fixed_at"),
    "effort_hours": ("effort_hours", "effort", "hours", "time_spent", "resolution_hours"),
}


def norm_severity(v, default="MEDIUM") -> str:
    s = str(v or "").strip().lower()
    for sev, aliases in SEV_ALIASES.items():
        if s == sev.lower() or s in aliases:
            return sev
    return default


def norm_status(v, default="OPEN") -> str:
    s = str(v or "").strip().lower().replace("_", " ")
    for st, aliases in STATUS_ALIASES.items():
        if s == st.lower() or s in aliases:
            return st
    return default


def parse_date(v) -> str | None:
    if v in (None, ""):
        return None
    s = str(v).strip().replace("Z", "+00:00")
    for fmt in (None, "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y %H:%M"):
        try:
            d = datetime.fromisoformat(s) if fmt is None else datetime.strptime(s, fmt)
            return d.replace(tzinfo=None).isoformat(timespec="seconds")
        except ValueError:
            continue
    return None


def _num(v, default=None):
    try:
        return float(str(v).lower().replace("h", "").replace("hrs", "").strip())
    except (TypeError, ValueError):
        return default


def normalize_incident(raw: dict, row_no: int | None = None) -> tuple[dict | None, list[str]]:
    lower = {str(k).strip().lower(): v for k, v in raw.items()}
    rec: dict = {}
    for field, aliases in COLUMNS.items():
        for a in aliases:
            if a in lower and lower[a] not in (None, ""):
                rec[field] = lower[a]
                break
    where = f"row {row_no}: " if row_no is not None else ""
    errors = []
    title = str(rec.get("title") or "").strip()
    if len(title) < 3:
        return None, [f"{where}missing title"]
    out = {
        "key": str(rec["key"]).strip() if rec.get("key") else None,
        "title": title[:250],
        "description": str(rec.get("description") or "").strip()[:4000],
        "severity": norm_severity(rec.get("severity")),
        "status": norm_status(rec.get("status")),
        "module": str(rec.get("module") or "unassigned").strip().lower()[:100],
        "reported_at": parse_date(rec.get("reported_at")),
        "resolved_at": parse_date(rec.get("resolved_at")),
        "effort_hours": _num(rec.get("effort_hours"), 4.0),
    }
    if rec.get("reported_at") and not out["reported_at"]:
        errors.append(f"{where}could not read date {rec['reported_at']!r}; used import time")
    if out["status"] == "RESOLVED" and not out["resolved_at"]:
        out["resolved_at"] = out["reported_at"]
    if out["effort_hours"] is None or out["effort_hours"] < 0 or out["effort_hours"] > 1000:
        out["effort_hours"] = 4.0
        errors.append(f"{where}effort out of range; used 4h")
    return out, errors


def parse_csv(text: str) -> tuple[list[dict], list[str]]:
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    records, errors = [], []
    for i, row in enumerate(reader, start=2):
        rec, errs = normalize_incident(row, i)
        errors.extend(errs)
        if rec:
            records.append(rec)
    return records, errors


def parse_json(obj) -> tuple[list[dict], list[dict], list[str]]:
    """Accepts a list of incidents or {"incidents": [...], "debts": [...]}."""
    if isinstance(obj, (str, bytes)):
        obj = json.loads(obj)
    incs_raw = obj if isinstance(obj, list) else obj.get("incidents", [])
    debts_raw = [] if isinstance(obj, list) else obj.get("debts", [])
    incidents, errors = [], []
    for i, raw in enumerate(incs_raw, start=1):
        rec, errs = normalize_incident(raw, i)
        errors.extend(errs)
        if rec:
            incidents.append(rec)
    debts = []
    for i, d in enumerate(debts_raw, start=1):
        if not d.get("title"):
            errors.append(f"debt {i}: missing title")
            continue
        debts.append({
            "key": d.get("key"), "title": str(d["title"])[:250], "description": str(d.get("description") or ""),
            "category": str(d.get("category") or "CODE_SMELL").upper(), "module": str(d.get("module") or "unassigned").lower(),
            "principal": _num(d.get("principal") or d.get("effort"), 8.0), "status": str(d.get("status") or "IDENTIFIED").upper(),
        })
    return incidents, debts, errors


# ----------------------------------------------------------------------------- logs

_PY_TB = re.compile(r"^Traceback \(most recent call last\):")
_PY_FRAME = re.compile(r'^\s+File "([^"]+)", line (\d+)')
_EXC_LINE = re.compile(r"^([A-Za-z_][\w.]*(?:Error|Exception|Exit|Interrupt|Warning|Fault|Failure))(?::\s*(.*))?$")
_JS_FRAME = re.compile(r"^\s+at (?:.*?\()?([^\s()]+?):(\d+):\d+\)?\s*$")
_JAVA_FRAME = re.compile(r"^\s+at [\w$.<>]+\(([\w$]+\.\w+):(\d+)\)")
_LEVEL = re.compile(r"\b(FATAL|CRITICAL|PANIC|SEVERE|ERROR|ERR|WARN|WARNING)\b[\]:\s-]*(.*)", re.IGNORECASE)
_TS = re.compile(r"(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})")
_HINT = re.compile(r"^(?:\[([\w./-]+)\]|([a-z]\w*(?:\.\w+)+):(?=\s))\s*(.*)$")
_MASKS = [
    (re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I), "<uuid>"),
    (re.compile(r"\b0x[0-9a-f]+\b", re.I), "<hex>"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"), "<email>"),
    (re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b"), "<ip>"),
    (re.compile(r"(['\"]).*?\1"), "<str>"),
    (re.compile(r"\b[0-9a-f]{12,}\b", re.I), "<id>"),
    (re.compile(r"\b\d+(?:\.\d+)?(?:ms|s|kb|mb|gb|%)?\b", re.I), "<n>"),
]


def mask(message: str) -> str:
    m = message.strip()
    for rx, rep in _MASKS:
        m = rx.sub(rep, m)
    return re.sub(r"\s+", " ", m)[:200]


def _events(lines: list[str]):
    i, n = 0, len(lines)
    while i < n:
        line = lines[i].rstrip("\n")
        ts = (_TS.search(line) or [None])[0] if _TS.search(line) else None
        if _PY_TB.search(line):
            frames, j = [], i + 1
            while j < n and (lines[j].startswith((" ", "\t")) or not lines[j].strip()):
                fm = _PY_FRAME.match(lines[j])
                if fm:
                    frames.append(fm.group(1))
                j += 1
            exc, msg = "Exception", ""
            if j < n:
                em = _EXC_LINE.match(lines[j].strip())
                if em:
                    exc, msg = em.group(1), em.group(2) or ""
                    j += 1
            yield {"level": "ERROR", "exc": exc, "message": msg, "frames": frames, "ts": ts, "line": i + 1}
            i = j
            continue
        stripped = line.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                rec = json.loads(stripped)
                lvl = str(rec.get("level") or rec.get("severity") or rec.get("lvl") or "").upper()
                if lvl in ("ERROR", "FATAL", "CRITICAL", "PANIC", "SEVERE", "ERR"):
                    msg = str(rec.get("message") or rec.get("msg") or rec.get("error") or "")
                    em = _EXC_LINE.match(msg)
                    yield {"level": lvl, "exc": em.group(1) if em else (rec.get("error_type") or rec.get("exception") or ""),
                           "message": (em.group(2) or "") if em else msg,
                           "frames": [str(rec.get("file") or rec.get("logger") or rec.get("module") or "")],
                           "ts": rec.get("time") or rec.get("timestamp") or rec.get("ts"), "line": i + 1,
                           "module_hint": rec.get("service") or rec.get("module")}
            except (ValueError, AttributeError):
                pass
            i += 1
            continue
        em = _EXC_LINE.match(stripped.split(" - ")[-1]) if ("Error" in line or "Exception" in line) else None
        lm = _LEVEL.search(line)
        if em or (lm and lm.group(1).upper() not in ("WARN", "WARNING")):
            frames, j = [], i + 1
            while j < n and (_JS_FRAME.match(lines[j]) or _JAVA_FRAME.match(lines[j]) or lines[j].strip().startswith("Caused by")):
                fm = _JS_FRAME.match(lines[j]) or _JAVA_FRAME.match(lines[j])
                if fm:
                    frames.append(fm.group(1))
                j += 1
            hint = None
            if em:
                exc, msg = em.group(1), em.group(2) or ""
            else:
                rest = lm.group(2).strip()
                hm = _HINT.match(rest)
                if hm:  # "ERROR [payments] ..." or "ERROR payments.gateway: ..."
                    hint, rest = (hm.group(1) or hm.group(2)).split(".")[0].split("/")[0], hm.group(3)
                em2 = _EXC_LINE.match(rest.strip())
                exc, msg = (em2.group(1), em2.group(2) or "") if em2 else ("", rest)
            # a Python traceback printed right after the log line belongs to the same event
            if j < n and _PY_TB.search(lines[j]):
                k = j + 1
                while k < n and (lines[k].startswith((" ", "\t")) or not lines[k].strip()):
                    fm = _PY_FRAME.match(lines[k])
                    if fm:
                        frames.append(fm.group(1))
                    k += 1
                if k < n:
                    tm = _EXC_LINE.match(lines[k].strip())
                    if tm:
                        if not exc:
                            exc, msg = tm.group(1), tm.group(2) or msg
                        k += 1
                j = k
            level = lm.group(1).upper() if lm else "ERROR"
            yield {"level": "ERROR" if level == "ERR" else level, "exc": exc, "message": msg,
                   "frames": frames, "ts": ts, "line": i + 1, "module_hint": hint}
            i = j
            continue
        i += 1


def parse_logs(text: str, rules: list | None = None) -> dict:
    """Group error events into incident candidates."""
    lines = text.splitlines()
    groups: dict[str, dict] = {}
    total = 0
    for ev in _events(lines):
        total += 1
        top = next((f for f in ev["frames"] if f and "site-packages" not in f and "node_modules" not in f), None) \
            or (ev["frames"][0] if ev["frames"] else "")
        top_rel = top.replace("\\", "/")
        for marker in ("/app/", "/src/", "/srv/", "/code/"):
            if marker in top_rel:
                top_rel = top_rel.split(marker, 1)[1]
                break
        module = (ev.get("module_hint") or (module_of(top_rel, rules) if top_rel else "unassigned")).lower()
        # signature: exception + masked message + module (the same error logged with or without its
        # traceback still groups together; the top frame only names the file)
        sig = f"{ev['exc'] or ev['level']}|{mask(ev['message'])}|{module}"
        g = groups.get(sig)
        if not g:
            exc = ev["exc"] or ev["level"].title()
            template = mask(ev["message"]) or "(no message)"
            g = groups[sig] = {
                "signature": sig, "exception": exc, "template": template, "module": module,
                "file": top_rel or None, "count": 0, "first_seen": ev.get("ts"), "last_seen": ev.get("ts"),
                "first_line": ev["line"], "sample": ev["message"][:300], "levels": set(),
            }
        g["count"] += 1
        g["levels"].add(ev["level"])
        if ev.get("ts"):
            g["first_seen"] = min(filter(None, [g["first_seen"], ev["ts"]]))
            g["last_seen"] = max(filter(None, [g["last_seen"], ev["ts"]]))
    out = []
    for g in groups.values():
        lv = g.pop("levels")
        exc = g["exception"]
        if lv & {"FATAL", "CRITICAL", "PANIC"} or "OutOfMemory" in exc or "Deadlock" in exc:
            sev = "CRITICAL"
        elif g["count"] >= 20 or any(k in exc for k in ("Timeout", "Connection", "Unavailable")):
            sev = "HIGH"
        elif g["count"] >= 3:
            sev = "MEDIUM"
        else:
            sev = "LOW"
        where = f" in {g['file']}" if g["file"] else ""
        g["severity"] = sev
        g["title"] = f"{exc}: {g['template']}"[:200]
        g["description"] = (f"Raised automatically from logs: {exc}{where}, seen {g['count']}× "
                            f"(first {g['first_seen'] or 'n/a'}, last {g['last_seen'] or 'n/a'}). "
                            f"Sample: {g['sample']}")
        out.append(g)
    out.sort(key=lambda g: (-["LOW", "MEDIUM", "HIGH", "CRITICAL"].index(g["severity"]), -g["count"]))
    return {"lines": len(lines), "events": total, "groups": out}


# ----------------------------------------------------------------------------- GitHub issues

def github_issues(repo: str, token: str | None = None, labels: str = "bug", state: str = "all",
                  limit: int = 100) -> list[dict]:
    from .mining import parse_github_url

    owner, name = parse_github_url(repo)
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "debtlens/2"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    out, page = [], 1
    while len(out) < limit:
        url = (f"https://api.github.com/repos/{owner}/{name}/issues?state={state}&per_page=100&page={page}"
               + (f"&labels={labels}" if labels else ""))
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as r:
            batch = json.loads(r.read())
        if not batch:
            break
        for it in batch:
            if "pull_request" in it:
                continue
            names = [lab["name"].lower() for lab in it.get("labels") or []]
            sev = next((norm_severity(n.split(":")[-1].strip(), "") for n in names
                        if norm_severity(n.split(":")[-1].strip(), "")), "MEDIUM")
            module = next((n.split(":", 1)[1].strip() for n in names
                           if n.startswith(("module:", "area:", "component:", "service:"))), "unassigned")
            effort = next((_num(n.split(":", 1)[1]) for n in names if n.startswith("effort:")), None) or 4.0
            out.append({
                "key": f"GH-{it['number']}", "title": it["title"][:250], "description": (it.get("body") or "")[:2000],
                "severity": sev, "status": "RESOLVED" if it["state"] == "closed" else "OPEN", "module": module,
                "reported_at": parse_date(it.get("created_at")), "resolved_at": parse_date(it.get("closed_at")),
                "effort_hours": effort, "external_ref": it.get("html_url"),
            })
        page += 1
    return out[:limit]
