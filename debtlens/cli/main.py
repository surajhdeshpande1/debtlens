"""`debtlens` — the DebtLens engine in your terminal.

Works offline on your own repository and on the bundled industry scenarios, or connected to a
DebtLens website project (`debtlens login`).  Run `debtlens --help` for the command list."""

from __future__ import annotations

import json
import os
from decimal import ROUND_HALF_UP, Decimal
import sys
from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.markup import escape
from rich.panel import Panel
from rich.table import Table

from .. import APP_NAME, __version__
from ..core import embeddings as EMB
from ..core import engine as E
from ..core import ingest as ING
from ..core import mining as MIN
from ..core import packs as PK
from ..core import report as REPORT
from ..core import scenarios as SC
from ..core import spike as SPIKE
from ..core import similarity as SIM
from .client import Api, CliError, config_dir, load_config, save_config

app = typer.Typer(name="debtlens", help="DebtLens — incidents, root causes and technical debt, in your terminal.",
                  no_args_is_help=True, rich_markup_mode="rich", add_completion=False,
                  context_settings={"help_option_names": ["-h", "--help"]})
incidents_app = typer.Typer(help="Browse and report incidents (record 5 Whys).", no_args_is_help=True)
simulate_app = typer.Typer(help="Simulation Lab: what-if, Monte Carlo forecast, failure injection, load spikes.",
                           no_args_is_help=True)
model_app = typer.Typer(help="Manage the optional MiniLM model used for semantic similarity.", no_args_is_help=True)
pack_app = typer.Typer(help="Scenario packs: a whole system on its busiest day, in one JSON file.", no_args_is_help=True)
app.add_typer(incidents_app, name="incidents")
app.add_typer(simulate_app, name="simulate")
app.add_typer(model_app, name="model")
app.add_typer(pack_app, name="pack")

out = Console(highlight=False)
err = Console(stderr=True, highlight=False)

ProjectOpt = typer.Option(None, "--project", "-p", help="Website project id (needs `debtlens login`).")
ScenarioOpt = typer.Option(None, "--scenario", "-s", help="Built-in system: fintech, healthtech, ecommerce, college, self, "
                           "or a scenario pack code (`debtlens pack list`). Your own pack files open on the website.")
SnapshotOpt = typer.Option(None, "--snapshot", help="A JSON snapshot exported from the website.")
JsonOpt = typer.Option(False, "--json", help="Print JSON instead of tables.")

SEV_STYLE = {"CRITICAL": "bold white on red", "HIGH": "bold red", "MEDIUM": "yellow", "LOW": "dim"}
STATUS_STYLE = {"OPEN": "red", "INVESTIGATING": "yellow", "RESOLVED": "green", "REMEDIATED": "green",
                "PRIORITIZED": "cyan", "IN_PROGRESS": "cyan", "IDENTIFIED": "white", "DEFERRED": "dim"}


def version_cb(value: bool):
    if value:
        out.print(f"{APP_NAME} {__version__}")
        raise typer.Exit()


@app.callback()
def main(version: bool = typer.Option(False, "--version", "-V", callback=version_cb, is_eager=True,
                                      help="Show the version and exit.")):
    """DebtLens — Developer Incident & Technical Debt Management."""


def run():
    """Console-script entry point with friendly errors."""
    try:
        app()
    except CliError as e:
        err.print(f"[red]error:[/] {e}")
        sys.exit(e.code)
    except KeyboardInterrupt:
        err.print("[dim]cancelled[/]")
        sys.exit(130)


# ----------------------------------------------------------------------------- sources

