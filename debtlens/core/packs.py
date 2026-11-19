"""Scenario packs: a whole system on its busiest day, in one JSON file.

A pack has the same shape as a bundled industry scenario (see ``scenarios.py``): modules with metrics and owners,
module dependencies, file metrics, TODO/FIXME markers, incidents with 5-Whys chains and resolutions, and debt items
with prerequisites.  On top of that a pack carries its own load-spike event (``spike``).  Nothing in a pack is a
result: DebtLens computes everything from it exactly as it does for a real project.

Packs reach DebtLens in three ways:

* the bundled packs in ``debtlens/packs/`` open with one click on the website and by code in the terminal
  (``debtlens plan --scenario tatkal``);
* any pack file can be uploaded on the website, which opens it as a private sandbox;
* any pack file can be passed to the terminal (``debtlens plan --scenario my-pack.json``).

Uploaded packs come from anyone, so ``validate()`` checks every field, reference and limit before anything is
stored, and reports every problem at once so a pack can be fixed in one pass.  See docs/PACKS.md for the format.
"""

from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

FORMAT = "debtlens-pack/1"
PACK_DIR = Path(__file__).resolve().parent.parent / "packs"
MAX_BYTES = 400_000
LIMITS = {"modules": 40, "dependencies": 300, "files": 300, "satd": 300, "incidents": 300, "debts": 150,
          "people": 20, "whys": 7}

ROLES = ("admin", "tech_lead", "developer", "qa", "manager", "viewer")
SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
INCIDENT_STATUSES = ("OPEN", "INVESTIGATING", "RESOLVED")
DEBT_STATUSES = ("IDENTIFIED", "PRIORITIZED", "IN_PROGRESS", "DEFERRED", "REMEDIATED")
DEBT_CATEGORIES = ("ARCHITECTURAL", "CODE_SMELL", "TEST_DEBT", "INFRASTRUCTURE", "SECURITY_DEBT", "DOCUMENTATION")
PRIORITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
SATD_MARKERS = ("TODO", "FIXME", "HACK", "XXX", "BUG", "OPTIMIZE", "REFACTOR", "WORKAROUND", "DEPRECATED", "KLUDGE")

_MODULE = re.compile(r"^[a-z0-9][a-z0-9 _./-]{0,59}$")
_CODE = re.compile(r"^[a-z0-9][a-z0-9-]{1,23}$")
_PERSON = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,29}$")
_ITEM_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,29}$")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class PackError(ValueError):
    """A pack that cannot be opened; ``problems`` lists every reason."""

    def __init__(self, problems: list[str]):
        self.problems = problems
        head = "; ".join(problems[:3])
        more = f" (and {len(problems) - 3} more)" if len(problems) > 3 else ""
        super().__init__(f"this pack has {len(problems)} problem{'s' if len(problems) != 1 else ''}: {head}{more}")


class _Checker:
    def __init__(self):
        self.problems: list[str] = []
        self.warnings: list[str] = []

    def bad(self, where: str, msg: str) -> None:
        if len(self.problems) < 200:
            self.problems.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        if len(self.warnings) < 200:
            self.warnings.append(f"{where}: {msg}")

    # -- scalar helpers ------------------------------------------------------------------------------------------
    def text(self, obj: dict, key: str, where: str, *, required=False, min_len=0, max_len=255, default=None):
        v = obj.get(key, default)
        if v is None or (isinstance(v, str) and not v.strip()):
            if required:
                self.bad(where, f"'{key}' is required")
            return default if default is not None else None
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            v = str(v)
        if not isinstance(v, str):
            self.bad(where, f"'{key}' must be text")
            return default
        v = _CTRL.sub("", v).strip()
        if len(v) < min_len:
            self.bad(where, f"'{key}' must have at least {min_len} characters")
        if len(v) > max_len:
            self.bad(where, f"'{key}' is longer than {max_len} characters")
        return v

    def number(self, obj: dict, key: str, where: str, *, lo: float, hi: float, required=False, default=None):
        v = obj.get(key, default)
        if v is None:
            if required:
                self.bad(where, f"'{key}' is required")
            return default
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            self.bad(where, f"'{key}' must be a number")
            return default
        if not lo <= v <= hi:
            self.bad(where, f"'{key}' must be between {lo:g} and {hi:g} (got {v:g})")
            return default
        return v

    def choice(self, obj: dict, key: str, where: str, options: tuple, default: str):
        v = obj.get(key)
        if v is None:
            return default
        if not isinstance(v, str) or v.strip().upper() not in options:
            self.bad(where, f"'{key}' must be one of {', '.join(options)}")
            return default
        return v.strip().upper()


