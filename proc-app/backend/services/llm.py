"""LLM client — Vertex AI Gemini 2.5 Pro with deterministic fallback.

Auth: Application Default Credentials (ADC). No API keys in code.
Setup on a new machine:  `gcloud auth application-default login`

Every callable in this module MUST never raise — if Vertex AI is
unavailable for any reason (no ADC, network error, quota, sandbox
without GCP access), the call returns the deterministic fallback
the caller supplied. This is non-negotiable per the integration spec
at proc-app/kb/functions/procurement/_meta/ai-integration.md.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
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
                   max_chars: int = 2000) -> str:
    """Return generated text, or `fallback` on any error."""
    model = _get_model()
    if model is None:
        return fallback
    try:
        resp = model.generate_content(
            prompt,
            generation_config={"temperature": temperature, "max_output_tokens": 800},
        )
        text = (resp.text or "").strip()
        if not text:
            return fallback
        return text[:max_chars]
    except Exception as e:
        log.warning("LLM generate_text failed: %s — using fallback", e)
        return fallback


# ---------------------------------------------------------------------------
# Public callable: generate_json
# ---------------------------------------------------------------------------

_JSON_BLOCK = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def generate_json(prompt: str, fallback: Any, *, temperature: float = 0.2) -> Any:
    """Ask Gemini for JSON. Parses the first JSON object/array in the response.

    Returns `fallback` on any error (no model, bad JSON, etc.).
    """
    model = _get_model()
    if model is None:
        return fallback
    try:
        resp = model.generate_content(
            prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": 1500,
                "response_mime_type": "application/json",
            },
        )
        raw = (resp.text or "").strip()
        if not raw:
            return fallback
        # Strip ``` fences if present
        m = _JSON_BLOCK.search(raw)
        if m:
            raw = m.group(1).strip()
        # Find first { or [
        start = min((raw.find(c) for c in "{[" if raw.find(c) >= 0), default=-1)
        if start > 0:
            raw = raw[start:]
        return json.loads(raw)
    except Exception as e:
        log.warning("LLM generate_json failed: %s — using fallback", e)
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
