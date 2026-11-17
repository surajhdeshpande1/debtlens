"""Hybrid incident similarity and regression detection (module M6).

    sim(i, j) = α · cos(tfidf_i, tfidf_j) + (1 − α) · cos(emb_i, emb_j)

* lexical  – word unigram+bigram TF-IDF (exact vocabulary overlap: "HTTP 502", "pool")
* semantic – MiniLM sentence embeddings (meaning: "timed out" ≈ "hung waiting")
             falls back to character n-gram TF-IDF when the model is unavailable
* regression – incident i regresses resolved incident j when
               sim(i, j) ≥ τ, same module, and i was reported after j was resolved.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable

from . import text as T
from .tfidf import TfidfModel, cosine, cosine_matrix, dense_cosine, dense_cosine_matrix

# Calibrated on the five labelled scenarios (see Intelligence → Evaluation):
# α = 0.4: hybrid precision@1 0.92 vs TF-IDF 0.69 and MiniLM 0.88 (mean of five); τ = 0.30: best regression F1.
DEFAULT_ALPHA = 0.4
DEFAULT_TAU = 0.30  # regression threshold: best mean F1 (0.88; P 0.90, R 0.87) over the five labelled scenarios
SEMANTIC_MINILM = "minilm"
SEMANTIC_CHAR = "char-ngram"


def incident_text(inc: dict) -> str:
    """Text used for similarity: title + description (module is NOT included so
    'same module' does not inflate similarity; it is a separate rule)."""
    return f"{inc.get('title', '')}. {inc.get('description', '') or ''}".strip()


@dataclass
class SimilarityBundle:
    texts: list[str]
    lexical: list[list[float]]
    semantic: list[list[float]]
    hybrid: list[list[float]]
    alpha: float
    semantic_method: str

    def score(self, i: int, j: int) -> dict:
        return {
            "hybrid": round(self.hybrid[i][j], 4),
            "lexical": round(self.lexical[i][j], 4),
            "semantic": round(self.semantic[i][j], 4),
        }


def lexical_matrix(texts: list[str]) -> list[list[float]]:
    return cosine_matrix(TfidfModel(T.word_analyzer).fit_transform(texts))


def char_matrix(texts: list[str]) -> list[list[float]]:
    return cosine_matrix(TfidfModel(T.char_ngrams, sublinear_tf=True).fit_transform(texts))


def semantic_matrix(
    texts: list[str],
    embeddings: list[list[float] | None] | None = None,
    embed_fn: Callable[[list[str]], list[list[float]]] | None = None,
) -> tuple[list[list[float]], str]:
    """MiniLM cosine matrix when vectors are available, otherwise char n-gram TF-IDF."""
    vecs = list(embeddings) if embeddings is not None else [None] * len(texts)
    missing = [i for i, v in enumerate(vecs) if v is None]
    if missing and embed_fn is not None:
        try:
            new = embed_fn([texts[i] for i in missing])
            for i, v in zip(missing, new):
                vecs[i] = v
            missing = []
        except Exception:
            pass
    if not missing and texts:
        return dense_cosine_matrix(vecs), SEMANTIC_MINILM  # type: ignore[arg-type]
    return char_matrix(texts), SEMANTIC_CHAR


def build(
    texts: list[str],
    alpha: float = DEFAULT_ALPHA,
    embeddings: list[list[float] | None] | None = None,
    embed_fn: Callable[[list[str]], list[list[float]]] | None = None,
) -> SimilarityBundle:
    lex = lexical_matrix(texts)
    sem, method = semantic_matrix(texts, embeddings, embed_fn)
    n = len(texts)
    hyb = [[alpha * lex[i][j] + (1 - alpha) * sem[i][j] for j in range(n)] for i in range(n)]
    return SimilarityBundle(texts, lex, sem, hyb, alpha, method)


def top_similar(bundle: SimilarityBundle, i: int, k: int = 5, threshold: float = 0.0,
                exclude: set[int] | None = None) -> list[tuple[int, dict]]:
    """Threshold-then-rank retrieval (Laney et al. 2025 favour thresholds over fixed top-k)."""
    exclude = exclude or set()
    cands = [
        (j, bundle.score(i, j))
        for j in range(len(bundle.texts))
        if j != i and j not in exclude and bundle.hybrid[i][j] >= threshold
    ]
    cands.sort(key=lambda x: -x[1]["hybrid"])
    return cands[:k]


def query_similar(query: str, texts: list[str], alpha: float = DEFAULT_ALPHA,
                  embeddings: list[list[float] | None] | None = None,
                  query_embedding: list[float] | None = None,
                  embed_fn: Callable[[list[str]], list[list[float]]] | None = None,
                  k: int = 5, threshold: float = 0.0) -> tuple[list[tuple[int, dict]], str]:
    """Rank existing texts against a new piece of text (duplicate check before reporting)."""
    all_texts = texts + [query]
    lex_model = TfidfModel(T.word_analyzer).fit(all_texts)
    qv = lex_model.transform_one(query)
    lex = [cosine(qv, v) for v in lex_model.transform(texts)]
    method = SEMANTIC_CHAR
    sem: list[float]
    vecs = list(embeddings) if embeddings is not None else [None] * len(texts)
    qe = query_embedding
    if embed_fn is not None:
        try:
            missing = [i for i, v in enumerate(vecs) if v is None]
            if missing:
                for i, v in zip(missing, embed_fn([texts[i] for i in missing])):
                    vecs[i] = v
            if qe is None:
                qe = embed_fn([query])[0]
        except Exception:
            pass
    if qe is not None and all(v is not None for v in vecs):
        sem = [dense_cosine(qe, v) for v in vecs]  # type: ignore[arg-type]
        method = SEMANTIC_MINILM
    else:
        cm = TfidfModel(T.char_ngrams, sublinear_tf=True).fit(all_texts)
        cq = cm.transform_one(query)
        sem = [cosine(cq, v) for v in cm.transform(texts)]
    out = []
    for j in range(len(texts)):
        h = alpha * lex[j] + (1 - alpha) * sem[j]
        if h >= threshold:
            out.append((j, {"hybrid": round(h, 4), "lexical": round(lex[j], 4), "semantic": round(sem[j], 4)}))
    out.sort(key=lambda x: -x[1]["hybrid"])
    return out[:k], method


def _ts(v: Any) -> datetime | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v
    s = str(v).replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        return None
    return d.replace(tzinfo=None)


def detect_regressions(incidents: list[dict], bundle: SimilarityBundle, tau: float = DEFAULT_TAU) -> list[dict]:
    """For every incident, the most similar earlier-resolved incident in the same module
    with sim ≥ τ that it recurred after.  Output is ordered newest first."""
    out = []
    for i, new in enumerate(incidents):
        rep = _ts(new.get("reported_at"))
        if rep is None:
            continue
        best = None
        for j, old in enumerate(incidents):
            if i == j or (old.get("status") or "").upper() != "RESOLVED":
                continue
            res = _ts(old.get("resolved_at"))
            if res is None or rep <= res:
                continue
            if (new.get("module") or "").lower() != (old.get("module") or "").lower():
                continue
            s = bundle.hybrid[i][j]
            if s >= tau and (best is None or s > best[1]):
                best = (j, s, res)
        if best:
            j, s, res = best
            old = incidents[j]
            out.append({
                "incident_id": new.get("id"),
                "incident_key": new.get("key"),
                "incident_title": new.get("title"),
                "regressed_from_id": old.get("id"),
                "regressed_from_key": old.get("key"),
                "regressed_from_title": old.get("title"),
                "module": new.get("module"),
                "similarity": round(s, 4),
                **{k: round(v, 4) for k, v in bundle.score(i, j).items() if k != "hybrid"},
                "resolved_at": res.isoformat(),
                "reported_at": rep.isoformat(),
                "days_to_recurrence": round((rep - res).total_seconds() / 86400.0, 1),
            })
    out.sort(key=lambda r: r["reported_at"], reverse=True)
    return out
