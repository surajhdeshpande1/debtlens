"""Situations (Simulation Lab → "Run a scenario"): one day in the life of a system, hour by hour.

A situation is a day: its traffic over 24 hours (a rush, a sale, an ordinary weekday) plus whatever else goes wrong
that day: a bot attack, a provider outage, a bad deploy, a database failover, a cache stampede, a memory leak or a
lost cloud zone. The load flows along the dependency graph: if checkout depends on the database, the database sees
checkout's traffic too.

For module m in hour t, with the day's traffic multiplier M(t):

    load        L(m, t) = u0(m) · (1 + (M(t) − 1) · e(m) + R(t) · entry(m))
                          u0 = utilisation at a normal peak hour, e = exposure to the day's traffic (0..1),
                          R  = extra load at the edge from turning blocked bots away
    capacity    C(m, t) = Π (1 − capacity(d)) over open debts d in m  ×  Π situation capacity factors at t
    utilisation ρ = L / C

No real day goes exactly to forecast. Each simulated day r has its own turnout k (log-normal around 1, σ = 0.15) and
each module its own capacity on the day ε (σ = 0.05), so a module overloads in hour t with probability

    P(overload) = 1 / (1 + exp(−(ρ · k / ε − 1) / 0.05))

An overloaded module stays down until its utilisation falls below 0.9. While a module is down, each module that
depends on it fails with probability p · fragility, where fragility = 0.25 + Σ resilience(d) of the caller's open
debts (capped at 0.95): missing timeouts or circuit breakers let a failure spread.

Situations add two kinds of effect, each softened by the debts that guard against it:
  · capacity: a module (or every module) keeps only a share of its capacity for some hours, all at once or
    declining hour by hour (a leak). Fixing a guarding debt removes most of the loss.
  · down: a module is forced down for some hours (the provider stops answering, a release breaks it). Fixing a
    guarding debt lowers the chance that it happens at all (a canary catches the release, a fallback provider takes
    over).
Bots in an attack are blocked once their debt is fixed, but a fifth of them get through anyway (new addresses,
solved CAPTCHAs) and turning the rest away still costs the edge a tenth of serving them.

Some incidents have nothing to do with the day: every module has a small background fault rate taken from its own
incident history, higher when it is busy. They keep a well-prepared day from looking impossibly perfect.

Each module that goes down is one incident costing w(severity) · mean effort of that module's past incidents, the same
cost as in the interest model. Monte Carlo over many days gives expected incidents, engineering hours lost and the
share of traffic that hit a failed module. Every configuration uses the same random numbers (common random numbers),
so "before" and "after" differ only by the fixes. To decide what to fix before the day, every combination of fixes on
a module is valued by simulation, and an exact multiple-choice knapsack picks one combination per module within the
hours available (see ``plan_fixes``).
"""

from __future__ import annotations

import math
import random
import statistics
import time
import zlib
from dataclasses import dataclass, field


HOURS = 24
SLOPE = 0.05
RECOVER = 0.90
BASE_FRAGILITY = 0.25
DEFAULT_BASELINE = 0.15
MAX_PER_MODULE = 4          # fix combinations are enumerated per module, up to this many candidate debts
SEVERITY_WEIGHT = {"CRITICAL": 3.5, "HIGH": 2.5, "MEDIUM": 1.5, "LOW": 1.0}
DAY_SIGMA = 0.15            # turnout on the day around the forecast (log-normal)
CAPACITY_SIGMA = 0.05       # each module's capacity on the day around its usual value
BOT_ADAPT = 0.20            # share of blocked bots that get through anyway
REJECT_COST = 0.10          # turning a bot away still costs the edge a tenth of serving it
FAULT_STRESS = 3.0          # background faults per hour: rate × (1 + 3 · min(ρ, 1.5))
FAULT_WINDOW_DAYS = 180     # background fault rate: a module's incidents over this window
INCIDENT_KINDS = ("overload", "cascade", "outage", "deploy", "fault")
SITUATION_KINDS = ("traffic", "bots", "outage", "deploy", "database", "cache", "leak", "zone", "retry")

# --------------------------------------------------------------------------- presets