class Source:
    """Where a command reads data from: a website project, a bundled scenario or a snapshot file."""

    def __init__(self, project: Optional[int], scenario: Optional[str], snapshot: Optional[Path], quiet: bool = False):
        self.api = None
        self.project_id = None
        self._snap = None
        cfg = load_config()
        if snapshot:
            try:
                self._snap = json.loads(Path(snapshot).read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                raise CliError(f"cannot read snapshot {snapshot}: {e}") from None
            self.kind, self.label = "snapshot", f"snapshot {Path(snapshot).name}"
        elif scenario:
            self._load_scenario(scenario)
        elif project or (cfg.get("project") and Api().ready):
            self.api = Api()
            if not self.api.ready:
                raise CliError("not logged in — run `debtlens login <url>` or use --scenario for offline mode")
            self.project_id = int(project or cfg["project"])
            self.kind, self.label = "project", f"project {self.project_id} on {self.api.url}"
        else:
            self._load_scenario("fintech")
            if not quiet:
                err.print("[dim]offline: using the bundled fintech scenario (pass --scenario, --project or --snapshot)[/]")

    def _load_scenario(self, code: str):
        if code.lower().endswith(".json") or Path(code).expanduser().is_file():
            raise CliError(PACK_FILES_ON_WEB)
        code = code.lower()
        if not SC.known(code):
            raise CliError(f"unknown scenario '{code}' — try: "
                           f"{', '.join([s['code'] for s in SC.list_scenarios()] + PK.codes())}")
        self._snap = SC.materialize(code)
        kind = "pack" if code in PK.codes() else "scenario"
        self.kind, self.label, self.code = "scenario", f"{kind} {code}", code


    @property
    def remote(self) -> bool:
        return self.kind == "project"

    def path(self, suffix: str = "") -> str:
        return f"/projects/{self.project_id}{suffix}"

    def snap(self) -> dict:
        if self._snap is None:
            self._snap = self.api.get(self.path("/export"))
        return self._snap

    def params(self) -> dict:
        return dict((self.snap().get("settings") or {}).get("economics") or {})

    def alpha_tau(self) -> tuple[float, float]:
        st = self.snap().get("settings") or {}
        return float(st.get("alpha", SIM.DEFAULT_ALPHA)), float(st.get("tau", SIM.DEFAULT_TAU))

    def title(self) -> str:
        p = self.snap().get("project") or {}
        return f"{p.get('name', 'Project')} · {p.get('industry') or self.label}"


PACK_FILES_ON_WEB = ("pack files are opened on the website: on the start page, Pick a system → Upload a scenario "
                     "pack. The terminal runs the built-in systems by name (`debtlens scenarios`).")

def embedder():
    """MiniLM if it has been downloaded (`debtlens model download`), else None (char n-gram fallback)."""
    if os.environ.get("DEBTLENS_DISABLE_ML") == "1":
        return None
    m = EMB.get_embedder(download=False)
    return m.embed if m else None


def emit_json(obj) -> None:
    out.print_json(json.dumps(obj, default=str))


def r1(v) -> str:
    """One decimal, rounding halves up like the website does (98.55 -> 98.6, where Python's float format gives 98.5)."""
    if v is None:
        return "–"
    d = Decimal(repr(float(v))).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return f"{d:,}"


def fmt_h(v) -> str:
    return "–" if v is None else f"{r1(v)} h"


def sev(s: str) -> str:
    return f"[{SEV_STYLE.get(s, '')}]{(s or '').lower()}[/]"


def status(s: str) -> str:
    return f"[{STATUS_STYLE.get(s, '')}]{(s or '').replace('_', ' ').lower()}[/]"


def table(*cols, title: str | None = None) -> Table:
    t = Table(title=title, title_justify="left", title_style="bold", header_style="bold dim", box=None, pad_edge=False,
              show_edge=False)
    for c in cols:
        if isinstance(c, tuple):
            t.add_column(c[0], justify=c[1], no_wrap=c[1] == "right")
        else:
            t.add_column(c)
    return t


# ----------------------------------------------------------------------------- general

@app.command()
def scenarios(as_json: bool = JsonOpt):
    """List the bundled industry scenarios and scenario packs."""
    rows = SC.list_scenarios()
    packs = PK.list_packs()
    if as_json:
        return emit_json(rows + packs)
    t = table("code", "name", "industry", ("incidents", "right"), ("debts", "right"), ("modules", "right"), "about")
    for s in rows:
        t.add_row(f"[cyan]{s['code']}[/]", s["name"], s["industry"], str(s["counts"]["incidents"]), str(s["counts"]["debts"]),
                  str(s["counts"]["modules"]), s["tagline"])
    for s in packs:
        t.add_row(f"[magenta]{s['code']}[/]", s["name"], s["industry"], str(s["counts"]["incidents"]),
                  str(s["counts"]["debts"]), str(s["counts"]["modules"]),
                  f"pack · {s['event']['name']}" if s.get("event") else "pack")
    out.print(t)
    out.print("[dim]Try: debtlens demo healthtech · debtlens plan -s college --budget 40 · "
              "debtlens simulate spike -s tatkal[/]")


# ----------------------------------------------------------------------------- scenario packs

@pack_app.command("list")
def pack_list(as_json: bool = JsonOpt):
    """The bundled scenario packs and the event each one is built around."""
    rows = PK.list_packs()
    if as_json:
        return emit_json(rows)
    t = table("code", "name", "industry", "busiest day", ("peak", "right"), ("incidents", "right"), ("debts", "right"))
    for s in rows:
        ev = s.get("event") or {}
        t.add_row(f"[magenta]{s['code']}[/]", s["name"], s["industry"], ev.get("name", "—"),
                  f"{ev['peak']:g}× at {ev['peak_hour']:02d}:00" if ev else "—",
                  str(s["counts"]["incidents"]), str(s["counts"]["debts"]))
    out.print(t)
    out.print("[dim]Open one: debtlens demo tatkal · its situations: debtlens pack show tatkal · "
              "your own pack: upload it on the website[/]")


def _pack_arg(ref: str) -> dict:
    if ref.lower().endswith(".json") or Path(ref).expanduser().is_file():
        raise CliError(PACK_FILES_ON_WEB)
    try:
        return PK.get(ref.lower())
    except KeyError:
        raise CliError(f"no pack '{ref}' — try: {', '.join(PK.codes())}") from None


@pack_app.command("show")
def pack_show(ref: str = typer.Argument(..., help="Pack code (`debtlens pack list`)."), as_json: bool = JsonOpt):
    """What a pack contains: modules, incidents, debt and the situations it can run."""
    pack = _pack_arg(ref)
    if as_json:
        return emit_json(PK.info(pack))
    i = PK.info(pack)
    out.print(f"[bold]{pack['name']}[/] · {pack['industry']} [dim]({pack['code']})[/]")
    if pack.get("tagline"):
        out.print(pack["tagline"])
    out.print(f"{i['counts']['modules']} modules · {len(pack['dependencies'])} dependencies · "
              f"{i['counts']['incidents']} incidents · {i['counts']['debts']} debt items · "
              f"{len(pack['files'])} files · {len(pack['satd'])} TODO/FIXME markers")
    if i.get("headline"):
        out.print(f"Story: {i['headline']}")
    _situations_table(SPIKE.events_for(SC.events(pack)), pack["code"])
    t = table("module", ("incidents", "right"), ("debts", "right"), "owner")
    for m in pack["modules"]:
        t.add_row(m["name"], str(sum(1 for x in pack["incidents"] if x["module"] == m["name"])),
                  str(sum(1 for x in pack["debts"] if x["module"] == m["name"])),
                  (pack["people"].get(m.get("owner") or "", {}) or {}).get("name", "—"))
    out.print(t)


KIND_STYLE = {"traffic": "blue", "bots": "magenta", "outage": "red", "deploy": "red", "database": "green",
              "cache": "yellow", "leak": "cyan", "zone": "white", "retry": "magenta"}


def _situations_table(events: list[dict], code: str) -> None:
    t = table("situation (-e)", "kind", "name", ("peak", "right"), "what goes wrong", title="Situations")
    for e in events:
        if e["key"] == "custom":
            continue
        what = "; ".join(x["label"] for x in e.get("effects") or [])
        if e.get("bots"):
            what = f"bots are {100 * e['bots']['share']:.0f}% of the extra traffic"
        t.add_row(f"[cyan]{e['key']}[/]", f"[{KIND_STYLE.get(e['kind'], '')}]{REPORT.KIND_SHORT.get(e['kind'], e['kind'])}[/]", e["name"],
                  f"{e['peak']:g}× at {e['peak_hour']:02d}:00", what or "a rush of real users")
    out.print(t)
    out.print(f"[dim]Run one: debtlens simulate spike -s {code} -e <situation> --report   (add --live to watch it)[/]")


@app.command()
def demo(scenario: str = typer.Argument("fintech", help="Scenario code."), as_json: bool = JsonOpt):
    """Dashboard of a bundled scenario (offline)."""
    dashboard_cmd(Source(None, scenario, None), as_json)


@app.command()
def analyse(snapshot: Path = typer.Argument(..., exists=True, dir_okay=False, help="Snapshot JSON exported from the website."),
            as_json: bool = JsonOpt):
    """Run the full analysis offline on an exported project snapshot."""
    dashboard_cmd(Source(None, None, snapshot), as_json)


@app.command()
def dashboard(project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt,
              snapshot: Optional[Path] = SnapshotOpt, as_json: bool = JsonOpt):
    """KPIs, highest-risk debt, systemic causes and regressions."""
    dashboard_cmd(Source(project, scenario, snapshot), as_json)


def dashboard_cmd(src: Source, as_json: bool):
    if src.remote:
        d = src.api.get(src.path("/dashboard"))
    else:
        snap = src.snap()
        alpha, _ = src.alpha_tau()
        bundle = E.similarity_bundle(snap, alpha, embedder()) if snap["incidents"] else None
        d = E.dashboard(snap, src.params(), bundle=bundle)
        d["semantic_method"] = bundle.semantic_method if bundle else None
    if as_json:
        return emit_json(d)
    inc, led = d["incidents"], d["ledger"]
    out.print(Panel.fit(f"[bold]{src.title()}[/]   [dim]{src.label}[/]", border_style="blue"))
    out.print(f"  incidents [bold]{inc['open'] + inc['investigating']}[/] open of {inc['total']} · MTTR {fmt_h(inc['mttr_hours'])} · "
              f"interest [bold red]{fmt_h(led['total_interest'])}[/]/month · principal {fmt_h(led['total_principal'])} · "
              f"[bold]{led['break_even_pct']}%[/] past break-even · regressions [bold]{d['regression_count']}[/] · "
              f"TODO/FIXME {d['satd_count']}\n")
    t = table("debt", "title", "module", ("principal", "right"), ("interest/mo", "right"), ("risk", "right"), "break-even",
              title="Highest-risk debt")
    for r in d["top_debts"]:
        t.add_row(f"[cyan]{r['key']}[/]", r["title"], r["module"], fmt_h(r["principal"]), fmt_h(r["interest"]),
                  r1(r["risk"]), "[red]past[/]" if r["break_even"] else "not yet")
    out.print(t)
    out.print()
    t = table("root cause", ("incidents", "right"), ("paths", "right"), title="Systemic root causes")
    for c in d["top_causes"]:
        t.add_row(c["label"], str(c["incidents"]), f"{c.get('paths', 0):g}")
    out.print(t)
    if d["regressions"]:
        out.print()
        t = table("new", "came back from", "module", ("similarity", "right"), ("days later", "right"), title="Regressions")
        for r in d["regressions"]:
            t.add_row(f"{r['incident_key']} {r['incident_title'][:50]}", r["regressed_from_key"], r["module"],
                      f"{r['similarity']:.2f}", f"{r['days_to_recurrence']:.0f}")
        out.print(t)
    out.print(f"\n[dim]similarity: {d.get('semantic_method') or 'n/a'}[/]")


# ----------------------------------------------------------------------------- repository evidence

@app.command()
def scan(path: Path = typer.Argument(Path("."), exists=True, file_okay=False, help="Repository folder."),
         since: int = typer.Option(365, help="Days of git history for churn (0 = all)."),
         max_commits: Optional[int] = typer.Option(None, help="Cap on commits read."),
         top: int = typer.Option(15, help="Hotspots to show."),
         as_json: bool = JsonOpt, out_file: Optional[Path] = typer.Option(None, "--out", "-o", help="Write the scan JSON here."),
         push: bool = typer.Option(False, "--push", help="Upload the result to your website project."),
         project: Optional[int] = ProjectOpt):
    """Mine a repository: churn, McCabe complexity, TODO/FIXME debt and the import graph."""
    with out.status("Reading git history and analysing source files…", spinner="dots") if not as_json else _null():
        res = MIN.scan_repository(path, since or None, max_commits)
    if out_file:
        out_file.write_text(json.dumps(res, indent=2, default=str), encoding="utf-8")
    if as_json:
        emit_json(res)
    else:
        out.print(Panel.fit(f"[bold]{res.get('root')}[/]  {res.get('branch') or ''} {str(res.get('commit') or '')[:8]}   "
                            f"[dim]{res['commits_analyzed']} commits · {res['files_analyzed']} files · source {res.get('source')}[/]",
                            border_style="blue"))
        for w in res.get("warnings") or []:
            out.print(f"[yellow]! {w}[/]")
        t = table("file", "module", ("churn", "right"), ("complexity", "right"), ("worst fn", "right"), ("loc", "right"),
                  ("hotspot", "right"), title="Hotspots (churn × complexity)")
        for f in res["files"][:top]:
            t.add_row(f["path"], f["module"], str(f["churn"]), f"{f['complexity']:g}", str(f.get("max_function_complexity") or "–"),
                      str(f["loc"]), f"[bold]{f['hotspot_score']:.1f}[/]")
        out.print(t)
        if res["satd"]:
            out.print()
            t = table("where", "marker", "comment", title=f"Self-admitted debt ({len(res['satd'])})")
            for s in res["satd"][:20]:
                t.add_row(f"{s['path']}:{s['line']}", f"[yellow]{s['marker']}[/]", s["text"][:80])
            out.print(t)
        if res["dependencies"]:
            out.print("\n[bold]Module dependencies[/]  " + ", ".join(f"{d['source']}→{d['target']}" for d in res["dependencies"][:25]))
    if push:
        api = Api()
        pid = project or load_config().get("project")
        if not (api.ready and pid):
            raise CliError("to --push, run `debtlens login` and pass --project (or `debtlens use <id>`)")
        r = api.post(f"/projects/{pid}/evidence/scan", res)
        out.print(f"[green]✓ uploaded to project {pid}:[/] {r['applied']['files']} files, {r['applied']['satd_added']} new markers, "
                  f"{r['applied']['dependencies']} dependencies")


class _null:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


# ----------------------------------------------------------------------------- intelligence

@app.command()
def similar(text: str = typer.Argument(..., help="Describe the problem in plain words."),
            k: int = typer.Option(5, "--k", "-k"), project: Optional[int] = ProjectOpt,
            scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt, as_json: bool = JsonOpt):
    """Has this happened before, and what fixed it?"""
    src = Source(project, scenario, snapshot)
    if src.remote:
        r = src.api.post(src.path("/search"), {"query": text})
        hits, method = r["results"][:k], r["method"]
    else:
        snap = src.snap()
        incs = snap["incidents"]
        alpha, _ = src.alpha_tau()
        res_by = {x["incident_id"]: x for x in snap.get("resolutions") or []}
        found, method = SIM.query_similar(text, [SIM.incident_text(i) for i in incs], alpha,
                                          [i.get("embedding") for i in incs], None, embedder(), k=k, threshold=0.1)
        hits = []
        for j, sc in found:
            o, rr = incs[j], res_by.get(incs[j]["id"])
            hits.append({"key": o["key"], "title": o["title"], "module": o["module"], "status": o["status"], **sc,
                         "fix": rr["action"] if rr else None, "lessons": rr["lessons"] if rr else None})
    if as_json:
        return emit_json({"method": method, "results": hits})
    if not hits:
        out.print("Nothing similar found.")
        return
    for h in hits:
        out.print(f"[cyan]{h['key']}[/] {h['title']}  [dim]{h['module']} · {status(h['status'])}[/]")
        out.print(f"   [dim]hybrid[/] [bold]{h['hybrid']:.2f}[/]  [dim]lexical {h['lexical']:.2f} · semantic {h['semantic']:.2f}[/]")
        if h.get("fix"):
            out.print(f"   [green]fix:[/] {h['fix']}")
        if h.get("lessons"):
            out.print(f"   [green]lesson:[/] {h['lessons']}")
    out.print(f"\n[dim]{method} · {src.label}[/]")


# ----------------------------------------------------------------------------- incidents

def _need_remote(src: Source, what: str):
    if not src.remote:
        raise CliError(f"{what} needs a website project — `debtlens login <url>` then --project <id> (or `debtlens use <id>`)")


@incidents_app.command("list")
def incidents_list(status_: Optional[str] = typer.Option(None, "--status", help="OPEN, INVESTIGATING, RESOLVED (comma list)."),
                   limit: int = typer.Option(30, "--limit", "-n"), project: Optional[int] = ProjectOpt,
                   scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt, as_json: bool = JsonOpt):
    """List incidents, newest first."""
    src = Source(project, scenario, snapshot)
    if src.remote:
        items = src.api.get(src.path("/incidents"), status=status_, limit=limit)["items"]
    else:
        items = sorted(src.snap()["incidents"], key=lambda i: i.get("reported_at") or "", reverse=True)
        if status_:
            allowed = {x.strip().upper() for x in status_.split(",")}
            items = [i for i in items if i["status"] in allowed]
        items = items[:limit]
    if as_json:
        return emit_json([{k: v for k, v in i.items() if k != "embedding"} for i in items])
    t = table("key", "incident", "module", "severity", "status", "reported")
    for i in items:
        t.add_row(f"[cyan]{i['key']}[/]", i["title"], i["module"], sev(i["severity"]), status(i["status"]), (i.get("reported_at") or "")[:10])
    out.print(t)


@incidents_app.command("show")
def incidents_show(key: str = typer.Argument(..., help="Incident key, e.g. INC-118."), project: Optional[int] = ProjectOpt,
                   scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt, as_json: bool = JsonOpt):
    """One incident: 5 Whys chain, fix, similar incidents."""
    src = Source(project, scenario, snapshot)
    key = key.upper()
    if src.remote:
        found = [i for i in src.api.get(src.path("/incidents"), q=key, limit=50)["items"] if i["key"] == key]
        if not found:
            raise CliError(f"no incident {key}")
        d = src.api.get(src.path(f"/incidents/{found[0]['id']}"))
        inc, whys, res, sim = d["incident"], [w["answer"] for w in d["whys"]], d["resolution"], d["similar"]["matches"]
        fix = res and res["action_taken"]
        lesson = res and res["lessons_learned"]
    else:
        snap = src.snap()
        inc = next((i for i in snap["incidents"] if i["key"] == key), None)
        if inc is None:
            raise CliError(f"no incident {key} in {src.label}")
        labels = {c["id"]: c["label"] for c in snap["causes"]}
        whys = [r.get("explanation") or labels.get(r["cause_id"], "") for r in
                sorted((r for r in snap["root_causes"] if r["incident_id"] == inc["id"]), key=lambda r: r["level"])]
        rr = next((r for r in snap["resolutions"] if r["incident_id"] == inc["id"]), None)
        fix, lesson = (rr["action"], rr["lessons"]) if rr else (None, None)
        alpha, _ = src.alpha_tau()
        sim = E.similar_incidents(snap, inc["id"], 5, 0.2, alpha, embedder())["matches"]
    if as_json:
        return emit_json({"incident": {k: v for k, v in inc.items() if k != "embedding"}, "whys": whys, "fix": fix,
                          "lessons": lesson, "similar": sim})
    out.print(Panel.fit(f"[cyan bold]{inc['key']}[/] [bold]{inc['title']}[/]\n{sev(inc['severity'])} · {status(inc['status'])} · "
                        f"{inc['module']} · reported {(inc.get('reported_at') or '')[:16]}", border_style="blue"))
    if inc.get("description"):
        out.print(inc["description"] + "\n")
    if whys:
        out.print("[bold]5 Whys[/]")
        for n, w in enumerate(whys, 1):
            out.print(f"  [cyan]W{n}[/] {w}")
    if fix:
        out.print(f"\n[green]fix:[/] {fix}")
    if lesson:
        out.print(f"[green]lesson:[/] {lesson}")
    if sim:
        out.print("\n[bold]Similar incidents[/]")
        for m in sim:
            out.print(f"  [cyan]{m['key']}[/] {m['title']}  [dim]{m['hybrid']:.2f} · {m['status'].lower()}[/]")


@incidents_app.command("new")
def incidents_new(title: Optional[str] = typer.Option(None, help="What failed (prompted if missing)."),
                  module: Optional[str] = typer.Option(None), severity: Optional[str] = typer.Option(None),
                  description: Optional[str] = typer.Option(None), whys: Optional[List[str]] = typer.Option(None, "--why",
                  help="5 Whys answers, symptom first (repeat the option)."), project: Optional[int] = ProjectOpt,
                  yes: bool = typer.Option(False, "--yes", "-y", help="Don't ask questions; report as given.")):
    """Report an incident (checks for duplicates first) and record its 5 Whys."""
    src = Source(project, None, None, quiet=True)
    _need_remote(src, "reporting an incident")
    interactive = not yes and sys.stdin.isatty()
    if not title:
        if not interactive:
            raise CliError("--title is required")
        title = typer.prompt("What failed?")
    mods = [m["name"] for m in src.api.get(src.path("/modules"))["modules"]]
    if not module and interactive:
        out.print("[dim]modules: " + ", ".join(mods) + "[/]")
        module = typer.prompt("Module", default=mods[0] if mods else "unassigned")
    severity = (severity or (typer.prompt("Severity (critical/high/medium/low)", default="high") if interactive else "MEDIUM")).upper()
    if description is None and interactive:
        description = typer.prompt("Description", default="", show_default=False)
    chk = src.api.post(src.path("/incidents/check"), {"title": title, "description": description or "", "module": module or ""})
    if chk["matches"]:
        out.print(f"\n[bold]Has this happened before?[/] verdict: [bold]{chk['verdict']}[/] ({chk['method']})")
        for m in chk["matches"][:3]:
            out.print(f"  [cyan]{m['key']}[/] {m['title']} [dim]({m['hybrid']:.2f}, {m['status'].lower()})[/]")
            if m.get("fix"):
                out.print(f"     [green]fix:[/] {m['fix']}")
        if chk["verdict"] == "duplicate" and interactive and not typer.confirm("Report it anyway?", default=False):
            raise typer.Exit()
    answers = list(whys or [])
    if not answers and interactive and typer.confirm("Record the 5 Whys now?", default=True):
        for n in range(1, 6):
            a = typer.prompt(f"  Why {n}" + (" (the symptom)" if n == 1 else ""), default="", show_default=False)
            if not a.strip():
                break
            answers.append(a.strip())
    body = {"title": title, "module": module or "unassigned", "severity": severity, "description": description or ""}
    if answers:
        body["whys"] = answers
    r = src.api.post(src.path("/incidents"), body)
    merged = [w for w in r.get("whys") or [] if w["merged"]]
    out.print(f"[green]✓ reported {r['incident']['key']}[/]" + (f" — {len(merged)} answer(s) converged onto existing causes" if merged else ""))


# ----------------------------------------------------------------------------- debt, ledger, plan

def _ledger(src: Source) -> dict:
    return src.api.get(src.path("/ledger")) if src.remote else E.ledger(src.snap(), src.params())


@app.command()
def debt(project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
         show_all: bool = typer.Option(False, "--all", help="Include remediated items."), as_json: bool = JsonOpt):
    """Debt items with principal, interest, risk and break-even."""
    src = Source(project, scenario, snapshot)
    led = _ledger(src)
    rows = led["rows"] if show_all else [r for r in led["rows"] if r["is_open"]]
    if as_json:
        return emit_json(rows)
    t = table("debt", "title", "module", "status", ("principal", "right"), ("interest/mo", "right"), ("risk", "right"), "break-even")
    for r in rows:
        t.add_row(f"[cyan]{r['key']}[/]", r["title"], r["module"], status(r["status"]), fmt_h(r["principal"]), fmt_h(r["interest"]),
                  r1(r["risk"]), "[red]past[/]" if r["break_even"] else "not yet")
    out.print(t)


@app.command()
def ledger(project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
           as_json: bool = JsonOpt):
    """Ledger summary: principal, interest, break-even, by module and category."""
    src = Source(project, scenario, snapshot)
    led = _ledger(src)
    if as_json:
        return emit_json(led["summary"])
    s = led["summary"]
    out.print(f"[bold]{s['open_items']}[/] open items · principal {fmt_h(s['total_principal'])} · interest [bold red]{fmt_h(s['total_interest'])}[/]/month"
              f" · net drag {fmt_h(s['net_drag'])} · [bold]{s['break_even_pct']}%[/] past break-even\n")
    t = table("module", ("items", "right"), ("principal", "right"), ("interest/mo", "right"), title="By module")
    for m, v in sorted(s["by_module"].items(), key=lambda kv: -kv[1]["interest"]):
        t.add_row(m, str(v["count"]), fmt_h(v["principal"]), fmt_h(v["interest"]))
    out.print(t)


@app.command()
def plan(budget: float = typer.Option(40, "--budget", "-b", help="Sprint effort budget in hours."),
         method: str = typer.Option("auto", help="auto, tree_dp, branch_and_bound, greedy, naive_dp, brute_force."),
         force: Optional[List[str]] = typer.Option(None, "--force", help="Debt key that must be included (repeatable)."),
         approve: bool = typer.Option(False, "--approve", help="Save as the approved sprint plan (website projects)."),
         project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
         as_json: bool = JsonOpt):
    """What to fix this sprint: exact precedence-constrained 0/1 knapsack, compared with greedy and v1."""
    src = Source(project, scenario, snapshot)
    led = _ledger(src)
    ids = {r["key"]: r["id"] for r in led["rows"]}
    force_ids = []
    for k in force or []:
        if k.upper() not in ids:
            raise CliError(f"unknown debt {k}")
        force_ids.append(ids[k.upper()])
    if src.remote:
        r = src.api.post(src.path("/plan"), {"budget": budget, "method": method, "force": force_ids})
    else:
        try:
            r = E.plan(src.snap(), budget, src.params(), method, force_ids, led=led)
        except ValueError as e:
            raise CliError(str(e)) from None
    if as_json:
        return emit_json(r)
    s = led["summary"]
    out.print(f"[bold]{src.title()}[/] — {s['open_items']} open debt items, {fmt_h(s['total_interest'])}/month interest, "
              f"{s['break_even_pct']}% past break-even\n")
    tag = "proven optimal" if r["optimal"] else "heuristic"
    t = table("debt", "title", ("hours", "right"), ("interest/mo", "right"),
              title=f"Fix this sprint — {r['total_weight']:g} of {budget:g} h ({r['method'].replace('_', ' ')}, {tag})")
    for x in r["selected_items"]:
        t.add_row(f"[cyan]{x['key']}[/]", x["title"], f"{x['principal']:g}", r1(x["interest"]))
    out.print(t)
    out.print(f"\nRetires [bold green]{r['interest_retired']:g} h/month[/] of interest.")
    c = r.get("comparison")
    if c:
        out.print(f"vs greedy [green]+{c['gain_vs_greedy_pct']}%[/]   vs v1 naive DP [green]+{c['gain_vs_naive_pct']}%[/]"
                  + (f"   [dim](v1: {c['naive_dp']['warnings'][0]})[/]" if c["naive_dp"].get("warnings") else ""))
    for w in r.get("warnings") or []:
        out.print(f"[yellow]! {w}[/]")
    if approve:
        _need_remote(src, "approving a plan")
        a = src.api.post(src.path("/plans"), {"budget": budget, "method": method, "force": force_ids, "notes": "approved from the CLI"})
        out.print(f"[green]✓ approved — {len(a['plan']['selected_keys'])} items moved to PRIORITIZED[/]")


# ----------------------------------------------------------------------------- fix playbooks

def _playbook_edits(src: Source) -> dict:
    return dict((src.snap().get("settings") or {}).get("playbooks") or {})


SPARK = "▁▂▃▄▅▆▇█"


def spark(values, top: float = 1.5) -> str:
    """Hour-by-hour bar of utilisation: full block at `top` (150%) or more."""
    out_ = []
    for v in values:
        k = min(len(SPARK) - 1, int(round(max(0.0, v) / top * (len(SPARK) - 1))))
        ch = SPARK[k]
        out_.append(f"[red]{ch}[/]" if v >= 1.0 else f"[yellow]{ch}[/]" if v >= 0.85 else ch)
    return "".join(out_)


@app.command()
def playbook(key: str = typer.Argument(..., help="Debt key, e.g. DEBT-101."),
             done: Optional[str] = typer.Option(None, "--done", help="Mark steps done, e.g. 1,2 (website projects)."),
             use: Optional[str] = typer.Option(None, "--use", help="Choose another playbook by key (website projects)."),
             project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
             as_json: bool = JsonOpt):
    """Step-by-step fix guidance for one debt item, with how to verify it and what can go wrong."""
    src = Source(project, scenario, snapshot)
    key = key.upper()
    if src.remote:
        lib = src.api.get(src.path("/playbooks"))
        row = next((d for d in lib["debts"] if d["key"] == key), None)
        if row is None:
            raise CliError(f"unknown debt {key}")
        body = {}
        if use:
            body["playbook"] = use
        if done is not None:
            try:
                body["steps_done"] = sorted({int(x) - 1 for x in done.split(",") if x.strip()})
            except ValueError:
                raise CliError("--done takes step numbers like 1,2,4") from None
        r = (src.api.put(src.path(f"/debts/{row['id']}/playbook"), body) if body
             else src.api.get(src.path(f"/debts/{row['id']}/playbook")))
    else:
        if done is not None or use:
            raise CliError("--done and --use save progress on a website project (use --project)")
        snap = src.snap()
        try:
            r = E.debt_playbook(snap, key, _playbook_edits(src))
        except KeyError:
            raise CliError(f"unknown debt {key}") from None
        row = next((d for d in snap.get("debts") or [] if d.get("key") == key), {})
        r["steps_done"] = list(row.get("playbook_steps_done") or [])  # ticked on the website, kept in an exported snapshot
    if as_json:
        return emit_json(r)
    ctx = r.get("context") or {}
    m = r.get("match") or {}
    why = ("chosen by the team" if m.get("chosen") else
           f"matched on: {', '.join(m.get('matched') or [])}" if m.get("matched") else "general guidance")
    out.print(Panel.fit(f"[bold]{r['title']}[/]\n[dim]{ctx.get('debt_key')} · module {ctx.get('module')} · {why}[/]",
                        border_style="cyan"))
    if r.get("problem"):
        out.print(f"[bold]Problem.[/] {r['problem']}")
    if ctx.get("root_cause"):
        out.print(f"[bold]Root cause here.[/] {ctx['root_cause']}")
    out.print()
    done_set = set(r.get("steps_done") or [])
    for i, step in enumerate(r["steps"]):
        mark = "[green]✓[/]" if i in done_set else f"[bold]{i + 1}.[/]"
        out.print(f" {mark} {step}")
    if r.get("verify"):
        out.print("\n[bold]Done when[/]")
        for v in r["verify"]:
            out.print(f"  • {v}")
    if r.get("risks"):
        out.print("\n[bold]Watch out[/]")
        for v in r["risks"]:
            out.print(f"  • {v}")
    if r.get("references"):
        out.print("\n[bold]Read more[/]")
        for ref in r["references"]:
            out.print(f"  • {ref['title']} — [link={ref['url']}]{ref['url']}[/link]")
    if r.get("capacity") or r.get("resilience"):
        out.print(f"\n[dim]Load-spike effect while open: −{100 * r['capacity']:.0f}% capacity, "
                  f"+{r['resilience']:.2f} fragility (see `debtlens simulate spike`).[/]")
    if src.remote and r.get("progress"):
        out.print(f"\n[dim]{r['progress']['done']} of {r['progress']['total']} steps done.[/]")


@app.command()
def playbooks(project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
              as_json: bool = JsonOpt):
    """Which fix playbook each debt item uses, and why."""
    src = Source(project, scenario, snapshot)
    if src.remote:
        r = src.api.get(src.path("/playbooks"))
    else:
        snap = src.snap()
        lib, assignment = E.playbook_assignment(snap, _playbook_edits(src))
        r = {"debts": [{"key": d["key"], "title": d["title"], "module": d.get("module"), "status": d.get("status"),
                        "playbook": assignment[d["id"]]["key"], "playbook_title": lib[assignment[d["id"]]["key"]].title,
                        "chosen": assignment[d["id"]].get("chosen", False), "matched": assignment[d["id"]].get("matched", []),
                        "steps_done": len(d.get("playbook_steps_done") or []),
                        "steps_total": len(lib[assignment[d["id"]]["key"]].steps)}
                       for d in snap.get("debts") or []],
             "playbooks": [pb.to_dict() for pb in lib.values()]}
    if as_json:
        return emit_json(r)
    t = table("debt", "module", "status", "playbook", "why", ("steps", "right"), title=f"Fix playbooks — {src.title()}")
    for d in r["debts"]:
        why = "team choice" if d.get("chosen") else ", ".join(d.get("matched") or []) or "general"
        steps = f"{d['steps_done']}/{d['steps_total']}" if src.remote or d["steps_done"] else str(d["steps_total"])
        t.add_row(f"[cyan]{d['key']}[/]", d.get("module") or "", status(d.get("status") or ""), d["playbook_title"],
                  f"[dim]{why}[/]", steps)
    out.print(t)
    out.print(f"\n[dim]{len(r['playbooks'])} playbooks available. Show one with `debtlens playbook DEBT-…`.[/]")


# ----------------------------------------------------------------------------- simulation lab

@simulate_app.command("forecast")
def sim_forecast(budget: float = typer.Option(40, "--budget", "-b"), sprints: int = typer.Option(12),
                 runs: int = typer.Option(200), seed: int = typer.Option(7), inflow: float = typer.Option(0.25, help="New debt per sprint."),
                 hazard: float = typer.Option(1.0, help="Incident-rate multiplier."), project: Optional[int] = ProjectOpt,
                 scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt, as_json: bool = JsonOpt):
    """Monte Carlo: incident hours over the next sprints under each remediation policy."""
    src = Source(project, scenario, snapshot)
    cfg = {"budget": budget, "sprints": sprints, "runs": runs, "seed": seed, "inflow_rate": inflow, "hazard_scale": hazard}
    with out.status(f"Simulating {runs} futures × 4 policies…", spinner="dots") if not as_json else _null():
        r = src.api.post(src.path("/simulate/forecast"), cfg) if src.remote else E.forecast(src.snap(), cfg, src.params())
    if as_json:
        return emit_json(r)
    t = table("policy", ("incident hours", "right"), ("p10–p90", "right"), ("fix hours", "right"), ("open items", "right"),
              title=f"After {sprints} sprints of {budget:g} h ({runs} runs)")
    for k, p in r["policies"].items():
        t.add_row(p["label"], f"[bold]{p['final_hours_mean']:,.1f}[/]", f"{p['final_hours_p10']:,.0f}–{p['final_hours_p90']:,.0f}",
                  f"{p['fix_hours_mean']:,.0f}", f"{p['open_mean'][-1]:.1f}")
    out.print(t)
    out.print()
    t = table("comparison", ("hours saved", "right"), ("95% CI", "right"), ("%", "right"), ("runs better", "right"),
              title="Paired comparison (same random futures)")
    for k, c in r["comparisons"].items():
        t.add_row(k.replace("_vs_", " vs ").replace("_", " "), f"[green]{c['hours_saved_mean']:,.1f}[/]",
                  f"{c['ci95'][0]:,.1f} … {c['ci95'][1]:,.1f}", f"{c['pct_saved']}%", f"{c['runs_better']}/{runs}")
    out.print(t)


@simulate_app.command("cascade")
def sim_cascade(module: str = typer.Argument(..., help="Module to fail."), p: float = typer.Option(0.35, help="Spread probability."),
                runs: int = typer.Option(3000), drill: bool = typer.Option(False, "--drill", help="Also raise a drill incident (website)."),
                project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
                as_json: bool = JsonOpt):
    """Failure injection: fail one module and see which dependents are likely to break."""
    src = Source(project, scenario, snapshot)
    if src.remote:
        r = src.api.post(src.path("/simulate/cascade"), {"module": module, "p": p, "runs": runs, "create_incident": drill})
    else:
        if drill:
            raise CliError("--drill needs a website project")
        try:
            r = E.cascade(src.snap(), module.lower(), p, runs)
        except ValueError as e:
            raise CliError(str(e)) from None
    if as_json:
        return emit_json(r)
    out.print(f"Failing [bold]{r['start']}[/] (p = {p}): [bold red]{r['expected_affected']:.2f}[/] dependent modules expected to fail, "
              f"90th percentile {r['p90_affected']:g}, worst case {r['worst_case_affected']} · ~{r['expected_extra_hours']:g} extra incident hours\n")
    t = table("module", ("probability", "right"), ("fragility", "right"), "likely path")
    for m in r["modules"]:
        if m["probability"] > 0:
            path = m["likely_path"] if m["likely_path"] and m["likely_path"][-1] == m["module"] else m["likely_path"] + [m["module"]]
            t.add_row(m["module"], f"{100 * m['probability']:.1f}%", f"{m['fragility']:.2f}", " → ".join(path))
    out.print(t)
    if r.get("debts_in_path"):
        out.print("\n[bold]Debt on the failure paths:[/] " + ", ".join(f"{d['key']} ({d['module']})" for d in r["debts_in_path"]))
    if r.get("incident"):
        out.print(f"[green]✓ drill incident {r['incident']['key']} raised[/]")


@simulate_app.command("spike")
def sim_spike(event: Optional[str] = typer.Option(None, "--event", "-e", help="Situation key (default: the system's busiest day); see --list."),
              peak: Optional[float] = typer.Option(None, help="Custom spike: traffic multiplier at the peak."),
              start: int = typer.Option(20, help="Custom spike: start hour (0-23)."),
              hours: int = typer.Option(2, help="Custom spike: hours at the peak."),
              budget: float = typer.Option(40, "--budget", "-b", help="Hours available to fix things before the event."),
              runs: int = typer.Option(300), seed: int = typer.Option(17),
              live: bool = typer.Option(False, "--live", help="Play the day live: the customer's journey, modules and alerts, minute by minute."),
              side: bool = typer.Option(False, "--side", help="With --live: today and after the fixes side by side."),
              after: bool = typer.Option(False, "--after", help="With --live: play the day after the fixes."),
              speed: float = typer.Option(2.0, "--speed", min=0.25, max=8.0, help="With --live: playback speed."),
              no_freeze: bool = typer.Option(False, "--no-freeze", help="With --live: no frozen-screen effects."),
              report: bool = typer.Option(False, "--report", help="Print the full report: what happened, why, what to fix first, what next."),
              output: Optional[Path] = typer.Option(None, "--output", "-o", help="Also write the report to this text file."),
              list_: bool = typer.Option(False, "--list", help="List this system's situations and exit."),
              project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
              as_json: bool = JsonOpt):
    """Run a situation (a rush, bots, an outage, a bad release…) on a system: what fails, why, and what to fix first."""
    if live and as_json:
        raise CliError("--live draws in the terminal; leave out --json")
    src = Source(project, scenario, snapshot)
    if list_:
        evs = _events_of(src)
        if as_json:
            return emit_json(evs)
        return _situations_table(evs, getattr(src, "code", None) or (scenario or "<code>"))
    ev = {"peak": peak, "start_hour": start, "duration": hours} if peak else event
    with out.status(f"Simulating {runs} days of traffic…", spinner="dots") if not as_json else _null():
        if src.remote:
            r = src.api.post(src.path("/simulate/spike"), {"event": ev, "budget": budget, "runs": runs, "seed": seed})
        else:
            try:
                r = E.spike(src.snap(), ev, budget, runs, seed, src.params(), _playbook_edits(src))
            except ValueError as e:
                raise CliError(str(e)) from None
    rep = r.get("report") or E.spike_report(src.snap(), r)
    if output:
        output.write_text(REPORT.to_text(rep), encoding="utf-8")
    if as_json:
        return emit_json(r)
    if live:
        _live_spike(r, "side" if side else "after" if after else "before", speed, not no_freeze)
        out.print()
        _print_report(rep)
        if output:
            out.print(f"[dim]Report written to {output}[/]")
        return
    if report:
        _print_report(rep)
        if output:
            out.print(f"[dim]Report written to {output}[/]")
        return
    e = r["event"]
    out.print(f"[bold]{e['name']}[/] — peak {r['peak']:g}× normal traffic. {e.get('description', '')}\n")
    b, a = r["before"], r["after"]
    t = table("", ("incidents", "right"), ("engineer hours lost", "right"), ("failed requests", "right"),
              ("no incident at all", "right"), title=f"Expected over the day ({r['runs']} simulated days)")
    t.add_row("now", f"[red]{b['incidents']:.1f}[/]", f"[red]{b['hours_lost']:,.1f}[/]", f"[red]{b['failed_traffic_pct']}%[/]",
              f"{100 * b['p_no_incident']:.0f}%")
    t.add_row("after the fixes", f"[green]{a['incidents']:.1f}[/]", f"[green]{a['hours_lost']:,.1f}[/]",
              f"[green]{a['failed_traffic_pct']}%[/]", f"{100 * a['p_no_incident']:.0f}%")
    out.print(t)
    sv = r["saved_hours"]
    out.print(f"Saves [bold green]{sv['mean']:,.1f} h[/] (95% CI {sv['ci95'][0]:,.1f}–{sv['ci95'][1]:,.1f}), better in "
              f"{sv['better_runs']} of {sv['runs']} simulated days.")
    reg = r.get("regular_plan")
    if reg:
        out.print(f"[dim]The regular sprint plan would save {reg['saved_hours']['mean']:,.1f} h on this day.[/]")
    out.print()
    pl = r["plan"]
    t = table("fix first", "module", ("hours", "right"), ("protects", "right"), "playbook",
              title=f"What to fix before the event — {pl['hours_used']:g} of {budget:g} h")
    titles = r.get("playbook_titles") or {}
    for x in pl["selected"]:
        prot = (f"needed for {', '.join(x['prerequisite_of'])}" if x.get("prerequisite_of") and not x["protects_hours"]
                else f"{x['protects_hours']:,.1f} h")
        t.add_row(f"[cyan]{x['key']}[/] {x['title']}", x["module"], f"{x['principal']:g}", prot,
                  titles.get(x.get("playbook"), x.get("playbook") or ""))
    out.print(t if pl["selected"] else "[dim]No open debt changes the outcome of this event.[/]")
    out.print()
    t = table("module", ("peak load", "right"), ("P(incident)", "right"), "hour by hour (now)", ("after", "right"),
              title="Modules under the most pressure (load vs capacity; red ≥ 100%)")
    for m in r["modules"][:8]:
        t.add_row(m["module"], f"{100 * m['peak_utilisation_before']:.0f}%", f"{100 * m['p_incident_before']:.0f}%",
                  spark(m["utilisation_before"]), f"{100 * m['peak_utilisation_after']:.0f}% · {100 * m['p_incident_after']:.0f}%")
    out.print(t)
    out.print("[dim]Columns run 00:00 → 23:00. Load = traffic ÷ capacity left after open debt. "
              "Add --report for what happened, why and what to do next.[/]")
    if output:
        out.print(f"[dim]Report written to {output}[/]")


def _events_of(src: "Source") -> list[dict]:
    """The situations a source can run (its busiest day first)."""
    if src.remote:
        return src.api.get(src.path("/simulate/spike/events"))["events"]
    if getattr(src, "code", None):
        return SPIKE.events_for(SC.events(src.code))
    p = src.snap().get("project") or {}
    evs = [p["spike"], *(p.get("events") or [])] if isinstance(p.get("spike"), dict) else []
    return SPIKE.events_for(evs or (p.get("scenario") or ""))


def _print_report(rep: dict) -> None:
    """The end-of-run report, the same text as the website's report and its PDF."""
    width = max(72, min(110, out.width - 2))
    for line in REPORT.to_text(rep, width=width).splitlines():
        if line and line.isupper() and not line.startswith("─"):
            out.print(f"[bold]{escape(line)}[/]")
        elif line.startswith("DebtLens run report"):
            out.print(f"[bold cyan]{escape(line)}[/]")
        else:
            out.print(escape(line), soft_wrap=True)


def _live_spike(r: dict, mode: str, speed: float, effects: bool) -> None:
    from . import live as LIVE

    if mode == "side" and out.width < 120:
        out.print("[yellow]The terminal is narrower than 120 columns: playing today, then after the fixes.[/]")
        res = {**LIVE.run(r, out, "before", speed, effects), **LIVE.run(r, out, "after", speed, effects)}
    else:
        res = LIVE.run(r, out, mode, speed, effects)
    rp = r["replay"]
    out.print()
    for s, label in (("before", "Today, with the open debt"), ("after", "After the fixes")):
        tr = rp[s]
        played = f" (replay stopped at {res[s]['until']})" if s in res and not res[s]["finished"] else ""
        out.print(f"[bold]{label}[/]: {tr['total_hours_lost']:,.1f} engineer-hours lost, {tr['incidents']} incidents, "
                  f"worst hour {100 * max(tr['failed_share']):.0f}% of requests failing{played}.")
    keys = ", ".join(x["key"] for x in r["plan"]["selected"]) or "nothing"
    out.print(f"Fix before the event: [cyan]{keys}[/] ({r['plan']['hours_used']:g} h). Simulated day {rp['run'] + 1} of {r['runs']}; "
              f"on average the plan saves {r['saved_hours']['mean']:,.1f} h. The full report follows.")


@simulate_app.command("whatif")
def sim_whatif(lambda_churn: Optional[float] = typer.Option(None, help="λ₁ churn weight."),
               lambda_blast: Optional[float] = typer.Option(None, help="λ₂ blast-radius weight."),
               budgets: str = typer.Option("16,40,80", help="Comma-separated budgets."), project: Optional[int] = ProjectOpt,
               scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt, as_json: bool = JsonOpt):
    """Change the cost assumptions and see which debts change rank or cross break-even."""
    src = Source(project, scenario, snapshot)
    params = {k: v for k, v in {"lambda_churn": lambda_churn, "lambda_blast": lambda_blast}.items() if v is not None}
    bl = [float(b) for b in budgets.split(",") if b.strip()]
    r = src.api.post(src.path("/simulate/whatif"), {"params": params, "budgets": bl}) if src.remote else \
        E.whatif(src.snap(), params, bl, src.params())
    if as_json:
        return emit_json(r)
    b, a = r["summary_before"], r["summary_after"]
    out.print(f"interest {fmt_h(b['total_interest'])} → [bold]{fmt_h(a['total_interest'])}[/] /month · break-even {b['break_even_pct']}% → "
              f"[bold]{a['break_even_pct']}%[/] · flips: {', '.join(r['flips']) or 'none'}\n")
    t = table("debt", ("rank", "right"), ("interest", "right"), ("risk", "right"), title="Items that moved")
    for c in [c for c in r["changes"] if c["rank_before"] != c["rank_after"]][:12]:
        t.add_row(f"{c['key']} {c['title'][:44]}", f"{c['rank_before']} → {c['rank_after']}", f"{c['interest_before']:.1f} → {c['interest_after']:.1f}",
                  f"{c['risk_before']:.1f} → {c['risk_after']:.1f}")
    out.print(t)
    out.print()
    t = table(("budget", "right"), ("value before", "right"), ("value after", "right"), "selected after", title="Optimal plan by budget")
    for x in r["budget_curve"]:
        t.add_row(f"{x['budget']:g} h", f"{x['value_before']:.1f}", f"{x['value_after']:.1f}", " ".join(x["selected_after"]))
    out.print(t)


# ----------------------------------------------------------------------------- intake paths

@app.command()
def ingest(logfile: Path = typer.Argument(..., exists=True, dir_okay=False, help="Application log file."),
           min_severity: str = typer.Option("LOW", help="LOW, MEDIUM, HIGH or CRITICAL."),
           push: bool = typer.Option(False, "--push", help="Create the incidents in your website project."),
           project: Optional[int] = ProjectOpt, as_json: bool = JsonOpt):
    """Group error logs into incident candidates (signature = exception + masked message + top frame)."""
    text = logfile.read_text(encoding="utf-8", errors="replace")
    if push:
        api = Api()
        pid = project or load_config().get("project")
        if not (api.ready and pid):
            raise CliError("to --push, run `debtlens login` and pass --project (or `debtlens use <id>`)")
        r = api.post(f"/projects/{pid}/import/logs", {"text": text, "min_severity": min_severity, "dry_run": False})
        groups = r["groups"]
    else:
        parsed = ING.parse_logs(text)
        order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        floor = order.index(ING.norm_severity(min_severity) or "LOW")
        groups = [g for g in parsed["groups"] if order.index(g["severity"]) >= floor]
        r = {"lines": parsed["lines"], "events": parsed["events"]}
    if as_json:
        return emit_json({**r, "groups": groups})
    out.print(f"{r['lines']} lines → {r['events']} error events → [bold]{len(groups)} incident candidate(s)[/]\n")
    t = table("incident", "module", "severity", ("events", "right"), "first seen", "action" if push else "file")
    for g in groups:
        last = ({"create": "created " + str(g.get("created_key")), "count": f"added to {g.get('existing_key')}",
                 "recurred": f"[red]recurred[/] after {g.get('existing_key')} → {g.get('created_key')}"}.get(g.get("action"), "")
                if push else (g.get("file") or ""))
        t.add_row(g["title"][:70], g["module"], sev(g["severity"]), str(g["count"]), str(g.get("first_seen") or "")[:19], last)
    out.print(t)


@app.command("import")
def import_cmd(file: Path = typer.Argument(..., exists=True, dir_okay=False, help="CSV or JSON export (Jira, ServiceNow…)."),
               commit: bool = typer.Option(False, "--commit", help="Create them (default: preview only)."),
               project: Optional[int] = ProjectOpt):
    """Bring an existing defect backlog into a website project."""
    api = Api()
    pid = project or load_config().get("project")
    if not (api.ready and pid):
        raise CliError("import needs `debtlens login` and --project (or `debtlens use <id>`)")
    text = file.read_text(encoding="utf-8", errors="replace")
    body = {"format": "json" if file.suffix.lower() == ".json" else "csv", "dry_run": not commit}
    if body["format"] == "json":
        try:
            body["data"] = json.loads(text)
        except ValueError as e:
            raise CliError(f"invalid JSON: {e}") from None
    else:
        body["text"] = text
    r = api.post(f"/projects/{pid}/import/incidents", body)
    rows = r.get("would_create") if not commit else r.get("created")
    out.print(f"{'would create' if not commit else '[green]created[/]'} {len(rows)} · skipped {len(r['skipped'])} already imported")
    for e in r.get("errors") or []:
        out.print(f"[yellow]! {e}[/]")
    if not commit and rows:
        out.print("[dim]run again with --commit to create them[/]")


# ----------------------------------------------------------------------------- CI gate, reports

@app.command()
def ci(max_open_critical: int = typer.Option(0, help="Open critical incidents allowed."),
       max_regressions: Optional[int] = typer.Option(None, help="Regressions allowed in the window."),
       regression_days: int = typer.Option(30), max_break_even: Optional[int] = typer.Option(None),
       max_risk: Optional[float] = typer.Option(None), max_interest: Optional[float] = typer.Option(None),
       project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt,
       as_json: bool = JsonOpt):
    """Quality gate for CI pipelines: exit code 1 when any limit is crossed."""
    src = Source(project, scenario, snapshot, quiet=as_json)
    limits = {"max_open_critical": max_open_critical, "max_regressions": max_regressions, "regression_days": regression_days,
              "max_break_even": max_break_even, "max_risk": max_risk, "max_interest": max_interest}
    if src.remote:
        g = src.api.get(src.path("/gate"), **limits)
    else:
        g = local_gate(src, limits)
    if as_json:
        emit_json(g)
    else:
        for c in g["checks"]:
            mark = "[green]ok  [/]" if c["pass"] else "[bold red]FAIL[/]"
            lim = "no limit" if c["limit"] is None else f"limit {c['limit']:g}"
            out.print(f"{mark} {c['check']}: {c['value']:g} ({lim})")
        out.print("\n" + ("[bold green]PASS[/]" if g["pass"] else "[bold red]FAIL[/] — the build should stop here"))
    raise typer.Exit(0 if g["pass"] else 1)


def local_gate(src: Source, limits: dict) -> dict:
    from datetime import timedelta

    snap = src.snap()
    alpha, tau = src.alpha_tau()
    led = E.ledger(snap, src.params())
    open_rows = [r for r in led["rows"] if r["is_open"]]
    since = (E.reference_now(snap) - timedelta(days=limits["regression_days"])).isoformat()
    regs = [r for r in E.regressions(snap, tau, alpha, embedder())["regressions"] if r["reported_at"] >= since]
    values = [("open critical incidents", sum(1 for i in snap["incidents"] if i["severity"] == "CRITICAL" and i["status"] != "RESOLVED"),
               limits["max_open_critical"]),
              (f"regressions in the last {limits['regression_days']} days", len(regs), limits["max_regressions"]),
              ("debts past break-even", sum(1 for r in open_rows if r["break_even"]), limits["max_break_even"]),
              ("highest debt risk score", max((r["risk"] for r in open_rows), default=0), limits["max_risk"]),
              ("monthly interest (hours)", led["summary"]["total_interest"], limits["max_interest"])]
    checks = [{"check": n, "value": v, "limit": lim, "pass": lim is None or v <= lim} for n, v, lim in values]
    return {"pass": all(c["pass"] for c in checks), "checks": checks}


@app.command()
def report(out_file: Path = typer.Option(Path("debtlens-report.pdf"), "--out", "-o"), budget: float = typer.Option(40),
           project: Optional[int] = ProjectOpt, scenario: Optional[str] = ScenarioOpt, snapshot: Optional[Path] = SnapshotOpt):
    """Download (or, offline, build) the PDF report."""
    src = Source(project, scenario, snapshot)
    if src.remote:
        data = src.api.download(src.path(f"/report.pdf?budget={budget}"))
    else:
        try:
            from ..api.routes.reports import build_pdf, plan_guides
        except ImportError:
            raise CliError('offline PDF reports need the server extras: pip install "debtlens[server]"') from None
        snap = src.snap()
        alpha, _ = src.alpha_tau()
        bundle = E.similarity_bundle(snap, alpha, embedder())
        led = E.ledger(snap, src.params())
        plan = E.plan(snap, budget, src.params(), led=led)
        done = {d["id"]: d.get("playbook_steps_done") or [] for d in snap.get("debts") or []}
        data = build_pdf(snap["project"]["name"], "debtlens CLI", E.dashboard(snap, src.params(), bundle=bundle), led,
                         plan, E.causal_graph(snap), budget, bundle.semantic_method,
                         plan_guides(snap, plan, _playbook_edits(src), None, done))
    out_file.write_bytes(data)
    out.print(f"[green]✓ wrote {out_file}[/] ({len(data) // 1024} KB)")


@app.command()
def export(out_file: Path = typer.Option(Path("debtlens-snapshot.json"), "--out", "-o"), project: Optional[int] = ProjectOpt,
           scenario: Optional[str] = ScenarioOpt):
    """Save a project (or scenario) as a JSON snapshot for offline analysis (`debtlens analyse`)."""
    src = Source(project, scenario, None)
    snap = src.snap()
    for i in snap.get("incidents") or []:
        i.pop("embedding", None)
    for c in snap.get("causes") or []:
        c.pop("embedding", None)
    snap.setdefault("format", "debtlens-snapshot/1")
    out_file.write_text(json.dumps(snap, indent=1, default=str), encoding="utf-8")
    out.print(f"[green]✓ wrote {out_file}[/] — {len(snap['incidents'])} incidents, {len(snap['debts'])} debts")


# ----------------------------------------------------------------------------- account

@app.command()
def login(url: str = typer.Argument(..., help="Website address, e.g. https://debtlens-bec.vercel.app"),
          token: Optional[str] = typer.Option(None, "--token", "-t", help="API token from Team & settings (dlt_…)."),
          email: Optional[str] = typer.Option(None, help="Sign in with email + password instead (creates a token)."),
          project: Optional[int] = ProjectOpt):
    """Connect the CLI to a DebtLens website."""
    url = url.rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    if not token:
        if not email:
            email = typer.prompt("Email")
        pw = typer.prompt("Password", hide_input=True)
        s = Api(url, token="").post("/auth/login", {"email": email, "password": pw})
        import platform

        t = Api(url, s["token"]).post("/auth/tokens", {"name": f"debtlens CLI ({platform.node() or 'computer'})"[:80]})
        token = t["token"]
    me = Api(url, token).get("/auth/me")
    if me["principal"]["kind"] != "user":
        raise CliError("that is a sandbox token — the CLI needs an API token from a real account")
    cfg = load_config()
    cfg.update({"url": url, "token": token})
    if project:
        cfg["project"] = project
    path = save_config(cfg)
    out.print(f"[green]✓ signed in to {url} as {me['principal']['name']} ({me['principal']['role_label']}, {me['org']['name']})[/]")
    out.print(f"[dim]token saved in {path}[/]")
    if not cfg.get("project"):
        out.print("next: [bold]debtlens projects[/] then [bold]debtlens use <id>[/]")


@app.command()
def logout():
    """Forget the saved URL and token."""
    cfg = load_config()
    for k in ("token", "url", "project"):
        cfg.pop(k, None)
    save_config(cfg)
    out.print("signed out")


@app.command()
def whoami():
    """Show who the CLI is signed in as."""
    api = Api()
    if not api.ready:
        out.print("not signed in (offline mode)")
        return
    me = api.get("/auth/me")
    cfg = load_config()
    out.print(f"{me['principal']['name']} · {me['principal']['role_label']} · {me['org']['name']} · {api.url}"
              + (f" · default project {cfg['project']}" if cfg.get("project") else ""))


@app.command()
def projects(as_json: bool = JsonOpt):
    """List the projects of your team."""
    rows = Api().get("/projects")["projects"]
    if as_json:
        return emit_json(rows)
    default = load_config().get("project")
    t = table(("id", "right"), "name", "key", ("open incidents", "right"), ("open debts", "right"), "")
    for p in rows:
        t.add_row(str(p["id"]), p["name"], p["key"], str(p["counts"]["open_incidents"]), str(p["counts"]["open_debts"]),
                  "[green]default[/]" if p["id"] == default else "")
    out.print(t)


@app.command()
def use(project_id: int = typer.Argument(..., help="Project id from `debtlens projects`.")):
    """Set the default website project for later commands."""
    p = Api().get(f"/projects/{project_id}")["project"]
    cfg = load_config()
    cfg["project"] = project_id
    save_config(cfg)
    out.print(f"[green]✓ default project: {p['name']} ({p['key']})[/]")


# ----------------------------------------------------------------------------- model & server

@model_app.command("download")
def model_download():
    """Download all-MiniLM-L6-v2 (≈23 MB, once) from the official Hugging Face repository."""
    with out.status("Downloading the MiniLM model…", spinner="dots"):
        d = EMB.ensure_model(download=True)
    if d is None:
        raise CliError(f"download failed: {EMB.status().get('error')}")
    m = EMB.get_embedder(download=False)
    if m is None:
        raise CliError('model downloaded but could not load — install the ML extras: pip install "debtlens[ml]"')
    out.print(f"[green]✓ MiniLM ready[/] in {d}")


@model_app.command("status")
def model_status():
    """Is semantic similarity available?"""
    m = EMB.get_embedder(download=False)
    s = EMB.status()
    out.print(("[green]MiniLM available[/]" if m else "[yellow]MiniLM not available — char n-gram fallback[/]") + f"  [dim]{s.get('path')}[/]")
    if not m and s.get("error"):
        out.print(f"[dim]{s['error']}[/]")


@app.command()
def serve(host: str = typer.Option("127.0.0.1"), port: int = typer.Option(8000),
          db: Optional[str] = typer.Option(None, help="Database URL, e.g. mysql+pymysql://user:pass@localhost/debtlens (default: SQLite file)."),
          warm: bool = typer.Option(True, help="Load the MiniLM model and cache scenario vectors at start.")):
    """Run the whole DebtLens website locally — the offline demo (MySQL 8 or SQLite)."""
    try:
        from ..api import create_app
        from ..api import db as DB
    except ImportError:
        raise CliError('the website needs the server extras: pip install "debtlens[server]"') from None
    url = db or os.environ.get("DATABASE_URL") or f"sqlite:///{(config_dir() / 'debtlens-local.db').as_posix()}"
    config_dir().mkdir(parents=True, exist_ok=True)
    flask_app = create_app(url)
    with flask_app.app_context():
        DB.init_db()
        info = DB.ping()
    out.print(f"[bold]DebtLens {__version__}[/] · database: {info.get('dialect')} {info.get('version', '')}")
    if warm:
        with flask_app.test_client() as c:
            w = c.get("/api/v1/health?warm=1").get_json().get("warm") or {}
        out.print("[green]MiniLM ready[/]" if w.get("model") else "[yellow]MiniLM not available — char n-gram fallback[/]")
    out.print(f"open [bold cyan]http://{host}:{port}[/]  (Ctrl+C to stop)")
    try:
        from waitress import serve as wserve  # optional production-grade server
        wserve(flask_app, host=host, port=port, threads=8)
    except ImportError:
        flask_app.run(host=host, port=port, threaded=True)


if __name__ == "__main__":
    run()
