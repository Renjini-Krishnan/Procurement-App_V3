"""Shared Services theme (SS0-SS5).

Operates on Stage 9 canonical categories. Each output entry carries the
underlying MATKLs as `members` for UI drill-down.

SS1 Volume-Value Quadrant — FOUNDATIONAL, used by CoE + Tail Spend
SS2 Industry knowledge filter — SSC-suitable / unsuitable / centre-handled
SS3 SSC coverage gap — addressable spend + PO count
SS4 FTE productivity — operational saving from cost-per-PO drop + FTE freed
"""
from __future__ import annotations

import pandas as pd

from ... import kb_loader

SSC_MINIMUM_PO_COUNT = 500
SSC_MINIMUM_ANNUAL_SPEND_INR_CR = 5


def run_shared_services(df_canonical: pd.DataFrame, industry: str = "steel",
                            taxonomy: dict | None = None) -> dict:
    benchmarks = kb_loader.resolve_pillar_benchmarks("op-model", industry=industry)["benchmarks"]
    filters = _load_industry_filters(industry)

    # Drop UNCLASSIFIED bucket from theme analysis
    df_analysed = df_canonical[
        df_canonical["canonical_id"].astype(str).str.upper() != "UNCLASSIFIED"
    ].copy() if len(df_canonical) else df_canonical

    # SS0 — Current coverage (stub)
    ss0 = {
        "component_id": "ss0_current_coverage",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE Q-OM-SS-01/02/03 responses. Stub for V1.",
    }

    # SS1 — Volume-Value Quadrant
    ss1 = _ss1_volume_value_quadrant(df_analysed)

    # SS2 — Industry filter on Q1 transactional candidates
    ss2 = _ss2_industry_filter(ss1["q1_categories"], df_analysed, filters, taxonomy or {})

    # SS3 — Coverage gap (without QRE, treat full SSC-suitable list as gap)
    ss3 = _ss3_coverage_gap(ss2)

    # SS4 — Productivity
    ss4 = _ss4_fte_productivity(ss3, benchmarks)

    # SS5 — Reconciliation
    ss5 = {
        "component_id": "ss5_reconciliation",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE. Stub for V1.",
    }

    headline = _build_headline(ss1, ss3, ss4)

    return {
        "theme": "shared-services",
        "unit_of_analysis": "canonical_category",
        "components": {
            "ss0_current_coverage": ss0,
            "ss1_volume_value_quadrant": ss1,
            "ss2_industry_filter": ss2,
            "ss3_coverage_gap": ss3,
            "ss4_fte_productivity": ss4,
            "ss5_reconciliation": ss5,
        },
        "headline": headline,
        "metrics": {
            "q1_count": len(ss1["q1_categories"]),
            "q4_count": len(ss1["q4_categories"]),
            "ssc_suitable_count": ss2["suitable_count"],
            "ssc_addressable_spend_inr_cr": ss3["addressable_spend_inr_cr"],
            "ssc_addressable_po_count": ss3["addressable_po_count"],
            "operational_savings_inr_cr": ss4["operational_savings_inr_cr"],
            "fte_equivalent_freed": ss4["fte_equivalent_freed"],
        },
    }


# --------------------------------------------------------------------------

