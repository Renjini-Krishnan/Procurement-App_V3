"""Explainability assembler — turns the provenance fields engines already
emit (thresholds, benchmark_source, computed_via flags, component metrics)
into a structured `explainability` payload that travels alongside every
theme / RCA card / KPI so the UI can render an audit trail.

A consultant reading any score should be able to ask, in plain language:
  - What data did this use?
  - What method was applied?
  - What thresholds + benchmarks did it cite?
  - How did inputs → score get derived?
  - What's missing that would refine the answer?

The engine already captures most of this in component dicts (e.g.
threshold_min_plants, benchmark_source, computed_via=stage9_data_only_no_qre).
This module surfaces it as a uniform payload.
"""
from __future__ import annotations

from typing import Optional


# ---------------------------------------------------------------------------
# Per-theme explainability for Op Model
# ---------------------------------------------------------------------------

THEME_METHOD = {
    "centralisation": {
        "method": ("Identify material groups bought across multiple plants by the same "
                    "buying unit, filter by industry-specific category patterns "
                    "(KB: archetype-overrides.yml), then quantify savings using the "
                    "function-default + industry-overlay savings-rate benchmark cascade."),
        "decision_components": ["c1_multi_plant_detection", "c2_vendor_pattern_insight",
                                 "c3_industry_knowledge_filter", "c4_savings_quantification"],
        "qre_baseline": ["c0_baseline", "c5_reconciliation"],
        "kb_files": ["op-model/benchmarks.yml",
                     "industries/<industry>/by-function/procurement/op-model/archetype-overrides.yml",
                     "industries/<industry>/by-function/procurement/op-model/centralisation-filters.yml"],
        "data_columns": ["Plant", "Material_Group", "Material_Group_Desc",
                          "Net_Value", "Vendor_Number", "Vendor_Name"],
    },
    "shared-services": {
        "method": ("Volume-value quadrant on PO_count × Net_Value to identify Q1 "
                    "(transactional, high-volume) categories, then apply industry filter "
                    "and quantify SSC operational savings using current-cost-per-PO vs "
                    "SSC-target-cost-per-PO benchmark."),
        "decision_components": ["ss1_volume_value_quadrant", "ss2_industry_filter",
                                 "ss3_coverage_gap", "ss4_fte_productivity"],
        "qre_baseline": ["ss0_current_coverage", "ss5_reconciliation"],
        "kb_files": ["op-model/benchmarks.yml",
                     "industries/<industry>/by-function/procurement/op-model/centralisation-filters.yml"],
        "data_columns": ["Material_Group", "Net_Value", "PO_Number"],
    },
    "coe": {
        "method": ("Identify strategic categories (high spend × high vendor concentration), "
                    "filter by industry CoE-suitability rules, quantify incremental savings "
                    "(over baseline centralisation) using CoE savings-rate benchmark."),
        "decision_components": ["ce1_strategic_identification", "ce2_industry_filter",
                                 "ce3_coverage_gap", "ce4_value_quantification"],
        "qre_baseline": ["ce0_current_state", "ce5_reconciliation"],
        "kb_files": ["op-model/benchmarks.yml",
                     "industries/<industry>/by-function/procurement/op-model/centralisation-filters.yml"],
        "data_columns": ["Material_Group", "Net_Value", "Vendor_Number"],
    },
    "tail-spend": {
        "method": ("Two-method tail detection: (A) POs below ₹1 lakh, (B) Q3 spend MGs from "
                    "spend distribution. Long-tail vendor analysis via Pareto check (top 20% "
                    "vendors should hold 80% spend). Aggregator-addressable spend quantified "
                    "using industry-specific tail patterns."),
        "decision_components": ["ts1_quantification", "ts2_vendor_footprint",
                                 "ts3_industry_filter", "ts4_outsourcing_savings"],
        "qre_baseline": ["ts0_current_tail_management", "ts5_reconciliation"],
        "kb_files": ["op-model/benchmarks.yml",
                     "industries/<industry>/by-function/procurement/op-model/centralisation-filters.yml"],
        "data_columns": ["Net_Value", "Vendor_Number", "Material_Group"],
    },
    "buying-channel-strategy": {
        "method": ("Per-MG channel match analysis. Classify each PO by channel "
                    "(RC-Long-term, OLA, RC-ROP, ASL, RFQ, Single-Tender PAC, Spot) from "
                    "PO_Type + Contract_Number + Outline_Agreement. Compare to recommended "
                    "channel per MG using KB rules; surface misrouted MGs + migration "
                    "opportunities + sole-source risks."),
        "decision_components": ["bc1_portfolio_channel_mix", "bc4_recommended_channel_per_mg",
                                 "bc5_match_status", "bc6_migration_opportunities",
                                 "bc8_sole_source_risk", "bc13_contract_coverage_lift"],
        "qre_baseline": [],
        "kb_files": ["buying-channel/rca-rules.yml",
                     "buying-channel/benchmarks.yml"],
        "data_columns": ["PO_Type", "Contract_Number", "Outline_Agreement",
                          "Vendor_Name", "Material_Group", "Net_Value", "Plant"],
    },
    # Org-Structure themes
    "organisation-posture": {
        "method": ("Map QRE D2.1 (Structure) + D2.4 (DoA framework) to a maturity score. "
                    "Posture inferred: Centralised if D2.1≥3, Hybrid if ≥2, else Federated."),
        "decision_components": ["op0_current_state"],
        "qre_baseline": [],
        "kb_files": ["org-structure/scoring-descriptors.yml",
                     "org-structure/rca-rules.yml"],
        "data_columns": [],
        "qre_required": ["D2.1", "D2.4"],
    },
    "fte-sizing-role-composition": {
        "method": ("Compute Spend per FTE = annual_spend / fte_count and compare to "
                    "industry benchmark band. Combine with QRE D2.2 (roles & bandwidth) "
                    "+ D11.1 (skills) + D11.4 (specialisation) maturity scores."),
        "decision_components": ["ft1_spend_per_fte", "ft3_role_composition_mix",
                                 "ft4_specialist_roles_audit"],
        "qre_baseline": [],
        "kb_files": ["org-structure/benchmarks.yml",
                     "org-structure/scoring-descriptors.yml"],
        "data_columns": [],
        "qre_required": ["D2.2", "D11.1", "D11.4"],
        "engagement_required": ["fte_count", "annual_spend_inr_cr"],
    },
    "spend-fte-distribution": {
        "method": ("Plant-level spend share concentration (top-plant share + Gini-ish "
                    "proxy) from PO data, combined with QRE D2.3 (governance) + D2.5 "
                    "(shared services) maturity."),
        "decision_components": ["ds0_current_state", "ds1_bw_mapping"],
        "qre_baseline": [],
        "kb_files": ["org-structure/benchmarks.yml"],
        "data_columns": ["Plant", "Net_Value"],
        "qre_required": ["D2.3", "D2.5"],
    },
    "hierarchy-span": {
        "method": ("QRE D10.1 (governance forums) + D10.2 (policy framework). Span of "
                    "control + hierarchy depth require Employee Master upload (V2 feature)."),
        "decision_components": [],
        "qre_baseline": [],
        "kb_files": ["org-structure/benchmarks.yml"],
        "data_columns": [],
        "qre_required": ["D10.1", "D10.2"],
    },
    # DoA themes
    "document-audit": {
        "method": ("Coverage % = D2.4 / 4 × 100. Indian-cases-covered % = (D9.2 + D10.2) / "
                    "2 / 4 × 100. doa_document_present = D2.4 ≥ 2."),
        "decision_components": ["da1_doa_document_present", "da2_coverage_check",
                                 "da3_tier_structure", "da4_indian_special_cases"],
        "qre_baseline": [],
        "kb_files": ["doa/benchmarks.yml", "doa/scoring-descriptors.yml"],
        "data_columns": [],
        "qre_required": ["D2.4", "D9.2", "D10.2"],
    },
    "robustness": {
        "method": ("Mandatory cases covered % = (D9.2 + D10.2 + D2.4) / 12 × 100. "
                    "Ambiguity rate = 100 − mandatory_cases_covered_pct."),
        "decision_components": ["rb1_tier_coverage_vs_reference", "rb2_mandatory_cases_check",
                                 "rb3_ambiguity_audit"],
        "qre_baseline": [],
        "kb_files": ["doa/benchmarks.yml", "_meta/standard-doa-reference.yml"],
        "data_columns": [],
        "qre_required": ["D2.4", "D9.2", "D10.2"],
    },
    "po-compliance": {
        "method": ("70/30 rule: % spend in tiers 1-3 (operational) vs tiers 4-5 (CXO/Board). "
                    "Cap-breach: % spend in tier 5 (>₹10 Cr). Both computed from PO data only."),
        "decision_components": ["pc1_seventy_rule", "pc2_cap_breaches",
                                 "pc3_distribution_by_value_band"],
        "qre_baseline": [],
        "kb_files": ["doa/benchmarks.yml"],
        "data_columns": ["Net_Value"],
    },
    "system-enforcement": {
        "method": ("Automation % = D5.2 / 4 × 100. ERP workflow present if D5.2 ≥ 2 or "
                    "D12.1 ≥ 2."),
        "decision_components": ["se1_erp_workflow_present", "se2_automation_pct",
                                 "se3_paper_workflow_pct"],
        "qre_baseline": [],
        "kb_files": ["doa/benchmarks.yml"],
        "data_columns": [],
        "qre_required": ["D5.2", "D12.1"],
    },
    "bucket-optimisation": {
        "method": ("Compare current DoA tier thresholds against spend-distribution "
                    "percentiles (p50, p75, p90, p95, p99). Bucket-fit score = 5 if avg "
                    "relative error <20%, down to 1 if >200%."),
        "decision_components": ["bo1_current_bucket_fit", "bo2_recommended_thresholds"],
        "qre_baseline": [],
        "kb_files": ["doa/benchmarks.yml"],
        "data_columns": ["Net_Value"],
    },
    # V2 themes
    "mm1_coverage": {
        "method": "% of PO rows with material_number populated.",
        "data_columns": ["material_number"],
        "kb_files": ["data-templates/po.yml"],
    },
    "mm2_master_quality": {
        "method": "Duplicate descriptions + active-flag % in Material Master file.",
        "data_columns": ["material_description", "active_flag"],
        "kb_files": ["data-templates/material_master.yml"],
        "file_required": ["material_master.csv"],
    },
    "mm3_classification": {
        "method": "% of PO rows mapped to a canonical category via Stage 9 6-tier classifier.",
        "data_columns": ["Material_Group_Desc", "Short_Text", "Vendor_Name"],
        "kb_files": ["industries/<industry>/categories-master.yml"],
    },
    "pr1_conversion": {
        "method": "% of PRs linked to at least one PO via pr_reference.",
        "data_columns": ["pr_number (PR)", "pr_reference (PO)"],
        "file_required": ["pr.csv"],
    },
    "pr2_tat": {
        "method": "Mean (po_creation_date − pr_creation_date) days across linked PR-PO pairs.",
        "data_columns": ["pr_creation_date (PR)", "po_creation_date (PO)"],
        "file_required": ["pr.csv"],
    },
    "pr3_value_consistency": {
        "method": "% of PR-PO pairs where |pr_total - po_total| / po_total > 20%.",
        "data_columns": ["pr_total_value (PR)", "net_value (PO)"],
        "file_required": ["pr.csv"],
    },
    "pp1_grn_coverage": {
        "method": "% of POs with at least one GRN record (by po_number join).",
        "data_columns": ["po_number (GRN)"],
        "file_required": ["grn.csv"],
    },
    "pp2_three_way_match": {
        "method": "% of POs that have BOTH a GRN record and an Invoice record.",
        "data_columns": ["po_number (GRN)", "po_number (Invoice)"],
        "file_required": ["grn.csv", "invoice.csv"],
    },
    "pp3_otd": {
        "method": "% of GRN dates ≤ delivery_date (promised). On-Time-Delivery rate.",
        "data_columns": ["delivery_date", "gr_date"],
    },
    "sup1_concentration": {
        "method": ("Top vendor spend share + HHI concentration index "
                    "(Σ(share²) × 10000). Score: 4.5 - 1.5 if top1>30% - 1.0 if HHI>2500."),
        "data_columns": ["vendor_id", "net_value"],
    },
    "sup2_master_utilization": {
        "method": "Active vendors (in PO) / total vendors (in Vendor Master). Healthy: 30-70%.",
        "data_columns": ["vendor_id (PO)", "vendor_id (Vendor Master)"],
        "file_required": ["vendor_master.csv"],
    },
    "sup3_msme": {
        "method": "% of spend with vendors flagged MSME in Vendor Master.",
        "data_columns": ["msme_flag (Vendor Master)", "net_value (PO)"],
        "file_required": ["vendor_master.csv with msme_flag column"],
    },
}


