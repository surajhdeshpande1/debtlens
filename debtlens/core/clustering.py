"""DBSCAN over cosine distance (module M6: root-cause clustering).

DBSCAN needs no preset number of clusters and labels isolated points as noise (-1),
which suits root causes: most recur in families, some are genuine one-offs.

    core point:   |N_eps(p)| >= min_samples   (N_eps includes p itself)
    cluster:      all points density-reachable from a core point
    noise:        neither core nor reachable  -> label -1
"""

from __future__ import annotations

from collections import defaultdict

from . import text as T
from .tfidf import TfidfModel


def dbscan(dist: list[list[float]], eps: float, min_samples: int) -> list[int]:
    n = len(dist)
    neighbors = [[j for j in range(n) if dist[i][j] <= eps] for i in range(n)]
    labels: list[int | None] = [None] * n
    cluster = -1
    for i in range(n):
        if labels[i] is not None:
            continue
        if len(neighbors[i]) < min_samples:
            labels[i] = -1
            continue
        cluster += 1
        labels[i] = cluster
        queue = list(neighbors[i])
        k = 0
        while k < len(queue):
            q = queue[k]
            k += 1
            if labels[q] == -1:
                labels[q] = cluster  # border point previously marked noise
            if labels[q] is not None:
                continue
            labels[q] = cluster
            if len(neighbors[q]) >= min_samples:
                queue.extend(neighbors[q])
    return [int(x) for x in labels]  # type: ignore[arg-type]


def similarity_to_distance(sim: list[list[float]]) -> list[list[float]]:
    return [[min(2.0, max(0.0, 1.0 - s)) for s in row] for row in sim]


# generic words that make poor cluster names (they stay in the similarity model)
_THEME_SKIP = {"one", "two", "three", "four", "five", "every", "each", "all", "same", "new", "old", "still",
               "never", "always", "no", "not", "was", "were", "is", "are", "had", "has", "have", "did", "does"}


def cluster_texts(texts: list[str], sim: list[list[float]], eps: float = 0.45,
                  min_samples: int = 2, ids: list | None = None) -> list[dict]:
    """Cluster items and name each cluster by its strongest shared terms."""
    ids = ids if ids is not None else list(range(len(texts)))
    if len(texts) < 2:
        return []
    labels = dbscan(similarity_to_distance(sim), eps, min_samples)
    groups: dict[int, list[int]] = defaultdict(list)
    for idx, lab in enumerate(labels):
        groups[lab].append(idx)
    model = TfidfModel(lambda s: T.words(s)).fit(texts)
    out = []
    for lab, members in groups.items():
        weight: dict[str, float] = defaultdict(float)
        for m in members:
            for t, w in model.transform_one(texts[m]).items():
                weight[t] += w
        terms = [t for t, _ in sorted(weight.items(), key=lambda kv: (-kv[1], kv[0])) if t not in _THEME_SKIP][:3]
        cohesion = 0.0
        if len(members) > 1:
            pairs = [(a, b) for ai, a in enumerate(members) for b in members[ai + 1 :]]
            cohesion = sum(sim[a][b] for a, b in pairs) / len(pairs)
        out.append({
            "cluster_id": lab,
            "is_noise": lab == -1,
            "theme": "Unclustered one-offs" if lab == -1 else " · ".join(terms),
            "size": len(members),
            "cohesion": round(cohesion, 4),
            "member_ids": [ids[m] for m in members],
            "members": [texts[m] for m in members],
        })
    out.sort(key=lambda c: (c["is_noise"], -c["size"]))
    return out