def _ss1_volume_value_quadrant(df_canonical: pd.DataFrame) -> dict:
    """Classify each canonical category into Q1/Q2/Q3/Q4 based on PO count
    + avg PO value percentile thresholds (75th percentile).
      Q1 = high count + low value  → Transactional (SSC)
      Q2 = high count + high value → Hybrid
      Q3 = low count  + low value  → Tail
      Q4 = low count  + high value → Strategic (CoE)
    """
    if df_canonical.empty:
        return {"component_id": "ss1_volume_value_quadrant",
                "q1_categories": [], "q2_categories": [],
                "q3_categories": [], "q4_categories": [], "thresholds": {}}

    po_thresh = float(df_canonical["po_count"].quantile(0.75))
    val_thresh = float(df_canonical["avg_po_value"].quantile(0.75))

    def quadrant(row):
        high_po = row["po_count"] >= po_thresh
        high_val = row["avg_po_value"] >= val_thresh
        if high_po and not high_val: return "Q1"
        if high_po and high_val:     return "Q2"
        if not high_po and not high_val: return "Q3"
        return "Q4"

    df = df_canonical.copy()
    df["quadrant"] = df.apply(quadrant, axis=1)

    def as_list(q):
        out = []
        for _, r in df[df["quadrant"] == q].iterrows():
            out.append({
                "canonical_id": r["canonical_id"],
                "canonical_label": r.get("canonical_label", r["canonical_id"]),
                "archetype": r.get("archetype"),
                "total_spend_inr": float(r["total_spend_inr"]),
                "po_count": int(r["po_count"]),
                "avg_po_value": float(r.get("avg_po_value", 0)),
                "vendor_count": int(r.get("vendor_count", 0)),
                "plant_count": int(r.get("plant_count", 0)),
                "matkl_count": int(r.get("matkl_count", 0)),
                "members": r.get("members") or [],
            })
        return out

    return {
        "component_id": "ss1_volume_value_quadrant",
        "decision_driving": True,
        "thresholds": {"high_po_count": po_thresh, "high_avg_value_inr": val_thresh},
        "q1_categories": as_list("Q1"),
        "q2_categories": as_list("Q2"),
        "q3_categories": as_list("Q3"),
        "q4_categories": as_list("Q4"),
        "labels": {"Q1": "Transactional (SSC)", "Q2": "Hybrid",
                    "Q3": "Tail", "Q4": "Strategic (CoE)"},
    }


# SSC-default archetype tag (when neither KB recommendation nor filter pattern matches)
_SSC_ARCHETYPE_DEFAULT = {
    "INDIRECT": "suitable",
    "SERVICE": "review",
    "BULK": "unsuitable",
    "DIRECT": "unsuitable",
    "CAPEX": "centre_handled",
    "UNKNOWN": "review",
}


def _ss2_industry_filter(q1_categories: list, df_canonical: pd.DataFrame,
                            filters: dict, taxonomy: dict) -> dict:
    """Tag Q1 canonical categories as SSC-Suitable / Unsuitable / Centre-Handled.

    Resolution order: KB explicit `ssc_recommendation` field on the canonical
    → filter-pattern match on canonical_label → archetype default.
    """
    suitable = filters.get("ssc_suitable", [])
    unsuitable = filters.get("ssc_unsuitable", [])
    centre_handled = filters.get("centre_handled", [])
    by_id = (taxonomy.get("by_id") or {})

    tags = []
    suitable_count = 0
    suitable_spend = 0.0
    suitable_po_count = 0

    for cat in q1_categories:
        cid = cat["canonical_id"]
        canon_def = by_id.get(cid) or {}
        kb_tag = str(canon_def.get("ssc_recommendation") or "").strip().lower() or None
        label_upper = str(cat.get("canonical_label") or cid).upper()
        archetype = cat.get("archetype") or "UNKNOWN"

        tag = "no_match"
        source = None
        if kb_tag in ("suitable", "unsuitable", "centre_handled", "review"):
            tag, source = kb_tag, "kb_canonical_recommendation"
        if tag == "no_match":
            for pat in centre_handled:
                if _leaf(pat) in label_upper:
                    tag, source = "centre_handled", "filter_pattern_match"; break
        if tag == "no_match":
            for pat in unsuitable:
                if _leaf(pat) in label_upper:
                    tag, source = "unsuitable", "filter_pattern_match"; break
        if tag == "no_match":
            for pat in suitable:
                if _leaf(pat) in label_upper:
                    tag, source = "suitable", "filter_pattern_match"; break
        if tag == "no_match":
            tag = _SSC_ARCHETYPE_DEFAULT.get(str(archetype).upper(), "review")
            source = "archetype_default"

        if tag == "suitable":
            suitable_count += 1
            suitable_spend += float(cat["total_spend_inr"])
            suitable_po_count += int(cat["po_count"])

        tags.append({
            "canonical_id": cid,
            "canonical_label": cat.get("canonical_label", cid),
            "archetype": archetype,
            "tag": tag,
            "tag_source": source,
            "po_count": cat["po_count"],
            "total_spend_inr_cr": round(cat["total_spend_inr"] / 10_000_000, 2),
            "matkl_count": cat.get("matkl_count", 0),
            "members": cat.get("members") or [],
        })

    return {
        "component_id": "ss2_industry_filter",
        "decision_driving": True,
        "tags": tags,
        "suitable_count": suitable_count,
        "suitable_spend_inr_cr": round(suitable_spend / 10_000_000, 2),
        "suitable_po_count": suitable_po_count,
    }


