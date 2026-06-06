"""CoE theme (CE0-CE5).

CE1 Strategic identification — Q4 from SS1 + strategic_by_nature list
CE2 Industry filter — coe_suitable / already_strategic / plant_owned
CE3 Coverage gap (stub without QRE)
CE4 Value quantification — apply CoE savings rate to addressable spend
CE5 Reconciliation (stub)
"""
from __future__ import annotations

import pandas as pd

from ... import kb_loader

HIGH_CONCENTRATION_TOP_VENDOR_THRESHOLD = 70  # %
MIN_COE_ADDRESSABLE_SPEND_INR_CR = 50         # Steel default per coe-filters.yml


def run_coe(df_canonical: pd.DataFrame, ss1: dict, industry: str = "steel",
              taxonomy: dict | None = None) -> dict:
    benchmarks = kb_loader.resolve_pillar_benchmarks("op-model", industry=industry)["benchmarks"]
    filters = _load_industry_filters(industry)

    df_analysed = df_canonical[
        df_canonical["canonical_id"].astype(str).str.upper() != "UNCLASSIFIED"
    ].copy() if len(df_canonical) else df_canonical

    # CE0 — Current state (stub)
    ce0 = {
        "component_id": "ce0_current_state",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE Q-OM-COE-01-04. Stub for V1.",
    }

    # CE1 — Strategic identification (canonical-level)
    ce1 = _ce1_strategic_identification(df_analysed, ss1, filters)

    # CE2 — Industry filter
    ce2 = _ce2_industry_filter(ce1["strategic_candidates"], filters, taxonomy or {})

    # CE3 — Coverage gap (without QRE, full coe-suitable list is the gap)
    ce3 = _ce3_coverage_gap_stub(ce2)

    # CE4 — Value quantification
    ce4 = _ce4_value_quantification(ce3, benchmarks)

    # CE5 — Reconciliation stub
    ce5 = {
        "component_id": "ce5_reconciliation",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE. Stub for V1.",
    }

    headline = _build_headline(ce1, ce2, ce4)

    return {
        "theme": "coe",
        "unit_of_analysis": "canonical_category",
        "components": {
            "ce0_current_state": ce0,
            "ce1_strategic_identification": ce1,
            "ce2_industry_filter": ce2,
            "ce3_coverage_gap": ce3,
            "ce4_value_quantification": ce4,
            "ce5_reconciliation": ce5,
        },
        "headline": headline,
        "metrics": {
            "strategic_candidate_count": ce1["candidate_count"],
            "coe_suitable_count": ce2["suitable_count"],
            "addressable_spend_inr_cr": ce3["addressable_spend_inr_cr"],
            "savings_range_inr_cr": ce4["savings_range_inr_cr"],
        },
    }


# --------------------------------------------------------------------------

def _ce1_strategic_identification(df_canonical: pd.DataFrame, ss1: dict, filters: dict) -> dict:
    """Strategic candidates = Q4 from SS1 UNION strategic_by_nature filter.

    Strategic-by-nature: even if not in Q4 quadrant, certain canonical
    categories are always strategic for the industry (refractories, mill
    rolls, ferro alloys).
    """
    strategic_by_nature = filters.get("strategic_by_nature", [])

    q4_ids = {c["canonical_id"] for c in (ss1.get("q4_categories") or [])}
    nature_ids = set()
    for _, row in df_canonical.iterrows():
        label = (row.get("canonical_label") or row["canonical_id"]).upper()
        for pat in strategic_by_nature:
            if _leaf(pat) in label:
                nature_ids.add(row["canonical_id"])
                break

    all_candidates = q4_ids | nature_ids
    cand_df = df_canonical[df_canonical["canonical_id"].isin(all_candidates)]

    candidates_list = []
    for _, row in cand_df.iterrows():
        cid = row["canonical_id"]
        candidates_list.append({
            "canonical_id": cid,
            "canonical_label": row.get("canonical_label", cid),
            "archetype": row.get("archetype"),
            "total_spend_inr_cr": round(row["total_spend_inr"] / 10_000_000, 2),
            "vendor_count": int(row.get("vendor_count", 0)),
            "top_vendor_share_pct": round(float(row.get("top_vendor_share_pct", 0)), 1),
            "high_concentration": float(row.get("top_vendor_share_pct", 0)) >= HIGH_CONCENTRATION_TOP_VENDOR_THRESHOLD,
            "from_q4": cid in q4_ids,
            "from_strategic_by_nature": cid in nature_ids,
            "matkl_count": int(row.get("matkl_count", 0)),
            "members": row.get("members") or [],
        })

    candidates_list.sort(key=lambda x: -x["total_spend_inr_cr"])

    return {
        "component_id": "ce1_strategic_identification",
        "decision_driving": True,
        "candidate_count": len(candidates_list),
        "strategic_candidates": candidates_list,
        "high_concentration_count": sum(1 for c in candidates_list if c["high_concentration"]),
    }


