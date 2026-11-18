"""Load-spike simulation (Simulation Lab → "Load spike").

A traffic event (salary day, a sale, exam results) multiplies the load on the modules users enter through. The load
flows along the dependency graph: if checkout depends on the database, the database sees checkout's spike too.

For module m in hour t, with traffic multiplier M(t):

    load      L(m, t) = u0(m) · (1 + (M(t) − 1) · e(m))          u0 = utilisation at a normal peak hour,
                                                                    e  = exposure of m to the event (0..1)
    capacity  C(m)    = Π (1 − capacity(d))  over open debts d in m (factor from the debt's fix playbook)
    utilisation ρ = L / C,   P(overload in that hour) = 1 / (1 + exp(−(ρ − 1) / 0.05))

An overloaded module stays down until its utilisation falls below 0.9. While a module is down, each module that
depends on it fails with probability p · fragility, where fragility = 0.25 + Σ resilience(d) of the caller's open
debts (capped at 0.95): missing timeouts or circuit breakers let a failure spread. Each module that goes down is one
incident costing w(severity) · mean effort of that module's past incidents, the same cost as in the interest model.

Monte Carlo over many runs gives expected incidents, engineering hours lost, and the share of the event's traffic
that hit a failed entry module. Every configuration uses the same random numbers (common random numbers), so
"before" and "after" differ only by the fixes. To decide what to fix before the event, every combination of fixes on
a module is valued by simulation, and an exact multiple-choice knapsack picks one combination per module within the
hours available (see ``plan_fixes``).
"""

from __future__ import annotations

import math
import random
import statistics
import time
from dataclasses import dataclass, field


HOURS = 24
SLOPE = 0.05
RECOVER = 0.90
BASE_FRAGILITY = 0.25
DEFAULT_BASELINE = 0.15
MAX_PER_MODULE = 4          # fix combinations are enumerated per module, up to this many candidate debts
SEVERITY_WEIGHT = {"CRITICAL": 3.5, "HIGH": 2.5, "MEDIUM": 1.5, "LOW": 1.0}

# --------------------------------------------------------------------------- presets

