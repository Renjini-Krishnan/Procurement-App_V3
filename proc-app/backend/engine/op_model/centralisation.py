"""Centralisation theme (C0-C5).

C1 Multi-plant detection — categories bought by ≥2 plants with material spend
C2 Vendor pattern insight — vendor overlap across plants
C3 Industry knowledge filter — tag categories naturally_local / _central / centre_led
C4 Savings quantification — apply industry benchmark rate to candidate spend
C5 Reconciliation — qualitative cross-check (stub for V1; needs QRE)
"""
from __future__ import annotations

import pandas as pd

from ... import kb_loader


# Thresholds (could be exposed via analysis-config; using sensible defaults for V1)
MATERIAL_SPEND_THRESHOLD_INR_CR = 3   # Steel default per centralisation-filters.yml
MIN_PLANTS_FOR_CENTRALISATION = 2


def run_centralisation(df_mg: pd.DataFrame, industry: str = "steel") -> dict:
    """Run all 6 centralisation components against per-MG metrics."""

    benchmarks = kb_loader.resolve_pillar_benchmarks("op-model", industry=industry)["benchmarks"]
    filters = _load_industry_filters(industry)

    # C0 — Baseline (stub for V1 without QRE)
    c0 = _c0_baseline_stub(df_mg)

    # C1 — Multi-plant candidates
    c1 = _c1_multi_plant(df_mg)
    candidates = c1["candidates"]

    # C2 — Vendor pattern insight
    c2 = _c2_vendor_pattern(df_mg, candidates)

    # C3 — Industry filter tagging
    c3 = _c3_industry_filter(df_mg, candidates, filters)

    # C4 — Savings quantification
    c4 = _c4_savings_quantification(c3, benchmarks)

    # C5 — Reconciliation (stub)
    c5 = _c5_reconciliation_stub()

    # Headline
    headline = _build_headline(c1, c3, c4)

    return {
        "theme": "centralisation",
        "components": {
            "c0_baseline": c0,
            "c1_multi_plant_detection": c1,
            "c2_vendor_pattern_insight": c2,
            "c3_industry_knowledge_filter": c3,
            "c4_savings_quantification": c4,
            "c5_reconciliation": c5,
        },
        "headline": headline,
        "metrics": {
            "candidate_count": c1["candidate_count"],
            "candidate_spend_inr_cr": c3["addressable_spend_inr_cr"],
            "savings_range_inr_cr": c4["savings_range_inr_cr"],
            "centralise_count": c3["centralise_count"],
            "centre_led_count": c3["centre_led_count"],
            "keep_local_count": c3["keep_local_count"],
        },
    }


# --------------------------------------------------------------------------

def _c0_baseline_stub(df_mg: pd.DataFrame) -> dict:
    """Stub — without QRE, we cannot compute spend_central_pct. Returns placeholder."""
    return {
        "component_id": "c0_baseline",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE Q-OM-01/Q-OM-02 responses (consultant input). Stub for V1.",
        "spend_central_pct": None,
    }


def _c1_multi_plant(df_mg: pd.DataFrame) -> dict:
    """Identify MGs bought by ≥2 plants with material spend."""
    threshold_inr = MATERIAL_SPEND_THRESHOLD_INR_CR * 10_000_000  # ₹ Cr → ₹

    candidates_df = df_mg[
        (df_mg["plant_count"] >= MIN_PLANTS_FOR_CENTRALISATION)
        & (df_mg["total_spend_inr"] >= threshold_inr)
    ].copy()

    return {
        "component_id": "c1_multi_plant_detection",
        "decision_driving": True,
        "candidate_count": len(candidates_df),
        "candidates": candidates_df["material_group"].tolist(),
        "candidate_spend_inr_cr": round(candidates_df["total_spend_inr"].sum() / 10_000_000, 1),
        "threshold_min_plants": MIN_PLANTS_FOR_CENTRALISATION,
        "threshold_material_spend_inr_cr": MATERIAL_SPEND_THRESHOLD_INR_CR,
        "top_candidates": candidates_df.head(10)[
            ["material_group", "material_group_desc", "archetype", "total_spend_inr", "plant_count", "vendor_count"]
        ].to_dict(orient="records"),
    }