PRESETS: dict[str, dict] = {
    "fintech": {
        "key": "salary-day", "name": "Salary day", "kind": "traffic",
        "description": "On the 1st of the month salaries land and UPI and card payments peak at four times a "
                       "normal busy hour through the morning, with a second rush in the evening.",
        "profile": [0.5, 0.4, 0.4, 0.4, 0.5, 0.8, 1.6, 2.6, 3.6, 4.0, 4.0, 3.6,
                    3.2, 2.8, 2.4, 2.2, 2.2, 2.6, 3.0, 3.2, 2.8, 2.2, 1.6, 1.0],
        "entry": {"checkout": 1.0, "gateway": 1.0, "webhooks": 0.8, "auth": 0.6, "settlement": 0.5, "reporting": 0.3},
        "baseline": {"db": 0.22, "gateway": 0.20, "checkout": 0.18, "ledger": 0.16, "auth": 0.12, "webhooks": 0.18,
                     "risk": 0.15, "settlement": 0.15, "reporting": 0.15},
    },
    "healthtech": {
        "key": "opd-rush", "name": "Monday morning OPD rush", "kind": "traffic",
        "description": "Monday's outpatient registrations, token SMS, consultations, lab orders and pharmacy "
                       "billing peak at three and a half times a normal hour between 8 and 11 am.",
        "profile": [0.3, 0.3, 0.3, 0.3, 0.4, 0.6, 1.2, 2.2, 3.2, 3.5, 3.4, 3.0,
                    2.4, 1.8, 1.8, 1.6, 1.4, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.4],
        "entry": {"appointments": 1.0, "identity": 0.9, "notify": 0.8, "emr": 0.7, "billing": 0.6, "lab": 0.5,
                  "pharmacy": 0.5, "vitals": 0.1},
        "baseline": {"db": 0.24, "hl7": 0.22, "appointments": 0.24, "identity": 0.18, "emr": 0.18, "notify": 0.20,
                     "lab": 0.15, "pharmacy": 0.14, "billing": 0.15, "vitals": 0.20},
    },
    "ecommerce": {
        "key": "diwali-sale", "name": "Diwali sale", "kind": "traffic",
        "description": "Traffic runs two to three times higher all day and jumps to eight times a normal peak when "
                       "the flash sale opens at 8 pm.",
        "profile": [1.2, 0.9, 0.7, 0.6, 0.6, 0.8, 1.2, 1.6, 2.0, 2.2, 2.4, 2.4,
                    2.4, 2.4, 2.4, 2.6, 2.8, 3.0, 3.6, 4.5, 8.0, 6.5, 4.5, 3.0],
        "entry": {"catalog": 1.0, "search": 1.0, "cart": 1.0, "checkout": 0.9, "notifications": 0.6,
                  "warehouse": 0.3, "delivery": 0.2},
        "baseline": {"catalog": 0.10, "search": 0.11, "cart": 0.09, "checkout": 0.09, "payments": 0.09,
                     "inventory": 0.11, "orders": 0.09, "notifications": 0.10, "warehouse": 0.12, "delivery": 0.10},
    },
    "college": {
        "key": "results-day", "name": "Exam results day", "kind": "traffic",
        "description": "Results are published at 10 am: every student and parent logs in within the hour, twelve "
                       "times a normal peak, while the SMS blast goes out.",
        "profile": [0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.2, 1.8, 2.5, 12.0, 8.0,
                    5.0, 3.5, 2.6, 2.2, 2.0, 1.8, 1.6, 1.6, 1.4, 1.2, 0.8, 0.5],
        "entry": {"results": 1.0, "auth": 1.0, "notifications": 0.8, "fees": 0.1, "attendance": 0.05,
                  "timetable": 0.05},
        "exposure": {"exams": 0.3, "attendance": 0.05, "timetable": 0.05, "reports": 0.0, "library": 0.0,
                     "admissions": 0.0, "fees": 0.1},
        "baseline": {"results": 0.06, "auth": 0.06, "notifications": 0.06, "exams": 0.05, "db": 0.07,
                     "attendance": 0.15, "fees": 0.10, "timetable": 0.10, "reports": 0.12, "library": 0.05,
                     "admissions": 0.08},
    },
}

# An ordinary weekday: quiet at night, a morning and an evening peak at the normal busy hour (1×).
WEEKDAY = [0.25, 0.2, 0.15, 0.15, 0.2, 0.3, 0.45, 0.65, 0.85, 0.95, 1.0, 1.0,
           0.95, 0.9, 0.85, 0.85, 0.9, 0.95, 1.0, 1.0, 0.9, 0.7, 0.5, 0.35]


def custom_profile(peak: float, start_hour: int, duration: int, ramp: int = 1, base: float = 1.0) -> list[float]:
    """A 24-hour multiplier curve: ``base`` outside the event, ``peak`` for ``duration`` hours, linear ramps."""
    peak = max(1.0, min(50.0, float(peak)))
    start = int(start_hour) % HOURS
    duration = max(1, min(HOURS, int(duration)))
    ramp = max(0, min(6, int(ramp)))
    prof = [float(base)] * HOURS
    for k in range(-ramp, duration + ramp):
        h = start + k
        if not 0 <= h < HOURS:
            continue
        if k < 0:
            v = base + (peak - base) * (ramp + k + 1) / (ramp + 1)
        elif k >= duration:
            v = base + (peak - base) * (duration + ramp - k) / (ramp + 1)
        else:
            v = peak
        prof[h] = max(prof[h], round(v, 2))
    return prof


def kind_of(event: dict | None) -> str:
    if not event:
        return "traffic"
    k = event.get("kind")
    if k in SITUATION_KINDS:
        return k
    return "bots" if event.get("bots") else "traffic"


def events_for(scenario: str | dict | list | None) -> list[dict]:
    """Situations offered for a project (its scenario's or pack's events, if any) plus the custom template."""
    out = []
    if isinstance(scenario, list):
        presets = [p for p in scenario if isinstance(p, dict)]
    else:
        p = scenario if isinstance(scenario, dict) else PRESETS.get(scenario or "")
        presets = [p] if p else []
    for p in presets:
        ev = {k: p[k] for k in ("key", "name", "description", "profile")}
        ev |= {"peak": max(p["profile"]), "peak_hour": p["profile"].index(max(p["profile"])), "preset": True,
               "kind": kind_of(p)}
        if p.get("effects"):
            ev["effects"] = [{k: e.get(k) for k in ("type", "module", "start", "hours", "label")} for e in p["effects"]]
        out.append(ev)
    out.append({"key": "custom", "name": "Custom spike", "preset": False, "kind": "traffic",
                "description": "Choose the peak multiplier, the hour it starts and how long it lasts.",
                "profile": custom_profile(5, 20, 2), "peak": 5, "peak_hour": 20})
    return out


# --------------------------------------------------------------------------- model

def exposure(modules: list[str], deps: list[tuple[str, str]], entry: dict[str, float],
             fixed: dict[str, float] | None = None) -> dict[str, float]:
    """Event traffic reaching each module: a callee sees at least as much of the spike as its busiest caller.

    ``fixed`` pins the exposure of modules a preset knows better (on results day the marks are read from
    precomputed results, so attendance behind them sees almost none of the spike); pinned values do not spread."""
    fixed = {m: max(0.0, min(1.0, float(v))) for m, v in (fixed or {}).items() if m in modules}
    e = {m: 0.0 for m in modules}
    for m, w in entry.items():
        if m in e:
            e[m] = max(e[m], max(0.0, min(1.0, float(w))))
    for _ in range(len(modules) + 1):
        changed = False
        for caller, callee in deps:
            if caller in e and callee in e and callee not in fixed and e[caller] > e[callee] + 1e-12:
                e[callee] = e[caller]
                changed = True
        if not changed:
            break
    e.update(fixed)
    return e


