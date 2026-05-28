"""RCA rules evaluator — fires deterministic IF-THEN rules from rca-rules.yml.

V1 implements a small subset of triggers — fully parsing rule trigger
expressions is a Build-2 task. For each pillar, we evaluate selected
deterministic patterns against theme outputs and emit RCA findings.
"""
from __future__ import annotations

from typing import Any, Optional

from .. import kb_loader


def run_rca_op_model(theme_outputs: dict) -> list[dict]:
    """Evaluate Op Model RCA rules against the 4 theme outputs.

    Returns a list of fired RCA cards: {rule_id, theme, root_causes,
    confidence, references, diagnostic_actions}.
    """
    fired: list[dict] = []

    rules_kb = kb_loader.get_pillar_rca_rules("op-model")
    rules = rules_kb.get("rules") or []

    cent = theme_outputs.get("centralisation", {})
    ss = theme_outputs.get("shared-services", {})
    coe = theme_outputs.get("coe", {})
    tail = theme_outputs.get("tail-spend", {})

    # Build a flat metrics dict the trigger heuristics can read
    m = {
        # Centralisation
        "centralisation.candidate_count": cent.get("metrics", {}).get("candidate_count", 0),
        "centralisation.candidate_spend_inr_cr": cent.get("metrics", {}).get("candidate_spend_inr_cr", 0),
        "centralisation.savings_low": cent.get("metrics", {}).get("savings_range_inr_cr", [0, 0])[0],
        "centralisation.savings_high": cent.get("metrics", {}).get("savings_range_inr_cr", [0, 0])[1],
        # Shared Services
        "shared_services.q1_count": ss.get("metrics", {}).get("q1_count", 0),
        "shared_services.ssc_addressable_po_count": ss.get("metrics", {}).get("ssc_addressable_po_count", 0),
        # CoE
        "coe.strategic_candidate_count": coe.get("metrics", {}).get("strategic_candidate_count", 0),
        "coe.coe_suitable_count": coe.get("metrics", {}).get("coe_suitable_count", 0),
        # Tail
        "tail.tail_spend_share_pct": tail.get("metrics", {}).get("tail_spend_share_pct", 0),
        "tail.long_tail_vendor_share_pct": tail.get("metrics", {}).get("long_tail_vendor_share_pct", 0),
    }

    # Apply heuristic trigger mappings (matches sample of rule IDs in op-model/rca-rules.yml)
    fired.extend(_eval_centralisation_rules(rules, m))
    fired.extend(_eval_shared_services_rules(rules, m))
    fired.extend(_eval_coe_rules(rules, m))
    fired.extend(_eval_tail_rules(rules, m))

    return fired


# --------------------------------------------------------------------------

def _find_rule(rules: list[dict], rule_id: str) -> Optional[dict]:
    for r in rules:
        if r.get("id") == rule_id:
            return r
    return None


def _rule_card(rule: dict) -> dict:
    return {
        "rule_id": rule.get("id"),
        "theme": rule.get("theme"),
        "trigger": rule.get("trigger"),
        "root_causes": rule.get("root_causes") or [],
        "confidence": rule.get("confidence"),
        "references": rule.get("references") or {},
        "diagnostic_actions": rule.get("diagnostic_actions") or [],
    }


def _eval_centralisation_rules(rules: list[dict], m: dict) -> list[dict]:
    out = []
    if m["centralisation.candidate_count"] >= 5 and m["centralisation.savings_high"] >= 15:
        r = _find_rule(rules, "rca.centralisation.r01_low_central_many_candidates")
        if r: out.append(_rule_card(r))
    if m["centralisation.candidate_count"] >= 3 and m["centralisation.savings_high"] >= 8:
        r = _find_rule(rules, "rca.centralisation.r05_mid_tier_blind_spot")
        if r: out.append(_rule_card(r))
    return out


def _eval_shared_services_rules(rules: list[dict], m: dict) -> list[dict]:
    out = []
    if m["shared_services.q1_count"] >= 3 and m["shared_services.ssc_addressable_po_count"] >= 5000:
        r = _find_rule(rules, "rca.shared_services.r01_no_ssc_many_q1")
        if r: out.append(_rule_card(r))
    return out


def _eval_coe_rules(rules: list[dict], m: dict) -> list[dict]:
    out = []
    if m["coe.coe_suitable_count"] >= 3:
        r = _find_rule(rules, "rca.coe.r02_no_coe_high_concentration")
        if r: out.append(_rule_card(r))
    return out


def _eval_tail_rules(rules: list[dict], m: dict) -> list[dict]:
    out = []
    if m["tail.long_tail_vendor_share_pct"] >= 30:
        r = _find_rule(rules, "rca.tail_spend.r03_long_tail_fragmentation")
        if r: out.append(_rule_card(r))
    if m["tail.tail_spend_share_pct"] >= 15:
        r = _find_rule(rules, "rca.tail_spend.r04_high_tail_share")
        if r: out.append(_rule_card(r))
    return out
