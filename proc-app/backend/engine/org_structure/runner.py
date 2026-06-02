"""Org Structure pillar runner — V1 QRE-driven.

4 themes: Organisation Posture · FTE Sizing & Role Composition ·
Spend-FTE Distribution · Hierarchy & Span.

V1 limitation: without Employee Master / Org Structure uploads, quantitative
analyses (Spend per FTE, role composition mix, span of control) are estimated
from QRE responses + engagement metadata (fte_count if provided).
"""
from __future__ import annotations

from typing import Optional

import pandas as pd

from ... import kb_loader
from ..availability import (require_qre, require_engagement, unavailable_theme,
                              unavailable_score, aggregate_pillar_score)


def run_org_structure(df_mg: pd.DataFrame, df_gold: pd.DataFrame,
                       engagement: dict, qre_responses: Optional[dict] = None) -> dict:
    qre = _index_qre(qre_responses)
    benchmarks = _load_benchmarks()

    # Engagement-level inputs
    fte_count = engagement.get("fte_count")
    annual_spend_cr = engagement.get("annual_spend_inr_cr")

    t1 = _theme_organisation_posture(qre)
    t2 = _theme_fte_sizing(qre, fte_count, annual_spend_cr, benchmarks)
    t3 = _theme_distribution(qre, df_gold)
    t4 = _theme_hierarchy_span(qre)

    scores = {
        "organisation-posture": _score_theme(t1, "posture"),
        "fte-sizing-role-composition": _score_fte_sizing(t2),
        "spend-fte-distribution": _score_theme(t3, "distribution"),
        "hierarchy-span": _score_theme(t4, "hierarchy"),
    }
    weights = {"organisation-posture": 0.20, "fte-sizing-role-composition": 0.35,
                "spend-fte-distribution": 0.20, "hierarchy-span": 0.25}
    pillar_score = aggregate_pillar_score(scores, weights)

    return {
        "pillar": "org-structure",
        "themes": {
            "organisation-posture": t1, "fte-sizing-role-composition": t2,
            "spend-fte-distribution": t3, "hierarchy-span": t4,
        },
        "theme_scores": scores,
        "pillar_score": pillar_score,
        "rca_cards": _rca(scores),
    }


def _score_theme(t: dict, theme: str) -> dict:
    """Pure-QRE theme scorer — early returns unavailable when t.available=False."""
    if not t.get("available", True):
        return unavailable_score(t.get("missing_reason", "qre"),
                                  t.get("missing_inputs", []))
    return _score_qre_based(t["metrics"]["avg_qre_score"], theme)


# --------------------------------------------------------------------------

def _theme_organisation_posture(qre: dict) -> dict:
    """Organisation Posture — QRE-driven (D2.1 + D2.4)."""
    vals, missing = require_qre(qre, ["D2.1", "D2.4"])
    if missing:
        return unavailable_theme("Organisation Posture",
                                   required=missing, reason="qre",
                                   theme_id="organisation-posture")
    d21, d24 = vals["D2.1"], vals["D2.4"]
    avg = (d21 + d24) / 2
    posture_inferred = "Centralised" if d21 >= 3 else "Hybrid" if d21 >= 2 else "Federated"
    headline = f"Posture appears '{posture_inferred}' (QRE D2.1={d21}/4 · D2.4={d24}/4)."
    return {
        "theme": "organisation-posture",
        "available": True,
        "headline": headline,
        "metrics": {"avg_qre_score": avg, "posture_inferred": posture_inferred,
                    "qre_d21": d21, "qre_d24": d24},
        "components": {
            "op0_current_state": {"posture": posture_inferred},
            "op1_alignment": "QRE-only for V1",
            "op2_reporting_line_diagnostic": "QRE-only for V1",
        },
    }