def default_entry(modules: list[str], deps: list[tuple[str, str]]) -> dict[str, float]:
    """Without a preset, users enter through modules nothing else depends on (or everywhere, in a cycle)."""
    called = {b for _, b in deps}
    tops = [m for m in modules if m not in called]
    return {m: 1.0 for m in (tops or modules)}


def p_overload(rho: float) -> float:
    x = (rho - 1.0) / SLOPE
    if x < -40:
        return 0.0
    if x > 40:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def make_effects(raw: list[dict] | None, modules: list[str], debt_ids: dict[str, int], kind: str = "outage") -> list[dict]:
    """Situation effects in model form: module indices, hours, and the debts (by id) that guard against them."""
    out = []
    for e in raw or []:
        if not isinstance(e, dict):
            continue
        target = e.get("module") or "*"
        idx = list(range(len(modules))) if target == "*" else [modules.index(target)] if target in modules else []
        if not idx:
            continue
        start = int(e.get("start", 0)) % HOURS
        hours = max(1, min(HOURS - start, int(e.get("hours", 1))))
        typ = "down" if e.get("type") == "down" else "capacity"
        chance = max(0.0, min(1.0, float(e.get("chance", 1.0))))
        factor = max(0.02, min(1.0, float(e.get("factor", 0.5))))
        keys = [k for k in e.get("mitigated_by") or () if k in debt_ids]
        out.append({
            "type": typ, "module": target, "mods": idx, "start": start, "end": start + hours, "hours": hours,
            "at": max(0, min(59, int(e.get("minute", 5)))), "ramp": bool(e.get("ramp")) and typ == "capacity",
            "chance0": chance, "chance": chance, "factor0": factor, "factor": factor,
            "mitigation": max(0.0, min(1.0, float(e.get("mitigation", 0.8)))),
            "by": {debt_ids[k] for k in keys}, "by_keys": keys, "mitigated": False,
            "kind": e.get("kind") if e.get("kind") in ("outage", "deploy") else ("deploy" if kind == "deploy" else "outage"),
            "label": str(e.get("label") or ""), "prevented": str(e.get("prevented") or ""),
            "recovered": str(e.get("recovered") or ""),
        })
    return out


@dataclass
class Model:
    modules: list[str]
    deps: list[tuple[str, str]]
    baseline: dict[str, float]
    exposure: dict[str, float]
    entry: dict[str, float]
    cost: dict[str, float]
    severity: dict[str, str]
    profile: list[float]
    p_cascade: float = 0.6
    bots: dict | None = None   # {"share": s, "blocked": b, "mitigated_by": {debt ids}}: bot traffic a fix can block
    effects: list[dict] = field(default_factory=list)       # situation effects, from make_effects
    fault_rate: dict[str, float] = field(default_factory=dict)  # background faults per module-hour at rest
    edge: list[float] | None = None   # extra load at the entry modules from turning blocked bots away
    dependents: dict[int, list[tuple[int, int]]] = field(default_factory=dict)
    edges: list[tuple[int, int]] = field(default_factory=list)

    def __post_init__(self):
        ix = {m: i for i, m in enumerate(self.modules)}
        self.edges = [(ix[callee], ix[caller]) for caller, callee in self.deps if caller in ix and callee in ix]
        self.dependents = {i: [] for i in range(len(self.modules))}
        for e, (x, y) in enumerate(self.edges):
            self.dependents[x].append((e, y))

    def load(self, m: str, t: int) -> float:
        extra = self.edge[t] * self.entry.get(m, 0.0) if self.edge else 0.0
        return self.baseline[m] * (1.0 + (self.profile[t] - 1.0) * self.exposure[m] + extra)

    def mitigated(self, fixed) -> bool:
        """Whether ``fixed`` includes a debt that blocks this event's bots."""
        return bool(self.bots and set(self.bots.get("mitigated_by") or ()) & set(fixed or ()))

    def blockers(self) -> set:
        """Debts that soften this situation directly: they block its bots or guard against its effects."""
        out = set((self.bots or {}).get("mitigated_by") or ())
        for e in self.effects:
            out |= e["by"]
        return out

    def for_fixed(self, fixed) -> "Model":
        """The same day as experienced after ``fixed``: blocked bots, softened effects."""
        fixed = set(fixed or ())
        bots, prof, edge, changed = self.bots, self.profile, self.edge, False
        if self.mitigated(fixed):
            cut = max(0.0, min(1.0, float(self.bots.get("share", 0)) * float(self.bots.get("blocked", 0))
                               * (1.0 - BOT_ADAPT)))
            prof = [1.0 + (m - 1.0) * (1.0 - cut) if m > 1.0 else m for m in self.profile]
            edge = [(m - 1.0) * cut * REJECT_COST if m > 1.0 else 0.0 for m in self.profile]
            bots, changed = None, True
        effects = []
        for e in self.effects:
            if not e["mitigated"] and e["by"] & fixed:
                m = e["mitigation"]
                e = dict(e, mitigated=True, chance=e["chance0"] * (1.0 - m), factor=1.0 - (1.0 - e["factor0"]) * (1.0 - m))
                changed = True
            effects.append(e)
        if not changed:
            return self
        return Model(self.modules, self.deps, self.baseline, self.exposure, self.entry, self.cost, self.severity,
                     prof, self.p_cascade, bots, effects, self.fault_rate, edge)


