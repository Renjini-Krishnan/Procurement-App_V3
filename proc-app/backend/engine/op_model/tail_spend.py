"""Tail Spend theme (TS0-TS5).

TS1 Quantification — Method A (PO < threshold) + Method B (Q3 from SS1)
TS2 Vendor footprint — long-tail vendor share
TS3 Industry filter — aggregator-suitable / consolidate-internally / not-addressable
TS4 Outsourcing savings — apply benchmark rate
"""
from __future__ import annotations

import pandas as pd

from ... import kb_loader

TAIL_PO_THRESHOLD_INR_LAKH = 1
MIN_AGGREGATOR_ADDRESSABLE_SPEND_INR_CR = 0.5


def run_tail_spend(df_canonical: pd.DataFrame, df_gold: pd.DataFrame, ss1: dict,
                       industry: str = "steel", taxonomy: dict | None = None) -> dict:
    benchmarks = kb_loader.resolve_pillar_benchmarks("op-model", industry=industry)["benchmarks"]
    filters = _load_industry_filters(industry)

    # TS0 — Current tail management (stub)
    ts0 = {
        "component_id": "ts0_current_tail_management",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE Q-OM-TS-01-04. Stub for V1.",
    }

    # TS1 — Quantification (two methods)
    ts1 = _ts1_quantification(df_gold, ss1)

    # TS2 — Vendor footprint (Pareto)
    ts2 = _ts2_vendor_footprint(df_gold)

    # TS3 — Industry filter (canonical-level on Q3)
    ts3 = _ts3_industry_filter(ss1.get("q3_categories") or [], filters, taxonomy or {})

    # TS4 — Outsourcing savings
    ts4 = _ts4_outsourcing_savings(ts3, benchmarks)

    # TS5 — Reconciliation stub
    ts5 = {
        "component_id": "ts5_reconciliation",
        "decision_driving": False,
        "computed": False,
        "reason": "Requires QRE. Stub for V1.",
    }

    headline = _build_headline(ts1, ts2, ts4)

    return {
        "theme": "tail-spend",
        "unit_of_analysis": "canonical_category",
        "components": {
            "ts0_current_tail_management": ts0,
            "ts1_quantification": ts1,
            "ts2_vendor_footprint": ts2,
            "ts3_industry_filter": ts3,
            "ts4_outsourcing_savings": ts4,
            "ts5_reconciliation": ts5,
        },
        "headline": headline,
        "metrics": {
            "tail_spend_share_pct": ts1["tail_spend_share_pct"],
            "long_tail_vendor_share_pct": ts2["long_tail_vendor_share_pct"],
            "aggregator_addressable_spend_inr_cr": ts3["aggregator_addressable_spend_inr_cr"],
            "savings_range_inr_cr": ts4["savings_range_inr_cr"],
        },
    }


# --------------------------------------------------------------------------

def _ts1_quantification(df_gold: pd.DataFrame, ss1: dict) -> dict:
    """Method A: POs below ₹1 lakh each (per-transaction).
       Method B: Spend in Q3 canonical categories from SS1."""
    threshold_inr = TAIL_PO_THRESHOLD_INR_LAKH * 100_000
    total = float(df_gold["net_value_inr"].sum())

    method_a_spend = float(df_gold.loc[df_gold["net_value_inr"] < threshold_inr, "net_value_inr"].sum())
    method_a_pos = int((df_gold["net_value_inr"] < threshold_inr).sum())

    q3_ids = {c["canonical_id"] for c in (ss1.get("q3_categories") or [])}
    if q3_ids and "canonical_id" in df_gold.columns:
        method_b_spend = float(df_gold[df_gold["canonical_id"].isin(q3_ids)]["net_value_inr"].sum())
    else:
        method_b_spend = 0.0

    # Combined tail spend (take max of two methods — not additive)
    combined = max(method_a_spend, method_b_spend)
    tail_share_pct = round(combined / total * 100, 1) if total else 0.0

    return {
        "component_id": "ts1_quantification",
        "decision_driving": True,
        "method_a_threshold_inr_lakh": TAIL_PO_THRESHOLD_INR_LAKH,
        "method_a_spend_inr_cr": round(method_a_spend / 10_000_000, 1),
        "method_a_po_count": method_a_pos,
        "method_b_q3_count": len(q3_ids),
        "method_b_spend_inr_cr": round(method_b_spend / 10_000_000, 1),
        "combined_tail_spend_inr_cr": round(combined / 10_000_000, 1),
        "tail_spend_share_pct": tail_share_pct,
        "q3_canonicals": list(q3_ids),
    }


def _ts2_vendor_footprint(df_gold: pd.DataFrame) -> dict:
    """Long-tail vendors = bottom-80% of vendors by spend. Pareto check."""
    if "vendor_id" not in df_gold.columns:
        return {"component_id": "ts2_vendor_footprint", "long_tail_vendor_share_pct": 0.0, "vendor_count": 0}

    vendor_spend = df_gold.groupby("vendor_id")["net_value_inr"].sum().sort_values(ascending=False)
    total_spend = float(vendor_spend.sum())
    if total_spend <= 0:
        return {"component_id": "ts2_vendor_footprint", "long_tail_vendor_share_pct": 0.0, "vendor_count": 0}

    # Top-20% vendors
    top20_n = max(1, int(round(len(vendor_spend) * 0.2)))
    top20_spend = float(vendor_spend.head(top20_n).sum())
    top20_share = round(top20_spend / total_spend * 100, 1)
    long_tail_share = round(100 - top20_share, 1)

    return {
        "component_id": "ts2_vendor_footprint",
        "decision_driving": False,
        "vendor_count": int(len(vendor_spend)),
        "top20_pct_vendor_count": top20_n,
        "top20_spend_share_pct": top20_share,
        "long_tail_vendor_share_pct": long_tail_share,
        "pareto_holds": top20_share >= 75,  # Standard 80-20 rule check
    }