def _slug(s: str, n: int = 24) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return (s[:n].strip("-") or "pack")


def _module_name(v) -> str | None:
    if not isinstance(v, str):
        return None
    v = v.strip().lower()
    return v if _MODULE.match(v) else None


def parse(raw) -> dict:
    """JSON text, bytes or an already-parsed object -> dict (size-checked)."""
    if isinstance(raw, (bytes, bytearray)):
        if len(raw) > MAX_BYTES:
            raise PackError([f"file: larger than {MAX_BYTES // 1000} KB"])
        try:
            raw = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise PackError(["file: not UTF-8 text"]) from None
    if isinstance(raw, str):
        if len(raw.encode("utf-8")) > MAX_BYTES:
            raise PackError([f"file: larger than {MAX_BYTES // 1000} KB"])
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as e:
            raise PackError([f"file: not valid JSON (line {e.lineno}, column {e.colno}: {e.msg})"]) from None
    if not isinstance(raw, dict):
        raise PackError(["file: a pack is a JSON object with modules, incidents and debts"])
    try:
        size = len(json.dumps(raw, ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError):
        raise PackError(["file: contains values that are not JSON"]) from None
    if size > MAX_BYTES:
        raise PackError([f"file: larger than {MAX_BYTES // 1000} KB"])
    return raw


def validate(raw, *, source: str = "pack") -> tuple[dict, list[str]]:
    """Check a pack completely.  Returns ``(clean_pack, warnings)``; raises PackError listing every problem."""
    from . import playbooks

    d = parse(raw)
    c = _Checker()
    out: dict = {"format": FORMAT}

    fmt = d.get("format")
    if fmt is not None and fmt != FORMAT:
        c.warn("format", f"expected '{FORMAT}', read it as that")
    name = c.text(d, "name", "pack", required=True, min_len=2, max_len=80)
    out["name"] = name or "Unnamed pack"
    code = d.get("code")
    if isinstance(code, str) and _CODE.match(code.strip().lower()):
        out["code"] = code.strip().lower()
    else:
        if code is not None:
            c.warn("code", "must be 2-24 lowercase letters, digits or '-'; made one from the name")
        out["code"] = _slug(out["name"])
    key = d.get("key")
    out["key"] = (re.sub(r"[^A-Z0-9]", "", key.upper())[:8] if isinstance(key, str) else "") or \
        (re.sub(r"[^A-Z0-9]", "", out["name"].upper())[:4] or "PACK")
    out["industry"] = c.text(d, "industry", "pack", max_len=60, default="Scenario pack")
    out["tagline"] = c.text(d, "tagline", "pack", max_len=200, default="")
    out["summary"] = c.text(d, "summary", "pack", max_len=1500, default=out["tagline"] or out["name"])
    url = c.text(d, "repository_url", "pack", max_len=300)
    if url and not re.match(r"^https?://", url, re.IGNORECASE):
        c.warn("repository_url", "must start with http:// or https://; left out")
        url = None
    out["repository_url"] = url
    order = c.number(d, "order", "pack", lo=0, hi=999, default=99)
    out["order"] = int(order if order is not None else 99)

    # -- people ---------------------------------------------------------------------------------------------------
    people = {}
    raw_people = d.get("people") or {}
    if not isinstance(raw_people, dict):
        c.bad("people", "must be an object of person-key -> {name, role, title}")
        raw_people = {}
    if len(raw_people) > LIMITS["people"]:
        c.bad("people", f"at most {LIMITS['people']} people")
    for pk, pv in list(raw_people.items())[:LIMITS["people"]]:
        where = f"people.{pk}"
        if not isinstance(pk, str) or not _PERSON.match(pk):
            c.bad("people", f"'{str(pk)[:30]}' is not a valid person key (lowercase letters, digits, _ . -)")
            continue
        if not isinstance(pv, dict):
            c.bad(where, "must be {name, role, title}")
            continue
        role = pv.get("role")
        if role not in ROLES:
            c.bad(where, f"'role' must be one of {', '.join(ROLES)}")
        people[pk] = {"name": c.text(pv, "name", where, required=True, min_len=1, max_len=120) or pk,
                      "role": role if role in ROLES else "viewer",
                      "title": c.text(pv, "title", where, max_len=120, default="")}
    out["people"] = people

    # -- modules --------------------------------------------------------------------------------------------------
    mods, names = [], set()
    raw_mods = d.get("modules")
    if not isinstance(raw_mods, list) or len(raw_mods) < 2:
        c.bad("modules", "needs a list of at least 2 modules")
        raw_mods = raw_mods if isinstance(raw_mods, list) else []
    if len(raw_mods) > LIMITS["modules"]:
        c.bad("modules", f"at most {LIMITS['modules']} modules")
    for n, m in enumerate(raw_mods[:LIMITS["modules"]], 1):
        where = f"modules[{n}]"
        if isinstance(m, str):
            m = {"name": m}
        if not isinstance(m, dict):
            c.bad(where, "must be an object with a 'name'")
            continue
        nm = _module_name(m.get("name"))
        if nm is None:
            c.bad(where, "'name' must be 1-60 lowercase letters, digits, spaces or _ . / -")
            continue
        where = f"module '{nm}'"
        if nm in names:
            c.bad(where, "appears twice")
            continue
        names.add(nm)
        owner = m.get("owner")
        if owner is not None and owner not in people:
            c.warn(where, f"owner '{str(owner)[:30]}' is not in people; ignored")
            owner = None
        mods.append({"name": nm, "path": c.text(m, "path", where, max_len=255, default=f"src/{nm}"),
                     "description": c.text(m, "description", where, max_len=400, default=""),
                     "churn": c.number(m, "churn", where, lo=0, hi=100000, default=0),
                     "complexity": c.number(m, "complexity", where, lo=0, hi=1000000, default=0),
                     "loc": int(c.number(m, "loc", where, lo=0, hi=10**8, default=0) or 0),
                     "files": int(c.number(m, "files", where, lo=0, hi=10**6, default=0) or 0),
                     "owner": owner})
    out["modules"] = mods

    # -- dependencies ---------------------------------------------------------------------------------------------
    deps, seen = [], set()
    raw_deps = d.get("dependencies") or []
    if not isinstance(raw_deps, list):
        c.bad("dependencies", "must be a list of [caller, callee] pairs")
        raw_deps = []
    if len(raw_deps) > LIMITS["dependencies"]:
        c.bad("dependencies", f"at most {LIMITS['dependencies']} dependencies")
    for n, dep in enumerate(raw_deps[:LIMITS["dependencies"]], 1):
        where = f"dependencies[{n}]"
        if isinstance(dep, dict):
            dep = [dep.get("source"), dep.get("target")]
        if not isinstance(dep, (list, tuple)) or len(dep) != 2:
            c.bad(where, "must be [caller, callee]")
            continue
        a, b = _module_name(dep[0]), _module_name(dep[1])
        if a not in names or b not in names:
            c.bad(where, f"both modules must be listed in modules (got {str(dep[0])[:30]!r} -> {str(dep[1])[:30]!r})")
            continue
        if a == b:
            c.bad(where, f"'{a}' cannot depend on itself")
            continue
        if (a, b) not in seen:
            seen.add((a, b))
            deps.append([a, b])
    out["dependencies"] = deps

    # -- files and TODO markers -----------------------------------------------------------------------------------
    files = []
    raw_files = d.get("files") or []
    if not isinstance(raw_files, list):
        c.bad("files", "must be a list")
        raw_files = []
    if len(raw_files) > LIMITS["files"]:
        c.bad("files", f"at most {LIMITS['files']} files")
    for n, f in enumerate(raw_files[:LIMITS["files"]], 1):
        where = f"files[{n}]"
        if isinstance(f, dict):
            f = [f.get("path"), f.get("module"), f.get("churn", 0), f.get("complexity", 0), f.get("loc", 0),
                 f.get("lines_changed", 0), f.get("authors", 1)]
        if not isinstance(f, (list, tuple)) or not 5 <= len(f) <= 7:
            c.bad(where, "must be [path, module, churn, complexity, loc, lines_changed?, authors?]")
            continue
        row = {"path": f[0], "module": f[1], "churn": f[2], "complexity": f[3], "loc": f[4],
               "lines_changed": f[5] if len(f) > 5 else 0, "authors": f[6] if len(f) > 6 else 1}
        path = c.text(row, "path", where, required=True, max_len=255)
        mod = _module_name(row["module"])
        if mod not in names:
            c.bad(where, f"module {str(row['module'])[:30]!r} is not listed in modules")
            continue
        vals = [c.number(row, k, where, lo=0, hi=10**8, default=0) or 0
                for k in ("churn", "complexity", "loc", "lines_changed", "authors")]
        if path:
            files.append([path, mod, vals[0], vals[1], int(vals[2]), int(vals[3]), max(1, int(vals[4]))])
    out["files"] = files

    satd = []
    raw_satd = d.get("satd") or []
    if not isinstance(raw_satd, list):
        c.bad("satd", "must be a list")
        raw_satd = []
    if len(raw_satd) > LIMITS["satd"]:
        c.bad("satd", f"at most {LIMITS['satd']} markers")
    file_mod = {f[0]: f[1] for f in files}
    for n, s in enumerate(raw_satd[:LIMITS["satd"]], 1):
        where = f"satd[{n}]"
        if isinstance(s, dict):
            s = [s.get("path"), s.get("line"), s.get("marker"), s.get("text")] + \
                ([s["module"]] if s.get("module") else [])
        if not isinstance(s, (list, tuple)) or not 4 <= len(s) <= 5:
            c.bad(where, "must be [path, line, marker, text, module?]")
            continue
        row = {"path": s[0], "line": s[1], "text": s[3]}
        path = c.text(row, "path", where, required=True, max_len=255)
        line = c.number(row, "line", where, lo=1, hi=10**7, required=True)
        marker = str(s[2] or "").strip().upper()
        if marker not in SATD_MARKERS:
            c.bad(where, f"marker must be one of {', '.join(SATD_MARKERS)}")
            continue
        txt = c.text(row, "text", where, required=True, max_len=300)
        mod = _module_name(s[4]) if len(s) > 4 else file_mod.get(path)
        if mod is None:
            c.bad(where, f"give the module, or list {str(path)[:60]!r} in files")
            continue
        if mod not in names:
            c.bad(where, f"module {mod!r} is not listed in modules")
            continue
        if path and line and txt:
            satd.append([path, int(line), marker, txt, mod])
    out["satd"] = satd

    # -- incidents ------------------------------------------------------------------------------------------------
    incs, inc_keys = [], set()
    raw_incs = d.get("incidents")
    if not isinstance(raw_incs, list) or not raw_incs:
        c.bad("incidents", "needs a list of at least 1 incident")
        raw_incs = raw_incs if isinstance(raw_incs, list) else []
    if len(raw_incs) > LIMITS["incidents"]:
        c.bad("incidents", f"at most {LIMITS['incidents']} incidents")
    for n, i in enumerate(raw_incs[:LIMITS["incidents"]], 1):
        where = f"incidents[{n}]"
        if not isinstance(i, dict):
            c.bad(where, "must be an object")
            continue
        k = i.get("key")
        if not isinstance(k, str) or not _ITEM_KEY.match(k.strip()):
            c.bad(where, "'key' is required (letters, digits, - _ . ; e.g. INC-101)")
            continue
        k = k.strip().upper()
        where = f"incident {k}"
        if k in inc_keys:
            c.bad(where, "key appears twice")
            continue
        inc_keys.add(k)
        mod = _module_name(i.get("module"))
        if mod not in names:
            c.bad(where, f"module {str(i.get('module'))[:30]!r} is not listed in modules")
        status = c.choice(i, "status", where, INCIDENT_STATUSES, "RESOLVED")
        ago = c.number(i, "ago", where, lo=0, hi=3650, required=True)
        fixed = i.get("fixed")
        if status == "RESOLVED":
            fixed = c.number(i, "fixed", where, lo=0, hi=3650, required=True)
            if fixed is not None and ago is not None and fixed > ago:
                c.bad(where, f"'fixed' ({fixed:g} days ago) is before it was reported ({ago:g} days ago)")
        elif fixed is not None:
            c.warn(where, f"'fixed' ignored because the status is {status}")
            fixed = None
        whys_raw = i.get("whys") or []
        if not isinstance(whys_raw, list):
            c.bad(where, "'whys' must be a list of answers")
            whys_raw = []
        if len(whys_raw) > LIMITS["whys"]:
            c.bad(where, f"at most {LIMITS['whys']} whys")
        whys = []
        for w_n, w in enumerate(whys_raw[:LIMITS["whys"]], 1):
            txt = c.text({"w": w}, "w", f"{where} why {w_n}", required=True, min_len=3, max_len=300)
            if txt:
                whys.append(txt)
        by = i.get("by")
        if by is not None and not isinstance(by, str):
            c.bad(where, "'by' must be a person key or a name")
            by = None
        fixed_by = i.get("fixed_by")
        if fixed_by is not None and fixed_by not in people:
            c.warn(where, f"fixed_by '{str(fixed_by)[:30]}' is not in people; ignored")
            fixed_by = None
        group = c.text(i, "group", where, max_len=30)
        row = {"key": k, "title": c.text(i, "title", where, required=True, min_len=3, max_len=255),
               "desc": c.text(i, "desc", where, max_len=4000, default=""), "module": mod,
               "sev": c.choice(i, "sev", where, SEVERITIES, "MEDIUM"), "status": status,
               "ago": ago, "fixed": fixed,
               "effort": c.number(i, "effort", where, lo=0.25, hi=500, default=4),
               "by": by[:120] if isinstance(by, str) else None, "whys": whys,
               "fix": c.text(i, "fix", where, max_len=2000, default=""),
               "lesson": c.text(i, "lesson", where, max_len=2000, default="")}
        if group:
            row["group"] = group
        if fixed_by:
            row["fixed_by"] = fixed_by
        incs.append(row)
    out["incidents"] = incs

    # -- debts ----------------------------------------------------------------------------------------------------
    debts, debt_keys = [], set()
    raw_debts = d.get("debts")
    if not isinstance(raw_debts, list) or not raw_debts:
        c.bad("debts", "needs a list of at least 1 debt item")
        raw_debts = raw_debts if isinstance(raw_debts, list) else []
    if len(raw_debts) > LIMITS["debts"]:
        c.bad("debts", f"at most {LIMITS['debts']} debt items")
    pending_needs = []
    for n, x in enumerate(raw_debts[:LIMITS["debts"]], 1):
        where = f"debts[{n}]"
        if not isinstance(x, dict):
            c.bad(where, "must be an object")
            continue
        k = x.get("key")
        if not isinstance(k, str) or not _ITEM_KEY.match(k.strip()):
            c.bad(where, "'key' is required (letters, digits, - _ . ; e.g. DEBT-101)")
            continue
        k = k.strip().upper()
        where = f"debt {k}"
        if k in debt_keys or k in inc_keys:
            c.bad(where, "key appears twice")
            continue
        debt_keys.add(k)
        mod = _module_name(x.get("module"))
        if mod not in names:
            c.bad(where, f"module {str(x.get('module'))[:30]!r} is not listed in modules")
        links = x.get("incidents") or []
        if not isinstance(links, list):
            c.bad(where, "'incidents' must be a list of incident keys")
            links = []
        links = [str(v).strip().upper() for v in links if isinstance(v, str)]
        for v in links:
            if v not in inc_keys:
                c.bad(where, f"links to unknown incident {v}")
        needs = x.get("needs") or []
        if not isinstance(needs, list):
            c.bad(where, "'needs' must be a list of debt keys")
            needs = []
        needs = [str(v).strip().upper() for v in needs if isinstance(v, str)]
        pending_needs.append((where, k, needs))
        owner = x.get("owner")
        if owner is not None and owner not in people:
            c.warn(where, f"owner '{str(owner)[:30]}' is not in people; ignored")
            owner = None
        pb = x.get("playbook")
        if pb is not None and pb not in playbooks.BY_KEY:
            c.bad(where, f"unknown playbook '{str(pb)[:40]}' (see `debtlens playbooks`)")
            pb = None
        row = {"key": k, "title": c.text(x, "title", where, required=True, min_len=3, max_len=255),
               "desc": c.text(x, "desc", where, max_len=4000, default=""), "module": mod,
               "cat": c.choice(x, "cat", where, DEBT_CATEGORIES, "CODE_SMELL"),
               "principal": c.number(x, "principal", where, lo=0.5, hi=500, required=True),
               "status": c.choice(x, "status", where, DEBT_STATUSES, "IDENTIFIED"),
               "priority": c.choice(x, "priority", where, PRIORITIES, "MEDIUM"),
               "owner": owner, "incidents": links, "needs": needs,
               "cause": c.text(x, "cause", where, max_len=300),
               "ago": c.number(x, "ago", where, lo=0, hi=3650, default=90),
               "file": c.text(x, "file", where, max_len=255)}
        if pb:
            row["playbook"] = pb
        debts.append(row)
    for where, k, needs in pending_needs:
        for v in needs:
            if v == k:
                c.bad(where, "cannot need itself")
            elif v not in debt_keys:
                c.bad(where, f"needs unknown debt {v}")
    out["debts"] = debts

    # -- load-spike events: the main one, then up to four more (a bot attack, say) ----------------------------------
    sp = d.get("spike")
    if sp is not None:
        out["spike"] = _spike(sp, names, c, debt_keys)
    extra = d.get("events")
    if extra is not None:
        if not isinstance(extra, list):
            c.bad("events", "must be a list of events shaped like 'spike'")
            extra = []
        if len(extra) > 4:
            c.bad("events", "at most 4 extra events")
        if extra and not sp:
            c.bad("events", "give the main event in 'spike' first")
        seen_keys = {(out.get("spike") or {}).get("key")}
        evs = []
        for n, ev in enumerate(extra[:4], 1):
            e = _spike(ev, names, c, debt_keys, where=f"events[{n}]")
            if e:
                if e["key"] in seen_keys:
                    c.bad(f"events[{n}]", f"key '{e['key']}' is used twice")
                seen_keys.add(e["key"])
                evs.append(e)
        if evs:
            out["events"] = evs

    # -- the customer's journey shown on the simulated phone in Live replay --------------------------------------------
    jr = d.get("journey")
    if jr is not None:
        out["journey"] = _journey(jr, names, c)

    # -- guided tour ----------------------------------------------------------------------------------------------
    tour = d.get("tour")
    if isinstance(tour, dict):
        t = {"incident": str(tour.get("incident") or "").upper(), "debt": str(tour.get("debt") or "").upper(),
             "module": _module_name(tour.get("module")), "cascade_module": _module_name(tour.get("cascade_module")),
             "budget": c.number(tour, "budget", "tour", lo=1, hi=500, default=40),
             "headline": c.text(tour, "headline", "tour", max_len=300, default="")}
        missing = [f for f, ok in (("incident", t["incident"] in inc_keys), ("debt", t["debt"] in debt_keys),
                                   ("module", t["module"] in names), ("cascade_module", t["cascade_module"] in names))
                   if not ok]
        if missing:
            c.warn("tour", f"left out: {', '.join(missing)} do not match the pack")
        else:
            out["tour"] = t
    elif tour is not None:
        c.warn("tour", "must be an object; left out")

    if c.problems:
        raise PackError(c.problems)
    return out, c.warnings


def _journey(jr, names: set[str], c: _Checker) -> dict | None:
    w = "journey"
    if not isinstance(jr, dict):
        c.bad(w, "must be an object with 'steps'")
        return None
    color = jr.get("color")
    if color is not None and not (isinstance(color, str) and re.match(r"^#[0-9a-fA-F]{6}$", color)):
        c.warn(w, "'color' must look like #1f6feb; left out")
        color = None
    steps_raw = jr.get("steps")
    if not isinstance(steps_raw, list) or not 1 <= len(steps_raw) <= 8:
        c.bad(w, "'steps' must be a list of 1 to 8 steps")
        steps_raw = steps_raw[:8] if isinstance(steps_raw, list) else []
    steps = []
    for n, s in enumerate(steps_raw, 1):
        sw = f"journey step {n}"
        if not isinstance(s, dict):
            c.bad(sw, "must be {module, label, ok, fail}")
            continue
        mod = _module_name(s.get("module"))
        if mod not in names:
            c.bad(sw, f"module {str(s.get('module'))[:30]!r} is not listed in modules")
            continue
        steps.append({"module": mod, "label": c.text(s, "label", sw, required=True, min_len=2, max_len=60),
                      "ok": c.text(s, "ok", sw, max_len=100, default="Done"),
                      "slow": c.text(s, "slow", sw, max_len=100, default="Still loading…"),
                      "fail": c.text(s, "fail", sw, max_len=120, default="Something went wrong. Please try again.")})
    rpm = c.number(jr, "peak_rpm", w, lo=1, hi=10**9, default=20000)
    return {"app": c.text(jr, "app", w, max_len=40, default="") or "", "who": c.text(jr, "who", w, max_len=120, default=""),
            "peak_rpm": int(rpm or 20000), "color": color, "steps": steps}


def _spike(sp, names: set[str], c: _Checker, debt_keys: set[str] | None = None, where: str = "spike") -> dict | None:
    from . import spike as SPIKE

    if not isinstance(sp, dict):
        c.bad(where, "must be an object")
        return None
    w = where
    out = {"key": _slug(str(sp.get("key") or sp.get("name") or "event"), 30),
           "name": c.text(sp, "name", w, required=True, min_len=2, max_len=80) or "Event",
           "description": c.text(sp, "description", w, max_len=400, default="")}
    prof = sp.get("profile")
    if prof is None:
        peak = c.number(sp, "peak", w, lo=1, hi=50, required=True, default=5)
        start = c.number(sp, "start_hour", w, lo=0, hi=23, default=20)
        dur = c.number(sp, "duration", w, lo=1, hi=24, default=2)
        prof = SPIKE.custom_profile(peak or 5, int(start or 0), int(dur or 1), int(sp.get("ramp", 1) or 0))
    elif (not isinstance(prof, list) or len(prof) != SPIKE.HOURS
          or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and 0.05 <= v <= 100 for v in prof)):
        c.bad(w, f"'profile' must be {SPIKE.HOURS} hourly multipliers between 0.05 and 100")
        prof = [1.0] * SPIKE.HOURS
    out["profile"] = [round(float(v), 3) for v in prof]

    def table(key: str, lo: float, hi: float, required: bool = False) -> dict:
        t = sp.get(key)
        if t is None:
            if required:
                c.bad(w, f"'{key}' is required: which modules users enter through, with a weight 0-1")
            return {}
        if not isinstance(t, dict):
            c.bad(w, f"'{key}' must map module names to numbers")
            return {}
        res = {}
        for m, v in t.items():
            nm = _module_name(m)
            if nm not in names:
                c.bad(w, f"'{key}' names unknown module {str(m)[:30]!r}")
                continue
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not lo <= v <= hi:
                c.bad(w, f"'{key}.{nm}' must be between {lo:g} and {hi:g}")
                continue
            res[nm] = float(v)
        return res

    out["entry"] = table("entry", 0, 1, required=True)
    if sp.get("entry") is not None and not out["entry"]:
        c.bad(w, "'entry' needs at least one module")
    out["baseline"] = table("baseline", 0.01, 0.95)
    expo = table("exposure", 0, 1)
    if expo:
        out["exposure"] = expo
    bots = sp.get("bots")
    if bots is not None:
        if not isinstance(bots, dict):
            c.bad(w, "'bots' must be {share, blocked, mitigated_by}")
        else:
            share = c.number(bots, "share", f"{w}.bots", lo=0, hi=1, default=0.8)
            blocked = c.number(bots, "blocked", f"{w}.bots", lo=0, hi=1, default=0.9)
            keys = bots.get("mitigated_by") or []
            if not isinstance(keys, list):
                c.bad(f"{w}.bots", "'mitigated_by' must be a list of debt keys")
                keys = []
            keys = [str(k).strip().upper() for k in keys if isinstance(k, str)]
            for k in keys:
                if debt_keys is not None and k not in debt_keys:
                    c.bad(f"{w}.bots", f"'mitigated_by' names unknown debt {k}")
            out["bots"] = {"share": share, "blocked": blocked, "mitigated_by": keys}
    return out