def explain_theme(theme_id: str, theme: dict, score: dict,
                    benchmark_map: Optional[dict] = None,
                    industry: str = "steel",
                    qre_status: Optional[dict] = None,
                    engagement: Optional[dict] = None) -> dict:
    """Build the structured explainability payload for a theme.

    Pulls together: data columns used, method, thresholds applied,
    benchmark cited (with full citation + layer), derivation steps,
    and pending inputs that would refine the score."""
    spec = THEME_METHOD.get(theme_id, {})
    bench = _pick_benchmark(benchmark_map, theme_id)

    if not theme.get("available", True):
        return {
            "theme_id": theme_id,
            "status": "data_not_available",
            "missing_inputs": theme.get("missing_inputs", []),
            "missing_reason": theme.get("missing_reason", "input"),
            "note": theme.get("note", ""),
            "method": spec.get("method"),
            "data_columns_required": spec.get("data_columns") or [],
            "qre_required": spec.get("qre_required") or [],
            "file_required": spec.get("file_required") or [],
            "engagement_required": spec.get("engagement_required") or [],
            "kb_files_consulted": _resolve_kb_paths(spec.get("kb_files") or [], industry),
        }

    metrics = theme.get("metrics") or {}
    components = theme.get("components") or {}
    thresholds = _collect_thresholds(components)
    derivation = _build_derivation(theme_id, metrics, components, bench, score)
    pending = _build_pending(spec, components, qre_status, engagement)

    return {
        "theme_id": theme_id,
        "status": "computed",
        "score": score.get("score"),
        "band": score.get("label"),
        "rationale": score.get("rationale"),
        "method": spec.get("method"),
        "data_columns_used": spec.get("data_columns") or [],
        "thresholds": thresholds,
        "derivation": derivation,
        "benchmark": bench,
        "kb_files_consulted": _resolve_kb_paths(spec.get("kb_files") or [], industry),
        "pending_inputs": pending,
    }


