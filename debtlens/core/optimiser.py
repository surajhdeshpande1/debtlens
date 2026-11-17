"""Remediation planning (module M7: payoff optimiser).

The sprint plan is a Precedence-Constrained 0/1 Knapsack Problem (PCKP):

    maximise    Σ R(d) · x(d)
    subject to  Σ P(d) · x(d) ≤ B                 (sprint effort budget, hours)
                x(d) ≤ x(p)  for every prerequisite p of d
                x(d) ∈ {0, 1}

Solvers
-------
tree_dp           exact.  When every item has at most one prerequisite the
                  prerequisites form a forest; DP over the DFS pre-order
                  ("take i → go to i+1, skip i → jump past its subtree") runs in
                  O(n · B/step).
branch_and_bound  exact for any DAG.  Depth-first over a topological order;
                  upper bound = fractional knapsack over the undecided items
                  (a valid relaxation because it ignores precedence).
greedy            baseline: repeatedly add the best value/effort *bundle*
                  (item + its missing prerequisites) that still fits.
naive_dp          v1's method: ordinary knapsack that ignores prerequisites,
                  then drops items whose prerequisites were not picked.
brute_force       full enumeration for n ≤ 20 (tests only).

Prerequisite cycles are contracted into one bundle (Tarjan SCC) and reported.
"""

from __future__ import annotations

import math
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable

from .graph import strongly_connected_components, topological_sort


@dataclass
class Item:
    id: Any
    key: str
    weight: float
    value: float
    prereqs: tuple = ()
    title: str = ""


@dataclass
class Plan:
    method: str
    budget: float
    selected: list = field(default_factory=list)
    total_weight: float = 0.0
    total_value: float = 0.0
    optimal: bool = False
    work: int = 0
    millis: float = 0.0
    forced: list = field(default_factory=list)
    deferred: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)

    @property
    def utilization(self) -> float:
        return round(100.0 * self.total_weight / self.budget, 1) if self.budget > 0 else 0.0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["utilization"] = self.utilization
        d["unused_budget"] = round(max(0.0, self.budget - self.total_weight), 2)
        return d


# --------------------------------------------------------------------------- helpers

class _Group:
    """A schedulable unit: one item, or a bundle of items that form a prerequisite cycle."""

    __slots__ = ("gid", "members", "weight", "value", "prereqs")

    def __init__(self, gid, members, weight, value):
        self.gid, self.members, self.weight, self.value = gid, members, weight, value
        self.prereqs: set = set()


def _prepare(items: list[Item], blocked_prereqs: Iterable = ()) -> tuple[dict, list[str], dict]:
    """Drop items that can never be scheduled, contract cycles, build groups."""
    blocked_prereqs = set(blocked_prereqs)
    by_id = {it.id: it for it in items}
    warnings: list[str] = []
    deferred: dict = {}

    # items whose prerequisite is open but excluded (e.g. filtered out) can't be scheduled
    blocked: set = set()
    changed = True
    while changed:
        changed = False
        for it in items:
            if it.id in blocked:
                continue
            for p in it.prereqs:
                if p in blocked_prereqs or p in blocked:
                    blocked.add(it.id)
                    deferred[it.id] = f"blocked: prerequisite {by_id[p].key if p in by_id else p} is outside this plan"
                    changed = True
                    break
    live = [it for it in items if it.id not in blocked]
    live_ids = {it.id for it in live}
    edges = [(p, it.id) for it in live for p in it.prereqs if p in live_ids]
    comps = strongly_connected_components([it.id for it in live], edges)
    gid_of = {}
    groups: dict = {}
    for comp in comps:
        members = sorted(comp, key=lambda x: str(by_id[x].key))
        gid = members[0]
        if len(members) > 1:
            warnings.append("prerequisite cycle " + " ↔ ".join(by_id[m].key for m in members)
                            + " — scheduled together as one bundle")
        g = _Group(gid, members, sum(by_id[m].weight for m in members), sum(by_id[m].value for m in members))
        groups[gid] = g
        for m in members:
            gid_of[m] = gid
    for p, d in edges:
        gp, gd = gid_of[p], gid_of[d]
        if gp != gd:
            groups[gd].prereqs.add(gp)
    return groups, warnings, deferred