def _c2_vendor_pattern(df_mg: pd.DataFrame, candidates: list[str]) -> dict:
    """For each candidate, compute vendor overlap across plants.

    overlap = (sum of plants whose top vendor matches the MG-level top vendor) / plant_count
    Range 0-1; high overlap = same-vendor across plants = strong centralisation signal.
    """
    out = []
    if not candidates:
        return {
            "component_id": "c2_vendor_pattern_insight",
            "decision_driving": False,
            "avg_vendor_overlap_pct": None,
            "details": [],
        }

    cand_df = df_mg[df_mg["material_group"].isin(candidates)]
    for _, row in cand_df.iterrows():
        plants_data = row.get("plants_data") or {}
        if not plants_data or len(plants_data) < 2:
            continue
        # Top vendor across all plants for this MG
        # Aggregate per-plant top vendors; "overlap" = share of plants whose top vendor matches MG top vendor
        plant_top_vendors = [pd_data.get("top_vendor") for pd_data in plants_data.values()]
        # MG-level top vendor approximation: most common per-plant top vendor
        from collections import Counter
        c = Counter(v for v in plant_top_vendors if v)
        if not c:
            continue
        mg_top = c.most_common(1)[0][0]
        overlap_pct = (c[mg_top] / len(plants_data)) * 100
        out.append({
            "material_group": row["material_group"],
            "material_group_desc": row["material_group_desc"],
            "plant_count": int(row["plant_count"]),
            "mg_top_vendor": mg_top,
            "vendor_overlap_pct": round(overlap_pct, 1),
        })

    avg_overlap = round(sum(d["vendor_overlap_pct"] for d in out) / max(len(out), 1), 1) if out else 0
    return {
        "component_id": "c2_vendor_pattern_insight",
        "decision_driving": False,
        "avg_vendor_overlap_pct": avg_overlap,
        "details": out,
    }


def _c3_industry_filter(df_mg: pd.DataFrame, candidates: list[str], filters: dict) -> dict:
    """Tag each candidate with Centralise / Centre-Led / Keep Local using filters.

    Steel filters list category_patterns matching MG description keywords.
    """
    naturally_local = filters.get("naturally_local", [])
    naturally_central = filters.get("naturally_central", [])
    centre_led = filters.get("centre_led", [])

    tags: list[dict] = []
    centralise_spend = 0.0
    centre_led_spend = 0.0
    keep_local_spend = 0.0

    cand_df = df_mg[df_mg["material_group"].isin(candidates)]
    for _, row in cand_df.iterrows():
        desc = (row.get("material_group_desc") or "").upper()
        tag = _match_filter_tag(desc, naturally_local, naturally_central, centre_led)

        # Default if no match: tag by archetype + plant pattern
        if tag == "no_match":
            if row.get("archetype") == "BULK":
                tag = "centralise"
            elif row.get("archetype") == "INDIRECT":
                tag = "centre_led"
            else:
                tag = "review"

        spend = float(row["total_spend_inr"])
        if tag == "centralise":
            centralise_spend += spend
        elif tag == "centre_led":
            centre_led_spend += spend
        elif tag == "keep_local":
            keep_local_spend += spend

        tags.append({
            "material_group": row["material_group"],
            "material_group_desc": row["material_group_desc"],
            "archetype": row.get("archetype"),
            "tag": tag,
            "total_spend_inr_cr": round(spend / 10_000_000, 2),
        })

    centralise_count = sum(1 for t in tags if t["tag"] == "centralise")
    centre_led_count = sum(1 for t in tags if t["tag"] == "centre_led")
    keep_local_count = sum(1 for t in tags if t["tag"] == "keep_local")
    review_count = sum(1 for t in tags if t["tag"] == "review")

    addressable_spend_inr_cr = round((centralise_spend + centre_led_spend) / 10_000_000, 1)

    return {
        "component_id": "c3_industry_knowledge_filter",
        "decision_driving": True,
        "centralise_count": centralise_count,
        "centralise_spend_inr_cr": round(centralise_spend / 10_000_000, 1),
        "centre_led_count": centre_led_count,
        "centre_led_spend_inr_cr": round(centre_led_spend / 10_000_000, 1),
        "keep_local_count": keep_local_count,
        "keep_local_spend_inr_cr": round(keep_local_spend / 10_000_000, 1),
        "review_count": review_count,
        "addressable_spend_inr_cr": addressable_spend_inr_cr,
        "tags": tags,
    }


