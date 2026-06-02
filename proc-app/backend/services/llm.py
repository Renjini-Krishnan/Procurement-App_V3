"""LLM client — Vertex AI Gemini 2.5 Pro with deterministic fallback.

Auth: Application Default Credentials (ADC). No API keys in code.
Setup on a new machine:  `gcloud auth application-default login`

Every callable in this module MUST never raise — if Vertex AI is
unavailable for any reason (no ADC, network error, quota, sandbox
without GCP access), the call returns the deterministic fallback
the caller supplied. This is non-negotiable per the integration spec
at proc-app/kb/functions/procurement/_meta/ai-integration.md.

Agentic trace: every call is logged to an in-memory ring buffer
(THREAD-LOCAL per process). The /api/llm/trace endpoint exposes the
last N entries so consultants can see what the AI did, when, with
which prompt, and whether it succeeded or fell back.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
import uuid
from collections import deque
from typing import Any, Callable, Optional

log = logging.getLogger("procvault.llm")

_DEFAULT_PROJECT = os.environ.get("GEMINI_VERTEX_PROJECT", "gen-lang-client-0226029743")
_DEFAULT_LOCATION = os.environ.get("GEMINI_VERTEX_LOCATION", "us-central1")
_MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")

# Cache the model so we don't re-init on every call
_model = None
_model_init_attempted = False
_init_lock = threading.Lock()


def _get_model():
    """Return a cached GenerativeModel instance, or None if unavailable.

    Memoised: after the first attempt we never re-try (avoids spamming
    auth/network errors on every request). Set PROCVAULT_LLM_RETRY=1 in
    the env to force a re-attempt at startup of a new process.
    """
    global _model, _model_init_attempted
    if _model_init_attempted:
        return _model
    with _init_lock:
        if _model_init_attempted:
            return _model
        _model_init_attempted = True
        try:
            import vertexai  # noqa: F401
            from vertexai.generative_models import GenerativeModel
            vertexai.init(project=_DEFAULT_PROJECT, location=_DEFAULT_LOCATION)
            _model = GenerativeModel(_MODEL_NAME)
            log.info("LLM ready: %s @ %s/%s", _MODEL_NAME, _DEFAULT_PROJECT, _DEFAULT_LOCATION)
        except Exception as e:
            log.warning("LLM disabled — Vertex AI init failed: %s. Falling back to deterministic output.", e)
            _model = None
        return _model


def is_enabled() -> bool:
    return _get_model() is not None


# ---------------------------------------------------------------------------
# Public callable: generate_text
# ---------------------------------------------------------------------------

def generate_text(prompt: str, fallback: str, *, temperature: float = 0.3,
                   max_chars: int = 2000, call_site: str = "generate_text",
                   engagement_id: Optional[str] = None) -> str:
    """Return generated text, or `fallback` on any error. Every call is
    recorded in the agentic trace."""
    t0 = time.time()
    model = _get_model()
    if model is None:
        _record_trace(call_site, prompt, fallback, used_fallback=True,
                       latency_ms=(time.time() - t0) * 1000,
                       engagement_id=engagement_id,
                       error="Vertex AI unavailable (no ADC / sandbox / quota)")
        return fallback
    try:
        resp = model.generate_content(
            prompt,
            generation_config={"temperature": temperature, "max_output_tokens": 800},
        )
        text = (resp.text or "").strip()
        if not text:
            _record_trace(call_site, prompt, fallback, used_fallback=True,
                           latency_ms=(time.time() - t0) * 1000,
                           engagement_id=engagement_id,
                           error="empty response from model")
            return fallback
        text = text[:max_chars]
        _record_trace(call_site, prompt, text, used_fallback=False,
                       latency_ms=(time.time() - t0) * 1000,
                       engagement_id=engagement_id)
        return text
    except Exception as e:
        log.warning("LLM generate_text failed: %s — using fallback", e)
        _record_trace(call_site, prompt, fallback, used_fallback=True,
                       latency_ms=(time.time() - t0) * 1000,
                       engagement_id=engagement_id, error=str(e)[:200])
        return fallback


# ---------------------------------------------------------------------------
# Public callable: generate_json
# ---------------------------------------------------------------------------

_JSON_BLOCK = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def generate_json(prompt: str, fallback: Any, *, temperature: float = 0.2,
                    call_site: str = "generate_json",
                    max_output_tokens: int = 4096,
                    engagement_id: Optional[str] = None) -> Any:
    """Ask Gemini for JSON. Parses the first JSON object/array in the response.

    Returns `fallback` on any error (no model, bad JSON, etc.). Trace-logged."""
    t0 = time.time()
    model = _get_model()
    if model is None:
        _record_trace(call_site, prompt, json.dumps(fallback)[:200],
                       used_fallback=True, latency_ms=(time.time() - t0) * 1000,
                       engagement_id=engagement_id,
                       error="Vertex AI unavailable")
        return fallback
    try:
        resp = model.generate_content(
            prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
                "response_mime_type": "application/json",
            },
        )
        raw = (resp.text or "").strip()
        if not raw:
            _record_trace(call_site, prompt, "", used_fallback=True,
                           latency_ms=(time.time() - t0) * 1000,
                           engagement_id=engagement_id, error="empty response")
            return fallback
        m = _JSON_BLOCK.search(raw)
        if m:
            raw = m.group(1).strip()
        start = min((raw.find(c) for c in "{[" if raw.find(c) >= 0), default=-1)
        if start > 0:
            raw = raw[start:]
        parsed = json.loads(raw)
        _record_trace(call_site, prompt, raw, used_fallback=False,
                       latency_ms=(time.time() - t0) * 1000,
                       engagement_id=engagement_id)
        return parsed
    except Exception as e:
        log.warning("LLM generate_json failed: %s — using fallback", e)
        _record_trace(call_site, prompt, str(fallback)[:200], used_fallback=True,
                       latency_ms=(time.time() - t0) * 1000,
                       engagement_id=engagement_id, error=str(e)[:200])
        return fallback


# ---------------------------------------------------------------------------
# Status — for /api/llm/status diagnostic endpoint
# ---------------------------------------------------------------------------

def status() -> dict:
    enabled = is_enabled()
    return {
        "enabled": enabled,
        "model": _MODEL_NAME,
        "project": _DEFAULT_PROJECT,
        "location": _DEFAULT_LOCATION,
        "auth_method": "Application Default Credentials (ADC)",
        "setup_hint": "Run: gcloud auth application-default login" if not enabled else None,
    }


# ---------------------------------------------------------------------------
# Agentic trace — observability of every LLM call
# ---------------------------------------------------------------------------

_TRACE_MAX = 500
_trace: deque = deque(maxlen=_TRACE_MAX)
_trace_lock = threading.Lock()


def _record_trace(call_site: str, prompt: str, response: str,
                    used_fallback: bool, latency_ms: float,
                    engagement_id: Optional[str] = None,
                    error: Optional[str] = None,
                    extra: Optional[dict] = None) -> None:
    entry = {
        "id": uuid.uuid4().hex[:12],
        "ts": time.time(),
        "engagement_id": engagement_id,
        "call_site": call_site,
        "model": _MODEL_NAME,
        "prompt_preview": (prompt or "")[:280],
        "prompt_chars": len(prompt or ""),
        "response_preview": (response or "")[:280],
        "response_chars": len(response or ""),
        "used_fallback": used_fallback,
        "latency_ms": round(latency_ms, 1),
        "error": error,
    }
    if extra: entry.update(extra)
    with _trace_lock:
        _trace.append(entry)


def get_trace(limit: int = 100, engagement_id: Optional[str] = None) -> list[dict]:
    """Return the most recent trace entries (newest first). Optionally
    filter by engagement_id."""
    with _trace_lock:
        items = list(_trace)
    items.reverse()
    if engagement_id:
        items = [x for x in items if x.get("engagement_id") == engagement_id]
    return items[:limit]


def clear_trace() -> int:
    with _trace_lock:
        n = len(_trace)
        _trace.clear()
    return n
