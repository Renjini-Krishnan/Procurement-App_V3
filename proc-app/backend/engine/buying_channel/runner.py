"""Buying Channel pillar runner.

Applies per-archetype thresholds + 13 IF-THEN rules from analysis-config.yml
to each MG. Computes current channel state + match status + portfolio rollups.
"""
from __future__ import annotations

from collections import Counter
from typing import Optional

import pandas as pd

from ... import kb_loader


# Per-archetype thresholds (from analysis-config.yml; loaded at runtime)
DEFAULTS = {
    "high_value_direct_avg_po_inr": 5_000_000,    # ₹50 L
    "low_value_indirect_avg_po_inr": 50_000,
    "medium_value_indirect_avg_po_inr": 500_000,  # ₹5 L
    "high_value_service_avg_po_inr": 500_000,
    "bulk_full_ltc_threshold_total_spend_inr_cr": 5,
    "high_freq_po_count_6mo_threshold": 5,
    "low_freq_po_count_6mo_threshold": 2,
    "pac_high_threshold_pct": 50,
}


def run_buying_channel(df_gold: pd.DataFrame, df_mg: pd.DataFrame, industry: str = "steel") -> dict:
    """Single theme — 13 components on per-MG data."""
    cfg = kb_loader.get_pillar_config("buying-channel")
    thresholds = _load_thresholds(cfg)
    benchmarks = _load_benchmarks(industry)

    # BC1 — Current portfolio channel mix
    bc1 = _bc1_current_mix(df_gold)

    # BC2 — Per-MG profile (already computed in df_mg; add recommended channel)
    df_recs = _apply_recommendation_rules(df_mg, thresholds)

    # BC3 — Archetype × channel heatmap
    bc3 = _bc3_archetype_channel_heatmap(df_recs)

    # BC4 already in df_recs as 'recommended_channel'
    bc4 = {"recommendations": len(df_recs), "by_channel": df_recs["recommended_channel"].value_counts().to_dict()}

    # BC5 — Match status
    bc5 = _bc5_match_status(df_recs)

    # BC6 — Migration opportunities
    bc6 = _bc6_migration_opportunities(df_recs)

    # BC7 — Cross-plant aggregation opportunity (single-vendor multi-plant)
    bc7 = _bc7_cross_plant(df_recs)

    # BC8 — Sole-source risk
    bc8 = _bc8_sole_source(df_recs)

    # BC9 — Project / one-off exclusion
    bc9 = _bc9_project_one_off(df_recs)

    # BC10 — Unclassified MGs (cross-pillar handoff signal)
    bc10 = _bc10_unclassified(df_recs)

    # BC13 — Contract coverage lift estimate
    bc13 = _bc13_contract_lift(df_recs, bc1)

    # Theme score
    score = _score(bc1, bc5, bc8, bc10)

    headline = _headline(bc1, bc5, bc6, bc8)

    return {
        "pillar": "buying-channel",
        "themes": {
            "buying-channel-strategy": {
                "theme": "buying-channel-strategy",
                "headline": headline,
                "metrics": {
                    "contracted_spend_pct": bc1["contracted_spend_pct"],
                    "misrouted_mg_count": bc5["misrouted_count"],
                    "misrouted_spend_inr_cr": bc5["misrouted_spend_inr_cr"],
                    "catalogue_migration_candidates": bc6.get("catalogue_count", 0),
                    "ola_migration_candidates": bc6.get("ola_count", 0),
                    "rc_lt_migration_candidates": bc6.get("rc_lt_count", 0),
                    "sole_source_count": bc8["sole_source_count"],
                    "unclassified_pct": bc10["unclassified_pct"],
                    "contract_lift_pp": bc13["lift_pp"],
                },
                "components": {
                    "bc1_portfolio_channel_mix": bc1,
                    "bc3_archetype_channel_heatmap": bc3,
                    "bc4_recommended_channel_per_mg": bc4,
                    "bc5_match_status": bc5,
                    "bc6_migration_opportunities": bc6,
                    "bc7_cross_plant_aggregation": bc7,
                    "bc8_sole_source_risk": bc8,
                    "bc9_project_one_off": bc9,
                    "bc10_unclassified_mgs": bc10,
                    "bc13_contract_coverage_lift": bc13,
                },
                "per_mg_table": df_recs.head(30)[[
                    "material_group", "material_group_desc", "archetype",
                    "total_spend_inr", "po_count", "vendor_count", "contracted_pct",
                    "current_channel", "recommended_channel", "match_status",
                ]].to_dict(orient="records"),
            }
        },
        "theme_scores": {"buying-channel-strategy": score},
        "pillar_score": score,
        "rca_cards": _rca(bc1, bc5, bc8, bc10),
    }


