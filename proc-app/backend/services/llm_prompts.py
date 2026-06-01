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


# ============================================================================
# Pillar-wise RCA + insights + narrative (per-pillar storytelling)
# ============================================================================

def _fmt_benchmark_block(bench: dict | None) -> str:
    """Render benchmark dict into a prompt-friendly citation block.
    bench shape: {value_range:[lo,hi], unit, source, year, sample_size, confidence}"""
    if not bench:
        return ""
    vr = bench.get("value_range")
    band = (f"{vr[0]}-{vr[1]} {bench.get('unit','') or ''}".strip()
            if vr and len(vr) == 2 else "")
    src_bits = []
    if bench.get("source"): src_bits.append(str(bench["source"]))
    if bench.get("year"):   src_bits.append(str(bench["year"]))
    if bench.get("sample_size"): src_bits.append(f"n={bench['sample_size']}")
    if bench.get("confidence"):  src_bits.append(f"{bench['confidence']} confidence")
    citation = " · ".join(src_bits)
    if not band and not citation:
        return ""
    return f"\nIndustry benchmark band: {band}\nBenchmark source: {citation}"


def _fmt_data_scope(scope: dict | None) -> str:
    """Render data-scope dict into a prompt-friendly footer.
    scope shape: {po_rows, vendor_count, qre_answered, qre_total, period_label, ...}"""
    if not scope:
        return ""
    bits = []
    if scope.get("po_rows"):
        bits.append(f"{int(scope['po_rows']):,} PO lines")
    if scope.get("vendor_count"):
        bits.append(f"{int(scope['vendor_count']):,} vendors")
    if scope.get("qre_total"):
        bits.append(f"{scope.get('qre_answered', 0)}/{scope['qre_total']} QRE answered")
    if scope.get("period_label"):
        bits.append(str(scope["period_label"]))
    if not bits:
        return ""
    return "\nData scope (engagement): " + " · ".join(bits)


def rca_narrative(*, pillar: str, theme: str, severity: str, cause: str,
                    recommendation: str, metrics: dict,
                    benchmark: dict | None = None,
                    data_scope: dict | None = None,
                    industry: str = "steel") -> tuple[str, str]:
    """Generate a consultant-style narrative for an RCA card.

    Returns (prompt, fallback). Fallback is the existing cause+recommendation
    rendered as a single sentence (deterministic, no AI required)."""
    metric_lines = "\n".join(f"  - {k}: {v}" for k, v in (metrics or {}).items())
    prompt = f"""You are a senior procurement consultant briefing a CPO. Write a 2-3 sentence
narrative for this root-cause finding. Specific. Quantified. No fluff.

Pillar: {pillar}
Theme: {theme}
Severity: {severity}
Industry: {industry}
{_fmt_data_scope(data_scope)}{_fmt_benchmark_block(benchmark)}

Computed metrics:
{metric_lines or "  (no specific metrics)"}

Engine's template cause: {cause}
Engine's template recommendation: {recommendation}

Write a single paragraph (60-90 words) that:
1. States the finding with the specific number from metrics above
2. Diagnoses WHY it's happening (root cause — not just what's happening)
3. Recommends one concrete action

Cite the benchmark source by name (e.g. "vs APQC-2024 typical 2-4%") if a
benchmark is provided. Avoid filler. Use active voice. Cite numbers."""
    fallback = f"{cause} {recommendation}".strip()
    return prompt, fallback


def theme_insight(*, pillar: str, theme_id: str, theme_label: str,
                    score: float, band: str, metrics: dict,
                    benchmark: dict | None = None,
                    data_scope: dict | None = None,
                    industry: str = "steel") -> tuple[str, str]:
    """Per-theme interpretation paragraph. 1 paragraph (50-80 words) that
    explains what the theme score MEANS for maturity, ties to industry
    context, and cites the benchmark source by name when available."""
    metric_lines = "\n".join(f"  - {k}: {v}" for k, v in (metrics or {}).items())
    prompt = f"""You are a senior procurement consultant. Write a 1-paragraph (50-80 words)
interpretation of this theme score for the {industry} industry.

Pillar: {pillar}
Theme: {theme_label} ({theme_id})
Computed score: {score} / 5 ({band})
{_fmt_data_scope(data_scope)}{_fmt_benchmark_block(benchmark)}

Computed metrics:
{metric_lines or "  (no metrics)"}

Explain what this score means in plain language — what's working, what isn't,
and what the team should focus on next. Be specific about the metrics. Cite
the benchmark source by name (e.g. "APQC-2024 typical 2-4%") if provided.
No bullet points; one short paragraph."""
    fallback = f"{theme_label} sits in the {band} band (score {score}/5)."
    return prompt, fallback


def pillar_narrative(*, pillar: str, pillar_label: str, pillar_score: float,
                       pillar_band: str, theme_summaries: list[dict],
                       benchmarks: list[dict] | None = None,
                       data_scope: dict | None = None,
                       industry: str = "steel") -> tuple[str, str]:
    """Pillar-level story stitching theme verdicts into one coherent paragraph
    for the dashboard / exec summary."""
    theme_lines = "\n".join(
        f"  - {t.get('label', t.get('id', '?'))}: score {t.get('score')}/5 "
        f"({t.get('band', '?')})"
        for t in (theme_summaries or [])
    )
    bench_block = ""
    if benchmarks:
        srcs = sorted({f"{b.get('source')}-{b.get('year')}" for b in benchmarks
                       if b.get("source")})
        if srcs:
            bench_block = f"\nBenchmark sources used: {', '.join(srcs)}"
    prompt = f"""You are a senior procurement consultant. Write a 2-3 sentence pillar
verdict for an executive dashboard.

Pillar: {pillar_label} ({pillar})
Overall score: {pillar_score} / 5 ({pillar_band})
Industry: {industry}
{_fmt_data_scope(data_scope)}{bench_block}

Theme breakdown:
{theme_lines}

Write 60-90 words that:
1. State the overall verdict for {pillar_label}
2. Name the strongest theme and the weakest theme by their values
3. End with a single recommended priority for the next phase

Active voice. Cite numbers. No filler."""
    fallback = (f"{pillar_label} maturity sits at {pillar_score}/5 ({pillar_band}). "
                 f"{len(theme_summaries or [])} themes assessed.")
    return prompt, fallback
