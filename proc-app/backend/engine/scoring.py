"""Maturity scoring — maps theme outputs to 1-5 maturity scores.

Reads scoring-descriptors.yml per pillar to find which level a theme
matches based on its key signal bands.

V1 implementation: use heuristic mapping per theme. Production: parse
scoring-descriptors.yml signal bands and match precisely.
"""
from __future__ import annotations

from typing import Optional


def score_centralisation(theme_output: dict) -> dict:
    """Score Centralisation theme based on candidate share + savings."""
    m = theme_output.get("metrics", {})
    cand_spend = m.get("candidate_spend_inr_cr", 0)
    savings_range = m.get("savings_range_inr_cr", [0, 0])

    # Heuristic: high candidate spend OR savings signals gap from optimal.
    # Without baseline spend_central_pct (needs QRE), we use the gap as a proxy.
    if cand_spend == 0 and savings_range[1] == 0:
        return {"score": 5, "label": "Optimised", "rationale": "No centralisation candidates surfaced — already mature."}
    elif savings_range[1] < 5:
        return {"score": 4, "label": "Managed", "rationale": "Narrow opportunity remaining; fine-tuning category."}
    elif savings_range[1] < 15:
        return {"score": 3, "label": "Defined", "rationale": "Mid-tier opportunity; selective scope expansion warranted."}
    elif savings_range[1] < 30:
        return {"score": 2, "label": "Developing", "rationale": "Material centralisation opportunity; phased expansion needed."}
    else:
        return {"score": 1, "label": "Initial", "rationale": "Large centralisation gap; greenfield programme warranted."}


def score_shared_services(theme_output: dict) -> dict:
    m = theme_output.get("metrics", {})
    addressable_spend = m.get("ssc_addressable_spend_inr_cr", 0)
    addressable_po = m.get("ssc_addressable_po_count", 0)

    if addressable_po == 0:
        return {"score": 5, "label": "Optimised", "rationale": "No SSC-suitable categories outside coverage."}
    elif addressable_po < 2000:
        return {"score": 4, "label": "Managed", "rationale": "Narrow scope-expansion opportunity remaining."}
    elif addressable_po < 8000:
        return {"score": 3, "label": "Defined", "rationale": "Partial SSC coverage; mid-tier expansion candidate set."}
    elif addressable_po < 20000:
        return {"score": 2, "label": "Developing", "rationale": "SSC programme nascent; substantial expansion scope."}
    else:
        return {"score": 1, "label": "Initial", "rationale": "Greenfield SSC opportunity; high transactional volume unconsolidated."}


def score_coe(theme_output: dict) -> dict:
    m = theme_output.get("metrics", {})
    suitable_count = m.get("coe_suitable_count", 0)
    high_concentration = m.get("strategic_candidate_count", 0)

    if suitable_count == 0:
        return {"score": 5, "label": "Optimised", "rationale": "No CoE coverage gap identified."}
    elif suitable_count <= 2:
        return {"score": 4, "label": "Managed", "rationale": "Limited CoE expansion scope."}
    elif suitable_count <= 5:
        return {"score": 3, "label": "Defined", "rationale": "Several strategic categories outside CoE attention."}
    elif suitable_count <= 9:
        return {"score": 2, "label": "Developing", "rationale": "CoE coverage thin relative to strategic universe."}
    else:
        return {"score": 1, "label": "Initial", "rationale": "Strategic categories largely outside formal CoE governance."}


def score_tail_spend(theme_output: dict) -> dict:
    m = theme_output.get("metrics", {})
    tail_share = m.get("tail_spend_share_pct", 0)
    long_tail_vendor = m.get("long_tail_vendor_share_pct", 0)

    if tail_share < 5 and long_tail_vendor < 15:
        return {"score": 5, "label": "Optimised", "rationale": "Tail well-managed."}
    elif tail_share < 8 and long_tail_vendor < 20:
        return {"score": 4, "label": "Managed", "rationale": "Tail mostly under control; minor optimisation."}
    elif tail_share < 12 and long_tail_vendor < 30:
        return {"score": 3, "label": "Defined", "rationale": "Tail programme defined; refinement scope remains."}
    elif tail_share < 18 and long_tail_vendor < 40:
        return {"score": 2, "label": "Developing", "rationale": "Tail share elevated; aggregator scope-expansion opportunity."}
    else:
        return {"score": 1, "label": "Initial", "rationale": "Tail largely unmanaged; vendor fragmentation high."}


def pillar_score(theme_scores: dict, weights: dict) -> dict:
    """Weighted rollup."""
    score = 0.0
    total_weight = 0.0
    for theme, ts in theme_scores.items():
        w = weights.get(theme, 0.25)
        score += ts["score"] * w
        total_weight += w
    if total_weight > 0:
        score = score / total_weight
    rounded = round(score, 1)
    if rounded < 1.5:
        label = "Initial"
    elif rounded < 2.5:
        label = "Developing"
    elif rounded < 3.5:
        label = "Defined"
    elif rounded < 4.5:
        label = "Managed"
    else:
        label = "Optimised"
    return {"score": rounded, "label": label}