def _ss3_coverage_gap(ss2: dict) -> dict:
    """Without QRE (no current SSC scope), the entire SSC-suitable list is the gap."""
    return {
        "component_id": "ss3_coverage_gap",
        "decision_driving": True,
        "computed_via": "stage9_data_only_no_qre",
        "addressable_categories": [t for t in ss2["tags"] if t["tag"] == "suitable"],
        "addressable_spend_inr_cr": ss2["suitable_spend_inr_cr"],
        "addressable_po_count": ss2["suitable_po_count"],
    }


def _ss4_fte_productivity(ss3: dict, benchmarks: dict) -> dict:
    cur = benchmarks.get("opmodel.shared_services.current_cost_per_po_inr", {})
    tgt = benchmarks.get("opmodel.shared_services.ssc_target_cost_per_po_inr", {})

    cur_range = (cur.get("primary") or {}).get("value_range") or [2500, 4000]
    tgt_range = (tgt.get("primary") or {}).get("value_range") or [1000, 1800]
    cur_mid = sum(cur_range) / 2
    tgt_mid = sum(tgt_range) / 2

    po_count = ss3["addressable_po_count"]
    saving_per_po = cur_mid - tgt_mid
    operational_savings = saving_per_po * po_count

    # FTE-equivalent freed
    plant_pos_per_fte_low = 4000
    ssc_pos_per_fte_high = 15000
    fte_low = po_count / ssc_pos_per_fte_high
    fte_high = po_count / plant_pos_per_fte_low
    fte_freed = round((fte_high - fte_low), 1)

    return {
        "component_id": "ss4_fte_productivity",
        "decision_driving": True,
        "current_cost_per_po_inr": round(cur_mid),
        "ssc_target_cost_per_po_inr": round(tgt_mid),
        "saving_per_po_inr": round(saving_per_po),
        "addressable_po_count": po_count,
        "operational_savings_inr": round(operational_savings),
        "operational_savings_inr_cr": round(operational_savings / 10_000_000, 1),
        "fte_equivalent_freed": fte_freed,
        "benchmark_source": (cur.get("primary") or {}).get("source_id"),
    }


# --------------------------------------------------------------------------

def _load_industry_filters(industry: str) -> dict:
    try:
        overlay = kb_loader.get_industry_pillar_overlay(industry, "op-model", "shared-services-filters")
    except Exception:
        return {"ssc_suitable": [], "ssc_unsuitable": [], "centre_handled": []}
    def extract(key):
        items = overlay.get(key) or []
        return [str((it.get("category_pattern") or "")).upper() for it in items if isinstance(it, dict)]
    return {
        "ssc_suitable": extract("ssc_suitable"),
        "ssc_unsuitable": extract("ssc_unsuitable"),
        "centre_handled": extract("centre_handled"),
    }


def _leaf(pattern: str) -> str:
    return pattern.split(".")[-1].replace("_", " ").upper()


def _build_headline(ss1: dict, ss3: dict, ss4: dict) -> str:
    q1_count = len(ss1["q1_categories"])
    if q1_count == 0:
        return "No Q1 transactional categories identified."
    return (
        f"{q1_count} Q1 transactional categories surface as SSC candidates "
        f"(₹{ss3['addressable_spend_inr_cr']} Cr / {ss3['addressable_po_count']:,} POs). "
        f"Estimated operational savings: ₹{ss4['operational_savings_inr_cr']} Cr/yr; "
        f"FTE-equivalent freed: ~{ss4['fte_equivalent_freed']}."
    )
