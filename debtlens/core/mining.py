"""Repository evidence (module M5): churn, complexity, TODO/FIXME markers, imports.

* churn        – commits touching a file/module in a rolling window, from
                 ``git log --numstat`` (CLI, full history) or the GitHub REST API (website)
* complexity   – McCabe cyclomatic complexity.  Python: exact, from the AST (same
                 rules as Radon).  JavaScript/TypeScript: decision-point count on
                 comment- and string-stripped source (approximation, flagged as such)
* SATD         – self-admitted technical debt: TODO, FIXME, HACK, XXX, BUG, ... found
                 *inside comments only* (Potdar & Shihab, ICSME 2014)
* dependencies – Python ``import`` / JS ``import``/``require`` resolved to repository
                 modules; feeds the blast-radius calculation
* hotspots     – Tornhill & Borg: risk = (churn / max churn) · (complexity / max complexity)
"""

from __future__ import annotations

import ast
import io
import json
import os
import posixpath
import re
import subprocess
import tarfile
import tempfile
import time
import tokenize
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

LANG = {
    ".py": "python", ".js": "js", ".jsx": "js", ".mjs": "js", ".cjs": "js", ".ts": "js", ".tsx": "js",
    ".java": "c-like", ".kt": "c-like", ".go": "c-like", ".cs": "c-like", ".c": "c-like", ".h": "c-like",
    ".cpp": "c-like", ".hpp": "c-like", ".php": "c-like", ".rb": "hash", ".swift": "c-like", ".rs": "c-like",
    ".scala": "c-like", ".dart": "c-like",
}
IGNORE_DIRS = {
    ".git", "node_modules", "venv", ".venv", "env", "__pycache__", "dist", "build", ".next", ".nuxt",
    ".idea", ".vscode", "vendor", "coverage", ".pytest_cache", ".mypy_cache", "site-packages", "target",
    "bin", "obj", ".tox", ".cache", "out", "public/vendor", "migrations",
}
CONTAINERS = {"src", "app", "apps", "lib", "libs", "packages", "services", "modules", "pkg", "internal",
              "cmd", "source", "server", "backend", "frontend", "web", "api"}
SATD_MARKERS = ("TODO", "FIXME", "HACK", "XXX", "BUG", "OPTIMIZE", "REFACTOR", "WORKAROUND", "DEPRECATED", "KLUDGE")
_SATD_ANY = re.compile(r"\b(" + "|".join(SATD_MARKERS) + r")\b", re.IGNORECASE)
_SATD = re.compile(r"\b(" + "|".join(SATD_MARKERS) + r")\b[\s:(\-\]]*(.*)", re.IGNORECASE)
MAX_FILE_BYTES = 800_000


# ----------------------------------------------------------------------------- modules

def module_of(path: str, rules: list[tuple[str, str]] | None = None, extra_containers: frozenset = frozenset()) -> str:
    """Map a file path to a module: explicit prefix rules first, else the first
    meaningful directory (skipping container dirs like src/, app/, services/)."""
    p = path.replace("\\", "/").lstrip("./")
    for prefix, name in rules or []:
        if p.startswith(prefix.rstrip("/") + "/") or p == prefix:
            return name
    parts = [x for x in p.split("/") if x]
    if len(parts) <= 1:
        return "root"
    if parts[0].lower() in extra_containers and len(parts) > 2:
        return parts[1].lower()           # mypkg/core/x.py -> core (a package's own sub-packages are real modules)
    if parts[0].lower() in CONTAINERS and len(parts) > 2:
        return parts[1].lower()           # src/payments/x.py -> payments (only a top-level container is skipped)
    return parts[0].lower()


def package_containers(paths: list[str], rules) -> frozenset:
    """A repository whose code mostly lives in one package folder (``mypkg/core``, ``mypkg/api``)
    is split one level deeper, so modules are ``core`` and ``api`` rather than ``mypkg``."""
    if rules:
        return frozenset()
    nested = [p.replace("\\", "/").split("/") for p in paths]
    nested = [x for x in nested if len(x) >= 3]
    if not paths or not nested:
        return frozenset()
    top, n = Counter(x[0].lower() for x in nested).most_common(1)[0]
    subdirs = {x[1].lower() for x in nested if x[0].lower() == top}
    if n / len(paths) >= 0.6 and len(subdirs) >= 2 and top not in CONTAINERS:
        return frozenset({top})
    return frozenset()