# --------------------------------------------------------------------------

def _load_thresholds(cfg: dict) -> dict:
    arch_th = cfg.get("archetype_thresholds") or {}
    freq_th = cfg.get("frequency_thresholds") or {}
    sole = cfg.get("sole_source_risk_detection") or {}
    out = dict(DEFAULTS)
    # Pull from KB where present (handle nested 'value' dicts)
    def _v(node, default):
        if isinstance(node, dict) and "value" in node:
            return node["value"]
        return node if node is not None else default
    if arch_th.get("direct"):
        out["high_value_direct_avg_po_inr"] = _v(arch_th["direct"].get("high_value_avg_po_inr"), DEFAULTS["high_value_direct_avg_po_inr"])
    if arch_th.get("indirect"):
        out["low_value_indirect_avg_po_inr"] = _v(arch_th["indirect"].get("low_value_avg_po_inr"), DEFAULTS["low_value_indirect_avg_po_inr"])
        out["medium_value_indirect_avg_po_inr"] = _v(arch_th["indirect"].get("medium_value_avg_po_inr"), DEFAULTS["medium_value_indirect_avg_po_inr"])
    if arch_th.get("service"):
        out["high_value_service_avg_po_inr"] = _v(arch_th["service"].get("high_value_avg_po_inr"), DEFAULTS["high_value_service_avg_po_inr"])
    if arch_th.get("bulk"):
        out["bulk_full_ltc_threshold_total_spend_inr_cr"] = _v(arch_th["bulk"].get("full_ltc_threshold_total_spend_inr_cr"), DEFAULTS["bulk_full_ltc_threshold_total_spend_inr_cr"])
    if freq_th.get("high_freq_po_count_6mo_threshold"):
        out["high_freq_po_count_6mo_threshold"] = _v(freq_th["high_freq_po_count_6mo_threshold"], DEFAULTS["high_freq_po_count_6mo_threshold"])
    pac_node = (sole.get("bc8c_pac_justified") or {}).get("pac_high_threshold_pct")
    if pac_node:
        out["pac_high_threshold_pct"] = _v(pac_node, DEFAULTS["pac_high_threshold_pct"])
    return out


def _load_benchmarks(industry: str) -> dict:
    try:
        return kb_loader.resolve_pillar_benchmarks("buying-channel", industry=industry)["benchmarks"]
    except Exception:
        return {}


# --------------------------------------------------------------------------
# Current channel derivation (BC1)
# --------------------------------------------------------------------------

def _derive_current_channel_per_row(row) -> str:
    if row.get("contract_number") and str(row["contract_number"]).strip():
        return "rc_long_term_contract"
    if row.get("outline_agreement") and str(row["outline_agreement"]).strip():
        return "rc_outline_agreement"
    if row.get("scheduling_agreement") and str(row["scheduling_agreement"]).strip():
        return "rc_rop_catalogue"
    short = str(row.get("short_text", ""))
    if any(kw in short.upper() for kw in ("PAC", "PROPRIETARY", "OEM", "SOLE SOURCE", "SINGLE SOURCE")):
        return "single_tender_pac"
    return "spot_uncontracted"


def _bc1_current_mix(df_gold: pd.DataFrame) -> dict:
    df = df_gold.copy()
    df["_channel"] = df.apply(_derive_current_channel_per_row, axis=1)
    total = float(df["net_value_inr"].sum())
    by_channel = df.groupby("_channel")["net_value_inr"].sum().to_dict()
    mix = {k: round(v / total * 100, 1) for k, v in by_channel.items()} if total else {}
    contracted_set = {"rc_long_term_contract", "rc_outline_agreement", "rc_rop_catalogue"}
    contracted_pct = round(sum(by_channel.get(k, 0) for k in contracted_set) / total * 100, 1) if total else 0.0
    return {
        "spend_by_channel_inr_cr": {k: round(v / 1e7, 2) for k, v in by_channel.items()},
        "channel_mix_pct": mix,
        "contracted_spend_pct": contracted_pct,
        "total_spend_inr_cr": round(total / 1e7, 1),
    }


# --------------------------------------------------------------------------
# Per-MG channel recommendation (BC4) — 13 rules
# --------------------------------------------------------------------------

