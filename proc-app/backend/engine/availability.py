"""Availability helpers — used by every pillar runner to signal
"data not available" explicitly instead of falling back to a default
value that would silently fabricate a score.

Pattern:
    vals, missing = require_qre(qre, ["D2.4", "D9.2"])
    if missing:
        return unavailable_theme("Doc audit", required=missing,
                                  reason="qre", theme_id="document-audit")
    # ... compute with vals["D2.4"], vals["D9.2"]

A theme / component is "available" only when ALL its required inputs have
real values. When unavailable:
  - theme/component dict carries available=False, score=None, missing_inputs=[...]
  - pillar score is the weighted average over AVAILABLE themes only,
    with a coverage_pct that reports how much of the pillar was computable.
  - KPIs whose source theme is unavailable are dropped (not rendered as zero).
"""
from __future__ import annotations

from typing import Iterable, Optional


def require_qre(qre: dict, ids: Iterable[str]) -> tuple[Optional[dict], list[str]]:
    """Return (values_by_id, missing_ids). values_by_id is None when any
    required id is missing — caller must early-return unavailable."""
    values = {}
    missing: list[str] = []
    for qid in ids:
        entry = qre.get(qid) if qre else None
        if not isinstance(entry, dict):
            missing.append(qid); continue
        sc = entry.get("score")
        if sc is None:
            missing.append(qid)
        else:
            values[qid] = sc
    return (None, missing) if missing else (values, [])


def require_columns(df, cols: Iterable[str]) -> list[str]:
    """Return list of missing columns (empty list if all present)."""
    if df is None:
        return list(cols)
    return [c for c in cols if c not in df.columns]


def require_engagement(engagement: dict, fields: Iterable[str]) -> list[str]:
    """Return list of engagement fields that are None / empty."""
    missing = []
    for f in fields:
        v = (engagement or {}).get(f)
        if v in (None, "", 0):
            missing.append(f)
    return missing


def unavailable_theme(label: str, *, required: list[str], reason: str = "input",
                       theme_id: Optional[str] = None,
                       note: Optional[str] = None) -> dict:
    """Build the standard "data not available" theme payload."""
    return {
        "theme": theme_id or label.lower().replace(" ", "-"),
        "label": label,
        "available": False,
        "score": None,
        "band": "Data not available",
        "missing_inputs": list(required),
        "missing_reason": reason,
        "note": note or _default_note(reason, required),
        "metrics": {},
        "components": {},
    }


def unavailable_score(reason: str, required: list[str]) -> dict:
    """Build the per-theme score record for an unavailable theme."""
    return {
        "score": None,
        "label": "Data not available",
        "rationale": _default_note(reason, required),
        "available": False,
        "missing_inputs": list(required),
    }


def unavailable_component(label: str, *, required: list[str],
                           reason: str = "input") -> dict:
    """Build a per-component "unavailable" payload — used when a single
    component within a mostly-available theme can't be computed."""
    return {
        "label": label,
        "available": False,
        "value": None,
        "missing_inputs": list(required),
        "note": _default_note(reason, required),
    }


def aggregate_pillar_score(theme_scores: dict, weights: dict) -> dict:
    """Weighted average over available themes only. Returns:
      {score, label, coverage_pct, themes_available, themes_total, missing_themes}
    coverage_pct = sum(weights of available themes) / sum(all weights).
    If no themes are available → score=None, label='Data not available'."""
    total_w = sum(weights.values())
    available = {k: v for k, v in theme_scores.items()
                 if isinstance(v, dict) and v.get("score") is not None}
    avail_w = sum(weights.get(k, 0) for k in available)
    coverage_pct = round(100 * avail_w / total_w, 1) if total_w else 0
    missing = [k for k, v in theme_scores.items()
               if not isinstance(v, dict) or v.get("score") is None]

    if not available:
        return {
            "score": None,
            "label": "Data not available",
            "rationale": "No themes had the required inputs available.",
            "coverage_pct": 0,
            "themes_available": 0,
            "themes_total": len(theme_scores),
            "missing_themes": missing,
        }

    score = sum(theme_scores[k]["score"] * weights.get(k, 0) for k in available) / avail_w
    suffix = "" if coverage_pct >= 99 else f" (partial · {coverage_pct}% computed)"
    return {
        "score": round(score, 1),
        "label": _pillar_label(score) + suffix,
        "coverage_pct": coverage_pct,
        "themes_available": len(available),
        "themes_total": len(theme_scores),
        "missing_themes": missing,
    }


def _pillar_label(score: float) -> str:
    if score < 1.5: return "Initial"
    if score < 2.5: return "Developing"
    if score < 3.5: return "Defined"
    if score < 4.5: return "Managed"
    return "Optimised"


def _default_note(reason: str, required: list[str]) -> str:
    if reason == "qre":
        return f"Data not available — requires QRE answers: {', '.join(required)}"
    if reason == "columns":
        return f"Data not available — missing columns: {', '.join(required)}"
    if reason == "file":
        return f"Data not available — required file(s) not uploaded: {', '.join(required)}"
    if reason == "engagement":
        return f"Data not available — engagement field(s) missing: {', '.join(required)}"
    return f"Data not available — required inputs missing: {', '.join(required)}"