def load_rules(root: Path) -> list[tuple[str, str]]:
    """Optional ``debtlens.json`` → {"modules": {"payments": ["services/payments", ...]}}."""
    f = root / "debtlens.json"
    if not f.is_file():
        return []
    try:
        cfg = json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []
    rules = []
    for name, prefixes in (cfg.get("modules") or {}).items():
        for pre in ([prefixes] if isinstance(prefixes, str) else prefixes):
            rules.append((pre.strip("/"), name.lower()))
    rules.sort(key=lambda r: -len(r[0]))
    return rules


# ----------------------------------------------------------------------------- complexity

class _McCabe(ast.NodeVisitor):
    """Radon-compatible cyclomatic complexity for one function body."""

    def __init__(self):
        self.score = 1

    def generic_visit(self, node):
        name = type(node).__name__
        if name in ("If", "IfExp"):
            self.score += 1
        elif name in ("For", "AsyncFor", "While"):
            self.score += 1 + bool(node.orelse)
        elif name in ("Try", "TryStar"):
            self.score += len(node.handlers) + bool(node.orelse)
        elif name == "BoolOp":
            self.score += len(node.values) - 1
        elif name == "comprehension":
            self.score += 1 + len(node.ifs)
        elif name == "Match":
            self.score += len(node.cases)
        elif name == "Assert":
            self.score += 1
        if name in ("FunctionDef", "AsyncFunctionDef", "ClassDef", "Lambda") and getattr(self, "_root", None) is not node:
            return  # nested definitions are measured separately
        super().generic_visit(node)


def python_complexity(source: str) -> dict:
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return {"complexity": 0, "max_function": 0, "functions": 0, "parsed": False}
    funcs = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            v = _McCabe()
            v._root = node  # type: ignore[attr-defined]
            v.generic_visit(node)
            funcs.append(v.score)
    total = sum(funcs) if funcs else 1
    return {"complexity": total, "max_function": max(funcs, default=1), "functions": len(funcs), "parsed": True}


_JS_STRIP = re.compile(
    r"""//[^\n]*|/\*.*?\*/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'""",
    re.DOTALL,
)
_JS_DECISIONS = re.compile(r"\b(if|for|while|case|catch)\b|&&|\|\||\?\?|\?(?![.?:])")
_JS_FUNCS = re.compile(r"\bfunction\b|=>")
_HASH_STRIP = re.compile(r"#[^\n]*|\"(?:\\.|[^\"\\\n])*\"|'(?:\\.|[^'\\\n])*'")
_GENERIC_DECISIONS = re.compile(r"\b(if|elif|elsif|for|foreach|while|case|catch|rescue|when|unless|until)\b|&&|\|\|")


def js_complexity(source: str) -> dict:
    code = _JS_STRIP.sub(" ", source)
    decisions = len(_JS_DECISIONS.findall(code))
    funcs = len(_JS_FUNCS.findall(code))
    return {"complexity": decisions + max(1, funcs), "max_function": None, "functions": funcs, "parsed": True}


def generic_complexity(source: str, lang: str) -> dict:
    code = (_HASH_STRIP if lang == "hash" else _JS_STRIP).sub(" ", source)
    return {"complexity": 1 + len(_GENERIC_DECISIONS.findall(code)), "max_function": None, "functions": None,
            "parsed": True}


def complexity(source: str, lang: str) -> dict:
    if lang == "python":
        return python_complexity(source)
    if lang == "js":
        return js_complexity(source)
    return generic_complexity(source, lang)


# ----------------------------------------------------------------------------- SATD

def _comments(source: str, lang: str):
    """Yield (line_number, comment_text) for real comments only."""
    if lang == "python":
        try:
            for tok in tokenize.generate_tokens(io.StringIO(source).readline):
                if tok.type == tokenize.COMMENT:
                    yield tok.start[0], tok.string.lstrip("#")
        except (tokenize.TokenError, IndentationError, SyntaxError):
            for i, line in enumerate(source.splitlines(), 1):
                if line.lstrip().startswith("#"):
                    yield i, line.lstrip()[1:]
        return
    pattern = _HASH_STRIP if lang == "hash" else _JS_STRIP
    for m in pattern.finditer(source):
        s = m.group(0)
        if s.startswith(("//", "/*", "#")):
            line = source.count("\n", 0, m.start()) + 1
            for k, part in enumerate(s.splitlines()):
                yield line + k, part.lstrip("/*# ").rstrip("*/ ")


def scan_satd(source: str, lang: str) -> list[dict]:
    out = []
    for line, text in _comments(source, lang):
        m = _SATD.search(text)
        if m and len({x.upper() for x in _SATD_ANY.findall(text)}) >= 2:
            continue  # a comment that lists marker names ("TODO, FIXME, HACK") is not debt
        if m:
            marker = m.group(1).upper()
            out.append({"line": line, "marker": marker, "text": (m.group(2) or "").strip()[:240] or marker})
    return out