def _ancestors(gid, groups: dict) -> set:
    seen, stack = set(), list(groups[gid].prereqs)
    while stack:
        x = stack.pop()
        if x not in seen:
            seen.add(x)
            stack.extend(groups[x].prereqs)
    return seen


def _units(w: float, step: float) -> int:
    return max(0, math.ceil(w / step - 1e-9))


# --------------------------------------------------------------------------- solvers

def _tree_dp(groups: dict, cap: float, step: float) -> tuple[set, int]:
    children: dict = {g: [] for g in groups}
    roots = []
    for g in groups.values():
        (children[next(iter(g.prereqs))] if g.prereqs else roots).append(g.gid)
    order: list = []
    end: list[int] = []

    def visit(root):
        stack = [(root, False)]
        while stack:
            node, done = stack.pop()
            if done:
                end[pos[node]] = len(order)
                continue
            pos[node] = len(order)
            order.append(node)
            end.append(0)
            stack.append((node, True))
            for c in sorted(children[node], key=lambda x: -groups[x].value)[::-1]:
                stack.append((c, False))

    pos: dict = {}
    for r in sorted(roots, key=lambda x: -groups[x].value):
        visit(r)
    n = len(order)
    C = int(math.floor(cap / step + 1e-9))
    w = [_units(groups[g].weight, step) for g in order]
    v = [groups[g].value for g in order]
    f = [[0.0] * (C + 1) for _ in range(n + 1)]
    take = [[False] * (C + 1) for _ in range(n)]
    for i in range(n - 1, -1, -1):
        fi, fskip, fnext = f[i], f[end[i]], f[i + 1]
        wi, vi = w[i], v[i]
        for c in range(C + 1):
            best = fskip[c]
            if wi <= c:
                t = fnext[c - wi] + vi
                if t > best + 1e-12:
                    best = t
                    take[i][c] = True
            fi[c] = best
    chosen: set = set()
    i, c = 0, C
    while i < n:
        if take[i][c]:
            chosen.add(order[i])
            c -= w[i]
            i += 1
        else:
            i = end[i]
    return chosen, (n + 1) * (C + 1)


def _greedy(groups: dict, cap: float) -> set:
    chosen: set = set()
    used = 0.0
    while True:
        best, best_ratio = None, -1.0
        for g in groups:
            if g in chosen:
                continue
            bundle = ({g} | _ancestors(g, groups)) - chosen
            bw = sum(groups[x].weight for x in bundle)
            bv = sum(groups[x].value for x in bundle)
            if used + bw <= cap + 1e-9:
                ratio = bv / bw if bw > 0 else math.inf
                if ratio > best_ratio:
                    best, best_ratio = bundle, ratio
        if best is None:
            return chosen
        chosen |= best
        used += sum(groups[x].weight for x in best)


def _branch_and_bound(groups: dict, cap: float, node_limit: int) -> tuple[set, int, bool]:
    gids = list(groups)
    edges = [(p, g) for g in gids for p in groups[g].prereqs]
    ratio = {g: (groups[g].value / groups[g].weight if groups[g].weight > 0 else math.inf) for g in gids}
    order = topological_sort(gids, edges, priority=ratio)
    pos = {g: i for i, g in enumerate(order)}
    by_ratio = sorted(order, key=lambda g: -ratio[g])
    W = [groups[g].weight for g in order]
    V = [groups[g].value for g in order]
    P = [[pos[p] for p in groups[g].prereqs] for g in order]
    R = [pos[g] for g in by_ratio]
    n = len(order)

    inc = _greedy(groups, cap)
    best_val = sum(groups[g].value for g in inc)
    best_set = {pos[g] for g in inc}
    chosen = [False] * n
    dead = [False] * n
    nodes = 0
    exhausted = True

    def bound(k: int, room: float, val: float) -> float:
        for i in R:
            if i < k or dead[i]:
                continue
            if any(not chosen[p] and p < k for p in P[i]):
                continue
            if W[i] <= room:
                room -= W[i]
                val += V[i]
            else:
                return val + (V[i] * room / W[i] if W[i] > 0 else V[i])
        return val

    def dfs(k: int, room: float, val: float) -> None:
        nonlocal best_val, best_set, nodes, exhausted
        nodes += 1
        if nodes > node_limit:
            exhausted = False
            return
        if val > best_val + 1e-9:
            best_val, best_set = val, {i for i in range(k) if chosen[i]}
        if k == n:
            return
        if bound(k, room, val) <= best_val + 1e-9:
            return
        feasible = all(chosen[p] for p in P[k])
        if feasible and W[k] <= room + 1e-9:
            chosen[k] = True
            dfs(k + 1, room - W[k], val + V[k])
            chosen[k] = False
        if not exhausted:
            return
        dead[k] = True
        dfs(k + 1, room, val)
        dead[k] = False

    dfs(0, cap, 0.0)
    return {order[i] for i in best_set}, nodes, exhausted