def _c4_savings_quantification(c3: dict, benchmarks: dict) -> dict:
    """Apply industry benchmark savings rate to Centralise + Centre-Led candidate spend."""
    cent_bench = benchmarks.get("opmodel.centralisation.savings_rate", {})
    cent_led_bench = benchmarks.get("opmodel.centralisation.centre_led_savings_rate", {})

    cent_rate_range = (cent_bench.get("primary") or {}).get("value_range") or [2, 4]
    cent_led_range = (cent_led_bench.get("primary") or {}).get("value_range") or [1, 2]

    cent_spend = c3["centralise_spend_inr_cr"]
    cent_led_spend = c3["centre_led_spend_inr_cr"]

    low = (cent_spend * cent_rate_range[0] / 100) + (cent_led_spend * cent_led_range[0] / 100)
    high = (cent_spend * cent_rate_range[1] / 100) + (cent_led_spend * cent_led_range[1] / 100)

    return {
        "component_id": "c4_savings_quantification",
        "decision_driving": True,
        "centralisation_rate_pct_range": cent_rate_range,
        "centre_led_rate_pct_range": cent_led_range,
        "centralise_spend_inr_cr": cent_spend,
        "centre_led_spend_inr_cr": cent_led_spend,
        "savings_range_inr_cr": [round(low, 1), round(high, 1)],
        "benchmark_source": (cent_bench.get("primary") or {}).get("source_id"),
        "benchmark_overridden_by": cent_bench.get("_overridden_by"),
    }


def _c5_reconciliation_stub() -> dict:
    return {
        "component_id": "c5_reconciliation",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE responses for QRE-vs-data reconciliation. Stub for V1.",
    }


# --------------------------------------------------------------------------
# Industry filter loading + matching
# --------------------------------------------------------------------------

def _load_industry_filters(industry: str) -> dict:
    """Load centralisation-filters.yml for the industry. Returns naturally_local
    / naturally_central / centre_led lists with their category patterns."""
    try:
        overlay = kb_loader.get_industry_pillar_overlay(industry, "op-model", "centralisation-filters")
    except Exception:
        return {"naturally_local": [], "naturally_central": [], "centre_led": []}

    def extract(key):
        items = overlay.get(key) or []
        return [str((it.get("category_pattern") or "")).upper() for it in items if isinstance(it, dict)]

    return {
        "naturally_local": extract("naturally_local"),
        "naturally_central": extract("naturally_central"),
        "centre_led": extract("centre_led"),
    }


def _match_filter_tag(desc: str, local: list[str], central: list[str], led: list[str]) -> str:
    """Match MG description against filter patterns. Filter patterns are dotted
    category paths like 'direct.raw_materials.coking_coal'. We keyword-match the
    LEAF token (after the last dot) against the description."""

    def leaf_keywords(patterns):
        out = []
        for p in patterns:
            leaf = p.split(".")[-1].replace("_", " ").upper()
            out.append(leaf)
        return out

    for kw in leaf_keywords(central):
        if kw and kw in desc:
            return "centralise"
    for kw in leaf_keywords(led):
        if kw and kw in desc:
            return "centre_led"
    for kw in leaf_keywords(local):
        if kw and kw in desc:
            return "keep_local"
    return "no_match"


def _build_headline(c1: dict, c3: dict, c4: dict) -> str:
    if c1["candidate_count"] == 0:
        return "No multi-plant centralisation candidates identified at the spend threshold."
    return (
        f"{c1['candidate_count']} multi-plant categories surface as centralisation candidates "
        f"(₹{c1['candidate_spend_inr_cr']} Cr total candidate spend; ₹{c3['addressable_spend_inr_cr']} Cr "
        f"addressable after industry filter). Tagged: {c3['centralise_count']} Centralise, "
        f"{c3['centre_led_count']} Centre-Led, {c3['keep_local_count']} Keep Local. "
        f"Estimated savings: ₹{c4['savings_range_inr_cr'][0]}–{c4['savings_range_inr_cr'][1]} Cr/year."
    )
