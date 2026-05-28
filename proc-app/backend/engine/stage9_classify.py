"""Stage 9 — Category Classification (V1 stub).

For V1, this module classifies each material group into one of the 5
archetypes (BULK / DIRECT / INDIRECT / SERVICE / CAPEX) using:
  1. SAP Item Category (PSTYP) → CAPEX (A) / SERVICE (D)
  2. SAP Material Type (MTART) → CAPEX (ANLZ/FHMI) / SERVICE (DIEN) / INDIRECT (ERSA/ERSZ/NLAG)
  3. Material Group description keyword match against the keyword banks
     in buying-channel/analysis-config.yml + steel archetype-overrides

The real Stage 9 engine (built in a parallel chat) produces canonical
category names per industry taxonomy. For V1 we use the raw MG code as
the canonical category — the pillar analyses key off archetype only.
"""
from __future__ import annotations

from typing import Optional

import pandas as pd

from .. import kb_loader


def classify_dataframe(df: pd.DataFrame, industry: str = "steel") -> pd.DataFrame:
    """Add archetype + reclassified_category columns to the gold DataFrame.

    archetype ∈ {BULK, DIRECT, INDIRECT, SERVICE, CAPEX, UNCLASSIFIED}
    reclassified_category — for V1, equal to material_group (raw code).
                            Stage 9 engine eventually maps to canonical taxonomy.
    """
    keyword_banks = _build_keyword_banks(industry)

    archetypes = []
    confidences = []
    sources = []
    for _, row in df.iterrows():
        arch, conf, src = _classify_row(row, keyword_banks)
        archetypes.append(arch)
        confidences.append(conf)
        sources.append(src)

    out = df.copy()
    out["archetype"] = archetypes
    out["reclassification_confidence"] = confidences
    out["reclassification_source"] = sources
    # For V1, reclassified_category = raw material_group (Stage 9 engine will refine)
    if "material_group" in out.columns:
        out["reclassified_category"] = out["material_group"]
    return out


# --------------------------------------------------------------------------

def _build_keyword_banks(industry: str) -> dict[str, list[str]]:
    """Combine function-default + industry-specific keyword banks for archetypes."""
    cfg = kb_loader.get_pillar_config("buying-channel")
    banks = dict(cfg.get("archetype_keyword_banks") or {})

    # Industry overlay append_keywords
    try:
        overlay = kb_loader.get_industry_pillar_overlay(industry, "buying-channel", "archetype-overrides")
        for arch, extra in (overlay.get("append_keywords") or {}).items():
            existing = banks.get(arch, [])
            if isinstance(existing, dict) and "keywords" in existing:
                existing = existing["keywords"]
            if isinstance(extra, list):
                banks[arch] = list(existing) + extra
    except Exception:
        pass

    # Normalise: ensure each value is a list of strings
    normalised = {}
    for arch, val in banks.items():
        if isinstance(val, dict) and "keywords" in val:
            val = val["keywords"]
        if isinstance(val, list):
            normalised[arch] = [str(k).upper() for k in val]
    return normalised


def _classify_row(row, keyword_banks: dict[str, list[str]]) -> tuple[str, str, str]:
    """Return (archetype, confidence, source)."""
    # P1 — SAP Item Category
    item_cat = str(row.get("item_category", "")).strip().upper()
    if item_cat == "A":
        return "CAPEX", "HIGH", "P1_item_category"
    if item_cat == "D":
        return "SERVICE", "HIGH", "P1_item_category"

    # P2 — SAP Material Type
    mtart = str(row.get("material_type", "")).strip().upper()
    if mtart in ("DIEN",):
        return "SERVICE", "HIGH", "P2_material_type"
    if mtart in ("ANLZ", "FHMI"):
        return "CAPEX", "HIGH", "P2_material_type"
    if mtart in ("ERSA", "ERSZ", "NLAG"):
        return "INDIRECT", "HIGH", "P2_material_type"

    # P4 — Keyword match on Material Group description + short text
    desc_parts = [str(row.get("material_group_desc", "")), str(row.get("short_text", ""))]
    text = " ".join(desc_parts).upper()
    if text.strip():
        best_arch = None
        best_score = 0
        for arch, keywords in keyword_banks.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > best_score:
                best_arch = arch
                best_score = score
        if best_arch and best_score > 0:
            return best_arch, "MEDIUM", "P4_keyword"

    return "UNCLASSIFIED", "LOW", "P4_fallback"


# --------------------------------------------------------------------------

def summarise(df: pd.DataFrame) -> dict:
    """Return classification distribution summary."""
    if "archetype" not in df.columns:
        return {}
    by_archetype = df["archetype"].value_counts().to_dict()
    by_arch_spend = {}
    if "net_value_inr" in df.columns:
        by_arch_spend = df.groupby("archetype")["net_value_inr"].sum().to_dict()
    confidence_dist = df["reclassification_confidence"].value_counts().to_dict() if "reclassification_confidence" in df.columns else {}
    return {
        "by_archetype_rows": {k: int(v) for k, v in by_archetype.items()},
        "by_archetype_spend_inr": {k: float(v) for k, v in by_arch_spend.items()},
        "confidence_distribution": {k: int(v) for k, v in confidence_dist.items()},
        "unclassified_pct": round(by_archetype.get("UNCLASSIFIED", 0) / max(len(df), 1) * 100, 2),
    }
