"""Vertex AI text-embedding-005 client.

Lazy init, batch API, deterministic empty-vector fallback when ADC is
unavailable so the pipeline never crashes for AI-config reasons.

Output dim: 768.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Optional

log = logging.getLogger("procvault.docs.embedding")

EMBED_DIM = 768
_MODEL_NAME = os.environ.get("PROCVAULT_EMBED_MODEL", "text-embedding-005")
_PROJECT = os.environ.get("GEMINI_VERTEX_PROJECT", "gen-lang-client-0226029743")
_LOCATION = os.environ.get("GEMINI_VERTEX_LOCATION", "us-central1")
_BATCH_SIZE = 100   # Vertex limit per request

_model = None
_init_attempted = False
_init_lock = threading.Lock()


def _get_model():
    """Memoised — returns the embedding model or None if unavailable."""
    global _model, _init_attempted
    if _init_attempted:
        return _model
    with _init_lock:
        if _init_attempted:
            return _model
        _init_attempted = True
        try:
            import vertexai
            from vertexai.language_models import TextEmbeddingModel
            vertexai.init(project=_PROJECT, location=_LOCATION)
            _model = TextEmbeddingModel.from_pretrained(_MODEL_NAME)
            log.info("Embedding model ready: %s @ %s/%s",
                     _MODEL_NAME, _PROJECT, _LOCATION)
        except Exception as e:
            log.warning("Embedding model init failed: %s. "
                        "Doc ingestion will store chunks without vectors.", e)
            _model = None
        return _model


def is_enabled() -> bool:
    return _get_model() is not None


def embed_batch(texts: list[str]) -> list[Optional[list[float]]]:
    """Embed a list of texts. Returns one vector per input (or None if
    the embedding call failed for that specific text). NEVER raises;
    callers can mix-and-match successful + failed chunks."""
    if not texts:
        return []
    model = _get_model()
    if model is None:
        return [None] * len(texts)
    out: list[Optional[list[float]]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i:i + _BATCH_SIZE]
        try:
            resp = model.get_embeddings(batch)
            out.extend([list(e.values) for e in resp])
        except Exception as e:
            log.warning("embed_batch failed for batch %d-%d: %s",
                        i, i + len(batch), e)
            out.extend([None] * len(batch))
    return out


def embed_one(text: str) -> Optional[list[float]]:
    out = embed_batch([text])
    return out[0] if out else None