def explain_rca(card: dict) -> dict:
    """Add explainability fields to an RCA card. Looks up the trigger
    expression + reference docs from rca-rules.yml so the UI can show
    'this rule fired because metric X crossed threshold Y'."""
    return {
        "rule_id": card.get("rule_id"),
        "theme": card.get("theme"),
        "severity": card.get("severity") or card.get("confidence"),
        "trigger": card.get("trigger"),
        "root_causes": card.get("root_causes") or [],
        "diagnostic_actions": card.get("diagnostic_actions") or [],
        "references": card.get("references") or {},
        "computed_values_that_fired_it": card.get("computed_values") or {},
    }


def explain_kpi(kpi: dict) -> dict:
    """Build explainability for a KPI card — formula + inputs + benchmark."""
    band = kpi.get("band") or {}
    bench = kpi.get("benchmark") or {}
    return {
        "kpi_id": kpi.get("id") or kpi.get("kpi_id"),
        "value": kpi.get("value"),
        "unit": kpi.get("unit"),
        "status": kpi.get("status"),
        "band_low": band.get("low"),
        "band_high": band.get("high"),
        "computed_from": {
            "pillar": kpi.get("pillar"),
            "source_path": kpi.get("source_path"),
        },
        "benchmark": {
            "source": bench.get("source"),
            "year": bench.get("year"),
            "confidence": bench.get("confidence"),
            "band_layer": bench.get("layer", "function"),
        },
    }