def capacities(model: Model, open_debts: list[dict], factors: dict, fixed: set) -> tuple[list[float], list[float]]:
    """Effective capacity and fragility per module, given which debts are fixed."""
    cap = {m: 1.0 for m in model.modules}
    res = {m: 0.0 for m in model.modules}
    for d in open_debts:
        if d["id"] in fixed or d["module"] not in cap:
            continue
        c, r = factors.get(d["id"], (0.0, 0.0))
        cap[d["module"]] *= (1.0 - c)
        res[d["module"]] += r
    caps = [max(0.05, cap[m]) for m in model.modules]
    frag = [min(0.95, BASE_FRAGILITY + res[m]) for m in model.modules]
    return caps, frag


@dataclass
class Draws:
    """Common random numbers: the same day, turnout and luck for every configuration being compared."""
    thr: list      # runs × hours × modules: a module overloads when its utilisation passes this threshold
    rec: list      # runs × modules: an overloaded module recovers below this utilisation
    fault: list    # runs × hours × modules: uniforms for background faults
    edge: list     # runs × hours × edges: uniforms for cascades
    effect: list   # runs × effects: uniforms deciding whether a forced outage happens
    day: list      # runs: the day's turnout against the forecast

    @classmethod
    def make(cls, runs: int, n_mod: int, n_edge: int, seed: int, n_eff: int = 0) -> "Draws":
        thr, rec, fault, edg, eff, day = [], [], [], [], [], []
        for r in range(runs):
            rng = random.Random(seed * 7919 + r)
            k = math.exp(rng.gauss(0.0, DAY_SIGMA) - DAY_SIGMA ** 2 / 2)
            scale = [math.exp(rng.gauss(0.0, CAPACITY_SIGMA) - CAPACITY_SIGMA ** 2 / 2) / k for _ in range(n_mod)]
            rows = []
            for _ in range(HOURS):
                row = []
                for i in range(n_mod):
                    u = min(max(rng.random(), 1e-12), 1.0 - 1e-12)
                    # P(overload) = logistic((ρ·k/ε − 1)/SLOPE) <=> overload when ρ > (1 + SLOPE·logit(u))·ε/k
                    row.append((1.0 + SLOPE * math.log(u / (1.0 - u))) * scale[i])
                rows.append(row)
            thr.append(rows)
            rec.append([RECOVER * s for s in scale])
            fault.append([[rng.random() for _ in range(n_mod)] for _ in range(HOURS)])
            edg.append([[rng.random() for _ in range(n_edge)] for _ in range(HOURS)])
            eff.append([rng.random() for _ in range(n_eff)])
            day.append(k)
        return cls(thr, rec, fault, edg, eff, day)


def _rho(model: Model, caps: list[float]) -> list[list[float]]:
    n = len(model.modules)
    capmul = [[1.0] * HOURS for _ in range(n)]
    for e in model.effects:
        if e["type"] != "capacity":
            continue
        span = e["end"] - e["start"]
        for t in range(e["start"], e["end"]):
            f = e["factor"] if not e["ramp"] else 1.0 - (1.0 - e["factor"]) * (t - e["start"] + 1) / span
            for i in e["mods"]:
                capmul[i][t] *= f
    return [[model.load(m, t) / max(0.02, caps[i] * capmul[i][t]) for t in range(HOURS)]
            for i, m in enumerate(model.modules)]


