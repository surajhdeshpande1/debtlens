"""Text utilities shared by the similarity, clustering and causal modules."""

from __future__ import annotations

import re
import unicodedata

# Small English stop-word list (function words only; technical words are kept).
STOPWORDS = frozenset(
    """
    a about above after again against all also am an and any are as at be because been
    before being below between both but by can could did do does doing down during each
    few for from further had has have having he her here hers him his how i if in into
    is it its itself just me more most my no nor not now of off on once only or other
    our ours out over own same she should so some such than that the their theirs them
    then there these they this those through to too under until up upon very via was we
    were what when where which while who whom why will with within without would you
    your yours
    """.split()
)

_WS = re.compile(r"\s+")
_WORD = re.compile(r"[a-z0-9][a-z0-9_]*")
_PUNCT = re.compile(r"[^\w\s]")


def normalize(text: str) -> str:
    """Lower-case, strip accents and collapse whitespace."""
    if not text:
        return ""
    t = unicodedata.normalize("NFKD", str(text))
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return _WS.sub(" ", t.lower()).strip()


def words(text: str, *, stop: bool = True, min_len: int = 2) -> list[str]:
    """Word tokens (``[a-z0-9_]+``), optionally without stop words."""
    toks = _WORD.findall(normalize(text))
    return [w for w in toks if len(w) >= min_len and not (stop and w in STOPWORDS)]


def word_ngrams(tokens: list[str], n_max: int = 2) -> list[str]:
    """Unigrams plus n-grams up to ``n_max`` built from an already-filtered token list."""
    out = list(tokens)
    for n in range(2, n_max + 1):
        out.extend(" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1))
    return out


def word_analyzer(text: str) -> list[str]:
    """Analyzer used for lexical TF-IDF: stop-word-filtered unigrams + bigrams."""
    return word_ngrams(words(text), 2)


def char_ngrams(text: str, n_min: int = 3, n_max: int = 5) -> list[str]:
    """Character n-grams inside word boundaries (same rule as scikit-learn ``char_wb``).

    Each word is padded with one space on both sides so prefixes/suffixes get their
    own grams ("timeout" -> " ti", "tim", ..., "ut ").  Robust to typos and
    morphological variants ("timed out" vs "timeout").
    """
    out: list[str] = []
    for w in normalize(text).split():
        w = f" {w} "
        w_len = len(w)
        for n in range(n_min, n_max + 1):
            offset = 0
            out.append(w[offset : offset + n])
            while offset + n < w_len:
                offset += 1
                out.append(w[offset : offset + n])
            if offset == 0:  # word shorter than n: counted once
                break
    return out


def normalize_cause(text: str) -> str:
    """Canonical form of a 5-Whys answer used to merge identical causes."""
    t = _PUNCT.sub(" ", normalize(text))
    return _WS.sub(" ", t).strip()


def content_tokens(text: str) -> set[str]:
    """Stop-word-free token set, used for token-overlap fallbacks."""
    return set(words(text))


def token_overlap(a: str, b: str) -> float:
    """|A ∩ B| / max(|A|, |B|) over content tokens (v1's convergence rule)."""
    ta, tb = content_tokens(a), content_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def shared_terms(a: str, b: str, limit: int = 10) -> list[str]:
    """Content words two texts have in common (for 'why are these similar?')."""
    return sorted(content_tokens(a) & content_tokens(b))[:limit]
