"""TF-IDF vectoriser and cosine similarity on sparse dict vectors.

Formula (identical to scikit-learn's defaults, verified in tests):

    idf(t)      = ln((1 + n) / (1 + df(t))) + 1          (smoothed)
    w(t, d)     = tf(t, d) * idf(t)                      (tf = raw count, or 1 + ln tf if sublinear)
    v(d)        = w(., d) / ||w(., d)||_2                (L2-normalised)
    cos(d1, d2) = v(d1) . v(d2)
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Callable, Iterable

Vector = dict[str, float]


class TfidfModel:
    def __init__(self, analyzer: Callable[[str], list[str]], *, sublinear_tf: bool = False):
        self.analyzer = analyzer
        self.sublinear_tf = sublinear_tf
        self.idf: dict[str, float] = {}
        self.n_docs = 0

    def fit(self, docs: Iterable[str]) -> "TfidfModel":
        df: Counter[str] = Counter()
        n = 0
        for d in docs:
            n += 1
            df.update(set(self.analyzer(d)))
        self.n_docs = n
        self.idf = {t: math.log((1 + n) / (1 + c)) + 1.0 for t, c in df.items()}
        return self

    def transform_one(self, doc: str) -> Vector:
        counts = Counter(t for t in self.analyzer(doc) if t in self.idf)
        vec: Vector = {}
        for t, c in counts.items():
            tf = 1.0 + math.log(c) if self.sublinear_tf else float(c)
            vec[t] = tf * self.idf[t]
        norm = math.sqrt(sum(v * v for v in vec.values()))
        if norm > 0:
            for t in vec:
                vec[t] /= norm
        return vec

    def transform(self, docs: Iterable[str]) -> list[Vector]:
        return [self.transform_one(d) for d in docs]

    def fit_transform(self, docs: list[str]) -> list[Vector]:
        return self.fit(docs).transform(docs)

    def top_terms(self, vec: Vector, k: int = 5) -> list[str]:
        return [t for t, _ in sorted(vec.items(), key=lambda kv: (-kv[1], kv[0]))[:k]]


def cosine(a: Vector, b: Vector) -> float:
    """Dot product of two L2-normalised sparse vectors."""
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def cosine_matrix(vecs: list[Vector]) -> list[list[float]]:
    n = len(vecs)
    m = [[0.0] * n for _ in range(n)]
    for i in range(n):
        m[i][i] = 1.0 if vecs[i] else 0.0
        for j in range(i + 1, n):
            s = cosine(vecs[i], vecs[j])
            m[i][j] = m[j][i] = s
    return m


def dense_cosine(a: list[float], b: list[float]) -> float:
    """Cosine of two dense vectors (embeddings)."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def dense_cosine_matrix(vecs: list[list[float]]) -> list[list[float]]:
    norms = [math.sqrt(sum(x * x for x in v)) or 1.0 for v in vecs]
    unit = [[x / nrm for x in v] for v, nrm in zip(vecs, norms)]
    n = len(unit)
    m = [[0.0] * n for _ in range(n)]
    for i in range(n):
        m[i][i] = 1.0
        ui = unit[i]
        for j in range(i + 1, n):
            s = sum(x * y for x, y in zip(ui, unit[j]))
            m[i][j] = m[j][i] = s
    return m