# ---------------------------------------------------------------------------
# Internal builders
# ---------------------------------------------------------------------------

def _pick_benchmark(benchmark_map: Optional[dict], theme_id: str) -> Optional[dict]:
    if not benchmark_map:
        return None
    tid_norm = theme_id.lower().replace("-", "_")
    candidates = []
    for bid, b in benchmark_map.items():
        if tid_norm in str(bid).lower():
            candidates.append(b)
    if not candidates:
        return None
    for c in candidates:
        if "savings" in str(c.get("id", "")).lower():
            return _benchmark_record(c)
    return _benchmark_record(candidates[0])


def _benchmark_record(b: dict) -> dict:
    return {
        "id": b.get("id"),
        "name": b.get("name"),
        "value_range": b.get("value_range"),
        "unit": b.get("unit"),
        "source": b.get("source"),
        "year": b.get("year"),
        "sample_size": b.get("sample_size"),
        "confidence": b.get("confidence"),
        "layer": b.get("layer", "function"),
        "overridden": b.get("overridden", False),
    }


def _collect_thresholds(components: dict) -> dict:
    """Walk components for any numeric `threshold_*` field."""
    out = {}
    for cname, cval in (components or {}).items():
        if not isinstance(cval, dict):
            continue
        for k, v in cval.items():
            if isinstance(k, str) and k.startswith("threshold_"):
                out[f"{cname}.{k}"] = v
    return out


