"""Sentence embeddings with all-MiniLM-L6-v2 (384-d), run on CPU through ONNX Runtime.

Pipeline (same as sentence-transformers):
    1. WordPiece tokenisation (bert-base-uncased vocab, lower-case, max 256 tokens)
    2. ONNX forward pass -> last_hidden_state  [batch, tokens, 384]
    3. mean pooling over real tokens (attention mask)
    4. L2 normalisation  -> cosine similarity is a plain dot product

The model is optional.  It needs ``numpy``, ``onnxruntime`` and ``tokenizers``
(``pip install "debtlens[ml]"``) and two files from the official Hugging Face
repository, downloaded once and cached.  When it is unavailable every caller
falls back to character n-gram TF-IDF and says so (``status()["available"]``).
"""

from __future__ import annotations

import base64
import os
import struct
import threading
import time
import urllib.request
from pathlib import Path

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
DIM = 384
MAX_TOKENS = 256
_ONNX_CANDIDATES = ("onnx/model_quint8_avx2.onnx", "onnx/model_qint8_avx512.onnx", "onnx/model.onnx")
_MODEL_FILE = "model.onnx"
_VOCAB_FILE = "vocab.txt"

_lock = threading.Lock()
_instance: "MiniLM | None" = None
_last_error: str | None = None
_failed_at = 0.0
RETRY_AFTER_S = 600  # after a failed download, do not retry on every request


def model_dir() -> Path:
    """Where the model files live (override with DEBTLENS_MODEL_DIR)."""
    env = os.environ.get("DEBTLENS_MODEL_DIR")
    if env:
        return Path(env)
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path("/tmp/debtlens-models/all-MiniLM-L6-v2")
    return Path.home() / ".cache" / "debtlens" / "models" / "all-MiniLM-L6-v2"


def _files_present(d: Path) -> bool:
    return (d / _MODEL_FILE).is_file() and (d / _VOCAB_FILE).is_file()


def _download(url: str, dest: Path, timeout: float = 60.0) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "debtlens/2"})
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(req, timeout=timeout) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    if tmp.stat().st_size < 1000:
        tmp.unlink(missing_ok=True)
        raise IOError(f"download too small: {url}")
    tmp.replace(dest)


def _timeout() -> float:
    return 20.0 if os.environ.get("VERCEL") else 120.0


def ensure_model(download: bool = True) -> Path | None:
    """Return the model directory, downloading the files from Hugging Face if needed."""
    global _last_error
    d = model_dir()
    if _files_present(d):
        return d
    if not download:
        _last_error = f"model files not found in {d}"
        return None
    base = os.environ.get("DEBTLENS_HF_BASE", "https://huggingface.co").rstrip("/")
    try:
        d.mkdir(parents=True, exist_ok=True)
        if not (d / _VOCAB_FILE).is_file():
            _download(f"{base}/{MODEL_ID}/resolve/main/vocab.txt", d / _VOCAB_FILE, timeout=_timeout())
        if not (d / _MODEL_FILE).is_file():
            errors = []
            for cand in _ONNX_CANDIDATES:
                try:
                    _download(f"{base}/{MODEL_ID}/resolve/main/{cand}", d / _MODEL_FILE, timeout=_timeout())
                    (d / "SOURCE.txt").write_text(f"{base}/{MODEL_ID}/resolve/main/{cand}\n")
                    break
                except Exception as e:  # try the next variant
                    errors.append(f"{cand}: {e}")
            else:
                raise IOError("; ".join(errors))
        return d
    except Exception as e:
        _last_error = f"download failed: {e}"
        return None


class MiniLM:
    """Thin wrapper around the ONNX session + WordPiece tokenizer."""

    def __init__(self, directory: Path):
        import numpy as np  # noqa: F401  (fail fast if the ML extra is missing)
        import onnxruntime as ort
        from tokenizers import BertWordPieceTokenizer

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(directory / _MODEL_FILE), sess_options=opts, providers=["CPUExecutionProvider"]
        )
        self.input_names = {i.name for i in self.session.get_inputs()}
        self.tokenizer = BertWordPieceTokenizer(str(directory / _VOCAB_FILE), lowercase=True)
        self.tokenizer.enable_truncation(max_length=MAX_TOKENS)
        self.directory = directory

    def embed(self, texts: list[str], batch_size: int = 1) -> list[list[float]]:
        """One text per forward pass by default: the quantised model scales activations per
        batch (dynamic quantisation), so batching would make a text's vector depend on which
        other texts share its batch.  One-at-a-time keeps every vector reproducible."""
        import numpy as np

        out: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            batch = [t if t and t.strip() else "." for t in texts[start : start + batch_size]]
            enc = self.tokenizer.encode_batch(batch)
            width = max(len(e.ids) for e in enc)
            ids = np.zeros((len(enc), width), dtype=np.int64)
            mask = np.zeros((len(enc), width), dtype=np.int64)
            for i, e in enumerate(enc):
                ids[i, : len(e.ids)] = e.ids
                mask[i, : len(e.ids)] = 1
            feeds = {"input_ids": ids, "attention_mask": mask}
            if "token_type_ids" in self.input_names:
                feeds["token_type_ids"] = np.zeros_like(ids)
            hidden = self.session.run(None, feeds)[0]  # [b, t, 384]
            m = mask[..., None].astype(np.float32)
            pooled = (hidden * m).sum(axis=1) / np.clip(m.sum(axis=1), 1e-9, None)
            pooled /= np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12, None)
            out.extend(pooled.astype(float).tolist())
        return out


def get_embedder(download: bool = True) -> MiniLM | None:
    """Process-wide singleton.  Returns None (and records why) if unavailable."""
    global _instance, _last_error, _failed_at
    if os.environ.get("DEBTLENS_DISABLE_ML") == "1":
        _last_error = "disabled by DEBTLENS_DISABLE_ML=1"
        return None
    if _instance is not None:
        return _instance
    if _failed_at and time.time() - _failed_at < RETRY_AFTER_S:
        return None
    with _lock:
        if _instance is not None:
            return _instance
        try:
            import numpy  # noqa: F401
            import onnxruntime  # noqa: F401
            import tokenizers  # noqa: F401
        except ImportError as e:
            _last_error = f"ML extra not installed ({e.name}); pip install 'debtlens[ml]'"
            return None
        d = ensure_model(download=download)
        if d is None:
            if download:
                _failed_at = time.time()
            return None
        try:
            t0 = time.time()
            _instance = MiniLM(d)
            _instance.load_seconds = round(time.time() - t0, 2)  # type: ignore[attr-defined]
            _last_error = None
        except Exception as e:
            _last_error = f"model load failed: {e}"
            _failed_at = time.time()
            return None
    return _instance


def status() -> dict:
    return {
        "model": MODEL_ID,
        "dimensions": DIM,
        "available": _instance is not None,
        "downloaded": _files_present(model_dir()),
        "path": str(model_dir()),
        "error": _last_error,
    }


def reset_for_tests() -> None:
    global _instance, _last_error, _failed_at
    _instance, _last_error, _failed_at = None, None, 0.0


# ---- compact storage: float32 little-endian, base64 for JSON --------------------------

def pack(vec: list[float]) -> bytes:
    return struct.pack(f"<{len(vec)}f", *vec)


def unpack(blob: bytes | None) -> list[float] | None:
    if not blob:
        return None
    return list(struct.unpack(f"<{len(blob) // 4}f", blob))


def to_b64(vec: list[float]) -> str:
    return base64.b64encode(pack(vec)).decode("ascii")


def from_b64(s: str | None) -> list[float] | None:
    return unpack(base64.b64decode(s)) if s else None