def _naive_dp(groups: dict, cap: float, step: float) -> tuple[set, int]:
    gids = list(groups)
    C = int(math.floor(cap / step + 1e-9))
    w = [_units(groups[g].weight, step) for g in gids]
    v = [groups[g].value for g in gids]
    n = len(gids)
    f = [[0.0] * (C + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for c in range(C + 1):
            f[i][c] = f[i - 1][c]
            if w[i - 1] <= c and f[i - 1][c - w[i - 1]] + v[i - 1] > f[i][c]:
                f[i][c] = f[i - 1][c - w[i - 1]] + v[i - 1]
    picked, c = set(), C
    for i in range(n, 0, -1):
        if f[i][c] != f[i - 1][c]:
            picked.add(gids[i - 1])
            c -= w[i - 1]
    order = topological_sort(gids, [(p, g) for g in gids for p in groups[g].prereqs])
    kept: set = set()
    for g in order:  # v1 repair: drop anything whose prerequisite was not picked
        if g in picked and groups[g].prereqs <= kept:
            kept.add(g)
    return kept, (n + 1) * (C + 1)


def _brute_force(groups: dict, cap: float) -> set:
    gids = list(groups)
    if len(gids) > 20:
        raise ValueError("brute force limited to 20 items")
    best, best_v, best_w = set(), -1.0, 0.0
    for mask in range(1 << len(gids)):
        s = {gids[i] for i in range(len(gids)) if mask >> i & 1}
        w = sum(groups[g].weight for g in s)
        if w > cap + 1e-9 or any(not groups[g].prereqs <= s for g in s):
            continue
        val = sum(groups[g].value for g in s)
        if val > best_v + 1e-9 or (abs(val - best_v) <= 1e-9 and w < best_w):
            best, best_v, best_w = s, val, w
    return best


# --------------------------------------------------------------------------- public API

def solve(items: list[Item], budget: float, method: str = "auto", force: Iterable = (),
          blocked_prereqs: Iterable = (), step: float = 0.5, node_limit: int = 300_000) -> Plan:
    t0 = time.perf_counter()
    by_id = {it.id: it for it in items}
    # prerequisites that are not in the item list (already remediated) are satisfied
    items = [Item(it.id, it.key, float(it.weight), float(it.value),
                  tuple(p for p in it.prereqs if p in by_id or p in set(blocked_prereqs)), it.title)
             for it in items]
    groups, warnings, deferred = _prepare(items, blocked_prereqs)
    plan = Plan(method=method, budget=float(budget), warnings=warnings, deferred=dict(deferred))

    # forced items (and everything they need) are taken first
    forced_groups: set = set()
    gid_of = {m: g.gid for g in groups.values() for m in g.members}
    for fid in force:
        if fid in gid_of:
            g = gid_of[fid]
            forced_groups |= {g} | _ancestors(g, groups)
    forced_w = sum(groups[g].weight for g in forced_groups)
    cap = float(budget) - forced_w
    if cap < -1e-9:
        plan.warnings.append(f"forced items need {forced_w:g}h, more than the {budget:g}h budget")
        cap = 0.0
    rest = {g: groups[g] for g in groups if g not in forced_groups}
    for g in rest.values():
        g.prereqs = {p for p in g.prereqs if p not in forced_groups}

    if method == "auto":
        method = "tree_dp" if all(len(g.prereqs) <= 1 for g in rest.values()) else "branch_and_bound"
    plan.method = method
    if method == "tree_dp":
        chosen, plan.work = _tree_dp(rest, cap, step)
        plan.optimal = all(_units(g.weight, step) * step == g.weight for g in rest.values())
        if not plan.optimal:
            plan.warnings.append(f"efforts rounded up to {step}h steps; plan is optimal for the rounded efforts")
    elif method == "branch_and_bound":
        chosen, plan.work, plan.optimal = _branch_and_bound(rest, cap, node_limit)
        if not plan.optimal:
            plan.warnings.append("search limit reached: best plan found, optimality not proven")
    elif method == "greedy":
        chosen = _greedy(rest, cap)
    elif method == "naive_dp":
        chosen, plan.work = _naive_dp(rest, cap, step)
    elif method == "brute_force":
        chosen, plan.optimal = _brute_force(rest, cap), True
    else:
        raise ValueError(f"unknown method {method!r}")

    all_groups = chosen | forced_groups
    ids = [m for g in all_groups for m in groups[g].members]
    value = {it.id: it.value for it in items}
    prereq_edges = [(p, it.id) for it in items if it.id in ids for p in it.prereqs if p in ids]
    try:
        plan.selected = topological_sort(ids, prereq_edges, priority=value)
    except Exception:
        plan.selected = sorted(ids, key=lambda x: -value[x])
    plan.forced = [m for g in forced_groups for m in groups[g].members]
    plan.total_weight = round(sum(by_id[i].weight for i in plan.selected), 2)
    plan.total_value = round(sum(by_id[i].value for i in plan.selected), 2)

    # why was each other item left out?
    sel = set(plan.selected)
    room = float(budget) - plan.total_weight
    for it in items:
        if it.id in sel or it.id in plan.deferred:
            continue
        missing = [by_id[p].key for p in it.prereqs if p in by_id and p not in sel]
        if missing:
            plan.deferred[it.id] = "needs " + ", ".join(missing) + " first"
        elif it.weight > room + 1e-9:
            plan.deferred[it.id] = f"needs {it.weight:g}h, only {max(room, 0):g}h left"
        else:
            plan.deferred[it.id] = "lower value per hour than the selected items"
    plan.millis = round(1000 * (time.perf_counter() - t0), 2)
    return plan


def compare(items: list[Item], budget: float, **kw) -> dict:
    """Optimal vs greedy vs v1's naive DP on the same input — shown on the planner page."""
    opt = solve(items, budget, "auto", **kw)
    gre = solve(items, budget, "greedy", **kw)
    nai = solve(items, budget, "naive_dp", **kw)

    def gain(a: Plan, b: Plan) -> float:
        return round(100.0 * (a.total_value - b.total_value) / b.total_value, 1) if b.total_value > 0 else 0.0

    return {
        "optimal": opt.to_dict(),
        "greedy": gre.to_dict(),
        "naive_dp": nai.to_dict(),
        "gain_vs_greedy_pct": gain(opt, gre),
        "gain_vs_naive_pct": gain(opt, nai),
    }


def items_from_ledger(rows: list[dict], categories: Iterable[str] | None = None) -> tuple[list[Item], list]:
    """Turn open ledger rows into optimiser items.  Returns (items, blocked prerequisite ids)."""
    cats = {c.upper() for c in categories} if categories else None
    open_rows = [r for r in rows if r.get("is_open", True)]
    keep = [r for r in open_rows if cats is None or (r.get("category") or "").upper() in cats]
    keep_ids = {r["id"] for r in keep}
    open_ids = {r["id"] for r in open_rows}
    blocked = [r["id"] for r in open_rows if r["id"] not in keep_ids]
    items = [Item(r["id"], r.get("key") or str(r["id"]), float(r["principal"]), float(r["risk"]),
                  tuple(p for p in r.get("prerequisite_ids") or [] if p in open_ids), r.get("title") or "")
             for r in keep]
    return items, blocked
