"""Stochastic simulations for the Simulation Lab.

1. Sprint-by-sprint forecast (Monte Carlo)
   ---------------------------------------
   Each open debt item d fails independently every sprint:

       incidents_t(d) ~ Poisson(λ_d)
       λ_d = (n_d + 0.5) / (age_d + 2) · m_d · κ,   m_d = (1 + ½·churn̂ + ½·complexitŷ) / mean(m)

   (n_d + 0.5)/(age_d + 2) is the posterior-mean incident rate per sprint under a
   Gamma(0.5, 2) prior — items with no history are not assumed to be safe.
   Each incident costs  w_sev · effort  hours (severity drawn from d's own history,
   effort ~ log-normal around d's mean resolution effort).  New debt arrives at
   rate μ per sprint.  Every sprint the team spends at most B hours fixing debt
   chosen by a *policy*; fixed items stop failing from the next sprint.

   Policies: DebtLens optimal (exact knapsack on R(d)), greedy value/effort,
   oldest-first (FIFO backlog), and doing nothing.  All policies see the *same*
   random failures in each run (common random numbers), so the per-run difference
   between two policies is a paired comparison with a tight confidence interval.

2. Failure injection (independent-cascade model)
   ----------------------------------------------
   A failure starts in module m₀.  When module X fails, every module Y that depends
   on X fails with probability  p · f(Y),  f(Y) = 0.5 + 0.5·(open risk in Y / max),
   i.e. modules carrying more unresolved debt are more fragile.  Monte Carlo gives
   P(Y affected), the cascade-size distribution and the most likely failure path;
   the deterministic DFS blast radius is the worst case (p = 1).
"""

from __future__ import annotations

import heapq
import math
import random
import statistics
import time
from dataclasses import asdict, dataclass

from . import optimiser as OPT
from .economics import SEVERITIES, SEVERITY_WEIGHT


def poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    if lam > 30:
        return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = (len(s) - 1) * q
    lo, hi = math.floor(idx), math.ceil(idx)
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)


# =========================================================================== forecast

@dataclass
class ForecastConfig:
    budget: float = 40.0
    sprints: int = 12
    runs: int = 150
    seed: int = 7
    inflow_rate: float = 0.25
    hazard_scale: float = 1.0
    sprint_days: int = 14
    policies: tuple = ("optimal", "greedy", "oldest_first", "none")

    @classmethod
    def from_dict(cls, d: dict | None) -> "ForecastConfig":
        c = cls()
        for k, v in (d or {}).items():
            if k == "policies" and v:
                c.policies = tuple(p for p in v if p in POLICIES)
            elif hasattr(c, k) and v is not None:
                setattr(c, k, type(getattr(c, k))(v))
        c.sprints = max(1, min(c.sprints, 26))
        c.runs = max(10, min(c.runs, 1000))
        c.budget = max(0.0, c.budget)
        return c


POLICIES = {
    "optimal": "DebtLens optimal (exact knapsack)",
    "greedy": "Greedy value per hour",
    "oldest_first": "Oldest first (FIFO backlog)",
    "none": "No remediation",
}


@dataclass
class _Debt:
    id: object
    key: str
    principal: float
    interest: float
    structural: float
    hazard: float
    sev_probs: list
    mean_effort: float
    created: int
    prereqs: tuple
    blast: float
    centrality: float


