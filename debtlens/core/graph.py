"""Graph algorithms for the causal graph (M3) and the module dependency graph (M5).

* degree centrality      C_D(v) = (deg_in(v) + deg_out(v)) / (n − 1)
* betweenness centrality C_B(v) = Σ_{s≠v≠t} σ_st(v) / σ_st, normalised by (n−1)(n−2)
                         (Brandes 2001, O(V·E) for unweighted directed graphs)
* blast radius           |{ m : m transitively depends on v }|   (DFS on reversed edges)
* topological order      Kahn's algorithm; strongly connected components by Tarjan

Edge frequency in the causal graph is a *strength*, not a distance, so betweenness is
computed on hop counts (v1 passed frequency as a path length, which ranked the most
frequent links as the "longest" — the opposite of what was intended).
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Hashable, Iterable

Node = Hashable


class CycleError(ValueError):
    def __init__(self, cycle: list):
        super().__init__("dependency cycle: " + " -> ".join(map(str, cycle)))
        self.cycle = cycle


def _adjacency(nodes: Iterable[Node], edges: Iterable[tuple[Node, Node]]):
    nodes = list(dict.fromkeys(nodes))
    succ: dict[Node, list[Node]] = {v: [] for v in nodes}
    pred: dict[Node, list[Node]] = {v: [] for v in nodes}
    for a, b in edges:
        if a == b:
            continue
        for x in (a, b):
            if x not in succ:
                succ[x], pred[x] = [], []
                nodes.append(x)
        if b not in succ[a]:
            succ[a].append(b)
            pred[b].append(a)
    return nodes, succ, pred


def degree_centrality(nodes: Iterable[Node], edges: Iterable[tuple[Node, Node]]) -> dict[Node, float]:
    nodes, succ, pred = _adjacency(nodes, edges)
    n = len(nodes)
    if n <= 1:
        return {v: 1.0 for v in nodes}
    return {v: (len(succ[v]) + len(pred[v])) / (n - 1) for v in nodes}


def betweenness_centrality(nodes: Iterable[Node], edges: Iterable[tuple[Node, Node]],
                           normalized: bool = True) -> dict[Node, float]:
    """Brandes' algorithm for directed, unweighted graphs."""
    nodes, succ, _ = _adjacency(nodes, edges)
    cb = {v: 0.0 for v in nodes}
    for s in nodes:
        stack: list[Node] = []
        preds: dict[Node, list[Node]] = {v: [] for v in nodes}
        sigma = dict.fromkeys(nodes, 0.0)
        sigma[s] = 1.0
        dist = dict.fromkeys(nodes, -1)
        dist[s] = 0
        q = deque([s])
        while q:
            v = q.popleft()
            stack.append(v)
            for w in succ[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    q.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    preds[w].append(v)
        delta = dict.fromkeys(nodes, 0.0)
        while stack:
            w = stack.pop()
            for v in preds[w]:
                delta[v] += sigma[v] / sigma[w] * (1.0 + delta[w])
            if w != s:
                cb[w] += delta[w]
    n = len(nodes)
    if normalized and n > 2:
        scale = 1.0 / ((n - 1) * (n - 2))
        cb = {v: c * scale for v, c in cb.items()}
    return cb


def dependents_closure(module: Node, deps: Iterable[tuple[Node, Node]]) -> set[Node]:
    """All modules that (transitively) depend on ``module``.  deps: (source depends on target)."""
    rev: dict[Node, set[Node]] = defaultdict(set)
    for src, tgt in deps:
        if src != tgt:
            rev[tgt].add(src)
    seen: set[Node] = set()
    stack = [module]
    while stack:
        cur = stack.pop()
        for parent in rev.get(cur, ()):
            if parent not in seen and parent != module:
                seen.add(parent)
                stack.append(parent)
    return seen


def blast_radius(modules: Iterable[Node], deps: Iterable[tuple[Node, Node]]) -> dict[Node, int]:
    deps = [(a, b) for a, b in deps]
    mods = set(modules) | {a for a, _ in deps} | {b for _, b in deps}
    return {m: len(dependents_closure(m, deps)) for m in mods}


def strongly_connected_components(nodes: Iterable[Node], edges: Iterable[tuple[Node, Node]]) -> list[list[Node]]:
    """Tarjan's algorithm (iterative).  Components are returned in reverse topological order."""
    nodes, succ, _ = _adjacency(nodes, edges)
    index: dict[Node, int] = {}
    low: dict[Node, int] = {}
    on_stack: set[Node] = set()
    stack: list[Node] = []
    comps: list[list[Node]] = []
    counter = 0
    for root in nodes:
        if root in index:
            continue
        work = [(root, 0)]
        while work:
            v, i = work.pop()
            if i == 0:
                index[v] = low[v] = counter
                counter += 1
                stack.append(v)
                on_stack.add(v)
            recurse = False
            nbrs = succ[v]
            while i < len(nbrs):
                w = nbrs[i]
                i += 1
                if w not in index:
                    work.append((v, i))
                    work.append((w, 0))
                    recurse = True
                    break
                if w in on_stack:
                    low[v] = min(low[v], index[w])
            if recurse:
                continue
            if low[v] == index[v]:
                comp = []
                while True:
                    w = stack.pop()
                    on_stack.discard(w)
                    comp.append(w)
                    if w == v:
                        break
                comps.append(comp)
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[v])
    return comps


def find_cycle(nodes: Iterable[Node], edges: Iterable[tuple[Node, Node]]) -> list[Node] | None:
    edges = list(edges)
    for comp in strongly_connected_components(nodes, edges):
        if len(comp) > 1:
            return comp + [comp[0]]
    for a, b in edges:
        if a == b:
            return [a, a]
    return None


def topological_sort(nodes: Iterable[Node], edges: Iterable[tuple[Node, Node]],
                     priority: dict[Node, float] | None = None) -> list[Node]:
    """Kahn's algorithm; ties broken by higher ``priority`` then node order.  Raises CycleError."""
    nodes, succ, pred = _adjacency(nodes, list(edges))
    order_ix = {v: i for i, v in enumerate(nodes)}
    priority = priority or {}
    indeg = {v: len(pred[v]) for v in nodes}
    ready = [v for v in nodes if indeg[v] == 0]
    out: list[Node] = []
    while ready:
        ready.sort(key=lambda v: (-priority.get(v, 0.0), order_ix[v]))
        v = ready.pop(0)
        out.append(v)
        for w in succ[v]:
            indeg[w] -= 1
            if indeg[w] == 0:
                ready.append(w)
    if len(out) != len(nodes):
        raise CycleError(find_cycle(nodes, [(a, b) for a in nodes for b in succ[a]]) or [])
    return out