def _simulate(model: Model, caps: list[float], frag: list[float], draws: Draws, runs: int,
              trace_run: int | None = None) -> dict:
    """Monte Carlo over ``runs`` days. With ``trace_run``, only that run is simulated and recorded hour by hour."""
    n = len(model.modules)
    rho = _rho(model, caps)
    p_edge = [min(0.95, model.p_cascade * frag[y]) for _, y in model.edges]
    cost = [model.cost.get(m, 6.0) for m in model.modules]
    share = [model.entry.get(m, 0.0) for m in model.modules]
    total_share = sum(share) or 1.0
    total_traffic = sum(model.profile) * total_share
    rate = [model.fault_rate.get(m, 0.0) for m in model.modules]
    p_fault = [[rate[i] * (1.0 + FAULT_STRESS * min(1.5, rho[i][t])) for t in range(HOURS)] for i in range(n)]
    forced_at: list[list[list[int]]] = [[[] for _ in range(n)] for _ in range(HOURS)]
    for k, e in enumerate(model.effects):
        if e["type"] == "down":
            for t in range(e["start"], e["end"]):
                for i in e["mods"]:
                    forced_at[t][i].append(k)
    hours_lost, incidents, failed_share = [], [], []
    inc_by_mod = [0] * n
    down_hours = [[0] * HOURS for _ in range(n)]
    kind_hours = {k: 0.0 for k in INCIDENT_KINDS}
    kind_count = {k: 0 for k in INCIDENT_KINDS}
    effect_hits = [0] * len(model.effects)
    trace = None
    for r in ([trace_run] if trace_run is not None else range(runs)):
        thr, rec, fu, ue, uf = draws.thr[r], draws.rec[r], draws.fault[r], draws.edge[r], draws.effect[r]
        active = [e["type"] == "down" and uf[k] < e["chance"] for k, e in enumerate(model.effects)]
        for k, a in enumerate(active):
            if a:
                effect_hits[k] += 1
        down = [0] * n
        why = [""] * n
        prev = [False] * n
        lost = n_inc = 0.0
        traffic_lost = 0.0
        hit = [False] * n
        if trace_run is not None:
            trace = {"states": [], "failed_share": [], "hours_lost": [], "events": [], "cause": [], "kinds": []}
            for k, e in enumerate(model.effects):
                if e["type"] == "capacity":
                    trace["events"].append({"hour": e["start"], "at": e["at"], "kind": "situation", "module": e["module"],
                                            "effect": "capacity", "label": e["label"], "mitigated": e["mitigated"],
                                            "factor": round(e["factor"], 2), "hours": e["hours"]})
                    if e["end"] < HOURS:
                        trace["events"].append({"hour": e["end"], "at": 0, "kind": "situation_end", "module": e["module"],
                                                "label": e["recovered"] or "Capacity back to normal"})
                elif active[k]:
                    trace["events"].append({"hour": e["start"], "at": e["at"], "kind": "situation", "module": e["module"],
                                            "effect": "down", "label": e["label"], "mitigated": e["mitigated"],
                                            "hours": e["hours"]})
                elif e["mitigated"] and uf[k] < e["chance0"]:
                    trace["events"].append({"hour": e["start"], "at": e["at"], "kind": "prevented", "module": e["module"],
                                            "label": e["prevented"] or "A fix kept this from happening"})
        for t in range(HOURS):
            cause = [None] * n
            forced = [None] * n
            for i in range(n):
                for k in forced_at[t][i]:
                    if active[k]:
                        forced[i] = model.effects[k]["kind"]
                        break
            for i in range(n):
                if down[i] == 2 or (down[i] == 1 and forced[i] is None and rho[i][t] < rec[i]):
                    down[i] = 0
            for i in range(n):
                if down[i] == 0:
                    if forced[i]:
                        down[i], why[i] = 1, forced[i]
                    elif rho[i][t] > thr[t][i]:
                        down[i], why[i] = 1, "overload"
                    elif fu[t][i] < p_fault[i][t]:
                        down[i], why[i] = 1, "fault"
            stack = [i for i in range(n) if down[i]]
            while stack:
                x = stack.pop()
                for e, y in model.dependents[x]:
                    if down[y] == 0 and ue[t][e] < p_edge[e]:
                        down[y], why[y] = 2, "cascade"
                        cause[y] = model.modules[x]
                        stack.append(y)
            out_now = 0.0
            for i in range(n):
                if down[i]:
                    down_hours[i][t] += 1
                    out_now += share[i]
                    if not prev[i]:
                        n_inc += 1
                        lost += cost[i]
                        hit[i] = True
                        kind_hours[why[i]] += cost[i]
                        kind_count[why[i]] += 1
                        if trace is not None:
                            trace["events"].append({"hour": t, "module": model.modules[i], "kind": why[i],
                                                    "from": cause[i], "utilisation": round(rho[i][t], 3),
                                                    "severity": model.severity.get(model.modules[i], "MEDIUM"),
                                                    "cost_hours": round(cost[i], 1)})
                    prev[i] = True
                else:
                    if trace is not None and prev[i]:  # down last hour, up for the whole of this one
                        trace["events"].append({"hour": t, "module": model.modules[i], "kind": "recovered"})
                    prev[i] = False
            traffic_lost += model.profile[t] * min(out_now, total_share)
            if trace is not None:
                trace["states"].append(list(down))
                trace["failed_share"].append(round(min(1.0, out_now / total_share), 3))
                trace["hours_lost"].append(round(lost, 1))
                trace["cause"].append(cause)
                trace["kinds"].append([why[i] if down[i] else None for i in range(n)])
        for i in range(n):
            if hit[i]:
                inc_by_mod[i] += 1
        hours_lost.append(lost)
        incidents.append(n_inc)
        failed_share.append(traffic_lost / total_traffic if total_traffic else 0.0)
    if trace is not None:
        trace["total_hours_lost"] = round(lost, 1)
        trace["incidents"] = int(n_inc)
        trace["failed_traffic_pct"] = round(100 * failed_share[-1], 1)
        trace["turnout"] = round(draws.day[trace_run], 3)
        return {"trace": trace, "rho": rho}
    return {"rho": rho, "hours_lost": hours_lost, "incidents": incidents, "failed_share": failed_share,
            "inc_by_mod": inc_by_mod, "down_hours": down_hours, "runs": runs,
            "kind_hours": kind_hours, "kind_count": kind_count, "effect_hits": effect_hits}


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    return s[min(len(s) - 1, max(0, int(math.ceil(q * len(s))) - 1))]


def _summary(sim: dict) -> dict:
    runs = sim["runs"]
    return {
        "incidents": round(statistics.mean(sim["incidents"]), 2),
        "incidents_p90": _pct(sim["incidents"], 0.9),
        "hours_lost": round(statistics.mean(sim["hours_lost"]), 1),
        "hours_lost_p10": round(_pct(sim["hours_lost"], 0.1), 1),
        "hours_lost_p90": round(_pct(sim["hours_lost"], 0.9), 1),
        "failed_traffic_pct": round(100 * statistics.mean(sim["failed_share"]), 1),
        "p_any_user_outage": round(sum(1 for x in sim["failed_share"] if x > 0) / runs, 3),
        "p_no_incident": round(sum(1 for x in sim["incidents"] if x == 0) / runs, 3),
        "by_kind": {k: {"incidents": round(sim["kind_count"][k] / runs, 2), "hours": round(sim["kind_hours"][k] / runs, 1)}
                    for k in INCIDENT_KINDS},
    }


def _paired(a: list[float], b: list[float]) -> dict:
    diff = [x - y for x, y in zip(a, b)]
    m = statistics.mean(diff)
    sd = statistics.stdev(diff) if len(diff) > 1 else 0.0
    half = 1.96 * sd / math.sqrt(len(diff)) if diff else 0.0
    return {"mean": round(m, 1), "ci95": [round(m - half, 1), round(m + half, 1)],
            "better_runs": sum(1 for d in diff if d > 1e-9), "worse_runs": sum(1 for d in diff if d < -1e-9),
            "runs": len(diff)}


def _closure(ids: set, by_id: dict) -> set:
    """A set of debts plus every open prerequisite they need."""
    out, stack = set(), list(ids)
    while stack:
        i = stack.pop()
        if i in out or i not in by_id:
            continue
        out.add(i)
        stack.extend(p for p in by_id[i].get("prerequisite_ids") or () if p in by_id)
    return out