def build_forecast_inputs(ledger_rows: list[dict], incidents_by_id: dict, module_stats: dict,
                          now_days: dict, sprint_days: int = 14) -> list[_Debt]:
    """Turn ledger rows into simulation debts.  ``now_days[id]`` = age of the item in days."""
    max_churn = max((m.get("churn", 0) for m in module_stats.values()), default=0) or 1
    max_cx = max((m.get("complexity", 0) for m in module_stats.values()), default=0) or 1
    open_rows = [r for r in ledger_rows if r.get("is_open", True)]

    def structural(r):
        ms = module_stats.get(r["module"], {})
        return 1 + 0.5 * ms.get("churn", 0) / max_churn + 0.5 * ms.get("complexity", 0) / max_cx

    # normalise so the structural multiplier averages 1: history already reflects structure,
    # the multiplier only redistributes risk towards churning, complex modules
    mean_mult = (sum(structural(r) for r in open_rows) / len(open_rows)) if open_rows else 1.0
    out = []
    for r in open_rows:
        incs = [incidents_by_id[i] for i in r.get("incident_ids", []) if i in incidents_by_id]
        n = len(incs)
        age_sprints = max(1.0, now_days.get(r["id"], 30) / sprint_days)
        mult = structural(r) / mean_mult
        hazard = (n + 0.5) / (age_sprints + 2.0) * mult
        counts = {s: 0.5 for s in SEVERITIES}
        for i in incs:
            counts[(i.get("severity") or "MEDIUM").upper()] = counts.get((i.get("severity") or "MEDIUM").upper(), 0.5) + 1
        tot = sum(counts.values())
        efforts = [float(i.get("effort_hours") or 0) for i in incs if i.get("effort_hours")]
        out.append(_Debt(
            id=r["id"], key=r["key"], principal=float(r["principal"]), interest=float(r["interest"]),
            structural=float(r["churn_interest"] + r["blast_interest"]), hazard=min(3.0, hazard),
            sev_probs=[counts[s] / tot for s in SEVERITIES],
            mean_effort=statistics.mean(efforts) if efforts else 4.0,
            created=-int(age_sprints), prereqs=tuple(r.get("prerequisite_ids") or ()),
            blast=float(r["blast_radius"]), centrality=float(r["root_cause_centrality"]),
        ))
    return out


def _risk_values(debts: list[_Debt], sev_w: dict) -> dict:
    """Same shape as economics.R(d) but computed on the simulated state."""
    if not debts:
        return {}
    mi = max(d.interest for d in debts) or 1.0
    mb = max(d.blast for d in debts) or 1.0
    mc = max(d.centrality for d in debts) or 1.0
    ms = max(sum(p * sev_w[s] for p, s in zip(d.sev_probs, SEVERITIES)) for d in debts) or 1.0
    out = {}
    for d in debts:
        sev = sum(p * sev_w[s] for p, s in zip(d.sev_probs, SEVERITIES))
        v = 100 * (0.5 * d.interest / mi + 0.2 * d.blast / mb + 0.2 * sev / ms + 0.1 * d.centrality / mc)
        out[d.id] = v * (1.2 if d.interest > d.principal else 1.0)
    return out


def _choose(policy: str, open_debts: list[_Debt], budget: float, sev_w: dict) -> list:
    if policy == "none" or not open_debts or budget <= 0:
        return []
    ids = {d.id for d in open_debts}
    if policy == "oldest_first":
        chosen, used = [], 0.0
        for d in sorted(open_debts, key=lambda x: (x.created, str(x.key))):
            if used + d.principal <= budget + 1e-9 and all(p not in ids or p in chosen for p in d.prereqs):
                chosen.append(d.id)
                used += d.principal
        return chosen
    vals = _risk_values(open_debts, sev_w)
    items = [OPT.Item(d.id, d.key, d.principal, vals[d.id], tuple(p for p in d.prereqs if p in ids))
             for d in open_debts]
    method = "auto" if policy == "optimal" else "greedy"
    return OPT.solve(items, budget, method, step=1.0, node_limit=20_000).selected


