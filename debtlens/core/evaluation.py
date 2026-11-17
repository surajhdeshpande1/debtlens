"""Measured analytical performance (synopsis §9): retrieval, clustering and regression metrics.

Retrieval (similar-incident search) — for every incident that has a labelled duplicate:
    P@k   = |relevant ∩ top-k| / k
    Hit@k = 1 if any relevant incident is in the top-k
    MRR   = mean of 1 / rank of the first relevant incident
Clustering (root-cause grouping):
    purity = Σ_clusters max_class |cluster ∩ class| / N     (noise points count as singletons)
    ARI    = adjusted Rand index (1 = identical partitions, 0 = chance)
Regression detection: precision, recall, F1 over (new incident, regressed-from) pairs.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from math import comb


def retrieval_metrics(sim: list[list[float]], groups: list, ks: tuple = (1, 3, 5)) -> dict:
    n = len(sim)
    members = defaultdict(set)
    for i, g in enumerate(groups):
        if g:
            members[g].add(i)
    p_at = {k: [] for k in ks}
    hit_at = {k: [] for k in ks}
    rr = []
    for i in range(n):
        g = groups[i]
        rel = members[g] - {i} if g else set()
        if not rel:
            continue
        ranked = sorted((j for j in range(n) if j != i), key=lambda j: -sim[i][j])
        for k in ks:
            top = ranked[:k]
            p_at[k].append(len(rel & set(top)) / k)
            hit_at[k].append(1.0 if rel & set(top) else 0.0)
        first = next((r for r, j in enumerate(ranked, 1) if j in rel), None)
        rr.append(1.0 / first if first else 0.0)
    q = len(rr)
    out = {"queries": q}
    for k in ks:
        out[f"p@{k}"] = round(sum(p_at[k]) / q, 4) if q else None
        out[f"hit@{k}"] = round(sum(hit_at[k]) / q, 4) if q else None
    out["mrr"] = round(sum(rr) / q, 4) if q else None
    return out


def purity(pred: list[int], truth: list) -> float:
    if not pred:
        return 0.0
    clusters = defaultdict(list)
    for i, (p, t) in enumerate(zip(pred, truth)):
        clusters[p if p != -1 else f"noise-{i}"].append(t)
    return round(sum(Counter(ts).most_common(1)[0][1] for ts in clusters.values()) / len(pred), 4)


def adjusted_rand_index(a: list, b: list) -> float:
    n = len(a)
    if n < 2:
        return 1.0
    a = [x if x != -1 else f"noise-{i}" for i, x in enumerate(a)]
    cont = Counter(zip(a, b))
    sum_comb = sum(comb(v, 2) for v in cont.values())
    sa = sum(comb(v, 2) for v in Counter(a).values())
    sb = sum(comb(v, 2) for v in Counter(b).values())
    expected = sa * sb / comb(n, 2)
    max_index = (sa + sb) / 2
    if max_index == expected:
        return 1.0
    return round((sum_comb - expected) / (max_index - expected), 4)


def pair_scores(predicted: set, truth: set) -> dict:
    tp = len(predicted & truth)
    fp = len(predicted - truth)
    fn = len(truth - predicted)
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 4), "recall": round(r, 4), "f1": round(f1, 4)}


def regression_scores(predicted: set, truth: set) -> dict:
    """predicted: {(new, old)} one per flagged incident; truth: every valid (new, old) pair.
    A flag is correct when its (new, old) pair is valid; a true regression is found when
    any valid pair for that incident is predicted."""
    truth_new = {n for n, _ in truth}
    tp_pairs = predicted & truth
    tp = len(tp_pairs)
    fp = len(predicted) - tp
    fn = len(truth_new - {n for n, _ in tp_pairs})
    p = tp / (tp + fp) if tp + fp else 0.0
    r = (len(truth_new) - fn) / len(truth_new) if truth_new else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 4), "recall": round(r, 4), "f1": round(f1, 4)}