def _classify_value(archetype: str, avg_po_value: float, total_spend_inr: float, thresholds: dict) -> str:
    """Bucket avg_po_value into high/medium/low per archetype."""
    if archetype == "DIRECT":
        return "high" if avg_po_value >= thresholds["high_value_direct_avg_po_inr"] else "low"
    if archetype == "INDIRECT":
        if avg_po_value <= thresholds["low_value_indirect_avg_po_inr"]:
            return "low"
        if avg_po_value <= thresholds["medium_value_indirect_avg_po_inr"]:
            return "medium"
        return "high"
    if archetype == "SERVICE":
        return "high" if avg_po_value >= thresholds["high_value_service_avg_po_inr"] else "low"
    return "n/a"


def _recommend_channel(row, thresholds: dict) -> tuple[str, str]:
    """Return (recommended_channel, rule_fired)."""
    archetype = row["archetype"]
    pac_pct = row.get("pac_pct", 0)
    vendor_count = row.get("vendor_count", 0)
    po_count_6mo = row.get("po_count_6mo", 0)
    avg_po_value = row.get("avg_po_value", 0)
    total_spend_inr_cr = row.get("total_spend_inr", 0) / 1e7
    desc = (row.get("material_group_desc") or "").upper()

    high_freq = po_count_6mo > thresholds["high_freq_po_count_6mo_threshold"]

    # R1: PAC override
    if pac_pct >= thresholds["pac_high_threshold_pct"]:
        return ("single_tender_pac", "R1_pac_override")

    # R2: CAPEX
    if archetype == "CAPEX":
        return ("rfq_tendering", "R2_capex_always_rfq")

    # R3-R4: BULK
    if archetype == "BULK":
        if total_spend_inr_cr >= thresholds["bulk_full_ltc_threshold_total_spend_inr_cr"] and high_freq:
            return ("rc_long_term_contract", "R3_bulk_full_ltc")
        return ("rc_outline_agreement", "R4_bulk_smaller_annual")

    # R5-R7: INDIRECT
    if archetype == "INDIRECT":
        if avg_po_value <= thresholds["low_value_indirect_avg_po_inr"] and high_freq:
            return ("rc_rop_catalogue", "R5_indirect_catalogue")
        if avg_po_value <= thresholds["medium_value_indirect_avg_po_inr"] and po_count_6mo >= 3:
            return ("rc_outline_agreement", "R6_indirect_ola")
        if avg_po_value > thresholds["medium_value_indirect_avg_po_inr"]:
            return ("asl", "R7_indirect_engineered")

    # R8-R9: SERVICE
    if archetype == "SERVICE":
        if high_freq:
            return ("rc_outline_agreement", "R8_service_recurring_ola")
        if po_count_6mo <= thresholds["low_freq_po_count_6mo_threshold"] and avg_po_value >= thresholds["high_value_service_avg_po_inr"]:
            return ("rfq_tendering", "R9_service_project_rfq")
        return ("rc_outline_agreement", "R8_service_recurring_ola")

    # R10-R12: DIRECT
    if archetype == "DIRECT":
        if vendor_count >= 3 and avg_po_value < thresholds["high_value_direct_avg_po_inr"]:
            return ("asl", "R10_direct_panel_asl")
        if avg_po_value >= thresholds["high_value_direct_avg_po_inr"]:
            return ("asl", "R11_direct_high_value_asl_plus_rclt")
        if vendor_count <= 2:
            return ("asl", "R12_direct_narrow_vendor_base")

    # R13: UNCLASSIFIED
    return ("rfq_tendering", "R13_unclassified_fallback")


def _derive_current_channel_per_mg(row) -> str:
    """Approximate current channel per MG based on contracted_pct."""
    contracted_pct = row.get("contracted_pct", 0)
    if contracted_pct >= 80:
        return "rc_long_term_contract"   # mature contracted
    elif contracted_pct >= 40:
        return "rc_outline_agreement"
    elif contracted_pct >= 1:
        return "rc_rop_catalogue"
    return "spot_uncontracted"


def _apply_recommendation_rules(df_mg: pd.DataFrame, thresholds: dict) -> pd.DataFrame:
    df = df_mg.copy()
    df["current_channel"] = df.apply(_derive_current_channel_per_mg, axis=1)
    rec_chan, rule = zip(*df.apply(lambda r: _recommend_channel(r, thresholds), axis=1))
    df["recommended_channel"] = rec_chan
    df["rule_fired"] = rule
    df["match_status"] = df.apply(_compute_match_status, axis=1)
    return df


def _compute_match_status(row) -> str:
    cur = row["current_channel"]
    rec = row["recommended_channel"]
    if row.get("archetype") == "UNCLASSIFIED":
        return "unrecoverable"
    if cur == rec:
        return "already_right"
    contracted_channels = {"rc_long_term_contract", "rc_outline_agreement", "rc_rop_catalogue"}
    if cur in contracted_channels and rec in contracted_channels:
        return "over_engineered"
    return "misrouted"


