"""Data cleansing engine — applies rules from KB YAML + tracks what fired.

Wraps the existing cleansing primitives (type coercion, vendor dedup, currency
normalisation, negative-value tagging, deduplication, missing-key removal)
and emits a structured report per upload:

    [
      {"rule_id", "rule_name", "stage", "severity", "rows_affected",
       "action", "details"},
      ...
    ]

Universal rules (shared-kb/standards/data-quality-universal.yml) +
procurement rules (kb/functions/procurement/_meta/cleansing-rules.yml)
are both loaded so the Stage 7/8 screens can show the full picture.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd
import yaml

from .. import config


# ============================================================================
# Rule catalogue (loaded from YAML)
# ============================================================================

_rules_cache: dict[str, list[dict]] = {}


def load_rules() -> dict[str, list[dict]]:
    """Return {universal: [...], procurement: [...]} from KB YAML."""
    if _rules_cache:
        return _rules_cache
    universal_path = config.STANDARDS_DIR / "data-quality-universal.yml"
    proc_path = config.PROC_KB_ROOT / "_meta" / "cleansing-rules.yml"
    out = {"universal": [], "procurement": []}
    if universal_path.exists():
        d = yaml.safe_load(universal_path.read_text(encoding="utf-8")) or {}
        out["universal"] = d.get("rules", [])
    if proc_path.exists():
        d = yaml.safe_load(proc_path.read_text(encoding="utf-8")) or {}
        out["procurement"] = d.get("rules", [])
    _rules_cache.update(out)
    return out


def invalidate_rules_cache():
    _rules_cache.clear()


# ============================================================================
# Cleansing pipeline — each rule mutates df + appends to report
# ============================================================================

class CleansingReport:
    """Collects rule-execution outcomes."""

    def __init__(self):
        self.entries: list[dict] = []

    def record(self, rule_id: str, rule_name: str, stage: int, severity: str,
               rows_affected: int, action: str, details: Optional[dict] = None):
        self.entries.append({
            "rule_id": rule_id,
            "rule_name": rule_name,
            "stage": stage,
            "severity": severity,           # info / warn / fix / drop
            "rows_affected": int(rows_affected),
            "action": action,
            "details": details or {},
        })

    def summary(self) -> dict:
        totals_by_severity = {}
        totals_by_stage = {}
        for e in self.entries:
            totals_by_severity[e["severity"]] = totals_by_severity.get(e["severity"], 0) + 1
            totals_by_stage[e["stage"]] = totals_by_stage.get(e["stage"], 0) + 1
        return {
            "rules_fired": len(self.entries),
            "by_severity": totals_by_severity,
            "by_stage": totals_by_stage,
            "rows_fixed_total": sum(e["rows_affected"] for e in self.entries if e["severity"] == "fix"),
            "rows_dropped_total": sum(e["rows_affected"] for e in self.entries if e["severity"] == "drop"),
        }


# ============================================================================
# Individual rule applications
# ============================================================================

def apply_pipeline(df: pd.DataFrame, file_type: str = "PO") -> tuple[pd.DataFrame, CleansingReport]:
    """Run the full cleansing pipeline. Returns (cleaned_df, report)."""
    report = CleansingReport()
    original_rows = len(df)

    # --- Stage 5 / 6: structural ---
    df = _r_strip_whitespace(df, report)
    df = _r_drop_blank_rows(df, report)
    df = _r_normalise_dates(df, report)
    df = _r_normalise_numerics(df, report)
    df = _r_normalise_yesno(df, report)

    # --- Stage 8: domain-specific (PO) ---
    if file_type == "PO":
        df = _r_dedup_vendors(df, report)
        df = _r_normalise_currency_inr(df, report)
        df = _r_tag_negative_values(df, report)
        df = _r_detect_duplicate_lines(df, report)
        df = _r_detect_pac_in_short_text(df, report)
        df = _r_drop_missing_required(df, report)
    elif file_type == "PR":
        df = _r_drop_missing_required_pr(df, report)
    elif file_type in ("VENDOR_MASTER",):
        df = _r_dedup_vendor_master(df, report)
    elif file_type in ("MATERIAL_MASTER",):
        df = _r_detect_duplicate_materials(df, report)

    # --- Universal: dedupe + period coverage ---
    df = _r_exact_dup_rows(df, report)
    if "po_creation_date" in df.columns or "pr_creation_date" in df.columns or "posting_date" in df.columns:
        _r_period_coverage(df, report)

    report.record(
        rule_id="summary.row_count",
        rule_name="Row-count delta after cleansing",
        stage=8,
        severity="info",
        rows_affected=original_rows - len(df),
        action="kept",
        details={"original": original_rows, "kept": len(df)},
    )
    return df, report


# --- Universal rules ---

def _r_strip_whitespace(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    str_cols = df.select_dtypes(include=["object"]).columns
    fixed = 0
    for c in str_cols:
        before = df[c].astype(str)
        after = before.str.strip()
        fixed += int((before != after).sum())
        df[c] = after
    if fixed:
        r.record("universal.trim_whitespace", "Trim leading/trailing whitespace", 5, "fix", fixed, "trimmed")
    return df


def _r_drop_blank_rows(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    before = len(df)
    df = df.dropna(how="all").reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        r.record("universal.remove_fully_blank_rows", "Drop fully-blank rows", 5, "drop", dropped, "dropped")
    return df


def _r_normalise_dates(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    from .gold_data import _parse_dates
    date_candidates = [c for c in df.columns if "date" in c.lower()]
    fixed = 0
    for c in date_candidates:
        before = df[c].copy()
        df[c] = _parse_dates(df[c])
        fixed += int(before.notna().sum() - df[c].notna().sum() < 0 and 1 or 0)
    if date_candidates:
        r.record("universal.normalise_date_format", "Normalise date format", 5, "fix",
                 sum(df[c].notna().sum() for c in date_candidates),
                 "parsed to datetime", details={"columns": date_candidates})
    return df


def _r_normalise_numerics(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    numeric_candidates = [c for c in df.columns
                          if any(kw in c.lower() for kw in ("value", "price", "qty", "quantity", "amount"))]
    fixed = 0
    for c in numeric_candidates:
        if df[c].dtype == "object":
            cleaned = pd.to_numeric(
                df[c].astype(str).str.replace(",", "", regex=False).str.replace(" ", ""),
                errors="coerce")
            fixed += int(cleaned.notna().sum())
            df[c] = cleaned
    if fixed:
        r.record("universal.normalise_numeric_format", "Coerce numerics + strip thousand separators",
                 5, "fix", fixed, "coerced", details={"columns": numeric_candidates})
    return df


def _r_normalise_yesno(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    yn_map = {"y": "Yes", "yes": "Yes", "true": "Yes", "1": "Yes",
              "n": "No", "no": "No", "false": "No", "0": "No"}
    fixed = 0
    for c in df.columns:
        if df[c].dtype == "object":
            sample = df[c].dropna().astype(str).str.lower().head(50)
            if len(sample) > 0 and sample.isin(yn_map.keys()).mean() > 0.8:
                df[c] = df[c].astype(str).str.lower().map(yn_map).fillna(df[c])
                fixed += 1
    if fixed:
        r.record("universal.normalise_yes_no", "Standardise Y/N flags to Yes/No", 5, "fix", fixed, "standardised")
    return df


def _r_exact_dup_rows(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        r.record("universal.detect_exact_duplicate_rows", "Drop exact duplicate rows", 7, "drop", dropped, "dropped")
    return df


def _r_period_coverage(df: pd.DataFrame, r: CleansingReport) -> None:
    date_col = next((c for c in ["po_creation_date", "pr_creation_date", "posting_date"]
                     if c in df.columns), None)
    if not date_col:
        return
    valid = pd.to_datetime(df[date_col], errors="coerce").dropna()
    if valid.empty:
        return
    span_days = (valid.max() - valid.min()).days
    sev = "warn" if span_days < 90 else "info"
    r.record("universal.detect_period_coverage", "Detect period coverage", 7, sev, 0,
             "measured", details={
                 "date_min": str(valid.min().date()),
                 "date_max": str(valid.max().date()),
                 "span_days": int(span_days),
                 "rows": int(len(valid)),
             })


# --- PO procurement rules ---

def _r_dedup_vendors(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    from .gold_data import _dedup_vendors
    before_unique = df["vendor_id"].nunique() if "vendor_id" in df.columns else 0
    df = _dedup_vendors(df)
    if "canonical_vendor_name" in df.columns:
        canon_unique = df["canonical_vendor_name"].nunique()
        collapsed = before_unique - canon_unique
        r.record("procurement.vendor_dedup_semantic",
                 "Vendor dedup via canonical-name normalisation",
                 8, "fix", max(collapsed, 0), "deduped",
                 details={"raw_vendor_ids": before_unique,
                          "canonical_names": canon_unique})
    return df


def _r_normalise_currency_inr(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    from .gold_data import _normalise_currency_to_inr
    df = _normalise_currency_to_inr(df)
    if "net_value_inr" in df.columns:
        nonzero = int((df["net_value_inr"] > 0).sum())
        r.record("procurement.po_value_currency_normalised",
                 "Normalise PO net value to INR",
                 8, "fix", nonzero, "added net_value_inr column")
    return df


def _r_tag_negative_values(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    from .gold_data import _tag_negative_values
    df = _tag_negative_values(df)
    if "po_status_inferred" in df.columns:
        n = int((df["po_status_inferred"] == "cancellation_or_return").sum())
        if n:
            r.record("procurement.po_negative_value_handling",
                     "Tag negative net value as cancellation/return",
                     8, "warn", n, "tagged")
    return df


def _r_detect_duplicate_lines(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "po_number" not in df.columns or "po_item" not in df.columns:
        return df
    dup_mask = df.duplicated(subset=["po_number", "po_item"], keep=False)
    n = int(dup_mask.sum())
    if n:
        r.record("procurement.po_duplicate_line_detection",
                 "Detect duplicate (PO, line-item) combinations",
                 8, "warn", n, "flagged",
                 details={"sample": df.loc[dup_mask, ["po_number", "po_item"]].head(5).astype(str).to_dict(orient="records")})
    return df


def _r_detect_pac_in_short_text(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "short_text" not in df.columns:
        return df
    pac_keywords = ("PAC", "PROPRIETARY", "OEM ONLY", "SOLE SOURCE", "SINGLE SOURCE")
    short = df["short_text"].astype(str).str.upper()
    mask = pd.Series(False, index=df.index)
    for kw in pac_keywords:
        mask = mask | short.str.contains(kw, regex=False, na=False)
    n = int(mask.sum())
    if n:
        df["pac_keyword_detected"] = mask
        r.record("procurement.short_text_pac_detection",
                 "Detect PAC / proprietary / sole-source keywords in short_text",
                 8, "info", n, "tagged column pac_keyword_detected")
    return df


def _r_drop_missing_required(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    before = len(df)
    for col in ["po_number", "material_group", "net_value", "vendor_id", "plant"]:
        if col in df.columns:
            df = df.dropna(subset=[col])
    dropped = before - len(df)
    if dropped:
        r.record("universal.empty_required_field",
                 "Drop rows missing required PO keys (po_number / MG / net_value / vendor / plant)",
                 8, "drop", dropped, "dropped")
    return df.reset_index(drop=True)


# --- PR rules ---

def _r_drop_missing_required_pr(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    before = len(df)
    for col in ["pr_number", "pr_item", "pr_creation_date"]:
        if col in df.columns:
            df = df.dropna(subset=[col])
    dropped = before - len(df)
    if dropped:
        r.record("universal.empty_required_field",
                 "Drop PR rows missing required keys",
                 8, "drop", dropped, "dropped")
    return df.reset_index(drop=True)


# --- Vendor Master ---

def _r_dedup_vendor_master(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "vendor_id" not in df.columns:
        return df
    before = len(df)
    df = df.drop_duplicates(subset=["vendor_id"], keep="first").reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        r.record("procurement.vendor_master_dedup",
                 "Drop duplicate vendor_ids in master",
                 8, "drop", dropped, "dropped")
    return df


# --- Material Master ---

def _r_detect_duplicate_materials(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "material_description" not in df.columns:
        return df
    dups = df.duplicated(subset=["material_description"], keep=False)
    n = int(dups.sum())
    if n:
        r.record("procurement.material_master_dup_description",
                 "Detect duplicate material descriptions (different codes)",
                 8, "warn", n, "flagged")
    return df