def _mck(options: list[list[tuple[int, float, frozenset]]], cap: int) -> tuple[float, list[int]]:
    """Exact multiple-choice knapsack: at most one option per group, total units <= cap, maximum value."""
    neg = float("-inf")
    best = [0.0] + [neg] * cap
    picks: list[list] = []
    for opts in options:
        nxt = best[:]
        choice = [-1] * (cap + 1)
        for k, (w, v, _) in enumerate(opts):
            for b in range(cap, w - 1, -1):
                if best[b - w] != neg and best[b - w] + v > nxt[b] + 1e-9:
                    nxt[b] = best[b - w] + v
                    choice[b] = k
        picks.append(choice)
        best = nxt
    b = max(range(cap + 1), key=lambda i: (best[i], -i))
    total, chosen = best[b], []
    for g in range(len(options) - 1, -1, -1):
        k = picks[g][b]
        chosen.append(k)
        if k >= 0:
            b -= options[g][k][0]
    return total, list(reversed(chosen))


def plan_fixes(model: Model, open_debts: list[dict], factors: dict, budget: float, draws: Draws,
               value_runs: int) -> dict:
    """Choose what to fix before the day.

    Fixes on the same module work together (their capacity factors multiply), so every combination of a module's
    candidate fixes is valued by simulation on the same futures, and an exact multiple-choice knapsack picks one
    combination per module within the hours available. A second round re-values each module's combinations given
    what the first round chose elsewhere (fixing the database also stops some cascades into its callers).
    """
    by_id = {d["id"]: d for d in open_debts}
    hours = {i: float(by_id[i].get("principal") or 0.0) for i in by_id}
    blockers = model.blockers()
    cand = [d for d in open_debts if hours[d["id"]] > 0
            and (any(x > 0 for x in factors.get(d["id"], (0, 0))) or d["id"] in blockers)]
    cand_ids = {d["id"] for d in cand}
    groups: dict[str, list] = {}
    for d in cand:
        groups.setdefault(d["module"], []).append(d["id"])
    for m, ids in groups.items():
        if len(ids) > MAX_PER_MODULE:
            ids.sort(key=lambda i: (i not in blockers, -(factors.get(i, (0, 0))[0] + factors.get(i, (0, 0))[1])))
            groups[m] = ids[:MAX_PER_MODULE]
    cache: dict[frozenset, float] = {}

    def lost(fixed: frozenset) -> float:
        if fixed not in cache:
            caps, frag = capacities(model, open_debts, factors, set(fixed))
            cache[fixed] = statistics.mean(_simulate(model.for_fixed(fixed), caps, frag, draws,
                                                     value_runs)["hours_lost"])
        return cache[fixed]

    base = lost(frozenset())
    unit = 0.5
    cap = int(math.floor(budget / unit + 1e-9))
    mods = sorted(groups)
    combos: dict[str, list[frozenset]] = {}
    for m in mods:
        ids = groups[m]
        sets = set()
        for mask in range(1, 1 << len(ids)):
            sub = {ids[k] for k in range(len(ids)) if mask >> k & 1}
            fs = frozenset(_closure(sub, by_id))
            if sum(hours[i] for i in fs) <= budget + 1e-9:
                sets.add(fs)
        combos[m] = sorted(sets, key=lambda f: (len(f), sorted(f)))

    def solve(context: dict | None) -> tuple[dict, float]:
        options = []
        for m in mods:
            others = frozenset().union(*[v for k, v in (context or {}).items() if k != m])
            ref = lost(others)
            opts = []
            for fs in combos[m]:
                gain = ref - lost(others | fs)
                if gain > 1e-9:
                    w = int(math.ceil(sum(hours[i] for i in fs - others) / unit - 1e-9))
                    opts.append((w, gain, fs))
            options.append(opts)
        _, picks = _mck(options, cap)
        chosen = {m: (options[g][k][2] if k >= 0 else frozenset()) for g, (m, k) in enumerate(zip(mods, picks))}
        union = frozenset().union(*chosen.values()) if chosen else frozenset()
        return chosen, sum(hours[i] for i in union)

    chosen, _ = solve(None)
    rounds = 1
    if any(chosen.values()):
        second, used2 = solve(chosen)
        rounds = 2
        if used2 <= budget + 1e-9:
            fixed1 = frozenset().union(*chosen.values())
            fixed2 = frozenset().union(*second.values())
            if lost(fixed2) < lost(fixed1) - 1e-9:
                chosen = second
    fixed = frozenset().union(*chosen.values()) if chosen else frozenset()
    standalone = {i: (round(max(0.0, base - lost(frozenset(_closure({i}, by_id)))), 2) if i in cand_ids else 0.0)
                  for i in by_id}
    in_plan = {i: round(max(0.0, lost(fixed - {i}) - lost(fixed)), 2) for i in fixed}
    order = sorted(fixed, key=lambda i: (-in_plan[i], by_id[i]["key"]))
    return {"ids": order, "hours": round(sum(hours[i] for i in fixed), 1), "value": round(base - lost(fixed), 1),
            "standalone": standalone, "in_plan": in_plan, "rounds": rounds, "simulations": len(cache)}


def _jitter(name: str, hour: int, span: int) -> int:
    return zlib.crc32(f"{name}:{hour}".encode()) % span


STATE_KINDS = ("overload", "cascade", "outage", "deploy", "fault", "recovered")