# --------------------------------------------------------------------------
# Aggregations
# --------------------------------------------------------------------------

def _bc3_archetype_channel_heatmap(df_recs: pd.DataFrame) -> dict:
    pivot = df_recs.groupby(["archetype", "current_channel"])["total_spend_inr"].sum().reset_index()
    out = {}
    for arch, sub in pivot.groupby("archetype"):
        total = float(sub["total_spend_inr"].sum())
        out[arch] = {
            row["current_channel"]: round(row["total_spend_inr"] / total * 100, 1) if total else 0
            for _, row in sub.iterrows()
        }
    return out


def _bc5_match_status(df_recs: pd.DataFrame) -> dict:
    counts = df_recs["match_status"].value_counts().to_dict()
    spend = df_recs.groupby("match_status")["total_spend_inr"].sum().to_dict()
    misrouted = df_recs[df_recs["match_status"] == "misrouted"]
    return {
        "counts": counts,
        "spend_inr_cr": {k: round(v / 1e7, 1) for k, v in spend.items()},
        "misrouted_count": int(counts.get("misrouted", 0)),
        "misrouted_spend_inr_cr": round(spend.get("misrouted", 0) / 1e7, 1),
        "already_right_count": int(counts.get("already_right", 0)),
        "over_engineered_count": int(counts.get("over_engineered", 0)),
        "unrecoverable_count": int(counts.get("unrecoverable", 0)),
    }


def _bc6_migration_opportunities(df_recs: pd.DataFrame) -> dict:
    misrouted = df_recs[df_recs["match_status"] == "misrouted"]
    by_target = misrouted.groupby("recommended_channel").size().to_dict()
    spend_by_target = misrouted.groupby("recommended_channel")["total_spend_inr"].sum().to_dict()
    return {
        "catalogue_count": int(by_target.get("rc_rop_catalogue", 0)),
        "ola_count": int(by_target.get("rc_outline_agreement", 0)),
        "rc_lt_count": int(by_target.get("rc_long_term_contract", 0)),
        "asl_count": int(by_target.get("asl", 0)),
        "rfq_count": int(by_target.get("rfq_tendering", 0)),
        "single_tender_count": int(by_target.get("single_tender_pac", 0)),
        "spend_by_target_inr_cr": {k: round(v / 1e7, 2) for k, v in spend_by_target.items()},
        "top_candidates": misrouted.nlargest(20, "total_spend_inr")[[
            "material_group", "material_group_desc", "archetype",
            "total_spend_inr", "current_channel", "recommended_channel", "rule_fired"
        ]].assign(total_spend_inr_cr=lambda d: (d["total_spend_inr"] / 1e7).round(2)).to_dict(orient="records"),
    }


def _bc7_cross_plant(df_recs: pd.DataFrame) -> dict:
    multi_plant = df_recs[df_recs["plant_count"] >= 2]
    return {
        "multi_plant_mg_count": int(len(multi_plant)),
        "multi_plant_spend_inr_cr": round(float(multi_plant["total_spend_inr"].sum()) / 1e7, 1),
    }


def _bc8_sole_source(df_recs: pd.DataFrame) -> dict:
    single_vendor = df_recs[df_recs["vendor_count"] == 1]
    concentrated = df_recs[df_recs["top_vendor_share_pct"] >= 80]
    pac = df_recs[df_recs["pac_pct"] >= 50]
    return {
        "single_vendor_count": int(len(single_vendor)),
        "single_vendor_spend_inr_cr": round(float(single_vendor["total_spend_inr"].sum()) / 1e7, 1),
        "concentrated_count": int(len(concentrated)),
        "pac_justified_count": int(len(pac)),
        "sole_source_count": int(len(set(single_vendor.index) | set(pac.index))),
        "top_sole_source": single_vendor.nlargest(10, "total_spend_inr")[[
            "material_group", "material_group_desc", "archetype",
            "total_spend_inr", "vendor_count", "top_vendor_share_pct"
        ]].assign(total_spend_inr_cr=lambda d: (d["total_spend_inr"] / 1e7).round(2)).to_dict(orient="records"),
    }


def _bc9_project_one_off(df_recs: pd.DataFrame) -> dict:
    capex_or_low_freq = df_recs[(df_recs["archetype"] == "CAPEX") | (df_recs["distinct_months"] < 3) | (df_recs["po_count"] < 5)]
    return {
        "exempt_count": int(len(capex_or_low_freq)),
        "exempt_spend_inr_cr": round(float(capex_or_low_freq["total_spend_inr"].sum()) / 1e7, 1),
    }