def _build_derivation(theme_id: str, metrics: dict, components: dict,
                       bench: Optional[dict], score: dict) -> list[str]:
    """Compose a 3-6 step derivation chain showing how inputs → score."""
    steps: list[str] = []

    if theme_id == "centralisation":
        c1 = components.get("c1_multi_plant_detection") or {}
        c3 = components.get("c3_industry_knowledge_filter") or {}
        c4 = components.get("c4_savings_quantification") or {}
        if c1:
            steps.append(f"c1 — Detect multi-plant MGs: threshold ≥{c1.get('threshold_min_plants','?')} plants "
                          f"AND ≥₹{c1.get('threshold_material_spend_inr_cr','?')} Cr per MG → "
                          f"{c1.get('candidate_count','?')} candidate MGs, ₹{c1.get('candidate_spend_inr_cr','?')} Cr candidate spend")
        if c3:
            steps.append(f"c3 — Steel industry filter (KB: archetype-overrides.yml): "
                          f"{c3.get('centralise_count','?')} Centralise ({c3.get('centralise_spend_inr_cr','?')} Cr) · "
                          f"{c3.get('centre_led_count','?')} Centre-Led ({c3.get('centre_led_spend_inr_cr','?')} Cr) · "
                          f"{c3.get('review_count','?')} Review · "
                          f"addressable: ₹{c3.get('addressable_spend_inr_cr','?')} Cr")
        if c4 and bench:
            vr = bench.get("value_range") or [0, 0]
            steps.append(f"c4 — Savings: addressable × benchmark range = "
                          f"₹{c4.get('centralise_spend_inr_cr','?')} Cr × [{vr[0]},{vr[1]}]% "
                          f"+ ₹{c4.get('centre_led_spend_inr_cr','?')} Cr × [centre-led-rate] "
                          f"→ savings range cited in the headline")
        steps.append(f"Score: {score.get('score','?')}/5 ({score.get('label','?')}) — {score.get('rationale','')}")
        return steps

    if theme_id == "tail-spend":
        t1 = components.get("ts1_quantification") or {}
        t2 = components.get("ts2_vendor_footprint") or {}
        steps.append(f"ts1 — Method A (POs <₹{t1.get('method_a_threshold_inr_lakh','?')} lakh): "
                      f"{t1.get('method_a_po_count','?')} POs, ₹{t1.get('method_a_spend_inr_cr','?')} Cr")
        steps.append(f"ts1 — Method B (Q3 MGs by spend): "
                      f"{t1.get('method_b_q3_count','?')} MGs, ₹{t1.get('method_b_spend_inr_cr','?')} Cr")
        steps.append(f"ts1 — Combined tail = {t1.get('tail_spend_share_pct','?')}% of total spend "
                      f"(₹{t1.get('combined_tail_spend_inr_cr','?')} Cr)")
        if t2:
            steps.append(f"ts2 — Long-tail vendor share: {t2.get('long_tail_vendor_share_pct','?')}% "
                          f"({t2.get('vendor_count','?')} vendors total; top 20% hold "
                          f"{t2.get('top20_spend_share_pct','?')}% → Pareto holds: {t2.get('pareto_holds','?')})")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    if theme_id == "coe":
        c1 = components.get("ce1_strategic_identification") or {}
        c2 = components.get("ce2_industry_filter") or {}
        c4 = components.get("ce4_value_quantification") or {}
        if c1: steps.append(f"ce1 — Strategic candidates: {c1.get('candidate_count','?')} MGs "
                             f"(of which {c1.get('high_concentration_count','?')} high-concentration)")
        if c2: steps.append(f"ce2 — Industry filter (steel): {c2.get('suitable_count','?')} suitable, "
                             f"₹{c2.get('suitable_spend_inr_cr','?')} Cr")
        if c4 and bench:
            vr = bench.get("value_range") or [0, 0]
            steps.append(f"ce4 — Incremental savings = ₹{c4.get('addressable_spend_inr_cr','?')} Cr × "
                          f"[{vr[0]},{vr[1]}]% — note: INCREMENTAL over centralisation savings")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    if theme_id == "shared-services":
        s2 = components.get("ss2_industry_filter") or {}
        s4 = components.get("ss4_fte_productivity") or {}
        if s2: steps.append(f"ss2 — Industry filter (steel): {s2.get('suitable_count','?')} suitable MGs, "
                             f"{s2.get('suitable_po_count','?')} POs, ₹{s2.get('suitable_spend_inr_cr','?')} Cr")
        if s4:
            steps.append(f"ss4 — Saving/PO = current ₹{s4.get('current_cost_per_po_inr','?')} - "
                          f"SSC target ₹{s4.get('ssc_target_cost_per_po_inr','?')} = "
                          f"₹{s4.get('saving_per_po_inr','?')} per PO")
            steps.append(f"ss4 — Operational savings = ₹{s4.get('saving_per_po_inr','?')} × "
                          f"{s4.get('addressable_po_count','?')} POs = "
                          f"₹{s4.get('operational_savings_inr_cr','?')} Cr/yr; "
                          f"FTE freed: {s4.get('fte_equivalent_freed','?')}")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    if theme_id == "po-compliance":
        steps.append(f"Distribution by tier band (₹0-5L / 5L-50L / 50L-2.5Cr / 2.5Cr-10Cr / >10Cr)")
        steps.append(f"70% rule (operational %) = spend in tiers 1-3 / total = "
                      f"{metrics.get('seventy_rule_pct','?')}%")
        steps.append(f"Cap-breach % = spend in tier 5 (>₹10 Cr) / total = "
                      f"{metrics.get('cap_breach_pct','?')}%")
        steps.append(f"Score: {score.get('score','?')}/5 — bands: <40% op or >20% breach → Initial, "
                      f"<60% op or >10% breach → Developing, etc. {score.get('rationale','')}")
        return steps

    if theme_id == "bucket-optimisation":
        steps.append("Compute spend-distribution percentiles p50/p75/p90/p95/p99")
        steps.append("Compare current tier thresholds vs recommended percentiles (p75-p99)")
        steps.append(f"Bucket fit score: avg relative error → 5=<20%, 4=<50%, 3=<100%, 2=<200%, 1=else")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    if theme_id == "buying-channel-strategy":
        comps = components or {}
        bc1 = comps.get("bc1_portfolio_channel_mix", {})
        bc5 = comps.get("bc5_match_status", {})
        bc8 = comps.get("bc8_sole_source_risk", {})
        bc13 = comps.get("bc13_contract_coverage_lift", {})
        if bc1: steps.append(f"bc1 — Channel mix: {bc1.get('contracted_spend_pct','?')}% on contracted "
                              f"channels (RC + OLA + ROP) of ₹{bc1.get('total_spend_inr_cr','?')} Cr")
        if bc5: steps.append(f"bc5 — Match status: {bc5.get('misrouted_count','?')} MGs misrouted "
                              f"(₹{bc5.get('misrouted_spend_inr_cr','?')} Cr), "
                              f"{bc5.get('already_right_count','?')} already-right, "
                              f"{bc5.get('over_engineered_count','?')} over-engineered")
        if bc8: steps.append(f"bc8 — Sole-source risk: {bc8.get('sole_source_count','?')} MGs sole-sourced "
                              f"({bc8.get('single_vendor_count','?')} single-vendor, "
                              f"{bc8.get('pac_justified_count','?')} PAC-justified)")
        if bc13: steps.append(f"bc13 — Contract coverage lift: as-is {bc13.get('as_is_contracted_pct','?')}% → "
                               f"to-be {bc13.get('to_be_contracted_pct','?')}% (lift "
                               f"{bc13.get('lift_pp','?')} pp)")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    # QRE-driven Org Structure themes
    if theme_id == "organisation-posture":
        steps.append(f"D2.1 (Structure) = {metrics.get('qre_d21','?')}/4")
        steps.append(f"D2.4 (DoA framework) = {metrics.get('qre_d24','?')}/4")
        steps.append(f"Avg QRE = {metrics.get('avg_qre_score','?')}")
        steps.append(f"Posture inferred: '{metrics.get('posture_inferred','?')}' (D2.1≥3=Centralised, ≥2=Hybrid, else=Federated)")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    if theme_id == "fte-sizing-role-composition":
        steps.append(f"Spend/FTE = ₹{metrics.get('spend_per_fte_inr_cr','?')} Cr")
        steps.append(f"Benchmark band: ₹{(metrics.get('benchmark_band_inr_cr') or ['?','?'])[0]}–"
                      f"{(metrics.get('benchmark_band_inr_cr') or ['?','?'])[1]} Cr/FTE · "
                      f"in band: {metrics.get('in_band','?')}")
        steps.append(f"Avg QRE (D2.2 + D11.1 + D11.4) = {metrics.get('avg_qre_score','?')}/4")
        steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
        return steps

    # V2 simple themes
    if theme_id.startswith(("mm", "pr", "pp", "sup")):
        if metrics.get("metric_value") is not None:
            steps.append(f"Computed metric: {metrics.get('metric_value')}{metrics.get('metric_unit','')}")
        if theme.get("note"):
            steps.append(theme["note"])
        steps.append(f"Score: {score.get('score','?')}/5 ({score.get('label','?')})")
        return steps

    # Fallback
    if metrics:
        for k, v in list(metrics.items())[:4]:
            steps.append(f"{k}: {v}")
    steps.append(f"Score: {score.get('score','?')}/5 — {score.get('rationale','')}")
    return steps


def _build_pending(spec: dict, components: dict,
                    qre_status: Optional[dict],
                    engagement: Optional[dict]) -> list[dict]:
    """List inputs that would refine the score if provided."""
    pending: list[dict] = []
    # QRE inputs marked as 'not computed' on baseline / reconciliation components
    for cname, cval in (components or {}).items():
        if isinstance(cval, dict) and cval.get("computed") is False:
            pending.append({
                "type": "qre",
                "component": cname,
                "reason": cval.get("reason", "Requires QRE input"),
            })
    # Theme-level required QRE that's not answered
    qre_required = spec.get("qre_required") or []
    answered_ids = set()
    if qre_status and qre_status.get("answered"):
        answered_ids = set(qre_status.get("answered_ids") or [])
    for qid in qre_required:
        if qid not in answered_ids:
            pending.append({"type": "qre", "id": qid,
                             "reason": f"QRE {qid} would directly drive this theme's score"})
    return pending


def _resolve_kb_paths(paths: list[str], industry: str) -> list[str]:
    """Substitute <industry> placeholder in KB paths."""
    return [p.replace("<industry>", industry) for p in (paths or [])]