def _ce2_industry_filter(strategic_candidates: list[dict], filters: dict, taxonomy: dict) -> dict:
    """Tag each strategic candidate: CoE-Suitable / Already-Strategic / Plant-Owned.

    Resolution order: KB explicit `coe_recommendation` field on canonical →
    filter pattern match on label → 'coe_suitable' default.
    """
    coe_suitable = filters.get("coe_suitable", [])
    already_strategic = filters.get("already_strategic_no_coe_need", [])
    plant_owned = filters.get("plant_owned", [])
    by_id = (taxonomy.get("by_id") or {})

    tags = []
    suitable_count = 0
    suitable_spend = 0.0

    for c in strategic_candidates:
        canon_def = by_id.get(c["canonical_id"]) or {}
        kb_tag = str(canon_def.get("coe_recommendation") or "").strip().lower() or None
        label = (c.get("canonical_label") or c["canonical_id"]).upper()

        tag = "no_match"
        source = None
        if kb_tag in ("coe_suitable", "already_strategic", "plant_owned"):
            tag, source = kb_tag, "kb_canonical_recommendation"
        if tag == "no_match":
            for pat in coe_suitable:
                if _leaf(pat) in label: tag, source = "coe_suitable", "filter_pattern_match"; break
        if tag == "no_match":
            for pat in already_strategic:
                if _leaf(pat) in label: tag, source = "already_strategic", "filter_pattern_match"; break
        if tag == "no_match":
            for pat in plant_owned:
                if _leaf(pat) in label: tag, source = "plant_owned", "filter_pattern_match"; break
        if tag == "no_match":
            tag, source = "coe_suitable", "default"

        if tag == "coe_suitable":
            suitable_count += 1
            suitable_spend += c["total_spend_inr_cr"]

        tags.append({**c, "tag": tag, "tag_source": source})

    return {
        "component_id": "ce2_industry_filter",
        "decision_driving": True,
        "tags": tags,
        "suitable_count": suitable_count,
        "suitable_spend_inr_cr": round(suitable_spend, 2),
    }


def _ce3_coverage_gap_stub(ce2: dict) -> dict:
    """Without QRE, full coe_suitable list is the gap."""
    return {
        "component_id": "ce3_coverage_gap",
        "decision_driving": True,
        "computed_via": "stage9_data_only_no_qre",
        "addressable_categories": [t for t in ce2["tags"] if t["tag"] == "coe_suitable"],
        "addressable_spend_inr_cr": ce2["suitable_spend_inr_cr"],
    }


def _ce4_value_quantification(ce3: dict, benchmarks: dict) -> dict:
    bench = benchmarks.get("opmodel.coe.savings_rate", {})
    rate_range = (bench.get("primary") or {}).get("value_range") or [2, 5]
    spend = ce3["addressable_spend_inr_cr"]
    low = spend * rate_range[0] / 100
    high = spend * rate_range[1] / 100
    return {
        "component_id": "ce4_value_quantification",
        "decision_driving": True,
        "coe_savings_rate_pct_range": rate_range,
        "addressable_spend_inr_cr": spend,
        "savings_range_inr_cr": [round(low, 1), round(high, 1)],
        "benchmark_source": (bench.get("primary") or {}).get("source_id"),
        "benchmark_overridden_by": bench.get("_overridden_by"),
        "note": "CoE value is INCREMENTAL over baseline centralisation; cross-theme deduplication required",
    }


# --------------------------------------------------------------------------

def _load_industry_filters(industry: str) -> dict:
    try:
        overlay = kb_loader.get_industry_pillar_overlay(industry, "op-model", "coe-filters")
    except Exception:
        return {}
    def extract(key):
        items = overlay.get(key) or []
        return [str((it.get("category_pattern") or "")).upper() for it in items if isinstance(it, dict)]
    return {
        "strategic_by_nature": extract("strategic_by_nature"),
        "coe_suitable": extract("coe_suitable"),
        "already_strategic_no_coe_need": extract("already_strategic_no_coe_need"),
        "plant_owned": extract("plant_owned"),
    }


def _leaf(pattern: str) -> str:
    return pattern.split(".")[-1].replace("_", " ").upper()


def _build_headline(ce1: dict, ce2: dict, ce4: dict) -> str:
    if ce1["candidate_count"] == 0:
        return "No strategic CoE candidates identified."
    return (
        f"{ce1['candidate_count']} strategic categories identified ({ce1['high_concentration_count']} with high vendor concentration). "
        f"{ce2['suitable_count']} tagged CoE-Suitable totalling ₹{ce2['suitable_spend_inr_cr']} Cr. "
        f"Estimated incremental savings: ₹{ce4['savings_range_inr_cr'][0]}–{ce4['savings_range_inr_cr'][1]} Cr/year."
    )