def with_minutes(trace: dict) -> dict:
    """Give each change in a replay trace a minute of the day, so a replay can unfold inside the hour.

    The model works in whole hours. Within an hour, a situation starts at its own minute and the outage it forces a
    minute later; overloads land in the hour's first ten minutes, background faults anywhere in its first 45, a
    cascade a minute or three after the failure it comes from, and a recovery between minutes 6 and 30. The offsets
    are deterministic (a CRC of module and hour) and only change how the day is shown, never what happens in it.
    """
    evs = trace["events"]
    marks = {}
    for e in evs:
        if e["kind"] in ("situation", "prevented", "situation_end"):
            e["minute"] = e["hour"] * 60 + int(e.get("at", 0))
            if e["kind"] == "situation":
                marks[(e["hour"], e["module"])] = e["minute"]
    for e in evs:
        # what a situation causes happens after it starts: the outage it forces, the overload a capacity loss brings
        start = marks.get((e["hour"], e["module"]), marks.get((e["hour"], "*")))
        if e["kind"] in ("outage", "deploy"):
            e["minute"] = (min(e["hour"] * 60 + 59, start + 1 + _jitter(e["module"], e["hour"], 2)) if start is not None
                           else e["hour"] * 60 + 1 + _jitter(e["module"], e["hour"], 9))
        elif e["kind"] == "overload":
            e["minute"] = (min(e["hour"] * 60 + 59, start + 2 + _jitter(e["module"], e["hour"], 6)) if start is not None
                           else e["hour"] * 60 + 1 + _jitter(e["module"], e["hour"], 9))
        elif e["kind"] == "fault":
            e["minute"] = e["hour"] * 60 + 3 + _jitter(e["module"], e["hour"], 42)
        elif e["kind"] == "recovered":
            e["minute"] = e["hour"] * 60 + 6 + _jitter(e["module"], e["hour"], 25)
    pending = [e for e in evs if e["kind"] == "cascade"]
    for _ in range(len(pending) + 1):  # cascades can chain: resolve sources first
        left = []
        for e in pending:
            src = next((x for x in evs if x["hour"] == e["hour"] and x["module"] == e.get("from")
                        and x["kind"] in STATE_KINDS and x["kind"] != "recovered"), None)
            if src is None:   # the source was already down at the start of the hour
                e["minute"] = e["hour"] * 60 + 2 + _jitter(e["module"], e["hour"], 3)
            elif "minute" in src:
                e["minute"] = min(e["hour"] * 60 + 59, src["minute"] + 1 + _jitter(e["module"], e["hour"], 3))
            else:
                left.append(e)
        if not left:
            break
        pending = left
    for e in evs:
        e.setdefault("minute", e["hour"] * 60 + 30)
    order = {"situation_end": 0, "situation": 1, "prevented": 1}
    evs.sort(key=lambda e: (e["minute"], order.get(e["kind"], 2), e["kind"] == "recovered", e["module"]))
    return trace