def forecast(debts: list[_Debt], cfg: ForecastConfig, sev_weight: dict | None = None) -> dict:
    t0 = time.perf_counter()
    sev_w = dict(sev_weight or SEVERITY_WEIGHT)
    S, R = cfg.sprints, cfg.runs
    policies = [p for p in cfg.policies if p in POLICIES] or list(POLICIES)
    series = {p: {"cum_hours": [[0.0] * R for _ in range(S)], "open": [[0.0] * R for _ in range(S)],
                  "break_even": [[0.0] * R for _ in range(S)], "incidents": [[0.0] * R for _ in range(S)],
                  "fix_hours": [0.0] * R} for p in policies}
    templates = debts or []
    for r in range(R):
        rng = random.Random(f"{cfg.seed}:{r}")
        # ---- shared randomness for this run (common random numbers) ----
        arrivals: list[list[_Debt]] = []
        for t in range(S):
            k = poisson(rng, cfg.inflow_rate) if templates else 0
            new = []
            for j in range(k):
                tpl = rng.choice(templates)
                new.append(_Debt(id=f"new-{t}-{j}", key=f"NEW-{t + 1}.{j + 1}",
                                 principal=max(1.0, round(tpl.principal * rng.uniform(0.5, 1.5))),
                                 interest=tpl.structural, structural=tpl.structural,
                                 hazard=tpl.hazard * 0.8, sev_probs=tpl.sev_probs,
                                 mean_effort=tpl.mean_effort, created=t, prereqs=(),
                                 blast=tpl.blast, centrality=0.0))
            arrivals.append(new)
        everyone = list(debts) + [d for a in arrivals for d in a]
        shocks: dict = {}
        for d in everyone:
            for t in range(S):
                n = poisson(rng, d.hazard * cfg.hazard_scale)
                cost = 0.0
                for _ in range(n):
                    u = rng.random()
                    acc, sev = 0.0, "MEDIUM"
                    for p, s in zip(d.sev_probs, SEVERITIES):
                        acc += p
                        if u <= acc:
                            sev = s
                            break
                    effort = d.mean_effort * math.exp(0.5 * rng.gauss(0, 1) - 0.125)
                    cost += sev_w[sev] * effort
                shocks[(d.id, t)] = (n, cost)
        # ---- replay the same world under each policy ----
        for pol in policies:
            state = {d.id: _Debt(**{**d.__dict__}) for d in debts}
            cum = 0.0
            fix = 0.0
            for t in range(S):
                for d in arrivals[t]:
                    state[d.id] = _Debt(**{**d.__dict__})
                inc_t = 0
                for d in state.values():
                    n, cost = shocks.get((d.id, t), (0, 0.0))
                    inc_t += n
                    cum += cost
                    d.interest += cost
                chosen = _choose(pol, list(state.values()), cfg.budget, sev_w)
                for cid in chosen:
                    fix += state[cid].principal
                    del state[cid]
                s = series[pol]
                s["cum_hours"][t][r] = cum
                s["open"][t][r] = len(state)
                s["break_even"][t][r] = sum(1 for d in state.values() if d.interest > d.principal)
                s["incidents"][t][r] = inc_t
            series[pol]["fix_hours"][r] = fix

    result = {"config": asdict(cfg), "policies": {}, "sprints": list(range(1, S + 1))}
    for pol in policies:
        s = series[pol]
        final = s["cum_hours"][-1]
        result["policies"][pol] = {
            "label": POLICIES[pol],
            "cum_hours_mean": [round(statistics.mean(x), 1) for x in s["cum_hours"]],
            "cum_hours_p10": [round(_pct(x, 0.10), 1) for x in s["cum_hours"]],
            "cum_hours_p90": [round(_pct(x, 0.90), 1) for x in s["cum_hours"]],
            "open_mean": [round(statistics.mean(x), 2) for x in s["open"]],
            "break_even_mean": [round(statistics.mean(x), 2) for x in s["break_even"]],
            "incidents_mean": [round(statistics.mean(x), 2) for x in s["incidents"]],
            "final_hours_mean": round(statistics.mean(final), 1),
            "final_hours_p10": round(_pct(final, 0.10), 1),
            "final_hours_p90": round(_pct(final, 0.90), 1),
            "fix_hours_mean": round(statistics.mean(s["fix_hours"]), 1),
        }
    # paired comparisons (same random world per run)
    comps = {}
    base = "none" if "none" in policies else None
    for a in policies:
        for b in policies:
            if a == b or (b != base and not (a == "optimal" and b == "greedy")):
                continue
            diffs = [series[b]["cum_hours"][-1][r] - series[a]["cum_hours"][-1][r] for r in range(R)]
            mean = statistics.mean(diffs)
            sd = statistics.stdev(diffs) if R > 1 else 0.0
            half = 1.96 * sd / math.sqrt(R) if R > 1 else 0.0
            comps[f"{a}_vs_{b}"] = {
                "hours_saved_mean": round(mean, 1),
                "ci95": [round(mean - half, 1), round(mean + half, 1)],
                "pct_saved": round(100 * mean / statistics.mean(series[b]["cum_hours"][-1]), 1)
                if statistics.mean(series[b]["cum_hours"][-1]) > 0 else 0.0,
                "runs_better": sum(1 for x in diffs if x > 1e-9),
            }
    result["comparisons"] = comps
    result["seconds"] = round(time.perf_counter() - t0, 2)
    return result


