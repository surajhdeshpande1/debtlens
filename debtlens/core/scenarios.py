"""Bundled industry scenarios (Simulation Lab → "Industry scenarios").

Each ``debtlens/scenarios/<code>.json`` describes a fictional but realistic system:
modules, dependencies, file metrics, TODO/FIXME markers, incidents with 5-Whys chains
and resolutions, and debt items with prerequisites.  Times are given as *days ago*
so a scenario always looks current.  ``materialize()`` turns it into a snapshot that
the engine analyses exactly like a real project — nothing in a scenario is a
pre-computed result.

Ground truth for evaluation: incidents carry a ``group`` (duplicate family).  A
regression is any incident reported after an earlier member of its family, in the
same module, was resolved.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from . import text as T

SCENARIO_DIR = Path(__file__).resolve().parent.parent / "scenarios"


@lru_cache(maxsize=None)
def _load(code: str) -> dict:
    path = SCENARIO_DIR / f"{code}.json"
    if not path.is_file():
        raise KeyError(f"unknown scenario {code!r}")
    return json.loads(path.read_text(encoding="utf-8"))


def list_scenarios() -> list[dict]:
    out = []
    for f in sorted(SCENARIO_DIR.glob("*.json")):
        sc = _load(f.stem)
        out.append({"code": sc["code"], "name": sc["name"], "industry": sc["industry"], "tagline": sc["tagline"],
                    "summary": sc["summary"], "order": sc.get("order", 99),
                    "counts": {"modules": len(sc["modules"]), "incidents": len(sc["incidents"]),
                               "debts": len(sc["debts"])}})
    return sorted(out, key=lambda s: s["order"])


def get(code: str) -> dict:
    return _load(code)


def materialize(code_or_sc, now: datetime | None = None) -> dict:
    """Scenario -> analysis snapshot with integer ids and absolute timestamps."""
    sc = _load(code_or_sc) if isinstance(code_or_sc, str) else code_or_sc
    now = (now or datetime.now(timezone.utc)).replace(tzinfo=None, microsecond=0)

    def at(days_ago) -> str | None:
        if days_ago is None:
            return None
        return (now - timedelta(days=float(days_ago))).isoformat(timespec="seconds")

    people = sc.get("people", {})
    modules = [{"id": n, "name": m["name"], "path": m.get("path"), "description": m.get("description"),
                "churn": m.get("churn", 0), "complexity": m.get("complexity", 0), "loc": m.get("loc", 0),
                "files": m.get("files", 0), "owner": m.get("owner")}
               for n, m in enumerate(sc["modules"], 1)]
    files = [{"path": f[0], "module": f[1], "churn": f[2], "complexity": f[3], "loc": f[4],
              "lines_changed": f[5] if len(f) > 5 else 0, "authors": f[6] if len(f) > 6 else 2}
             for f in sc.get("files", [])]
    if files:
        mc = max(f["churn"] for f in files) or 1
        mx = max(f["complexity"] for f in files) or 1
        for f in files:
            f["hotspot_score"] = round(100 * (f["churn"] / mc) * (f["complexity"] / mx), 2)
    satd = [{"id": n, "path": s[0], "line": s[1], "marker": s[2], "text": s[3],
             "module": s[4] if len(s) > 4 else next((f["module"] for f in files if f["path"] == s[0]), "root"),
             "status": "DETECTED"} for n, s in enumerate(sc.get("satd", []), 1)]

    causes: list[dict] = []
    cause_ix: dict[str, int] = {}
    edges: dict[tuple[int, int], int] = {}
    root_causes, resolutions, incidents = [], [], []

    def cause_id(label: str, category: str) -> int:
        norm = T.normalize_cause(label)
        if norm not in cause_ix:
            causes.append({"id": len(causes) + 1, "label": label.strip(), "category": category})
            cause_ix[norm] = len(causes)
        return cause_ix[norm]

    key_to_id = {}
    for n, inc in enumerate(sc["incidents"], 1):
        key_to_id[inc["key"]] = n
        status = inc.get("status", "RESOLVED")
        resolved = at(inc["fixed"]) if status == "RESOLVED" and inc.get("fixed") is not None else None
        incidents.append({
            "id": n, "key": inc["key"], "title": inc["title"], "description": inc.get("desc", ""),
            "module": inc["module"], "severity": inc.get("sev", "MEDIUM"), "status": status,
            "reported_at": at(inc["ago"]), "resolved_at": resolved, "effort_hours": float(inc.get("effort", 4)),
            "reported_by": people.get(inc.get("by"), {}).get("name", inc.get("by")), "reporter_key": inc.get("by"),
            "group": inc.get("group"), "source": inc.get("source", "manual"),
        })
        prev = None
        whys = inc.get("whys") or []
        for level, why in enumerate(whys, 1):
            cat = inc.get("cause_category", "PROCESS") if level == len(whys) else "SYMPTOM" if level == 1 else "MECHANISM"
            cid = cause_id(why, cat)
            root_causes.append({"incident_id": n, "level": level, "cause_id": cid, "explanation": why})
            if prev is not None and prev != cid:
                edges[(prev, cid)] = edges.get((prev, cid), 0) + 1
            prev = cid
        if status == "RESOLVED" and (inc.get("fix") or inc.get("lesson")):
            resolutions.append({"incident_id": n, "action": inc.get("fix", ""), "lessons": inc.get("lesson", ""),
                                "resolved_by": people.get(inc.get("fixed_by") or inc.get("by"), {}).get("name"),
                                "resolved_at": resolved, "effort_hours": float(inc.get("effort", 4))})

    debt_key_to_id = {d["key"]: n for n, d in enumerate(sc["debts"], 1)}
    debts = []
    for n, d in enumerate(sc["debts"], 1):
        root = None
        if d.get("cause"):
            root = cause_ix.get(T.normalize_cause(d["cause"]))
            if root is None:
                root = cause_id(d["cause"], "ROOT")
        debts.append({
            "id": n, "key": d["key"], "title": d["title"], "description": d.get("desc", ""),
            "module": d["module"], "category": d.get("cat", "CODE_SMELL"), "priority": d.get("priority", "MEDIUM"),
            "principal": float(d["principal"]), "status": d.get("status", "IDENTIFIED"),
            "assigned_to": people.get(d.get("owner"), {}).get("name"), "owner_key": d.get("owner"),
            "root_cause_id": root, "incident_ids": [key_to_id[k] for k in d.get("incidents", []) if k in key_to_id],
            "prerequisite_ids": [debt_key_to_id[k] for k in d.get("needs", []) if k in debt_key_to_id],
            "created_at": at(d.get("ago", 90)), "file_path": d.get("file"), "source": d.get("source", "manual"),
            "playbook": d.get("playbook"),
        })
    for c in causes:  # deepest answers are root causes
        if c["category"] == "PROCESS":
            c["category"] = "ROOT"
    return {
        "project": {"name": sc["name"], "key": sc.get("key", sc["code"][:4].upper()), "description": sc["summary"],
                    "repository_url": sc.get("repository_url"), "scenario": sc["code"], "industry": sc["industry"]},
        "now": now.isoformat(),
        "people": people,
        "modules": modules,
        "dependencies": [{"source": a, "target": b} for a, b in sc["dependencies"]],
        "files": files,
        "satd": satd,
        "incidents": incidents,
        "causes": causes,
        "cause_edges": [{"source": a, "target": b, "weight": w} for (a, b), w in edges.items()],
        "root_causes": root_causes,
        "resolutions": resolutions,
        "debts": debts,
    }


def labels(code_or_sc) -> dict:
    """Ground truth: duplicate families and the regressions they imply."""
    sc = _load(code_or_sc) if isinstance(code_or_sc, str) else code_or_sc
    groups: dict[str, list[str]] = {}
    for inc in sc["incidents"]:
        if inc.get("group"):
            groups.setdefault(inc["group"], []).append(inc["key"])
    by_key = {i["key"]: i for i in sc["incidents"]}
    regressions = []
    for keys in groups.values():
        for new in keys:
            n = by_key[new]
            for old in keys:
                o = by_key[old]
                if old == new or o.get("status", "RESOLVED") != "RESOLVED" or o.get("fixed") is None:
                    continue
                if o["module"] == n["module"] and n["ago"] < o["fixed"]:
                    regressions.append([new, old])
    return {"duplicate_groups": groups, "regressions": regressions}
