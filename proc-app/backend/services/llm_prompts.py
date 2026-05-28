"""Prompt construction for LLM calls.

Each public function takes raw engine output + KB context and returns
a (prompt, fallback) tuple. The caller passes both into llm.generate_text
or llm.generate_json. Fallbacks must be functional on their own — the
app must produce useful output even when Gemini is disabled.

Spec source: proc-app/kb/functions/procurement/_meta/ai-integration.md
RCA narrative source: proc-app/kb/functions/procurement/_meta/kpi-rca-library.yml
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import yaml

from .. import config

_RCA_LIBRARY_PATH = config.PROC_KB_ROOT / "_meta" / "kpi-rca-library.yml"


@lru_cache(maxsize=1)
def _load_rca_library() -> dict:
    if not _RCA_LIBRARY_PATH.exists():
        return {"kpis": {}}
    try:
        return yaml.safe_load(_RCA_LIBRARY_PATH.read_text(encoding="utf-8")) or {"kpis": {}}
    except Exception:
        return {"kpis": {}}


def invalidate_rca_cache() -> None:
    _load_rca_library.cache_clear()


# ---------------------------------------------------------------------------
# Finding narrative — per-KPI
# ---------------------------------------------------------------------------

def finding_narrative(*, kpi_id: str, pillar: str, value, unit: str,
                       status: str, band_low, band_high, delta: str,
                       finding_template: str) -> tuple[str, str]:
    """Generate a 2-3 sentence consultant-quality finding for one KPI."""
    lib = _load_rca_library().get("kpis", {}).get(kpi_id, {})
    bands = lib.get("bands", {})
    # Map status to band 1-4 (rough mapping for prompt context)
    band_key = {"under": 1, "over": 1, "in": 3, "unknown": 2}.get(status, 2)
    band = bands.get(band_key, {})
    pillar_impl = (band.get("pillar_implications") or {}).get(pillar, "")
    causal_rules = lib.get("ai_causal_rules", [])
    causal_block = json.dumps(causal_rules, indent=2) if causal_rules else "None"

    prompt = f"""You are a senior procurement consultant writing one finding for a maturity assessment deliverable.

KPI: {kpi_id} ({lib.get("label") or kpi_id})
Pillar context: {pillar}
Observed value: {value} {unit}
Benchmark band: {band_low}-{band_high} {unit}
Status: {status}
Delta from band: {delta}

Library insight for this band: {band.get("insight", "")}
Recommended action: {band.get("action", "")}
Expected benefit: {band.get("benefit", "")}
Pillar-specific implication: {pillar_impl}

AI causal rules — only cite if evidence is in the data above:
{causal_block}

Write a single finding in 2-3 sentences. State the observation, the most
likely root cause from the library (cite the pillar-specific implication
when relevant), and the recommended action. Do NOT invent numbers or
speculate beyond the provided context. Use a calm, evidence-led tone.
Plain text only — no markdown, no headings.
"""

    fallback = finding_template or (
        f"{lib.get('label', kpi_id)} is {value} {unit}, against a band of "
        f"{band_low}-{band_high}. {band.get('action', '').rstrip('.')}.{' ' + pillar_impl if pillar_impl else ''}"
    )
    return prompt, fallback.strip()


# ---------------------------------------------------------------------------
# Exec summary narrative
# ---------------------------------------------------------------------------

def exec_summary_narrative(*, client_name: str, industry: str,
                            overall_maturity: float, label: str,
                            pillar_summary: dict, top_alerts: list[dict]) -> tuple[str, str]:
    pillar_lines = [
        f"- {pid}: score {(p.get('pillar_score') or {}).get('score', '—')} ({(p.get('pillar_score') or {}).get('label', '—')}) — "
        f"{p.get('in_band', 0)} in band, {p.get('under', 0)} below, {p.get('over', 0)} above"
        for pid, p in pillar_summary.items()
    ]
    alert_lines = [
        f"- [{a.get('pillar')}] {a.get('label')}: {a.get('value')} {a.get('unit')} "
        f"({a.get('status')} band)"
        for a in top_alerts[:5]
    ]

    prompt = f"""You are a senior procurement consultant writing the executive summary paragraph
for a maturity assessment of {client_name} ({industry} industry).

Overall maturity: {overall_maturity:.1f}/5 ({label})

Per-pillar maturity:
{chr(10).join(pillar_lines)}

Top attention items:
{chr(10).join(alert_lines) if alert_lines else "- None"}

Write 3-4 sentences for an executive audience. Start with the overall
maturity and what it implies. Name the 1-2 strongest pillars and 1-2
weakest, with the single most pressing gap. End with a forward-looking
next-step sentence. Plain text only — no markdown, no headings.
"""

    fallback = (
        f"{client_name} sits at {label} ({overall_maturity:.1f}/5) overall across "
        f"{len(pillar_summary)} pillars. "
        f"{len(top_alerts)} KPI(s) require attention. "
        f"Review the Findings Deck for the full evidence pack and the KPI Dashboard "
        f"for interactive drill-downs."
    )
    return prompt, fallback.strip()


# ---------------------------------------------------------------------------
# Column mapping — Stage 5 AI Validation
# ---------------------------------------------------------------------------

def column_mapping(*, raw_columns: list[str], canonical_fields: list[dict],
                    heuristic_mapping: list[dict], file_type: str) -> tuple[str, list[dict]]:
    """Ask Gemini to suggest canonical mapping. Fallback = heuristic."""
    canonical_summary = [
        {
            "field": f["field"],
            "type": f.get("type", "string"),
            "required": bool(f.get("required")),
            "description": (f.get("description") or "")[:160],
            "aliases": (f.get("aliases") or [])[:8],
        }
        for f in canonical_fields
    ]
    prompt = f"""You are a procurement data engineer mapping uploaded {file_type} columns
to a canonical schema.

Raw columns from the upload (in order):
{json.dumps(raw_columns, indent=2)}

Canonical schema:
{json.dumps(canonical_summary, indent=2)}

Heuristic-suggested mapping (review for correctness):
{json.dumps(heuristic_mapping, indent=2)}

Return a JSON array — one object per raw column, in the same order:
[
  {{"raw_column": "<exact>", "suggested_field": "<canonical or null>",
    "confidence": "high|medium|low|none", "reasoning": "<one short sentence>"}},
  ...
]

Rules:
- suggested_field MUST be one of the canonical field names, or null if
  there is no good match.
- Use null + "none" confidence rather than guessing.
- Required fields are critical — surface medium/low confidence honestly.
- Output JSON only — no prose, no markdown fences.
"""
    return prompt, heuristic_mapping