# ------------------------------------------------------------------------------------------------- bundled packs

@lru_cache(maxsize=None)
def _bundled() -> dict[str, dict]:
    out = {}
    if PACK_DIR.is_dir():
        for f in sorted(PACK_DIR.glob("*.json")):
            pack, _ = validate(f.read_bytes())
            out[pack["code"]] = pack
    return out


def codes() -> list[str]:
    return [p["code"] for p in sorted(_bundled().values(), key=lambda p: (p.get("order", 99), p["name"]))]


def get(code: str) -> dict:
    try:
        return _bundled()[code]
    except KeyError:
        raise KeyError(f"unknown pack {code!r}") from None


def info(pack: dict) -> dict:
    """Card data for a pack: what it is, how big it is and its busiest day."""
    sp = pack.get("spike") or {}
    return {"code": pack["code"], "name": pack["name"], "industry": pack["industry"], "tagline": pack.get("tagline", ""),
            "summary": pack.get("summary", ""), "order": pack.get("order", 99), "pack": True,
            "counts": {"modules": len(pack["modules"]), "incidents": len(pack["incidents"]),
                       "debts": len(pack["debts"])},
            "event": ({"key": sp["key"], "name": sp["name"], "description": sp.get("description", ""),
                       "peak": max(sp["profile"]), "peak_hour": sp["profile"].index(max(sp["profile"]))}
                      if sp.get("profile") else None),
            "headline": (pack.get("tour") or {}).get("headline"),
            "events": [{"key": e["key"], "name": e["name"], "peak": max(e["profile"]), "kind": "bots" if e.get("bots") else "traffic"}
                       for e in [sp, *(pack.get("events") or [])] if e and e.get("profile")]}


def list_packs() -> list[dict]:
    return [info(get(c)) for c in codes()]


def load_file(path: str | Path) -> tuple[dict, list[str]]:
    p = Path(path)
    if not p.is_file():
        raise PackError([f"file: {p} not found"])
    if p.stat().st_size > MAX_BYTES:
        raise PackError([f"file: larger than {MAX_BYTES // 1000} KB"])
    return validate(p.read_bytes())


def dump(pack: dict) -> str:
    """A pack as a readable JSON file (one item per line in long lists)."""
    return json.dumps(pack, ensure_ascii=False, indent=1) + "\n"
