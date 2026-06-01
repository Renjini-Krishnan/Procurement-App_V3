"""KPI Calculator — Stage 10 + Stage 30 (Dashboard).

Aggregates metrics from the 4 pillar runs into a canonical KPI list with:
  - value + unit
  - benchmark band {low, high} from KB cascade
  - status: in / under / over
  - delta text (relative to band)
  - sparkline (monthly trend from PO data where applicable)
  - benchmark source / year / confidence
  - finding (one-liner)
  - drill_down (component reference)

Each KPI is independently filterable + sortable in the dashboard UI.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Optional

import pandas as pd


# Benchmark bands for each KPI (sourced from each pillar's benchmarks.yml).
# Hardcoded here for V1 — Build 2 will pull from cascade dynamically per KPI.
KPI_DEFINITIONS = [
    # ---------- OP MODEL ----------
    {
        "id": "opmodel.centralisation.candidate_count",
        "label": "Multi-plant centralisation candidates",
        "pillar": "op-model",
        "theme": "centralisation",
        "unit": "MGs",
        "band": {"low": 0, "high": 15},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["centralisation"]["metrics"]["candidate_count"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
        "finding_template": "{value} multi-plant categories surface as centralisation candidates with ₹{spend} Cr addressable.",
        "finding_args": lambda r: {"spend": r["themes"]["centralisation"]["metrics"]["candidate_spend_inr_cr"]},
    },
    {
        "id": "opmodel.centralisation.savings_range",
        "label": "Centralisation savings (₹ Cr/yr)",
        "pillar": "op-model",
        "theme": "centralisation",
        "unit": "₹ Cr/yr",
        "band": {"low": 0, "high": 50},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["centralisation"]["metrics"]["savings_range_inr_cr"][1],
        "benchmark": {"source": "Steel overlay (WSA-2024)", "year": 2024, "confidence": "high"},
    },
    {
        "id": "opmodel.shared_services.q1_count",
        "label": "Q1 transactional candidates (SSC)",
        "pillar": "op-model",
        "theme": "shared-services",
        "unit": "MGs",
        "band": {"low": 5, "high": 25},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["shared-services"]["metrics"]["q1_count"],
        "benchmark": {"source": "Hackett", "year": 2024, "confidence": "high"},
    },
    {
        "id": "opmodel.shared_services.addressable_po_count",
        "label": "SSC addressable POs",
        "pillar": "op-model",
        "theme": "shared-services",
        "unit": "POs",
        "band": {"low": 1000, "high": 8000},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["shared-services"]["metrics"]["ssc_addressable_po_count"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "opmodel.shared_services.operational_savings",
        "label": "SSC operational savings (₹ Cr/yr)",
        "pillar": "op-model",
        "theme": "shared-services",
        "unit": "₹ Cr/yr",
        "band": {"low": 0, "high": 10},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["shared-services"]["metrics"]["operational_savings_inr_cr"],
        "benchmark": {"source": "Hackett", "year": 2024, "confidence": "high"},
    },
    {
        "id": "opmodel.shared_services.fte_freed",
        "label": "SSC FTE-equivalent freed",
        "pillar": "op-model",
        "theme": "shared-services",
        "unit": "FTE",
        "band": {"low": 0, "high": 10},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["shared-services"]["metrics"]["fte_equivalent_freed"],
        "benchmark": {"source": "Hackett", "year": 2024, "confidence": "medium"},
    },
    {
        "id": "opmodel.coe.strategic_candidates",
        "label": "Strategic categories (CoE)",
        "pillar": "op-model",
        "theme": "coe",
        "unit": "MGs",
        "band": {"low": 5, "high": 15},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["coe"]["metrics"]["strategic_candidate_count"],
        "benchmark": {"source": "APQC", "year": 2023, "confidence": "medium"},
    },
    {
        "id": "opmodel.coe.savings_range",
        "label": "CoE incremental savings (₹ Cr/yr)",
        "pillar": "op-model",
        "theme": "coe",
        "unit": "₹ Cr/yr",
        "band": {"low": 0, "high": 30},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["coe"]["metrics"]["savings_range_inr_cr"][1],
        "benchmark": {"source": "Steel overlay (ACN-2024)", "year": 2024, "confidence": "high"},
    },
    {
        "id": "opmodel.tail.tail_spend_pct",
        "label": "Tail spend share (%)",
        "pillar": "op-model",
        "theme": "tail-spend",
        "unit": "%",
        "band": {"low": 5, "high": 12},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["tail-spend"]["metrics"]["tail_spend_share_pct"],
        "benchmark": {"source": "WSA", "year": 2024, "confidence": "high"},
    },
    {
        "id": "opmodel.tail.long_tail_vendor_pct",
        "label": "Long-tail vendor share (%)",
        "pillar": "op-model",
        "theme": "tail-spend",
        "unit": "%",
        "band": {"low": 10, "high": 25},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["tail-spend"]["metrics"]["long_tail_vendor_share_pct"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    # ---------- BUYING CHANNEL ----------
    {
        "id": "buyingchannel.contracted_spend_pct",
        "label": "Contracted spend (%)",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "%",
        "band": {"low": 35, "high": 55},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["contracted_spend_pct"],
        "benchmark": {"source": "Steel overlay (WSA-2024)", "year": 2024, "confidence": "high"},
    },
    {
        "id": "buyingchannel.misrouted_mg_count",
        "label": "Misrouted MGs",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "MGs",
        "band": {"low": 0, "high": 10},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["misrouted_mg_count"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "medium"},
    },
    {
        "id": "buyingchannel.catalogue_migration_candidates",
        "label": "Catalogue migration candidates",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "MGs",
        "band": {"low": 0, "high": 5},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["catalogue_migration_candidates"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "buyingchannel.ola_migration_candidates",
        "label": "OLA migration candidates",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "MGs",
        "band": {"low": 0, "high": 10},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["ola_migration_candidates"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "buyingchannel.sole_source_count",
        "label": "Sole-source risk categories",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "MGs",
        "band": {"low": 0, "high": 5},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["sole_source_count"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "medium"},
    },
    {
        "id": "buyingchannel.unclassified_pct",
        "label": "UNCLASSIFIED MGs (%)",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "%",
        "band": {"low": 0, "high": 5},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["unclassified_pct"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "high"},
    },
    {
        "id": "buyingchannel.contract_lift_pp",
        "label": "Contract coverage lift (pp, capped 25)",
        "pillar": "buying-channel",
        "theme": "buying-channel-strategy",
        "unit": "pp",
        "band": {"low": 0, "high": 25},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["buying-channel-strategy"]["metrics"]["contract_lift_pp"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    # ---------- ORG STRUCTURE ----------
    {
        "id": "orgstr.spend_per_fte",
        "label": "Spend per FTE (₹ Cr/yr)",
        "pillar": "org-structure",
        "theme": "fte-sizing-role-composition",
        "unit": "₹ Cr/yr",
        "band": {"low": 40, "high": 80},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["fte-sizing-role-composition"]["metrics"]["spend_per_fte_inr_cr"],
        "benchmark": {"source": "Steel overlay (WSA-2024)", "year": 2024, "confidence": "high"},
    },
    {
        "id": "orgstr.plant_count",
        "label": "Plants in PO data",
        "pillar": "org-structure",
        "theme": "spend-fte-distribution",
        "unit": "plants",
        "band": {"low": 1, "high": 10},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["spend-fte-distribution"]["metrics"]["plant_count"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "high"},
    },
    {
        "id": "orgstr.top_plant_share",
        "label": "Top plant spend share (%)",
        "pillar": "org-structure",
        "theme": "spend-fte-distribution",
        "unit": "%",
        "band": {"low": 20, "high": 50},
        "band_meaning": "neutral",
        "extract": lambda r: r["themes"]["spend-fte-distribution"]["metrics"]["top_plant_share_pct"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "medium"},
    },
    # ---------- DoA ----------
    {
        "id": "doa.coverage_pct",
        "label": "DoA coverage (%)",
        "pillar": "doa",
        "theme": "document-audit",
        "unit": "%",
        "band": {"low": 60, "high": 85},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["document-audit"]["metrics"]["coverage_pct"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "doa.indian_cases_covered",
        "label": "Indian regulatory cases covered (%)",
        "pillar": "doa",
        "theme": "document-audit",
        "unit": "%",
        "band": {"low": 60, "high": 90},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["document-audit"]["metrics"]["indian_cases_covered_pct"],
        "benchmark": {"source": "Internal (Companies Act + SEBI + MSME)", "year": 2024, "confidence": "high"},
    },
    {
        "id": "doa.mandatory_cases_covered",
        "label": "Mandatory cases covered (%)",
        "pillar": "doa",
        "theme": "robustness",
        "unit": "%",
        "band": {"low": 60, "high": 90},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["robustness"]["metrics"]["mandatory_cases_covered_pct"],
        "benchmark": {"source": "Reference DoA template", "year": 2024, "confidence": "high"},
    },
    {
        "id": "doa.ambiguity_rate",
        "label": "DoA ambiguity rate (%)",
        "pillar": "doa",
        "theme": "robustness",
        "unit": "%",
        "band": {"low": 0, "high": 15},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["robustness"]["metrics"]["ambiguity_rate_pct"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "medium"},
    },
    {
        "id": "doa.seventy_rule_pct",
        "label": "DoA 70% rule compliance (%)",
        "pillar": "doa",
        "theme": "po-compliance",
        "unit": "%",
        "band": {"low": 70, "high": 90},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["po-compliance"]["metrics"]["seventy_rule_pct"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "doa.cap_breach_pct",
        "label": "DoA cap-breach rate (%)",
        "pillar": "doa",
        "theme": "po-compliance",
        "unit": "%",
        "band": {"low": 0, "high": 5},
        "band_meaning": "lower_is_better",
        "extract": lambda r: r["themes"]["po-compliance"]["metrics"]["cap_breach_pct"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "doa.automation_pct",
        "label": "DoA ERP automation (%)",
        "pillar": "doa",
        "theme": "system-enforcement",
        "unit": "%",
        "band": {"low": 50, "high": 90},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["system-enforcement"]["metrics"]["automation_pct"],
        "benchmark": {"source": "ACN Proc Benchmark DB", "year": 2024, "confidence": "high"},
    },
    {
        "id": "doa.bucket_fit_score",
        "label": "Bucket fit score (1-5)",
        "pillar": "doa",
        "theme": "bucket-optimisation",
        "unit": "score",
        "band": {"low": 3, "high": 5},
        "band_meaning": "higher_is_better",
        "extract": lambda r: r["themes"]["bucket-optimisation"]["metrics"]["bucket_fit_score"],
        "benchmark": {"source": "Internal", "year": 2024, "confidence": "medium"},
    },
]


def _status(value, band: dict, meaning: str) -> str:
    if value is None:
        return "unknown"
    if meaning == "higher_is_better":
        if value < band["low"]: return "under"
        if value >= band["low"]: return "in"
    elif meaning == "lower_is_better":
        if value > band["high"]: return "over"
        return "in"
    else:  # neutral
        if value < band["low"]: return "under"
        if value > band["high"]: return "over"
        return "in"


def _delta(value, band: dict, meaning: str) -> str:
    if value is None:
        return "—"
    if meaning == "higher_is_better":
        if value >= band["low"]:
            return f"+{value - band['low']:.1f} above band floor"
        return f"−{band['low'] - value:.1f} below band"
    if meaning == "lower_is_better":
        if value <= band["high"]:
            return f"−{band['high'] - value:.1f} below band ceiling"
        return f"+{value - band['high']:.1f} above band"
    if value < band["low"]:
        return f"−{band['low'] - value:.1f} below band"
    if value > band["high"]:
        return f"+{value - band['high']:.1f} above band"
    return "in band"


def _compute_monthly_spark(df_gold: pd.DataFrame, agg: str = "total_spend") -> list[float]:
    """Monthly trend for sparklines. agg: 'total_spend' | 'po_count'."""
    if "po_creation_date" not in df_gold.columns or len(df_gold) == 0:
        return []
    df = df_gold.dropna(subset=["po_creation_date"]).copy()
    if df.empty:
        return []
    df["month"] = df["po_creation_date"].dt.to_period("M")
    if agg == "po_count":
        series = df.groupby("month").size()
    else:
        series = df.groupby("month")["net_value_inr"].sum() / 1e7  # ₹ Cr
    return [round(float(v), 2) for v in series.tolist()]


def assemble_kpis(pillar_results: dict, df_gold: pd.DataFrame,
                   overrides: Optional[dict] = None) -> list[dict]:
    """Run extractors against each pillar's run output. Returns a list of KPI dicts.

    overrides: {kpi_id: {"low": x, "high": y}} — engagement-level band overrides.
    """
    spend_spark = _compute_monthly_spark(df_gold, "total_spend")
    po_spark = _compute_monthly_spark(df_gold, "po_count")
    overrides = overrides or {}

    kpis = []
    for d in KPI_DEFINITIONS:
        try:
            value = d["extract"](pillar_results[d["pillar"]])
        except (KeyError, TypeError, IndexError):
            continue
        # Apply engagement override if present
        band = dict(d["band"])
        band_overridden = False
        if d["id"] in overrides:
            ov = overrides[d["id"]]
            if isinstance(ov, dict):
                if "low" in ov: band["low"] = ov["low"]
                if "high" in ov: band["high"] = ov["high"]
                band_overridden = True
        status = _status(value, band, d["band_meaning"])
        delta = _delta(value, band, d["band_meaning"])
        # Spark trend: spend KPIs get spend spark; count KPIs get po spark; otherwise mock
        if d["unit"].startswith("₹"):
            spark = spend_spark[-12:] if spend_spark else []
        elif d["unit"] in ("POs", "MGs"):
            spark = po_spark[-12:] if po_spark else []
        else:
            spark = []
        # Generate finding — LLM where available, deterministic template fallback
        finding_template = ""
        if d.get("finding_template"):
            try:
                args = d.get("finding_args", lambda r: {})(pillar_results[d["pillar"]])
                finding_template = d["finding_template"].format(value=value, **args)
            except Exception:
                pass

        finding = finding_template
        # LLM enrichment — opt-in via env var (off by default to keep KPI dashboard fast)
        import os
        # LLM finding narratives are on by default. Set PROCVAULT_LLM_FINDINGS=0 to disable.
        # Falls back to deterministic template silently if Vertex AI / ADC is unavailable.
        if os.environ.get("PROCVAULT_LLM_FINDINGS", "1") in ("1", "true", "yes"):
            try:
                from ..services import llm, llm_prompts
                prompt, fallback = llm_prompts.finding_narrative(
                    kpi_id=d["id"], pillar=d["pillar"], value=value, unit=d["unit"],
                    status=status, band_low=band["low"], band_high=band["high"],
                    delta=delta, finding_template=finding_template,
                )
                finding = llm.generate_text(prompt, fallback)
            except Exception:
                finding = finding_template

        kpis.append({
            "id": d["id"],
            "label": d["label"],
            "pillar": d["pillar"],
            "theme": d["theme"],
            "value": value,
            "unit": d["unit"],
            "band": band,
            "band_overridden": band_overridden,
            "band_default": d["band"],
            "band_meaning": d["band_meaning"],
            "status": status,
            "delta": delta,
            "spark": spark,
            "benchmark": d["benchmark"],
            "finding": finding,
            "drill_down": {
                "pillar": d["pillar"],
                "theme": d["theme"],
                "metric_key": d["id"].split(".")[-1],
            },
        })
    return kpis