# ----------------------------------------------------------------------------- imports

_JS_IMPORT = re.compile(r"""(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[^'"]*?from\s*|import\s+)['"]([^'"]+)['"]""")


def _resolve_relative(base_file: str, spec: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_file), spec))


def imports_of(path: str, source: str, lang: str, py_index: dict[str, str]) -> tuple[list[str], list[str]]:
    """Return (internal target paths, external package names)."""
    internal, external = [], []
    if lang == "python":
        try:
            tree = ast.parse(source)
        except (SyntaxError, ValueError):
            return internal, external
        pkg = posixpath.dirname(path).replace("/", ".")

        def resolve(dotted: str) -> str | None:
            probe = dotted
            while probe:
                if probe in py_index:
                    return py_index[probe]
                probe = probe.rpartition(".")[0]
            return None

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    hit = resolve(a.name)
                    if hit:
                        internal.append(hit)
                    else:
                        external.append(a.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                base = node.module or ""
                if node.level:
                    parts = [p for p in pkg.split(".") if p]
                    if node.level > 1:
                        parts = parts[: max(0, len(parts) - (node.level - 1))]
                    base = ".".join(parts + ([base] if base else []))
                hits = {resolve(f"{base}.{a.name}" if base else a.name) or resolve(base) for a in node.names}
                hits.discard(None)
                if hits:
                    internal.extend(sorted(hits))
                elif node.level == 0 and base:
                    external.append(base.split(".")[0])
    elif lang == "js":
        for spec in _JS_IMPORT.findall(source):
            if spec.startswith("."):
                internal.append(_resolve_relative(path, spec))
            elif spec.startswith(("@/", "~/")):
                internal.append("src/" + spec[2:])
            else:
                external.append(spec.split("/")[0] if not spec.startswith("@") else "/".join(spec.split("/")[:2]))
    return internal, external


# ----------------------------------------------------------------------------- git

def _git(root: Path, *args: str, timeout: int = 120) -> str:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True,
                          timeout=timeout, check=True, encoding="utf-8", errors="replace").stdout


def _rename_target(path: str) -> str:
    """Resolve numstat rename syntax: 'src/{old => new}/f.py' or 'old.py => new.py'."""
    if "=>" not in path:
        return path
    m = re.match(r"^(.*)\{(.*) => (.*)\}(.*)$", path)
    if m:
        return re.sub(r"/+", "/", m.group(1) + m.group(3) + m.group(4))
    return path.split("=>")[-1].strip()


def git_history(root: Path, since_days: int | None = 365, max_commits: int | None = None) -> dict:
    args = ["log", "--no-merges", "--numstat", "--format=%x1e%H%x1f%an%x1f%at"]
    if since_days:
        args.append(f"--since={since_days} days ago")
    if max_commits:
        args.append(f"-n{max_commits}")
    raw = _git(root, *args)
    files: dict[str, dict] = defaultdict(lambda: {"commits": set(), "added": 0, "deleted": 0, "authors": set(), "last": 0})
    commits = 0
    for rec in raw.split("\x1e"):
        rec = rec.strip("\n")
        if not rec:
            continue
        lines = rec.split("\n")
        head = lines[0].split("\x1f")
        if len(head) < 3:
            continue
        sha, author, ts = head[0], head[1], int(head[2] or 0)
        commits += 1
        for ln in lines[1:]:
            parts = ln.split("\t")
            if len(parts) != 3:
                continue
            a, d, p = parts
            p = _rename_target(p)
            f = files[p]
            f["commits"].add(sha)
            f["added"] += int(a) if a.isdigit() else 0
            f["deleted"] += int(d) if d.isdigit() else 0
            f["authors"].add(author)
            f["last"] = max(f["last"], ts)
    return {"commits": commits, "files": files}


# ----------------------------------------------------------------------------- scan

def _iter_source_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")
                       and f"{rel_dir}/{d}".lstrip("./") not in IGNORE_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in LANG and not fn.endswith((".min.js", ".d.ts")):
                full = Path(dirpath) / fn
                try:
                    if full.stat().st_size > MAX_FILE_BYTES:
                        continue
                except OSError:
                    continue
                yield full, os.path.relpath(full, root).replace("\\", "/"), LANG[ext]