def state_at(trace: dict, modules: list[str], minute: int) -> list[int]:
    """Each module's state at a minute of the replayed day: 0 up, 1 down, 2 failing because a dependency failed."""
    h = max(0, min(HOURS - 1, minute // 60))
    now, before = trace["states"][h], trace["states"][h - 1] if h else [0] * len(modules)
    change = {e["module"]: e["minute"] for e in trace["events"] if e["hour"] == h and e["kind"] in STATE_KINDS}
    out = []
    for i, m in enumerate(modules):
        s, p = now[i], before[i]
        if s != p and (s == 0 or p == 0) and m in change and minute < change[m]:
            s = p
        out.append(s)
    return out


def describe_effects(model: Model, by_id: dict | None = None) -> list[dict]:
    """The situation's effects as shown in results and reports, with what the fixes change."""
    out = []
    for e in model.effects:
        out.append({"type": e["type"], "module": e["module"], "start": e["start"], "hours": e["hours"],
                    "minute": e["at"], "label": e["label"], "prevented": e["prevented"], "ramp": e["ramp"],
                    "chance": round(e["chance0"], 3), "factor": round(e["factor0"], 3),
                    "mitigation": e["mitigation"], "mitigated_by": e["by_keys"], "kind": e["kind"]})
    return out


def representative_run(before: dict, after: dict, runs: int) -> int:
    """The day to replay: the one closest to the average before and after the fixes, in hours lost and incidents."""
    mb, ma = statistics.mean(before["hours_lost"]), statistics.mean(after["hours_lost"])
    ib, ia = statistics.mean(before["incidents"]), statistics.mean(after["incidents"])

    def gap(r: int) -> tuple:
        hb = abs(before["hours_lost"][r] - mb) / max(mb, 1.0)
        ha = abs(after["hours_lost"][r] - ma) / max(ma, 1.0)
        nb = abs(before["incidents"][r] - ib) / max(ib, 1.0)
        na = abs(after["incidents"][r] - ia) / max(ia, 1.0)
        return (max(hb, ha) + 0.5 * min(hb, ha) + 0.15 * (nb + na), r)

    return min(range(runs), key=gap)


def simulate(model: Model, open_debts: list[dict], factors: dict, budget: float, runs: int = 300, seed: int = 17,
             value_runs: int = 150, regular_plan: list | None = None, playbook_of: dict | None = None) -> dict:
    """Before / situation-aware fix plan / after, plus how the regular sprint plan would fare."""
    t0 = time.perf_counter()
    runs = max(50, min(2000, int(runs)))
    value_runs = max(30, min(runs, int(value_runs)))
    draws = Draws.make(runs, len(model.modules), len(model.edges), seed, len(model.effects))

    caps0, frag0 = capacities(model, open_debts, factors, set())
    before = _simulate(model, caps0, frag0, draws, runs)

    plan = plan_fixes(model, open_debts, factors, budget, draws, value_runs)
    chosen = set(plan["ids"])
    values = plan["standalone"]

    caps1, frag1 = capacities(model, open_debts, factors, chosen)
    model_after = model.for_fixed(chosen)
    after = _simulate(model_after, caps1, frag1, draws, runs)
    regular = None
    if regular_plan is not None:
        caps2, frag2 = capacities(model, open_debts, factors, set(regular_plan))
        model_reg = model.for_fixed(set(regular_plan))
        reg = _simulate(model_reg, caps2, frag2, draws, runs)
        regular = {"selected_ids": list(regular_plan), "summary": _summary(reg),
                   "saved_hours": _paired(before["hours_lost"], reg["hours_lost"]),
                   "blocks_bots": model.mitigated(set(regular_plan)),
                   "guards": sorted({k for e in model.effects for k in e["by_keys"]
                                     if e["by"] & set(regular_plan)})}

    # One representative day to replay: the run closest to the average both before and after the fixes. Thanks to
    # common random numbers, "after" replays exactly the same day (same users, same luck) with the fixes in place.
    rep = representative_run(before, after, runs)
    replay = {"run": rep, "modules": model.modules,
              "before": with_minutes(_simulate(model, caps0, frag0, draws, runs, trace_run=rep)["trace"]),
              "after": with_minutes(_simulate(model_after, caps1, frag1, draws, runs, trace_run=rep)["trace"]),
              "profile_after": model_after.profile, "turnout": round(draws.day[rep], 3)}

    by_id = {d["id"]: d for d in open_debts}
    pb = playbook_of or {}
    modules = []
    for i, m in enumerate(model.modules):
        modules.append({
            "module": m, "exposure": round(model.exposure[m], 2), "entry_share": model.entry.get(m, 0.0),
            "baseline": model.baseline[m], "severity": model.severity[m],
            "capacity_before": round(caps0[i], 3), "capacity_after": round(caps1[i], 3),
            "fragility_before": round(frag0[i], 3), "fragility_after": round(frag1[i], 3),
            "utilisation_before": [round(x, 3) for x in before["rho"][i]],
            "utilisation_after": [round(x, 3) for x in after["rho"][i]],
            "peak_utilisation_before": round(max(before["rho"][i]), 3),
            "peak_utilisation_after": round(max(after["rho"][i]), 3),
            "down_probability_before": [round(x / runs, 3) for x in before["down_hours"][i]],
            "down_probability_after": [round(x / runs, 3) for x in after["down_hours"][i]],
            "p_incident_before": round(before["inc_by_mod"][i] / runs, 3),
            "p_incident_after": round(after["inc_by_mod"][i] / runs, 3),
            "first_overload_hour": next((t for t in range(HOURS) if before["rho"][i][t] >= 1.0), None),
        })
    modules.sort(key=lambda r: (-r["p_incident_before"], -r["peak_utilisation_before"]))
    debts = []
    blockers = model.blockers()
    for d in open_debts:
        c, r = factors.get(d["id"], (0.0, 0.0))
        debts.append({"id": d["id"], "key": d["key"], "title": d.get("title"), "module": d["module"],
                      "principal": d.get("principal"), "playbook": pb.get(d["id"]), "capacity_effect": c,
                      "resilience_effect": r, "protects_hours": values.get(d["id"], 0.0), "in_plan": d["id"] in chosen,
                      "in_regular_plan": d["id"] in set(regular_plan or []), "guards_situation": d["id"] in blockers})
    debts.sort(key=lambda x: (-x["protects_hours"], x["key"]))
    selected = [{"id": i, "key": by_id[i]["key"], "title": by_id[i].get("title"), "module": by_id[i]["module"],
                 "principal": by_id[i].get("principal"), "protects_hours": plan["in_plan"].get(i, 0.0),
                 "alone_hours": values.get(i, 0.0), "playbook": pb.get(i), "guards_situation": i in blockers}
                for i in plan["ids"] if i in by_id]
    for x in selected:  # prerequisites that protect nothing themselves are there because another fix needs them
        x["prerequisite_of"] = [by_id[j]["key"] for j in plan["ids"] if j in by_id and x["id"] in
                                (by_id[j].get("prerequisite_ids") or ())]
    effects = describe_effects(model)
    for k, e in enumerate(effects):
        e["guarded_in_plan"] = bool(model.effects[k]["by"] & chosen)
        if model.effects[k]["type"] == "down":
            e["happened_before"] = round(before["effect_hits"][k] / runs, 3)
            e["happened_after"] = round(after["effect_hits"][k] / runs, 3)
    return {
        "profile": model.profile,
        "peak": max(model.profile),
        "runs": runs, "seed": seed, "value_runs": value_runs, "budget": budget,
        "before": _summary(before), "after": _summary(after),
        "saved_hours": _paired(before["hours_lost"], after["hours_lost"]),
        "plan": {"method": "multiple-choice knapsack over simulated fix combinations", "selected": selected,
                 "hours_used": plan["hours"], "protects_hours": plan["value"], "rounds": plan["rounds"],
                 "combinations_simulated": plan["simulations"]},
        "regular_plan": regular,
        "replay": replay,
        "bots": ({"share": model.bots.get("share"), "blocked": model.bots.get("blocked"), "adapt": BOT_ADAPT,
                  "mitigated_by": [by_id[i]["key"] for i in model.bots.get("mitigated_by") or () if i in by_id],
                  "blocked_in_plan": model.mitigated(chosen)} if model.bots else None),
        "effects": effects,
        "modules": modules,
        "debts": debts,
        "assumptions": {"slope": SLOPE, "recover_below": RECOVER, "base_fragility": BASE_FRAGILITY,
                        "p_cascade": model.p_cascade, "day_sigma": DAY_SIGMA, "capacity_sigma": CAPACITY_SIGMA,
                        "bot_adapt": BOT_ADAPT, "reject_cost": REJECT_COST, "fault_stress": FAULT_STRESS,
                        "fault_rate_per_day": round(sum(model.fault_rate.values()) * HOURS, 3)},
        "seconds": round(time.perf_counter() - t0, 2),
    }