def _theme_fte_sizing(qre: dict, fte_count, annual_spend_cr, benchmarks: dict) -> dict:
    """FTE Sizing & Role Composition — needs QRE (D2.2 + D11.1 + D11.4)
    AND engagement fte_count + annual_spend_cr (without those, spend/FTE
    cannot be computed). If only QRE is missing, the theme is unavailable
    regardless of whether spend/FTE could be calculated."""
    vals, missing = require_qre(qre, ["D2.2", "D11.1", "D11.4"])
    if missing:
        return unavailable_theme("FTE Sizing & Role Composition",
                                   required=missing, reason="qre",
                                   theme_id="fte-sizing-role-composition")
    eng_missing = []
    if not fte_count: eng_missing.append("fte_count")
    if not annual_spend_cr: eng_missing.append("annual_spend_inr_cr")
    if eng_missing:
        return unavailable_theme("FTE Sizing & Role Composition",
                                   required=eng_missing, reason="engagement",
                                   theme_id="fte-sizing-role-composition")

    d22, d111, d114 = vals["D2.2"], vals["D11.1"], vals["D11.4"]
    spend_per_fte = round(annual_spend_cr / fte_count, 1)
    b = benchmarks.get("org.fte_productivity.spend_per_fte_inr_cr", {})
    primary = b.get("primary") or {}
    band = primary.get("value_range") or [40, 80]
    in_band = band[0] <= spend_per_fte <= band[1]

    headline = (
        f"Spend per FTE: ₹{spend_per_fte} Cr (band: ₹{band[0]}–{band[1]} Cr/FTE) · "
        f"Specialisation D11.4={d114}/4 · Skills D11.1={d111}/4."
    )
    return {
        "theme": "fte-sizing-role-composition",
        "available": True,
        "headline": headline,
        "metrics": {
            "spend_per_fte_inr_cr": spend_per_fte,
            "benchmark_band_inr_cr": band,
            "in_band": in_band,
            "qre_d22": d22, "qre_d111": d111, "qre_d114": d114,
            "avg_qre_score": (d22 + d111 + d114) / 3,
        },
        "components": {
            "ft1_spend_per_fte": {"value": spend_per_fte, "band": band, "in_band": in_band},
            "ft3_role_composition_mix": "QRE-only for V1",
            "ft4_specialist_roles_audit": f"Specialisation maturity ~{d114}/4",
        },
    }


def _theme_distribution(qre: dict, df_gold: pd.DataFrame) -> dict:
    """Spend-FTE Distribution — needs QRE (D2.3 + D2.5). Plant-level
    breakdown from PO data is included as auxiliary info but doesn't
    rescue the theme score."""
    vals, missing = require_qre(qre, ["D2.3", "D2.5"])
    if missing:
        return unavailable_theme("Spend-FTE Distribution",
                                   required=missing, reason="qre",
                                   theme_id="spend-fte-distribution")
    d23, d25 = vals["D2.3"], vals["D2.5"]
    plant_count = int(df_gold["plant"].nunique()) if "plant" in df_gold.columns else 0
    if "plant" in df_gold.columns and len(df_gold) > 0:
        plant_spend = df_gold.groupby("plant")["net_value_inr"].sum().sort_values(ascending=False)
        total = float(plant_spend.sum())
        top_plant_share = round(float(plant_spend.iloc[0]) / total * 100, 1) if total else 0
        per_plant_shares = {p: round(float(v) / total * 100, 1) for p, v in plant_spend.items() if total}
    else:
        top_plant_share = 0; per_plant_shares = {}
    avg = (d23 + d25) / 2
    return {
        "theme": "spend-fte-distribution",
        "available": True,
        "headline": (f"{plant_count} plants in PO data · top plant {top_plant_share}% of spend · "
                       f"governance D2.3={d23}/4."),
        "metrics": {
            "plant_count": plant_count, "top_plant_share_pct": top_plant_share,
            "per_plant_spend_share_pct": per_plant_shares,
            "qre_d23": d23, "qre_d25": d25, "avg_qre_score": avg,
        },
        "components": {
            "ds0_current_state": {"plant_count": plant_count, "top_plant_share_pct": top_plant_share},
            "ds1_bw_mapping": "Plant-level mapping computable; Central-vs-Plant split needs Org Master (V2)",
            "ds2_per_entity_productivity": "Requires Employee Master (V2)",
        },
    }


