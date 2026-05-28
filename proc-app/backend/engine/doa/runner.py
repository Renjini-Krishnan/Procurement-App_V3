"""DoA pillar runner — 5 themes scored against QRE + PO + PR data.

For V1:
  - Theme 1 (Document Audit + Coverage): driven by QRE D2.4 + PO coverage of categories with PAC/MSME signals
  - Theme 2 (Robustness vs Reference): compares declared DoA scope vs reference-doa-template.yml mandatory cases
  - Theme 3 (PO Compliance): PR_Approver distribution per value band vs reference tier structure
  - Theme 4 (System Enforcement): QRE D5.2 (system compliance) + D12.1 (app landscape)
  - Theme 5 (Bucket Optimisation): PO spend distribution → recommended bucket thresholds
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Optional

import pandas as pd

from ... import kb_loader


# --------------------------------------------------------------------------

def run_doa(df_gold: pd.DataFrame, df_mg: pd.DataFrame, qre_responses: Optional[dict] = None) -> dict:
    """Run all 5 DoA themes. Returns full pillar output.

    df_gold: classified Stage 9 PO data
    df_mg:    per-MG aggregations from Stage 10
    qre_responses: {responses: [{id, score, ...}]} from synthetic_data.generate_qre_responses
    """
    qre = _index_qre(qre_responses)
    reference = _load_reference_template()
    benchmarks = _load_benchmarks()

    t1 = _theme1_document_audit(qre, df_mg, reference)
    t2 = _theme2_robustness(qre, reference)
    t3 = _theme3_po_compliance(df_gold)
    t4 = _theme4_system_enforcement(qre)
    t5 = _theme5_bucket_optimisation(df_gold)

    theme_scores = {
        "document-audit": _score_document_audit(t1, benchmarks),
        "robustness": _score_robustness(t2, benchmarks),
        "po-compliance": _score_po_compliance(t3, benchmarks),
        "system-enforcement": _score_system_enforcement(t4, benchmarks),
        "bucket-optimisation": _score_bucket_optimisation(t5),
    }

    weights = {"document-audit": 0.20, "robustness": 0.25, "po-compliance": 0.25,
                "system-enforcement": 0.15, "bucket-optimisation": 0.15}
    pillar_score = sum(theme_scores[k]["score"] * w for k, w in weights.items())
    pillar_label = _pillar_label(pillar_score)

    return {
        "pillar": "doa",
        "themes": {
            "document-audit": t1,
            "robustness": t2,
            "po-compliance": t3,
            "system-enforcement": t4,
            "bucket-optimisation": t5,
        },
        "theme_scores": theme_scores,
        "pillar_score": {"score": round(pillar_score, 1), "label": pillar_label},
        "rca_cards": _evaluate_rca(theme_scores, t1, t3, t4, t5),
    }


# --------------------------------------------------------------------------
# Theme 1 — Document Audit + Coverage
# --------------------------------------------------------------------------

def _theme1_document_audit(qre: dict, df_mg: pd.DataFrame, reference: dict) -> dict:
    # D2.4 → DoA framework type. Score 1-4
    doa_score = qre.get("D2.4", {}).get("score", 0)
    doa_present = doa_score >= 2

    # Coverage estimate: assume coverage = QRE score / 4 × 100 (rough heuristic for V1)
    coverage_pct = round(doa_score / 4 * 100, 1) if doa_score else 0

    # Indian special cases — check D9.2 (audit findings) + D10.2 (policy framework)
    indian_cases_score = (qre.get("D9.2", {}).get("score", 1) + qre.get("D10.2", {}).get("score", 1)) / 2
    indian_cases_covered_pct = round(indian_cases_score / 4 * 100, 1)

    # Categories present in PO data
    archetypes = (df_mg["archetype"].value_counts().to_dict()) if "archetype" in df_mg.columns else {}

    headline = (
        f"DoA {'present' if doa_present else 'absent'} (QRE D2.4 = {doa_score}/4). "
        f"Estimated coverage: {coverage_pct}%. "
        f"Indian regulatory cases covered ~{indian_cases_covered_pct}%."
    )

    return {
        "theme": "document-audit",
        "headline": headline,
        "metrics": {
            "doa_document_present": doa_present,
            "doa_qre_score": doa_score,
            "coverage_pct": coverage_pct,
            "indian_cases_covered_pct": indian_cases_covered_pct,
            "po_archetypes": archetypes,
        },
        "components": {
            "da1_doa_document_present": doa_present,
            "da2_coverage_check": {"coverage_pct": coverage_pct},
            "da3_tier_structure": {"qre_source": "D2.4"},
            "da4_indian_special_cases": {"covered_pct": indian_cases_covered_pct},
        },
    }


# --------------------------------------------------------------------------
# Theme 2 — Robustness vs Reference
# --------------------------------------------------------------------------

def _theme2_robustness(qre: dict, reference: dict) -> dict:
    # Reference template has standard_tier_structure, mandatory_cases, regulatory_anchors
    mandatory_cases = reference.get("mandatory_cases") or []
    if isinstance(mandatory_cases, dict):
        n_mandatory_cases = sum(len(v) if isinstance(v, list) else 1 for v in mandatory_cases.values())
    else:
        n_mandatory_cases = len(mandatory_cases)

    # QRE D9.2 (audit findings — proxy for ambiguity / robustness)
    audit_score = qre.get("D9.2", {}).get("score", 1)
    policy_score = qre.get("D10.2", {}).get("score", 1)
    doa_score = qre.get("D2.4", {}).get("score", 1)

    # Approximate mandatory cases covered = avg of audit + policy + doa score / 4 × 100
    mandatory_covered_pct = round((audit_score + policy_score + doa_score) / 12 * 100, 1)
    ambiguity_rate = round(100 - mandatory_covered_pct, 1)

    headline = (
        f"{mandatory_covered_pct}% of {n_mandatory_cases} reference-mandatory cases estimated covered. "
        f"Ambiguity rate: {ambiguity_rate}%."
    )

    return {
        "theme": "robustness",
        "headline": headline,
        "metrics": {
            "reference_mandatory_cases_count": n_mandatory_cases,
            "mandatory_cases_covered_pct": mandatory_covered_pct,
            "ambiguity_rate_pct": ambiguity_rate,
            "qre_audit_score": audit_score,
            "qre_policy_score": policy_score,
        },
        "components": {
            "rb1_tier_coverage_vs_reference": {"covered_pct": mandatory_covered_pct},
            "rb2_mandatory_cases_check": {"reference_count": n_mandatory_cases},
            "rb3_ambiguity_audit": {"ambiguity_pct": ambiguity_rate},
            "rb4_quality_indicators": _qi_list(reference.get("quality_indicators"))[:5],
        },
    }


# --------------------------------------------------------------------------
# Theme 3 — PO Compliance & Distribution
# --------------------------------------------------------------------------

def _theme3_po_compliance(df_gold: pd.DataFrame) -> dict:
    if "net_value_inr" not in df_gold.columns or len(df_gold) == 0:
        return {"theme": "po-compliance", "headline": "PO data missing", "metrics": {}, "components": {}}

    # Reference tier structure (illustrative; in production sourced from
    # client's DoA matrix):
    tiers = [
        {"label": "Tier 1 — Manager",  "min": 0,         "max": 500_000},      # ₹5 L
        {"label": "Tier 2 — Sr Mgr",   "min": 500_000,   "max": 5_000_000},    # ₹50 L
        {"label": "Tier 3 — Director", "min": 5_000_000, "max": 25_000_000},   # ₹2.5 Cr
        {"label": "Tier 4 — CXO",      "min": 25_000_000, "max": 100_000_000}, # ₹10 Cr
        {"label": "Tier 5 — Board",    "min": 100_000_000, "max": float("inf")},
    ]

    # Spend distribution by tier
    distribution = []
    for t in tiers:
        mask = (df_gold["net_value_inr"] >= t["min"]) & (df_gold["net_value_inr"] < t["max"])
        spend = float(df_gold.loc[mask, "net_value_inr"].sum())
        count = int(mask.sum())
        distribution.append({
            "tier": t["label"],
            "spend_inr_cr": round(spend / 1e7, 2),
            "po_count": count,
        })

    total_spend = sum(d["spend_inr_cr"] for d in distribution)
    total_count = sum(d["po_count"] for d in distribution)

    # 70% rule: % of spend in tiers 1-3 (operational) is healthy. Cap breach: spend in tier 5 (CXO/Board level)
    if total_spend > 0:
        operational_pct = round(sum(d["spend_inr_cr"] for d in distribution[:3]) / total_spend * 100, 1)
        cap_breach_pct = round(distribution[-1]["spend_inr_cr"] / total_spend * 100, 1)
    else:
        operational_pct = 0
        cap_breach_pct = 0

    # Approver spread (if PR_Approver was joined; not in V1 — leave placeholder)
    approver_spread = "PR_Approver join required for full analysis"

    headline = (
        f"Spend distribution: {operational_pct}% within operational tiers (1-3). "
        f"Cap-breach (>₹10 Cr): {cap_breach_pct}%."
    )

    return {
        "theme": "po-compliance",
        "headline": headline,
        "metrics": {
            "seventy_rule_pct": operational_pct,
            "cap_breach_pct": cap_breach_pct,
            "total_spend_inr_cr": round(total_spend, 1),
            "total_po_count": total_count,
        },
        "components": {
            "pc1_seventy_rule": {"value": operational_pct},
            "pc2_cap_breaches": {"value": cap_breach_pct},
            "pc3_distribution_by_value_band": distribution,
            "pc4_approver_spread": approver_spread,
        },
    }


# --------------------------------------------------------------------------
# Theme 4 — System Enforcement (QRE-only)
# --------------------------------------------------------------------------

def _theme4_system_enforcement(qre: dict) -> dict:
    d52 = qre.get("D5.2", {}).get("score", 1)   # System compliance
    d121 = qre.get("D12.1", {}).get("score", 1)  # Application landscape
    erp_workflow_present = d52 >= 2 or d121 >= 2
    # Automation % = roughly D5.2 score / 4 × 100
    automation_pct = round(d52 / 4 * 100, 1)
    paper_pct = round(100 - automation_pct, 1)

    headline = (
        f"ERP workflow {'present' if erp_workflow_present else 'absent'}. "
        f"Automation: {automation_pct}% · Paper/manual: {paper_pct}%."
    )

    return {
        "theme": "system-enforcement",
        "headline": headline,
        "metrics": {
            "erp_workflow_present": erp_workflow_present,
            "automation_pct": automation_pct,
            "paper_pct": paper_pct,
            "qre_d52_score": d52,
            "qre_d121_score": d121,
        },
        "components": {
            "se1_erp_workflow_present": erp_workflow_present,
            "se2_automation_pct": automation_pct,
            "se3_paper_workflow_pct": paper_pct,
        },
    }


# --------------------------------------------------------------------------
# Theme 5 — Bucket Optimisation
# --------------------------------------------------------------------------

def _theme5_bucket_optimisation(df_gold: pd.DataFrame) -> dict:
    if "net_value_inr" not in df_gold.columns or len(df_gold) == 0:
        return {"theme": "bucket-optimisation", "headline": "PO data missing", "metrics": {}, "components": {}}

    # Compute spend distribution percentiles → recommend buckets at 50/75/90/95/99
    values = df_gold["net_value_inr"].dropna().sort_values()
    if len(values) == 0:
        return {"theme": "bucket-optimisation", "headline": "No PO values", "metrics": {}, "components": {}}

    pcts = [50, 75, 90, 95, 99]
    recommended = [{"percentile": p, "value_inr": round(float(values.quantile(p / 100)), 0)} for p in pcts]

    # Compare current (illustrative) tier thresholds to recommended
    current = [500_000, 5_000_000, 25_000_000, 100_000_000]
    bucket_fit = _bucket_fit_score(current, [r["value_inr"] for r in recommended])

    headline = f"Recommended bucket thresholds (p50/p75/p90/p95/p99): {[r['value_inr'] for r in recommended]}. Bucket fit score: {bucket_fit}/5."

    return {
        "theme": "bucket-optimisation",
        "headline": headline,
        "metrics": {
            "bucket_fit_score": bucket_fit,
            "recommended_thresholds_inr": [r["value_inr"] for r in recommended],
            "current_thresholds_inr": current,
        },
        "components": {
            "bo1_current_bucket_fit": {"score": bucket_fit},
            "bo2_recommended_thresholds": recommended,
            "bo3_consolidation_opportunity": "Review tier boundaries vs recommended percentile thresholds",
        },
    }


def _bucket_fit_score(current: list[float], recommended: list[float]) -> int:
    """Fit score 1-5 — how close are current tier thresholds to spend-distribution percentiles."""
    if not current or not recommended:
        return 3
    # Compare current[i] to recommended[i] (p75, p90, p95, p99)
    rel_errors = []
    for i, cur in enumerate(current):
        rec = recommended[i + 1] if i + 1 < len(recommended) else recommended[-1]   # skip p50, start at p75
        if rec > 0:
            rel_errors.append(abs(cur - rec) / rec)
    if not rel_errors:
        return 3
    avg_err = sum(rel_errors) / len(rel_errors)
    if avg_err < 0.2: return 5
    if avg_err < 0.5: return 4
    if avg_err < 1.0: return 3
    if avg_err < 2.0: return 2
    return 1


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def _score_document_audit(t: dict, benchmarks: dict) -> dict:
    m = t["metrics"]
    if not m.get("doa_document_present"):
        return {"score": 1, "label": "Initial", "rationale": "No formal DoA in place."}
    cov = m.get("coverage_pct", 0)
    if cov < 30: return {"score": 1, "label": "Initial", "rationale": "DoA covers <30% of spend."}
    if cov < 60: return {"score": 2, "label": "Developing", "rationale": "DoA covers 30-60%; gaps in major categories."}
    if cov < 80: return {"score": 3, "label": "Defined", "rationale": "Majority spend covered."}
    if cov < 95: return {"score": 4, "label": "Managed", "rationale": "Comprehensive coverage."}
    return {"score": 5, "label": "Optimised", "rationale": "Best-practice coverage."}


def _score_robustness(t: dict, benchmarks: dict) -> dict:
    m = t["metrics"]
    cov = m.get("mandatory_cases_covered_pct", 0)
    if cov < 30: return {"score": 1, "label": "Initial", "rationale": "Structural weakness in DoA design."}
    if cov < 60: return {"score": 2, "label": "Developing", "rationale": "Gaps in PAC / MSME / CAPEX tier coverage."}
    if cov < 80: return {"score": 3, "label": "Defined", "rationale": "Most mandatory cases covered; some ambiguity."}
    if cov < 95: return {"score": 4, "label": "Managed", "rationale": "Comprehensive structure."}
    return {"score": 5, "label": "Optimised", "rationale": "Best-practice robustness."}


def _score_po_compliance(t: dict, benchmarks: dict) -> dict:
    m = t["metrics"]
    op_pct = m.get("seventy_rule_pct", 0)
    breach = m.get("cap_breach_pct", 0)
    if op_pct < 40 or breach > 20:
        return {"score": 1, "label": "Initial", "rationale": "Severe non-compliance with DoA tier structure."}
    if op_pct < 60 or breach > 10:
        return {"score": 2, "label": "Developing", "rationale": "Material non-compliance."}
    if op_pct < 75 or breach > 5:
        return {"score": 3, "label": "Defined", "rationale": "Most spend compliant; outliers manageable."}
    if op_pct < 90 or breach > 2:
        return {"score": 4, "label": "Managed", "rationale": "Strong compliance."}
    return {"score": 5, "label": "Optimised", "rationale": "Best-in-class compliance."}


def _score_system_enforcement(t: dict, benchmarks: dict) -> dict:
    m = t["metrics"]
    if not m.get("erp_workflow_present"):
        return {"score": 1, "label": "Initial", "rationale": "DoA is paper-only."}
    autom = m.get("automation_pct", 0)
    if autom < 50: return {"score": 2, "label": "Developing", "rationale": "Partial ERP workflow."}
    if autom < 75: return {"score": 3, "label": "Defined", "rationale": "Majority of approvals via ERP."}
    if autom < 95: return {"score": 4, "label": "Managed", "rationale": "Near-complete system enforcement."}
    return {"score": 5, "label": "Optimised", "rationale": "Fully digitised + audit-trail complete."}


def _score_bucket_optimisation(t: dict) -> dict:
    fit = t["metrics"].get("bucket_fit_score", 3)
    labels = {1: "Initial", 2: "Developing", 3: "Defined", 4: "Managed", 5: "Optimised"}
    return {
        "score": fit,
        "label": labels.get(fit, "Defined"),
        "rationale": f"Bucket fit {fit}/5 vs spend-distribution percentiles.",
    }


def _pillar_label(score: float) -> str:
    if score < 1.5: return "Initial"
    if score < 2.5: return "Developing"
    if score < 3.5: return "Defined"
    if score < 4.5: return "Managed"
    return "Optimised"


# --------------------------------------------------------------------------
# RCA
# --------------------------------------------------------------------------

def _evaluate_rca(theme_scores: dict, t1: dict, t3: dict, t4: dict, t5: dict) -> list[dict]:
    rules = kb_loader.get_pillar_rca_rules("doa").get("rules", [])
    rule_index = {r["id"]: r for r in rules}
    fired = []

    if not t1["metrics"]["doa_document_present"]:
        fired.append(_card(rule_index.get("rca.doa.r01_no_formal_doa")))
    if t1["metrics"]["coverage_pct"] < 60:
        fired.append(_card(rule_index.get("rca.doa.r02_partial_coverage")))
    if t1["metrics"]["indian_cases_covered_pct"] < 70:
        fired.append(_card(rule_index.get("rca.doa.r03_indian_cases_missing")))
    if t3["metrics"].get("cap_breach_pct", 0) > 10:
        fired.append(_card(rule_index.get("rca.doa.r04_high_breach_rate")))
    if not t4["metrics"]["erp_workflow_present"]:
        fired.append(_card(rule_index.get("rca.doa.r05_paper_only")))
    if t3["metrics"].get("seventy_rule_pct", 0) < 60:
        fired.append(_card(rule_index.get("rca.doa.r06_low_seventy_rule")))
    if t5["metrics"].get("bucket_fit_score", 5) < 2:
        fired.append(_card(rule_index.get("rca.doa.r07_bucket_misfit")))

    # Filter out None entries (rule not found)
    return [c for c in fired if c is not None]


def _card(rule: Optional[dict]) -> Optional[dict]:
    if not rule:
        return None
    return {
        "rule_id": rule.get("id"),
        "theme": rule.get("theme"),
        "root_causes": rule.get("root_causes", []),
        "confidence": rule.get("confidence"),
        "references": rule.get("references", {}),
    }


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _index_qre(qre_responses: Optional[dict]) -> dict[str, dict]:
    if not qre_responses:
        return {}
    return {r["id"]: r for r in qre_responses.get("responses", [])}


def _qi_list(qi) -> list[str]:
    """quality_indicators may be a list or a dict in the YAML."""
    if not qi: return []
    if isinstance(qi, list):
        return [str(item.get("id", item)) if isinstance(item, dict) else str(item) for item in qi]
    if isinstance(qi, dict):
        return list(qi.keys())
    return []


def _load_reference_template() -> dict:
    from ... import config
    import yaml
    path = config.PROC_KB_ROOT / "doa" / "reference-doa-template.yml"
    if path.exists():
        return yaml.safe_load(path.read_text()) or {}
    return {}


def _load_benchmarks() -> dict:
    try:
        return kb_loader.get_pillar_benchmarks("doa")
    except Exception:
        return {}