def _ts3_industry_filter(q3_categories: list[dict], filters: dict, taxonomy: dict) -> dict:
    """Tag each Q3 canonical as aggregator-suitable / consolidate / not-addressable.

    Resolution: KB `tail_recommendation` per canonical → filter pattern on label
    → archetype default (INDIRECT → aggregator_suitable, else review).
    Each tag entry carries members[] for UI drill-down.
    """
    aggregator_suitable = filters.get("aggregator_suitable", [])
    consolidate = filters.get("consolidate_internally", [])
    not_addressable = filters.get("not_addressable", [])
    by_id = (taxonomy.get("by_id") or {})

    tags = []
    aggregator_spend_inr_cr = 0.0
    aggregator_count = 0

    for c in q3_categories:
        cid = c["canonical_id"]
        canon_def = by_id.get(cid) or {}
        kb_tag = str(canon_def.get("tail_recommendation") or "").strip().lower() or None
        label = (c.get("canonical_label") or cid).upper()

        tag = "no_match"
        source = None
        if kb_tag in ("aggregator_suitable", "consolidate_internally", "not_addressable", "review"):
            tag, source = kb_tag, "kb_canonical_recommendation"
        if tag == "no_match":
            for pat in aggregator_suitable:
                if _leaf(pat) in label: tag, source = "aggregator_suitable", "filter_pattern_match"; break
        if tag == "no_match":
            for pat in consolidate:
                if _leaf(pat) in label: tag, source = "consolidate_internally", "filter_pattern_match"; break
        if tag == "no_match":
            for pat in not_addressable:
                if _leaf(pat) in label: tag, source = "not_addressable", "filter_pattern_match"; break
        if tag == "no_match":
            if str(c.get("archetype") or "").upper() == "INDIRECT":
                tag, source = "aggregator_suitable", "archetype_default"
            else:
                tag, source = "review", "archetype_default"

        spend_cr = float(c.get("total_spend_inr", 0)) / 10_000_000
        if tag == "aggregator_suitable":
            aggregator_count += 1
            aggregator_spend_inr_cr += spend_cr

        tags.append({
            "canonical_id": cid,
            "canonical_label": c.get("canonical_label", cid),
            "archetype": c.get("archetype"),
            "tag": tag,
            "tag_source": source,
            "total_spend_inr_cr": round(spend_cr, 2),
            "po_count": int(c.get("po_count", 0)),
            "matkl_count": c.get("matkl_count", 0),
            "members": c.get("members") or [],
        })

    return {
        "component_id": "ts3_industry_filter",
        "decision_driving": True,
        "q3_canonical_count": len(q3_categories),
        "aggregator_addressable_spend_inr_cr": round(aggregator_spend_inr_cr, 2),
        "aggregator_count": aggregator_count,
        "tags": tags,
    }


def _leaf(pattern: str) -> str:
    return pattern.split(".")[-1].replace("_", " ").upper()


def _ts4_outsourcing_savings(ts3: dict, benchmarks: dict) -> dict:
    bench = benchmarks.get("opmodel.tail_spend.outsourcing_savings_rate", {})
    rate_range = (bench.get("primary") or {}).get("value_range") or [3, 8]
    addressable = ts3.get("aggregator_addressable_spend_inr_cr", 0.0)
    low = addressable * rate_range[0] / 100
    high = addressable * rate_range[1] / 100
    return {
        "component_id": "ts4_outsourcing_savings",
        "decision_driving": True,
        "outsourcing_rate_pct_range": rate_range,
        "addressable_spend_inr_cr": addressable,
        "savings_range_inr_cr": [round(low, 1), round(high, 1)],
        "benchmark_source": (bench.get("primary") or {}).get("source_id"),
        "benchmark_overridden_by": bench.get("_overridden_by"),
    }


# --------------------------------------------------------------------------

def _load_industry_filters(industry: str) -> dict:
    try:
        overlay = kb_loader.get_industry_pillar_overlay(industry, "op-model", "tail-spend-filters")
    except Exception:
        return {}
    def extract(key):
        items = overlay.get(key) or []
        return [str((it.get("category_pattern") or "")).upper() for it in items if isinstance(it, dict)]
    return {
        "aggregator_suitable": extract("aggregator_suitable"),
        "consolidate_internally": extract("consolidate_internally"),
        "not_addressable": extract("not_addressable"),
    }


def _build_headline(ts1: dict, ts2: dict, ts4: dict) -> str:
    return (
        f"Tail spend ~{ts1['tail_spend_share_pct']}% of portfolio "
        f"(₹{ts1['combined_tail_spend_inr_cr']} Cr across {ts1['method_a_po_count']:,} low-value POs). "
        f"Long-tail vendor share: {ts2['long_tail_vendor_share_pct']}%."
    )