def _bc10_unclassified(df_recs: pd.DataFrame) -> dict:
    unc = df_recs[df_recs["archetype"] == "UNCLASSIFIED"]
    total = float(df_recs["total_spend_inr"].sum())
    return {
        "unclassified_count": int(len(unc)),
        "unclassified_pct": round(len(unc) / max(len(df_recs), 1) * 100, 1),
        "unclassified_spend_pct": round(float(unc["total_spend_inr"].sum()) / total * 100, 1) if total else 0,
    }


def _bc13_contract_lift(df_recs: pd.DataFrame, bc1: dict) -> dict:
    contracted_now = bc1["contracted_spend_pct"]
    # Migration spend going to contracted channels (RC-LT/OLA/Catalogue)
    contracted_set = {"rc_long_term_contract", "rc_outline_agreement", "rc_rop_catalogue"}
    misrouted = df_recs[df_recs["match_status"] == "misrouted"]
    migration_spend = float(misrouted[misrouted["recommended_channel"].isin(contracted_set)]["total_spend_inr"].sum())
    total = float(df_recs["total_spend_inr"].sum())
    lift_raw = round(migration_spend / total * 100, 1) if total else 0
    lift_capped = min(lift_raw, 25.0)   # transformation ceiling
    return {
        "as_is_contracted_pct": contracted_now,
        "lift_pp_raw": lift_raw,
        "lift_pp": lift_capped,
        "to_be_contracted_pct": round(min(contracted_now + lift_capped, 100), 1),
        "ceiling_applied": lift_raw > 25.0,
    }


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def _score(bc1: dict, bc5: dict, bc8: dict, bc10: dict) -> dict:
    contracted = bc1["contracted_spend_pct"]
    misrouted_pct = bc5.get("misrouted_count", 0) / max(bc5.get("misrouted_count", 0) + bc5.get("already_right_count", 0) + bc5.get("over_engineered_count", 0) + 1, 1) * 100
    sole = bc8["sole_source_count"]
    unclassified = bc10["unclassified_pct"]

    if contracted < 25 or sole > 15:
        return {"score": 1, "label": "Initial", "rationale": "Buying channel discipline absent or vestigial."}
    if contracted < 40 or sole > 10:
        return {"score": 2, "label": "Developing", "rationale": "Contract programme exists but coverage partial."}
    if contracted < 55:
        return {"score": 3, "label": "Defined", "rationale": "Contract programme defined; mid-tier opportunities remain."}
    if contracted < 70:
        return {"score": 4, "label": "Managed", "rationale": "Channel discipline mature; remaining gaps narrow."}
    return {"score": 5, "label": "Optimised", "rationale": "Best-practice channel discipline."}


# --------------------------------------------------------------------------

def _headline(bc1: dict, bc5: dict, bc6: dict, bc8: dict) -> str:
    return (
        f"{bc1['contracted_spend_pct']}% of spend on contracted channels. "
        f"{bc5['misrouted_count']} MGs ({bc5['misrouted_spend_inr_cr']} ₹ Cr) misrouted; "
        f"{bc6.get('catalogue_count',0)} catalogue + {bc6.get('ola_count',0)} OLA migration candidates. "
        f"Sole-source risk: {bc8['sole_source_count']} categories."
    )


def _rca(bc1: dict, bc5: dict, bc8: dict, bc10: dict) -> list[dict]:
    try:
        rules = kb_loader.get_pillar_rca_rules("buying-channel").get("rules", [])
    except Exception:
        rules = []
    rule_idx = {r["id"]: r for r in rules}
    fired = []

    def card(rule_id):
        r = rule_idx.get(rule_id)
        if not r:
            return None
        return {
            "rule_id": rule_id,
            "theme": r.get("theme", "buying-channel-strategy"),
            "root_causes": r.get("root_causes", []),
            "confidence": r.get("confidence"),
            "references": r.get("references", {}),
        }

    if bc1["contracted_spend_pct"] < 25:
        c = card("rca.buying_channel.r01_very_low_contracted_pct"); fired.append(c) if c else None
    if bc5["misrouted_count"] >= 10:
        c = card("rca.buying_channel.r05_catalogue_opportunity_unrealised"); fired.append(c) if c else None
    if bc8["sole_source_count"] >= 5:
        c = card("rca.buying_channel.r09_high_pac_concentration"); fired.append(c) if c else None
    if bc10["unclassified_pct"] > 15:
        c = card("rca.buying_channel.r11_high_unclassified_master_data"); fired.append(c) if c else None
    return [f for f in fired if f]