def _theme_hierarchy_span(qre: dict) -> dict:
    """Hierarchy & Span — QRE-driven (D10.1 + D10.2). Note that V2 will
    replace this with employee-master joins; for V1 it's QRE-only."""
    vals, missing = require_qre(qre, ["D10.1", "D10.2"])
    if missing:
        return unavailable_theme("Hierarchy & Span of Control",
                                   required=missing, reason="qre",
                                   theme_id="hierarchy-span")
    d101, d102 = vals["D10.1"], vals["D10.2"]
    avg = (d101 + d102) / 2
    return {
        "theme": "hierarchy-span",
        "available": True,
        "headline": f"Governance D10.1={d101}/4 · Policy D10.2={d102}/4. Span/hierarchy needs Org Chart (V2).",
        "metrics": {"qre_d101": d101, "qre_d102": d102, "avg_qre_score": avg},
        "components": {
            "hs0_current_state": "Requires Employee Master + reports_to",
            "hs1_span_of_control": "V2",
            "hs2_hierarchy_depth": "V2",
        },
    }


# --------------------------------------------------------------------------

def _score_qre_based(avg: float, theme: str) -> dict:
    if avg < 1.5: return {"score": 1, "label": "Initial", "rationale": f"{theme}: low maturity per QRE."}
    if avg < 2.5: return {"score": 2, "label": "Developing", "rationale": f"{theme}: emerging maturity."}
    if avg < 3.0: return {"score": 3, "label": "Defined", "rationale": f"{theme}: defined practices."}
    if avg < 3.5: return {"score": 4, "label": "Managed", "rationale": f"{theme}: managed + measured."}
    return {"score": 5, "label": "Optimised", "rationale": f"{theme}: best-practice."}


def _score_fte_sizing(t2: dict) -> dict:
    if not t2.get("available", True):
        return unavailable_score(t2.get("missing_reason", "qre"),
                                  t2.get("missing_inputs", []))
    m = t2["metrics"]
    in_band = m.get("in_band")
    if in_band is None:
        return _score_qre_based(m["avg_qre_score"], "fte-sizing")
    if in_band:
        if m["avg_qre_score"] >= 3: return {"score": 4, "label": "Managed", "rationale": "Spend/FTE in band + role composition mature."}
        return {"score": 3, "label": "Defined", "rationale": "Spend/FTE in band; composition partial."}
    return {"score": 2, "label": "Developing", "rationale": "Spend/FTE outside benchmark band."}


def _label(score: float) -> str:
    if score < 1.5: return "Initial"
    if score < 2.5: return "Developing"
    if score < 3.5: return "Defined"
    if score < 4.5: return "Managed"
    return "Optimised"


def _load_benchmarks() -> dict:
    try:
        return kb_loader.resolve_pillar_benchmarks("org-structure", industry="steel")["benchmarks"]
    except Exception:
        return {}


def _index_qre(qre: Optional[dict]) -> dict:
    if not qre: return {}
    return {r["id"]: r for r in qre.get("responses", [])}


def _rca(scores: dict) -> list[dict]:
    """Fire RCA only for themes that produced a real score. Unavailable
    themes have score=None and must NOT generate a finding."""
    fired = []
    for tname, s in scores.items():
        score = s.get("score")
        if score is None:
            continue
        if score <= 2:
            fired.append({
                "rule_id": f"rca.org_structure.{tname.replace('-', '_')}_initial",
                "theme": tname,
                "root_causes": [s["rationale"]],
                "confidence": "medium",
                "references": {},
            })
    return fired
