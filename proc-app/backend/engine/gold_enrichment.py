"""Gold-layer enrichment — adds DERIVED columns to the PO DataFrame.

Bronze = structurally validated (cleansing_engine).
Gold   = Bronze + enrichment columns.

V1 enrichments (all from PO + KB seeds; no Vendor/Material/Contract Master
required — those uploads are tagged captured_for_v2):
  1. po_type_inferred    (capex / opex / services)
  2. is_capex            (boolean shortcut)
  3. is_pac              (materialised PAC flag)
  4. is_emergency        (short_text keyword scan)
  5. approver_tier       (1-5 ladder from po_approver_designation)

Each enrichment records {rule_id, rule_name, column_added, counts, details}
in an EnrichmentReport. Stage 8 UI renders the report as a "Gold
enrichments applied" honesty panel so Gold visibly differs from Bronze.

Engine-only — never raises. Missing input columns silently skip the rule.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import pandas as pd
import yaml

from .. import config


# --------------------------------------------------------------------------
# KB loaders (cached)
# --------------------------------------------------------------------------

_po_type_rules_cache: Optional[dict] = None
_designation_rules_cache: Optional[dict] = None


def _kb_dir() -> Path:
    return config.PROC_KB_ROOT / "data-cleansing"


def load_po_type_rules() -> dict:
    global _po_type_rules_cache
    if _po_type_rules_cache is not None:
        return _po_type_rules_cache
    path = _kb_dir() / "po-type-derivation-rules.yml"
    if not path.exists():
        _po_type_rules_cache = {}
        return _po_type_rules_cache
    _po_type_rules_cache = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return _po_type_rules_cache


def load_designation_rules() -> dict:
    global _designation_rules_cache
    if _designation_rules_cache is not None:
        return _designation_rules_cache
    path = _kb_dir() / "designation-tier-seed.yml"
    if not path.exists():
        _designation_rules_cache = {}
        return _designation_rules_cache
    _designation_rules_cache = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return _designation_rules_cache


def invalidate_caches():
    global _po_type_rules_cache, _designation_rules_cache
    _po_type_rules_cache = None
    _designation_rules_cache = None


# --------------------------------------------------------------------------
# Enrichment report
# --------------------------------------------------------------------------

class EnrichmentReport:
    def __init__(self):
        self.entries: list[dict] = []
        self.added_columns: list[str] = []

    def record(self, rule_id: str, rule_name: str, severity: str,
                column_added: Optional[str], counts: dict,
                details: Optional[dict] = None) -> None:
        self.entries.append({
            "rule_id": rule_id,
            "rule_name": rule_name,
            "severity": severity,  # "enrichment" | "enrichment_skipped"
            "column_added": column_added,
            "counts": counts,
            "details": details or {},
        })
        if column_added and column_added not in self.added_columns:
            self.added_columns.append(column_added)

    def summary(self) -> dict:
        return {
            "rules_fired": len(self.entries),
            "rules_applied": sum(1 for e in self.entries if e["severity"] == "enrichment"),
            "rules_skipped": sum(1 for e in self.entries if e["severity"] == "enrichment_skipped"),
            "columns_added": list(self.added_columns),
        }


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def apply_enrichment(df: pd.DataFrame, file_type: str = "PO") -> tuple[pd.DataFrame, EnrichmentReport]:
    """Apply all V1 enrichments. Returns (enriched_df, report). NEVER raises."""
    report = EnrichmentReport()
    if file_type != "PO":
        return df, report  # V1 enrichment only operates on PO
    df = df.copy()
    df = _enrich_po_type(df, report)
    df = _enrich_pac_flag(df, report)
    df = _enrich_emergency_flag(df, report)
    df = _enrich_capex_flag(df, report)
    df = _enrich_approver_tier(df, report)
    return df, report


# --------------------------------------------------------------------------
# Individual enrichments
# --------------------------------------------------------------------------

def _enrich_po_type(df: pd.DataFrame, r: EnrichmentReport) -> pd.DataFrame:
    rules = load_po_type_rules()
    if not rules:
        r.record("gold.po_type_derivation",
                 "Derive po_type_inferred (capex/opex/services)",
                 "enrichment_skipped", None,
                 {"reason_count": 1},
                 {"reason": "po-type-derivation-rules.yml not found"})
        return df

    type_keywords: dict = rules.get("type_keywords") or {}
    default_type: str = rules.get("default_po_type", "opex")
    capex_min_value: float = float(rules.get("capex_min_value_inr") or 0)
    use_explicit: bool = bool(rules.get("override_with_explicit_field", True))
    recognised_explicit = set(rules.get("recognised_explicit_values") or [])

    # Vectorised matching: for each row, derive type from explicit field
    # OR by first-keyword-match on material_group_desc.
    desc_col = ("material_group_desc" if "material_group_desc" in df.columns
                 else ("material_group" if "material_group" in df.columns else None))
    descs = df[desc_col].astype(str).str.lower() if desc_col else pd.Series([""] * len(df), index=df.index)

    if use_explicit and "po_type" in df.columns:
        explicit = df["po_type"].astype(str).str.strip().str.lower()
        explicit = explicit.where(explicit.isin(recognised_explicit), "")
    else:
        explicit = pd.Series([""] * len(df), index=df.index)

    # Start with default
    inferred = pd.Series([default_type] * len(df), index=df.index, dtype="object")

    # Apply keyword buckets in order: capex first, then services, then opex
    for tpe in ("capex", "services", "opex"):
        kws = type_keywords.get(tpe) or []
        if not kws:
            continue
        pattern = "|".join(re.escape(str(k).lower()) for k in kws if str(k).strip())
        if not pattern:
            continue
        mask = descs.str.contains(pattern, na=False, regex=True)
        # Only fill rows still at default (don't overwrite earlier matches)
        already_set = inferred != default_type
        inferred = inferred.where(already_set, inferred.where(~mask, tpe))

    # Override with explicit when valid
    has_explicit = (explicit != "") & (explicit.isin(recognised_explicit))
    inferred = inferred.where(~has_explicit, explicit)

    # Value-assist for capex
    bumped_to_capex = 0
    if capex_min_value > 0 and "net_value" in df.columns:
        v = pd.to_numeric(df["net_value"], errors="coerce").fillna(0)
        bump_mask = (v >= capex_min_value) & (inferred != "capex") & ~has_explicit
        bumped_to_capex = int(bump_mask.sum())
        if bumped_to_capex:
            inferred = inferred.where(~bump_mask, "capex")

    df["po_type_inferred"] = inferred

    counts = {
        "capex": int((inferred == "capex").sum()),
        "opex": int((inferred == "opex").sum()),
        "services": int((inferred == "services").sum()),
        "explicit_field_used": int(has_explicit.sum()),
        "value_bumped_to_capex": bumped_to_capex,
        "fallback_default": int((inferred == default_type).sum()),
    }
    r.record("gold.po_type_derivation",
             "Derive po_type_inferred (capex/opex/services) from material_group_desc + value",
             "enrichment", "po_type_inferred", counts,
             details={"default_type": default_type,
                       "capex_min_value_inr": capex_min_value,
                       "source_column": desc_col})
    return df


def _enrich_pac_flag(df: pd.DataFrame, r: EnrichmentReport) -> pd.DataFrame:
    if "short_text" not in df.columns:
        r.record("gold.pac_detection_column",
                 "Materialise is_pac column from short_text",
                 "enrichment_skipped", None,
                 {"reason_count": 1},
                 {"reason": "short_text column not present"})
        return df
    rules = load_po_type_rules()
    kws = rules.get("pac_keywords") or ["pac", "proprietary"]
    pattern = r"\b(?:" + "|".join(re.escape(str(k).lower()) for k in kws if str(k).strip()) + r")\b"
    txt = df["short_text"].astype(str).str.lower()
    flag = txt.str.contains(pattern, na=False, regex=True)
    df["is_pac"] = flag
    n = int(flag.sum())
    r.record("gold.pac_detection_column",
             "Materialise is_pac column from short_text",
             "enrichment", "is_pac",
             {"pac_pos": n, "non_pac": int(len(df) - n)},
             details={"pct_of_pos": round(100 * n / max(len(df), 1), 1), "keywords": kws})
    return df


def _enrich_emergency_flag(df: pd.DataFrame, r: EnrichmentReport) -> pd.DataFrame:
    if "short_text" not in df.columns:
        r.record("gold.emergency_detection",
                 "Detect emergency POs from short_text keywords",
                 "enrichment_skipped", None,
                 {"reason_count": 1},
                 {"reason": "short_text column not present"})
        return df
    rules = load_po_type_rules()
    kws = rules.get("emergency_keywords") or []
    if not kws:
        r.record("gold.emergency_detection",
                 "Detect emergency POs from short_text keywords",
                 "enrichment_skipped", None,
                 {"reason_count": 1},
                 {"reason": "no emergency_keywords in KB"})
        return df
    pattern = "|".join(re.escape(str(k).lower()) for k in kws if str(k).strip())
    txt = df["short_text"].astype(str).str.lower()
    flag = txt.str.contains(pattern, na=False, regex=True)
    df["is_emergency"] = flag
    n = int(flag.sum())
    r.record("gold.emergency_detection",
             "Detect emergency POs from short_text keywords",
             "enrichment", "is_emergency",
             {"emergency_pos": n, "non_emergency": int(len(df) - n)},
             details={"pct_of_pos": round(100 * n / max(len(df), 1), 1),
                       "keywords_count": len(kws)})
    return df


def _enrich_capex_flag(df: pd.DataFrame, r: EnrichmentReport) -> pd.DataFrame:
    if "po_type_inferred" not in df.columns:
        return df
    df["is_capex"] = (df["po_type_inferred"] == "capex")
    n = int(df["is_capex"].sum())
    r.record("gold.capex_flag",
             "Boolean is_capex flag (shortcut from po_type_inferred)",
             "enrichment", "is_capex",
             {"capex_pos": n, "non_capex": int(len(df) - n)},
             details={"pct_capex": round(100 * n / max(len(df), 1), 1)})
    return df


def _enrich_approver_tier(df: pd.DataFrame, r: EnrichmentReport) -> pd.DataFrame:
    if "po_approver_designation" not in df.columns:
        r.record("gold.approver_tier",
                 "Assign approver_tier (1-5) from po_approver_designation",
                 "enrichment_skipped", None,
                 {"reason_count": 1},
                 {"reason": "po_approver_designation column not in PO upload (optional V1 field)"})
        return df

    rules = load_designation_rules()
    patterns = rules.get("designation_patterns") or []
    overrides = rules.get("canonical_overrides") or {}
    if not patterns:
        r.record("gold.approver_tier",
                 "Assign approver_tier from po_approver_designation",
                 "enrichment_skipped", None,
                 {"reason_count": 1},
                 {"reason": "designation-tier-seed.yml missing or empty"})
        return df

    # Compile regexes once
    compiled: list[tuple[re.Pattern, int, str]] = []
    for p in patterns:
        pat = p.get("pattern")
        tier = p.get("tier")
        if pat and isinstance(tier, int):
            try:
                compiled.append((re.compile(pat, re.IGNORECASE), tier,
                                  p.get("example", "")))
            except re.error:
                pass

    # Normalised lowercase designation
    desigs_lower = df["po_approver_designation"].astype(str).str.strip().str.lower()
    tiers = pd.Series([None] * len(df), index=df.index, dtype="object")
    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "unmapped": 0, "blank": 0}

    # Lowercased canonical override keys
    override_map = {k.strip().lower(): v for k, v in overrides.items()}

    for i, d in zip(df.index, desigs_lower):
        if not d or d in ("nan", "none", ""):
            counts["blank"] += 1
            continue
        # Canonical override first
        if d in override_map:
            t = override_map[d]
            tiers.loc[i] = t
            counts[t] += 1
            continue
        # First-match regex
        matched = None
        for cre, tier, _ex in compiled:
            if cre.search(d):
                matched = tier
                break
        if matched:
            tiers.loc[i] = matched
            counts[matched] += 1
        else:
            counts["unmapped"] += 1

    df["approver_tier"] = tiers
    mapped = sum(counts[t] for t in (1, 2, 3, 4, 5))
    distinct_desigs = int(desigs_lower[desigs_lower != ""].nunique())

    r.record("gold.approver_tier",
             "Assign approver_tier (1-5) from po_approver_designation",
             "enrichment", "approver_tier",
             {"tier_1": counts[1], "tier_2": counts[2], "tier_3": counts[3],
               "tier_4": counts[4], "tier_5": counts[5],
               "unmapped_text": counts["unmapped"], "blank": counts["blank"]},
             details={"mapped_rows": mapped, "total_rows": int(len(df)),
                       "mapping_rate_pct": round(100 * mapped / max(len(df), 1), 1),
                       "distinct_designations": distinct_desigs})
    return df