def analyze_tree(root: Path, history: dict | None = None, rules: list | None = None, window_days: int | None = None,
                 meta: dict | None = None) -> dict:
    """Static analysis of a source tree + optional churn history -> ScanResult dict."""
    root = Path(root)
    rules = rules if rules is not None else load_rules(root)
    sources = list(_iter_source_files(root))
    py_index: dict[str, str] = {}
    for _, rel, lang in sources:
        if lang == "python":
            mod = rel[:-3].replace("/", ".")
            py_index[mod] = rel
            if mod.endswith(".__init__"):
                py_index[mod[: -len(".__init__")]] = rel
            for c in CONTAINERS:  # allow "from payments.x import y" when code lives in src/payments
                if mod.startswith(c + "."):
                    py_index.setdefault(mod[len(c) + 1 :], rel)
    all_paths = {rel for _, rel, _ in sources}
    extra = package_containers([rel for _, rel, _ in sources], rules)
    hist_files = (history or {}).get("files", {})
    files, satd = [], []
    dep_w: dict[tuple[str, str], int] = defaultdict(int)
    external: dict[str, set] = defaultdict(set)
    for full, rel, lang in sources:
        try:
            src = full.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        mod = module_of(rel, rules, extra)
        cx = complexity(src, lang)
        h = hist_files.get(rel)
        files.append({
            "path": rel, "module": mod, "language": lang, "loc": src.count("\n") + 1,
            "complexity": cx["complexity"], "max_function_complexity": cx["max_function"],
            "functions": cx["functions"],
            "churn": len(h["commits"]) if h else 0,
            "lines_changed": (h["added"] + h["deleted"]) if h else 0,
            "authors": len(h["authors"]) if h else 0,
            "last_modified": datetime.fromtimestamp(h["last"], timezone.utc).isoformat() if h and h["last"] else None,
            "_commits": h["commits"] if h else set(),
        })
        for s in scan_satd(src, lang):
            satd.append({"path": rel, "module": mod, **s})
        internal, ext = imports_of(rel, src, lang, py_index)
        for tgt in internal:
            cand = [tgt, tgt + ".py", tgt + ".js", tgt + ".ts", tgt + ".tsx", tgt + ".jsx",
                    tgt + "/index.js", tgt + "/index.ts", tgt + "/__init__.py"]
            real = next((c for c in cand if c in all_paths), tgt)
            tmod = module_of(real, rules, extra)
            if tmod != mod:
                dep_w[(mod, tmod)] += 1
        for e in ext:
            external[mod].add(e)
    mods: dict[str, dict] = {}
    for f in files:
        m = mods.setdefault(f["module"], {"name": f["module"], "files": 0, "loc": 0, "complexity": 0,
                                          "_commits": set(), "lines_changed": 0, "satd": 0})
        m["files"] += 1
        m["loc"] += f["loc"]
        m["complexity"] += f["complexity"]
        m["_commits"] |= f.pop("_commits")
        m["lines_changed"] += f["lines_changed"]
    for s in satd:
        if s["module"] in mods:
            mods[s["module"]]["satd"] += 1
    for m in mods.values():
        m["churn"] = len(m.pop("_commits"))
    max_churn = max((f["churn"] for f in files), default=0) or 1
    max_cx = max((f["complexity"] for f in files), default=0) or 1
    for f in files:
        f["hotspot_score"] = round(100.0 * (f["churn"] / max_churn) * (f["complexity"] / max_cx), 2)
    files.sort(key=lambda f: -f["hotspot_score"])
    return {
        "tool": "debtlens",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "window_days": window_days,
        "commits_analyzed": (history or {}).get("commits", 0),
        "files_analyzed": len(files),
        **(meta or {}),
        "modules": sorted(mods.values(), key=lambda m: -m["churn"]),
        "files": files,
        "dependencies": [{"source": a, "target": b, "weight": w} for (a, b), w in sorted(dep_w.items())],
        "external_dependencies": {k: sorted(v) for k, v in external.items()},
        "satd": satd,
    }


def scan_repository(path: str | Path, since_days: int | None = 365, max_commits: int | None = None) -> dict:
    """Full local scan (used by ``debtlens scan``)."""
    root = Path(path).resolve()
    meta = {"root": root.name, "source": "git", "warnings": []}
    history = None
    try:
        meta["commit"] = _git(root, "rev-parse", "HEAD").strip()
        meta["branch"] = _git(root, "rev-parse", "--abbrev-ref", "HEAD").strip()
        history = git_history(root, since_days, max_commits)
        if history["commits"] == 0 and since_days:
            history = git_history(root, None, max_commits)
            meta["warnings"].append(f"no commits in the last {since_days} days; used full history")
            since_days = None
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        meta["source"] = "filesystem"
        meta["warnings"].append("not a git repository (or git not installed): churn is 0")
    return analyze_tree(root, history, load_rules(root), since_days, meta)