# =========================================================================== failure cascade

def cascade(modules: list[str], deps: list[tuple[str, str]], fragility: dict[str, float],
            start: str, p: float = 0.35, runs: int = 2000, seed: int = 11,
            incident_cost: dict[str, float] | None = None) -> dict:
    """Monte Carlo independent cascade from ``start`` along reversed dependency edges."""
    t0 = time.perf_counter()
    start = start.lower()
    mods = sorted({m.lower() for m in modules} | {a.lower() for a, _ in deps} | {b.lower() for _, b in deps})
    if start not in mods:
        raise ValueError(f"unknown module {start!r}")
    dependents: dict[str, list[str]] = {m: [] for m in mods}
    for src, tgt in deps:
        if src.lower() != tgt.lower():
            dependents[tgt.lower()].append(src.lower())
    prob = {(x, y): max(0.0, min(1.0, p * fragility.get(y, 0.75))) for x in mods for y in dependents[x]}
    rng = random.Random(seed)
    hits = {m: 0 for m in mods}
    sizes = []
    for _ in range(runs):
        failed = {start}
        frontier = [start]
        while frontier:
            nxt = []
            for x in frontier:
                for y in dependents[x]:
                    if y not in failed and rng.random() < prob[(x, y)]:
                        failed.add(y)
                        nxt.append(y)
            frontier = nxt
        for m in failed:
            hits[m] += 1
        sizes.append(len(failed) - 1)
    worst = set()
    stack = [start]
    while stack:
        x = stack.pop()
        for y in dependents[x]:
            if y not in worst and y != start:
                worst.add(y)
                stack.append(y)
    # most likely path to each module: maximise Π p  ==  shortest path on −log p
    best = {start: 0.0}
    parent: dict[str, str | None] = {start: None}
    heap = [(0.0, start)]
    while heap:
        d, x = heapq.heappop(heap)
        if d > best.get(x, math.inf):
            continue
        for y in dependents[x]:
            pr = prob[(x, y)]
            if pr <= 0:
                continue
            nd = d - math.log(pr)
            if nd < best.get(y, math.inf) - 1e-12:
                best[y], parent[y] = nd, x
                heapq.heappush(heap, (nd, y))

    def path(m):
        out = []
        while m is not None:
            out.append(m)
            m = parent.get(m)
        return list(reversed(out))

    cost = incident_cost or {}
    per_module = []
    for m in mods:
        if m == start:
            continue
        pm = hits[m] / runs
        per_module.append({
            "module": m,
            "probability": round(pm, 4),
            "in_worst_case": m in worst,
            "fragility": round(fragility.get(m, 0.75), 3),
            "likely_path": path(m) if m in parent else [],
            "path_probability": round(math.exp(-best[m]), 4) if m in best else 0.0,
            "expected_hours": round(pm * cost.get(m, 6.0), 1),
        })
    per_module.sort(key=lambda r: -r["probability"])
    hist = [0] * (len(mods))
    for s in sizes:
        hist[s] += 1
    return {
        "start": start,
        "p": p,
        "runs": runs,
        "expected_affected": round(statistics.mean(sizes), 2),
        "p90_affected": _pct(sizes, 0.9),
        "worst_case_affected": len(worst),
        "worst_case_modules": sorted(worst),
        "size_distribution": [round(h / runs, 4) for h in hist],
        "modules": per_module,
        "expected_extra_hours": round(sum(r["expected_hours"] for r in per_module), 1),
        "seconds": round(time.perf_counter() - t0, 3),
    }