PRESETS: dict[str, dict] = {
    "fintech": {
        "key": "salary-day", "name": "Salary day",
        "description": "On the 1st of the month salaries land and UPI and card payments peak at four times a "
                       "normal busy hour through the morning, with a second rush in the evening.",
        "profile": [0.5, 0.4, 0.4, 0.4, 0.5, 0.8, 1.6, 2.6, 3.6, 4.0, 4.0, 3.6,
                    3.2, 2.8, 2.4, 2.2, 2.2, 2.6, 3.0, 3.2, 2.8, 2.2, 1.6, 1.0],
        "entry": {"checkout": 1.0, "gateway": 1.0, "webhooks": 0.8, "auth": 0.6, "settlement": 0.5, "reporting": 0.3},
        "baseline": {"db": 0.22, "gateway": 0.20, "checkout": 0.18, "ledger": 0.16, "auth": 0.12, "webhooks": 0.18,
                     "risk": 0.15, "settlement": 0.15, "reporting": 0.15},
    },
    "healthtech": {
        "key": "opd-rush", "name": "Monday morning OPD rush",
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
        "key": "diwali-sale", "name": "Diwali sale",
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
        "key": "results-day", "name": "Exam results day",
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


def events_for(scenario: str | None) -> list[dict]:
    """Preset events offered for a project (its scenario's event, if any) plus the custom template."""
    out = []
    p = PRESETS.get(scenario or "")
    if p:
        out.append({k: p[k] for k in ("key", "name", "description", "profile")} | {"peak": max(p["profile"]),
                                                                                   "preset": True})
    out.append({"key": "custom", "name": "Custom spike", "preset": False,
                "description": "Choose the peak multiplier, the hour it starts and how long it lasts.",
                "profile": custom_profile(5, 20, 2), "peak": 5})
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
    dependents: dict[int, list[tuple[int, int]]] = field(default_factory=dict)
    edges: list[tuple[int, int]] = field(default_factory=list)

    def __post_init__(self):
        ix = {m: i for i, m in enumerate(self.modules)}
        self.edges = [(ix[callee], ix[caller]) for caller, callee in self.deps if caller in ix and callee in ix]
        self.dependents = {i: [] for i in range(len(self.modules))}
        for e, (x, y) in enumerate(self.edges):
            self.dependents[x].append((e, y))

    def load(self, m: str, t: int) -> float:
        return self.baseline[m] * (1.0 + (self.profile[t] - 1.0) * self.exposure[m])


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
    """Common random numbers: the same uniforms for every configuration being compared."""
    module: list   # runs × hours × modules
    edge: list     # runs × hours × edges

    @classmethod
    def make(cls, runs: int, n_mod: int, n_edge: int, seed: int) -> "Draws":
        mod, edg = [], []
        for r in range(runs):
            rng = random.Random(seed * 7919 + r)
            mod.append([[rng.random() for _ in range(n_mod)] for _ in range(HOURS)])
            edg.append([[rng.random() for _ in range(n_edge)] for _ in range(HOURS)])
        return cls(mod, edg)


def _simulate(model: Model, caps: list[float], frag: list[float], draws: Draws, runs: int) -> dict:
    n = len(model.modules)
    rho = [[model.load(m, t) / caps[i] for t in range(HOURS)] for i, m in enumerate(model.modules)]
    pf = [[p_overload(rho[i][t]) for t in range(HOURS)] for i in range(n)]
    p_edge = [min(0.95, model.p_cascade * frag[y]) for _, y in model.edges]
    cost = [model.cost.get(m, 6.0) for m in model.modules]
    share = [model.entry.get(m, 0.0) for m in model.modules]
    total_traffic = sum(model.profile) * (sum(share) or 1.0)
    hours_lost, incidents, failed_share = [], [], []
    inc_by_mod = [0] * n
    down_hours = [[0] * HOURS for _ in range(n)]
    for r in range(runs):
        um, ue = draws.module[r], draws.edge[r]
        down = [0] * n
        prev = [False] * n
        lost = n_inc = 0.0
        traffic_lost = 0.0
        hit = [False] * n
        for t in range(HOURS):
            for i in range(n):
                if (down[i] == 1 and rho[i][t] < RECOVER) or down[i] == 2:
                    down[i] = 0
            for i in range(n):
                if down[i] == 0 and um[t][i] < pf[i][t]:
                    down[i] = 1
            stack = [i for i in range(n) if down[i]]
            while stack:
                x = stack.pop()
                for e, y in model.dependents[x]:
                    if down[y] == 0 and ue[t][e] < p_edge[e]:
                        down[y] = 2
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
                    prev[i] = True
                else:
                    prev[i] = False
            traffic_lost += model.profile[t] * min(out_now, sum(share) or 1.0)
        for i in range(n):
            if hit[i]:
                inc_by_mod[i] += 1
        hours_lost.append(lost)
        incidents.append(n_inc)
        failed_share.append(traffic_lost / total_traffic if total_traffic else 0.0)
    return {"rho": rho, "pf": pf, "hours_lost": hours_lost, "incidents": incidents, "failed_share": failed_share,
            "inc_by_mod": inc_by_mod, "down_hours": down_hours, "runs": runs}


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
        "hours_lost_p90": round(_pct(sim["hours_lost"], 0.9), 1),
        "failed_traffic_pct": round(100 * statistics.mean(sim["failed_share"]), 1),
        "p_any_user_outage": round(sum(1 for x in sim["failed_share"] if x > 0) / runs, 3),
        "p_no_incident": round(sum(1 for x in sim["incidents"] if x == 0) / runs, 3),
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
    """Choose what to fix before the event.

    Fixes on the same module work together (their capacity factors multiply), so every combination of a module's
    candidate fixes is valued by simulation on the same futures, and an exact multiple-choice knapsack picks one
    combination per module within the hours available. A second round re-values each module's combinations given
    what the first round chose elsewhere (fixing the database also stops some cascades into its callers).
    """
    by_id = {d["id"]: d for d in open_debts}
    hours = {i: float(by_id[i].get("principal") or 0.0) for i in by_id}
    cand = [d for d in open_debts if hours[d["id"]] > 0 and any(x > 0 for x in factors.get(d["id"], (0, 0)))]
    cand_ids = {d["id"] for d in cand}
    groups: dict[str, list] = {}
    for d in cand:
        groups.setdefault(d["module"], []).append(d["id"])
    for m, ids in groups.items():
        if len(ids) > MAX_PER_MODULE:
            ids.sort(key=lambda i: -(factors[i][0] + factors[i][1]))
            groups[m] = ids[:MAX_PER_MODULE]
    cache: dict[frozenset, float] = {}

    def lost(fixed: frozenset) -> float:
        if fixed not in cache:
            caps, frag = capacities(model, open_debts, factors, set(fixed))
            cache[fixed] = statistics.mean(_simulate(model, caps, frag, draws, value_runs)["hours_lost"])
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


def simulate(model: Model, open_debts: list[dict], factors: dict, budget: float, runs: int = 300, seed: int = 17,
             value_runs: int = 150, regular_plan: list | None = None, playbook_of: dict | None = None) -> dict:
    """Before / spike-aware fix plan / after, plus how the regular sprint plan would fare."""
    t0 = time.perf_counter()
    runs = max(50, min(2000, int(runs)))
    value_runs = max(30, min(runs, int(value_runs)))
    draws = Draws.make(runs, len(model.modules), len(model.edges), seed)

    caps0, frag0 = capacities(model, open_debts, factors, set())
    before = _simulate(model, caps0, frag0, draws, runs)

    plan = plan_fixes(model, open_debts, factors, budget, draws, value_runs)
    chosen = set(plan["ids"])
    values = plan["standalone"]

    caps1, frag1 = capacities(model, open_debts, factors, chosen)
    after = _simulate(model, caps1, frag1, draws, runs)
    regular = None
    if regular_plan is not None:
        caps2, frag2 = capacities(model, open_debts, factors, set(regular_plan))
        reg = _simulate(model, caps2, frag2, draws, runs)
        regular = {"selected_ids": list(regular_plan), "summary": _summary(reg),
                   "saved_hours": _paired(before["hours_lost"], reg["hours_lost"])}

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
    for d in open_debts:
        c, r = factors.get(d["id"], (0.0, 0.0))
        debts.append({"id": d["id"], "key": d["key"], "title": d.get("title"), "module": d["module"],
                      "principal": d.get("principal"), "playbook": pb.get(d["id"]), "capacity_effect": c,
                      "resilience_effect": r, "protects_hours": values.get(d["id"], 0.0), "in_plan": d["id"] in chosen,
                      "in_regular_plan": d["id"] in set(regular_plan or [])})
    debts.sort(key=lambda x: (-x["protects_hours"], x["key"]))
    selected = [{"id": i, "key": by_id[i]["key"], "title": by_id[i].get("title"), "module": by_id[i]["module"],
                 "principal": by_id[i].get("principal"), "protects_hours": plan["in_plan"].get(i, 0.0),
                 "alone_hours": values.get(i, 0.0), "playbook": pb.get(i)}
                for i in plan["ids"] if i in by_id]
    for x in selected:  # prerequisites that protect nothing themselves are there because another fix needs them
        x["prerequisite_of"] = [by_id[j]["key"] for j in plan["ids"] if j in by_id and x["id"] in
                                (by_id[j].get("prerequisite_ids") or ())]
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
        "modules": modules,
        "debts": debts,
        "assumptions": {"slope": SLOPE, "recover_below": RECOVER, "base_fragility": BASE_FRAGILITY,
                        "p_cascade": model.p_cascade},
        "seconds": round(time.perf_counter() - t0, 2),
    }