# ----------------------------------------------------------------------------- GitHub

_GH_URL = re.compile(r"github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


def parse_github_url(url: str) -> tuple[str, str]:
    m = _GH_URL.search(url.strip())
    if not m:
        m2 = re.fullmatch(r"([\w.-]+)/([\w.-]+)", url.strip())
        if not m2:
            raise ValueError("expected a GitHub URL like https://github.com/owner/repo")
        return m2.group(1), m2.group(2)
    return m.group(1), m.group(2)


def _gh(url: str, token: str | None, timeout: float = 20.0, raw: bool = False):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "debtlens/2",
               "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if raw else json.loads(data)


def github_scan(repo: str, token: str | None = None, max_commits: int = 120, deadline_s: float = 45.0,
                max_repo_kb: int = 150_000) -> dict:
    """Mine a public GitHub repository without git: tarball for code, REST API for churn."""
    t0 = time.time()
    owner, name = parse_github_url(repo)
    api = f"https://api.github.com/repos/{owner}/{name}"
    try:
        info = _gh(api, token)
    except urllib.error.HTTPError as e:
        raise ValueError(f"GitHub returned {e.code} for {owner}/{name}"
                         + (" (rate limit — set GITHUB_TOKEN)" if e.code in (403, 429) else "")) from e
    if info.get("private"):
        raise ValueError("private repositories are not supported on the website; use the CLI")
    if int(info.get("size") or 0) > max_repo_kb:
        raise ValueError(f"repository is {info['size'] // 1024} MB; scan it with the CLI instead")
    branch = info.get("default_branch") or "main"
    warnings = []
    if not token:
        max_commits = min(max_commits, 40)
        warnings.append("no GitHub token configured: churn limited to the latest 40 commits")
    with tempfile.TemporaryDirectory(prefix="debtlens-") as tmp:
        blob = _gh(f"{api}/tarball/{branch}", token, timeout=40, raw=True)
        with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
            members = [m for m in tar.getmembers()
                       if m.isfile() and m.size <= MAX_FILE_BYTES
                       and os.path.splitext(m.name)[1].lower() in LANG.keys() | {".json"}]
            try:
                tar.extractall(tmp, members=members, filter="data")
            except TypeError:  # Python < 3.12
                safe = [m for m in members if not (m.name.startswith("/") or ".." in m.name.split("/"))]
                tar.extractall(tmp, members=safe)
        tops = [p for p in Path(tmp).iterdir() if p.is_dir()]
        root = tops[0] if len(tops) == 1 else Path(tmp)
        files: dict[str, dict] = defaultdict(lambda: {"commits": set(), "added": 0, "deleted": 0, "authors": set(), "last": 0})
        shas, page = [], 1
        while len(shas) < max_commits and time.time() - t0 < deadline_s / 3:
            batch = _gh(f"{api}/commits?sha={branch}&per_page=100&page={page}", token)
            if not batch:
                break
            shas.extend(c["sha"] for c in batch if len(c.get("parents") or []) <= 1)
            page += 1
        shas = shas[:max_commits]

        def fetch(sha):
            if time.time() - t0 > deadline_s:
                return None
            try:
                return _gh(f"{api}/commits/{sha}", token)
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=8) as pool:
            details = list(pool.map(fetch, shas))
        done = 0
        for c in details:
            if not c:
                continue
            done += 1
            author = ((c.get("commit") or {}).get("author") or {}).get("name") or "?"
            when = ((c.get("commit") or {}).get("author") or {}).get("date")
            ts = int(datetime.fromisoformat(when.replace("Z", "+00:00")).timestamp()) if when else 0
            for f in c.get("files") or []:
                rec = files[f["filename"]]
                rec["commits"].add(c["sha"])
                rec["added"] += int(f.get("additions") or 0)
                rec["deleted"] += int(f.get("deletions") or 0)
                rec["authors"].add(author)
                rec["last"] = max(rec["last"], ts)
        if done < len(shas):
            warnings.append(f"churn from {done} of {len(shas)} commits (time limit)")
        meta = {"root": name, "source": "github", "repository": f"{owner}/{name}", "branch": branch,
                "warnings": warnings}
        result = analyze_tree(root, {"commits": done, "files": files}, load_rules(root), None, meta)
        result["seconds"] = round(time.time() - t0, 1)
        return result
