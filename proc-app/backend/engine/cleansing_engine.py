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
        df = _r_detect_future_po_dates(df, report)
        df = _r_detect_very_old_po_dates(df, report)
        df = _r_detect_qty_price_value_mismatch(df, report)
        df = _r_detect_unit_price_zero_qty_positive(df, report)
        df = _r_detect_duplicate_po_ids(df, report)
        df = _r_detect_vendor_concentration(df, report)
        df = _r_detect_split_purchasing(df, report)
        df = _r_drop_missing_required(df, report)
    elif file_type == "PR":
        df = _r_drop_missing_required_pr(df, report)
    elif file_type in ("VENDOR_MASTER",):
        df = _r_dedup_vendor_master(df, report)
        df = _r_validate_gstin(df, report)
        df = _r_validate_pan(df, report)
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


# ============================================================================
# PO Dump anomalies (from po-dump-cleansing-spec.md)
# ============================================================================

def _r_detect_future_po_dates(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "po_creation_date" not in df.columns: return df
    from datetime import datetime
    dates = pd.to_datetime(df["po_creation_date"], errors="coerce")
    today = pd.Timestamp(datetime.utcnow().date())
    future = int((dates > today).sum())
    if future:
        r.record("procurement.po_date_in_future",
                 "PO date is in the future (data entry error or forward-dated)",
                 7, "warn", future, "flagged",
                 details={"future_dated_po_rows": future,
                          "cutoff_today": str(today.date())})
    return df


def _r_detect_very_old_po_dates(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "po_creation_date" not in df.columns: return df
    from datetime import datetime, timedelta
    dates = pd.to_datetime(df["po_creation_date"], errors="coerce")
    cutoff = pd.Timestamp(datetime.utcnow().date() - timedelta(days=365 * 10))
    old = int((dates < cutoff).sum())
    if old:
        r.record("procurement.po_date_older_than_10y",
                 "PO date older than 10 years (legacy data, may be migration artefact)",
                 7, "info", old, "flagged",
                 details={"legacy_po_rows": old,
                          "cutoff_date": str(cutoff.date())})
    return df


def _r_detect_qty_price_value_mismatch(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    """po_value should equal quantity × unit_price within ~5% (allowing for tax/discount)."""
    cols = ("quantity", "net_price", "net_value")
    if not all(c in df.columns for c in cols): return df
    q = pd.to_numeric(df["quantity"], errors="coerce")
    p = pd.to_numeric(df["net_price"], errors="coerce")
    v = pd.to_numeric(df["net_value"], errors="coerce")
    expected = q * p
    # Skip rows where any input is null/zero (can't compute ratio meaningfully)
    mask_valid = (q.notna() & p.notna() & v.notna() & (expected.abs() > 0))
    diff_pct = (v[mask_valid] - expected[mask_valid]).abs() / expected[mask_valid].abs()
    mismatch = int((diff_pct > 0.05).sum())
    if mismatch:
        r.record("procurement.qty_price_value_mismatch",
                 "PO value does not equal quantity × unit price (>5% deviation)",
                 8, "warn", mismatch, "flagged",
                 details={"mismatch_rows": mismatch,
                          "tolerance_pct": 5.0,
                          "checked_rows": int(mask_valid.sum())})
    return df


def _r_detect_unit_price_zero_qty_positive(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if not all(c in df.columns for c in ("quantity", "net_price")): return df
    q = pd.to_numeric(df["quantity"], errors="coerce")
    p = pd.to_numeric(df["net_price"], errors="coerce")
    n = int(((q > 0) & (p == 0)).sum())
    if n:
        r.record("procurement.unit_price_zero_qty_positive",
                 "Unit price is zero but quantity > 0 (free issue or data error)",
                 8, "warn", n, "flagged",
                 details={"affected_rows": n})
    return df


def _r_detect_duplicate_po_ids(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    """Distinct from po_duplicate_line_detection: same po_number across rows
    (could be legitimate multi-line PO OR fully duplicated POs)."""
    if "po_number" not in df.columns: return df
    counts = df["po_number"].dropna().value_counts()
    fully_duplicated = counts[counts > 1]
    if len(fully_duplicated) == 0: return df
    # Subtract legitimate multi-line by checking po_item if present
    if "po_item" in df.columns:
        sig = df["po_number"].astype(str) + "|" + df["po_item"].astype(str)
        line_dups = int(sig.duplicated().sum())
    else:
        line_dups = 0
    r.record("procurement.po_id_repeats",
             "PO number appears in multiple rows (multi-line OR duplicate)",
             7, "info", int(fully_duplicated.sum() - len(fully_duplicated)),
             f"{len(fully_duplicated):,} POs span multiple rows; {line_dups:,} exact line dups",
             details={"distinct_pos_with_multiple_rows": int(len(fully_duplicated)),
                      "total_extra_rows": int(fully_duplicated.sum() - len(fully_duplicated)),
                      "exact_line_dups": line_dups})
    return df


def _r_detect_vendor_concentration(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if not all(c in df.columns for c in ("vendor_id", "net_value")): return df
    v = pd.to_numeric(df["net_value"], errors="coerce").fillna(0)
    total = float(v.sum())
    if total <= 0: return df
    by_v = pd.DataFrame({"vid": df["vendor_id"], "v": v}).groupby("vid")["v"].sum().sort_values(ascending=False)
    top_share = float(by_v.iloc[0] / total) if len(by_v) else 0.0
    if top_share > 0.50:
        r.record("procurement.single_vendor_concentration_high",
                 "Single vendor exceeds 50% of total PO spend (concentration risk)",
                 8, "warn", 1,
                 f"top vendor share = {top_share*100:.1f}%",
                 details={"top_vendor": str(by_v.index[0]),
                          "top_vendor_share_pct": round(top_share * 100, 1),
                          "top_vendor_spend_inr": float(by_v.iloc[0]),
                          "total_spend_inr": total})
    return df


def _r_detect_split_purchasing(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    """Same vendor + same material_group, multiple POs within 30 days,
    aggregate value above a threshold (potential threshold-evasion pattern)."""
    needed = ("vendor_id", "material_group", "po_creation_date", "net_value")
    if not all(c in df.columns for c in needed): return df
    d = df.copy()
    d["_dt"] = pd.to_datetime(d["po_creation_date"], errors="coerce")
    d = d.dropna(subset=["_dt", "vendor_id", "material_group"])
    if len(d) == 0: return df
    d["_v"] = pd.to_numeric(d["net_value"], errors="coerce").fillna(0)
    # Aggregate per vendor+material_group+30-day-window
    clusters_found = 0
    sample = []
    for (vid, mg), grp in d.groupby(["vendor_id", "material_group"]):
        if len(grp) < 3: continue
        grp = grp.sort_values("_dt")
        # Rolling 30-day count
        dt = grp["_dt"].values
        v = grp["_v"].values
        for i in range(len(grp)):
            window_end = dt[i]
            window_start = window_end - pd.Timedelta(days=30)
            mask = (dt >= window_start) & (dt <= window_end)
            n_in_window = int(mask.sum())
            v_in_window = float(v[mask].sum())
            if n_in_window >= 4 and v_in_window > 5_000_000:  # 4+ POs, >₹50 L in 30d
                clusters_found += 1
                if len(sample) < 5:
                    sample.append({"vendor_id": str(vid),
                                    "material_group": str(mg),
                                    "po_count_in_window": n_in_window,
                                    "value_in_window_inr": v_in_window,
                                    "window_end": str(pd.Timestamp(window_end).date())})
                break  # one cluster per (vendor, mg) is enough
    if clusters_found:
        r.record("procurement.split_purchasing_pattern",
                 "Potential split-purchasing: same vendor+category, 4+ POs in 30 days, aggregate >₹50 L",
                 8, "warn", clusters_found,
                 f"{clusters_found:,} (vendor, material_group) pairs show split pattern",
                 details={"clusters": clusters_found, "sample": sample,
                          "thresholds": {"min_pos_in_window": 4,
                                          "window_days": 30,
                                          "min_aggregate_inr": 5_000_000}})
    return df


# ============================================================================
# Indian-context rules (from indian-context-rules.yml)
# ============================================================================

_GSTIN_REGEX = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
_PAN_REGEX = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"


def _r_validate_gstin(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "gstin" not in df.columns: return df
    import re as _re
    s = df["gstin"].dropna().astype(str).str.strip().str.upper()
    s = s[s != ""]
    if len(s) == 0: return df
    invalid = int((~s.str.match(_GSTIN_REGEX)).sum())
    if invalid:
        r.record("indian.gstin_format_validation",
                 "GSTIN does not match 15-char format (2-digit state + 10-char PAN + entity + Z + checksum)",
                 8, "warn", invalid, "flagged",
                 details={"invalid_gstin_rows": invalid,
                          "valid_gstin_rows": int(len(s) - invalid),
                          "regex": _GSTIN_REGEX})
    return df


def _r_validate_pan(df: pd.DataFrame, r: CleansingReport) -> pd.DataFrame:
    if "pan" not in df.columns: return df
    s = df["pan"].dropna().astype(str).str.strip().str.upper()
    s = s[s != ""]
    if len(s) == 0: return df
    invalid = int((~s.str.match(_PAN_REGEX)).sum())
    if invalid:
        r.record("indian.pan_format_validation",
                 "PAN does not match 10-char format (AAAAA9999A)",
                 8, "warn", invalid, "flagged",
                 details={"invalid_pan_rows": invalid,
                          "valid_pan_rows": int(len(s) - invalid),
                          "regex": _PAN_REGEX})
    return df


# ============================================================================
# Cross-file recon — joins between PO / PR / GRN / Invoice / Vendor / Contract
# Each rule takes a dict of {file_type: dataframe} (only those uploaded) +
# the shared report. Designed to NEVER raise — missing inputs are skipped.
# ============================================================================

def apply_cross_file_recon(dfs: dict[str, pd.DataFrame]) -> CleansingReport:
    """Run every cross-file rule that has its inputs present."""
    report = CleansingReport()
    _x_pr_po_join(dfs, report)
    _x_pr_po_date_sequence(dfs, report)
    _x_pr_po_value_consistency(dfs, report)
    _x_po_grn_chain(dfs, report)
    _x_po_invoice_chain(dfs, report)
    _x_po_invoice_value_consistency(dfs, report)
    _x_grn_invoice_chain(dfs, report)
    _x_total_spend_consistency(dfs, report)
    _x_vendor_existence_in_master(dfs, report)
    _x_contract_po_linkage(dfs, report)
    _x_material_existence_in_master(dfs, report)
    _x_msme_45_day_payment(dfs, report)
    return report


def _pct(numer: int, denom: int) -> float:
    return round(100.0 * numer / denom, 1) if denom else 0.0


def _x_pr_po_join(dfs, r):
    """procurement.pr_po_join_via_reference — what share of POs have a
    PR_Reference that maps to a real PR? And what share of PRs were
    converted to a PO?"""
    po, pr = dfs.get("PO"), dfs.get("PR")
    if po is None or pr is None: return
    if "pr_reference" not in po.columns or "pr_number" not in pr.columns: return
    po_refs = po["pr_reference"].dropna().astype(str).str.strip()
    pr_keys = set(pr["pr_number"].dropna().astype(str).str.strip())
    po_refs_nonblank = po_refs[po_refs != ""]
    orphan_pos = int((~po_refs_nonblank.isin(pr_keys)).sum())
    blank_refs = int((po_refs.str.len() == 0).sum() + (len(po) - len(po_refs)))
    converted_pr_count = int(po_refs_nonblank.isin(pr_keys).sum())
    pr_conversion_rate = _pct(len(set(po_refs_nonblank) & pr_keys), len(pr_keys))
    severity = "warn" if orphan_pos > 0 else "info"
    r.record("procurement.pr_po_join_via_reference",
             "PR → PO linkage via PR_Reference",
             8, severity, orphan_pos,
             f"{orphan_pos:,} POs reference a PR not present in PR file; PR→PO conversion {pr_conversion_rate}%",
             details={"orphan_po_rows": orphan_pos, "blank_pr_ref_rows": blank_refs,
                      "linked_po_rows": converted_pr_count,
                      "pr_conversion_rate_pct": pr_conversion_rate,
                      "total_po_rows": int(len(po)), "total_pr_rows": int(len(pr))})


def _x_po_grn_chain(dfs, r):
    """What share of POs have at least one GRN posted against them?"""
    po, grn = dfs.get("PO"), dfs.get("GRN")
    if po is None or grn is None: return
    if "po_number" not in po.columns or "po_number" not in grn.columns: return
    po_keys = set(po["po_number"].dropna().astype(str).str.strip())
    grn_pos = set(grn["po_number"].dropna().astype(str).str.strip())
    received = po_keys & grn_pos
    no_grn = po_keys - grn_pos
    coverage_pct = _pct(len(received), len(po_keys))
    severity = "warn" if coverage_pct < 80 else "info"
    r.record("procurement.po_grn_chain_coverage",
             "PO → GRN coverage (receipt linkage)",
             8, severity, len(no_grn),
             f"{len(no_grn):,} POs have no GRN posted; receipt coverage {coverage_pct}%",
             details={"po_with_grn": len(received), "po_without_grn": len(no_grn),
                      "coverage_pct": coverage_pct,
                      "total_po_distinct": len(po_keys), "total_grn_rows": int(len(grn))})


def _x_po_invoice_chain(dfs, r):
    """What share of POs have at least one invoice posted against them?"""
    po, inv = dfs.get("PO"), dfs.get("INVOICE")
    if po is None or inv is None: return
    if "po_number" not in po.columns or "po_number" not in inv.columns: return
    po_keys = set(po["po_number"].dropna().astype(str).str.strip())
    inv_pos = set(inv["po_number"].dropna().astype(str).str.strip())
    invoiced = po_keys & inv_pos
    no_inv = po_keys - inv_pos
    coverage_pct = _pct(len(invoiced), len(po_keys))
    severity = "warn" if coverage_pct < 80 else "info"
    r.record("procurement.po_invoice_chain_coverage",
             "PO → Invoice coverage (billing linkage)",
             8, severity, len(no_inv),
             f"{len(no_inv):,} POs have no invoice; invoicing coverage {coverage_pct}%",
             details={"po_with_invoice": len(invoiced), "po_without_invoice": len(no_inv),
                      "coverage_pct": coverage_pct,
                      "total_po_distinct": len(po_keys), "total_invoice_rows": int(len(inv))})


def _x_grn_invoice_chain(dfs, r):
    """GRN posted before / without invoice — three-way match gap."""
    grn, inv = dfs.get("GRN"), dfs.get("INVOICE")
    if grn is None or inv is None: return
    if "po_number" not in grn.columns or "po_number" not in inv.columns: return
    grn_pos = set(grn["po_number"].dropna().astype(str).str.strip())
    inv_pos = set(inv["po_number"].dropna().astype(str).str.strip())
    grn_without_inv = grn_pos - inv_pos
    inv_without_grn = inv_pos - grn_pos
    severity = "warn" if (grn_without_inv or inv_without_grn) else "info"
    total_rows = len(grn_without_inv) + len(inv_without_grn)
    r.record("procurement.grn_invoice_three_way_match",
             "GRN ↔ Invoice three-way-match gap",
             8, severity, total_rows,
             f"{len(grn_without_inv):,} GRN POs lack invoices · {len(inv_without_grn):,} invoiced POs lack GRN",
             details={"grn_without_invoice": len(grn_without_inv),
                      "invoice_without_grn": len(inv_without_grn)})


def _x_vendor_existence_in_master(dfs, r):
    """universal.cross_file_id_check (vendor) — PO vendor_ids that don't
    appear in Vendor Master."""
    po, vm = dfs.get("PO"), dfs.get("VENDOR_MASTER")
    if po is None or vm is None: return
    if "vendor_id" not in po.columns or "vendor_id" not in vm.columns: return
    po_vendors = set(po["vendor_id"].dropna().astype(str).str.strip())
    master_vendors = set(vm["vendor_id"].dropna().astype(str).str.strip())
    orphans = po_vendors - master_vendors
    coverage_pct = _pct(len(po_vendors & master_vendors), len(po_vendors))
    severity = "warn" if orphans else "info"
    r.record("universal.cross_file_id_check.vendor",
             "Vendor IDs in PO present in Vendor Master",
             8, severity, len(orphans),
             f"{len(orphans):,} vendor_ids in PO not found in Vendor Master; coverage {coverage_pct}%",
             details={"po_vendor_count": len(po_vendors),
                      "master_vendor_count": len(master_vendors),
                      "orphan_vendor_count": len(orphans),
                      "coverage_pct": coverage_pct,
                      "sample_orphans": sorted(list(orphans))[:10]})


def _x_contract_po_linkage(dfs, r):
    """procurement.contract_reference_derivation — what share of PO rows
    reference a contract present in Contract Master?"""
    po, cm = dfs.get("PO"), dfs.get("CONTRACT_MASTER")
    if po is None or cm is None: return
    if "contract_number" not in po.columns or "contract_number" not in cm.columns: return
    po_contracts = po["contract_number"].dropna().astype(str).str.strip()
    po_contracts = po_contracts[po_contracts != ""]
    master_contracts = set(cm["contract_number"].dropna().astype(str).str.strip())
    linked = int(po_contracts.isin(master_contracts).sum())
    orphan = int((~po_contracts.isin(master_contracts)).sum())
    total_po = int(len(po))
    blank = total_po - len(po_contracts)
    coverage_pct = _pct(linked, total_po)
    severity = "warn" if orphan > 0 else "info"
    r.record("procurement.contract_reference_derivation",
             "Contract → PO linkage",
             8, severity, orphan,
             f"{linked:,} of {total_po:,} PO rows linked to a contract ({coverage_pct}%); {orphan:,} orphan refs, {blank:,} blank",
             details={"linked_po_rows": linked, "orphan_po_rows": orphan,
                      "blank_contract_rows": blank, "coverage_pct": coverage_pct,
                      "total_po_rows": total_po,
                      "total_contracts": len(master_contracts)})


def _x_material_existence_in_master(dfs, r):
    """universal.cross_file_id_check (material) — PO material_numbers
    not present in Material Master."""
    po, mm = dfs.get("PO"), dfs.get("MATERIAL_MASTER")
    if po is None or mm is None: return
    if "material_number" not in po.columns or "material_number" not in mm.columns: return
    po_mats = po["material_number"].dropna().astype(str).str.strip()
    po_mats = po_mats[po_mats != ""]
    po_mat_set = set(po_mats)
    master_mats = set(mm["material_number"].dropna().astype(str).str.strip())
    orphans = po_mat_set - master_mats
    coverage_pct = _pct(len(po_mat_set & master_mats), len(po_mat_set))
    severity = "warn" if orphans else "info"
    r.record("universal.cross_file_id_check.material",
             "Material numbers in PO present in Material Master",
             8, severity, len(orphans),
             f"{len(orphans):,} materials in PO not found in Material Master; coverage {coverage_pct}%",
             details={"po_material_count": len(po_mat_set),
                      "master_material_count": len(master_mats),
                      "orphan_material_count": len(orphans),
                      "coverage_pct": coverage_pct,
                      "sample_orphans": sorted(list(orphans))[:10]})


def _x_pr_po_date_sequence(dfs, r):
    """PR.pr_date <= PO.po_date for linked records."""
    po, pr = dfs.get("PO"), dfs.get("PR")
    if po is None or pr is None: return
    if "pr_reference" not in po.columns or "pr_number" not in pr.columns: return
    if "po_creation_date" not in po.columns or "pr_creation_date" not in pr.columns: return
    po_dt = pd.to_datetime(po["po_creation_date"], errors="coerce")
    pr_dt_map = dict(zip(pr["pr_number"].astype(str), pd.to_datetime(pr["pr_creation_date"], errors="coerce")))
    refs = po["pr_reference"].astype(str)
    reverse_dated = 0
    checked = 0
    for ref, pd_dt in zip(refs, po_dt):
        prd = pr_dt_map.get(ref)
        if prd is None or pd.isna(prd) or pd.isna(pd_dt): continue
        checked += 1
        if prd > pd_dt: reverse_dated += 1
    sev = "warn" if reverse_dated > 0 else "info"
    r.record("procurement.pr_po_date_sequence",
             "PR date should be ≤ PO date (reverse-dated PRs suggest post-facto entry)",
             8, sev, reverse_dated,
             f"{reverse_dated:,} of {checked:,} linked PR-PO pairs have PR_date > PO_date",
             details={"reverse_dated": reverse_dated, "checked_pairs": checked})


def _x_pr_po_value_consistency(dfs, r):
    """|PR.pr_total_value - PO.net_value| / PO.net_value > 50% → flag."""
    po, pr = dfs.get("PO"), dfs.get("PR")
    if po is None or pr is None: return
    if not all(c in po.columns for c in ("pr_reference", "net_value")): return
    if not all(c in pr.columns for c in ("pr_number", "pr_total_value")): return
    pr_val_map = dict(zip(pr["pr_number"].astype(str),
                            pd.to_numeric(pr["pr_total_value"], errors="coerce")))
    refs = po["pr_reference"].astype(str)
    po_v = pd.to_numeric(po["net_value"], errors="coerce")
    deviations = 0
    checked = 0
    for ref, pv in zip(refs, po_v):
        prv = pr_val_map.get(ref)
        if prv is None or pd.isna(prv) or pd.isna(pv) or pv == 0: continue
        checked += 1
        if abs(prv - pv) / abs(pv) > 0.50: deviations += 1
    sev = "info" if deviations > 0 else "info"
    if deviations:
        r.record("procurement.pr_po_value_consistency",
                 "PR estimated value differs from PO value by >50% (negotiation impact or wrong linkage)",
                 8, sev, deviations,
                 f"{deviations:,} of {checked:,} linked PR-PO pairs differ by >50%",
                 details={"large_deviations": deviations, "checked_pairs": checked,
                          "tolerance_pct": 50.0})


def _x_po_invoice_value_consistency(dfs, r):
    """|Invoice.gross_amount - PO.net_value| / PO.net_value > 20% → flag."""
    po, inv = dfs.get("PO"), dfs.get("INVOICE")
    if po is None or inv is None: return
    if not all(c in po.columns for c in ("po_number", "net_value")): return
    if not all(c in inv.columns for c in ("po_number", "gross_amount")): return
    po_val_map = (pd.DataFrame({"po": po["po_number"].astype(str),
                                  "v": pd.to_numeric(po["net_value"], errors="coerce")})
                    .groupby("po")["v"].sum().to_dict())
    inv_val_map = (pd.DataFrame({"po": inv["po_number"].astype(str),
                                    "v": pd.to_numeric(inv["gross_amount"], errors="coerce")})
                     .groupby("po")["v"].sum().to_dict())
    shared = set(po_val_map) & set(inv_val_map)
    deviations = 0
    for k in shared:
        pv, iv = po_val_map[k], inv_val_map[k]
        if pd.isna(pv) or pd.isna(iv) or pv == 0: continue
        if abs(iv - pv) / abs(pv) > 0.20: deviations += 1
    if deviations:
        r.record("procurement.po_invoice_value_consistency",
                 "Invoice value differs from PO value by >20% (scope change, billing error, or wrong linkage)",
                 8, "warn", deviations,
                 f"{deviations:,} of {len(shared):,} PO-Invoice pairs differ by >20%",
                 details={"large_deviations": deviations,
                          "checked_pos": len(shared),
                          "tolerance_pct": 20.0})


def _x_total_spend_consistency(dfs, r):
    """|SUM(PO) - SUM(Invoice)| / SUM(PO) > 15% → flag at aggregate level."""
    po, inv = dfs.get("PO"), dfs.get("INVOICE")
    if po is None or inv is None: return
    if "net_value" not in po.columns or "gross_amount" not in inv.columns: return
    po_total = float(pd.to_numeric(po["net_value"], errors="coerce").fillna(0).sum())
    inv_total = float(pd.to_numeric(inv["gross_amount"], errors="coerce").fillna(0).sum())
    if po_total == 0: return
    dev_pct = abs(inv_total - po_total) / abs(po_total) * 100
    sev = "warn" if dev_pct > 15 else "info"
    r.record("procurement.total_spend_consistency",
             "Aggregate PO spend vs Invoice spend",
             8, sev, 1 if dev_pct > 15 else 0,
             f"PO ₹{po_total/1e7:.1f} Cr · Invoice ₹{inv_total/1e7:.1f} Cr · deviation {dev_pct:.1f}%",
             details={"po_total_inr": po_total, "invoice_total_inr": inv_total,
                      "deviation_pct": round(dev_pct, 1), "threshold_pct": 15.0})


def _x_msme_45_day_payment(dfs, r):
    """MSMED Act §15: payments to MSME vendors must clear within 45 days.
    Detect invoices to MSME vendors where payment date > invoice date + 45."""
    vm, inv = dfs.get("VENDOR_MASTER"), dfs.get("INVOICE")
    if vm is None or inv is None: return
    msme_col = None
    for c in ("msme_flag", "is_msme", "msme"):
        if c in vm.columns: msme_col = c; break
    if msme_col is None: return
    if not all(c in inv.columns for c in ("vendor_id", "invoice_date")): return

    msme_vendors = set(
        vm.loc[vm[msme_col].astype(str).str.lower().isin(("true", "yes", "1", "y")),
                "vendor_id"].dropna().astype(str)
    )
    if not msme_vendors: return

    pay_col = next((c for c in ("payment_date", "paid_date", "due_date") if c in inv.columns), None)
    if pay_col is None:
        # Without payment date we cannot compute the lag; record info only
        msme_inv = int(inv["vendor_id"].astype(str).isin(msme_vendors).sum())
        r.record("indian.msme_payment_45_day_compliance",
                 "MSME late-payment check (MSMED Act §15)",
                 8, "info", 0,
                 f"{msme_inv:,} invoices to MSME vendors; payment_date column missing — cannot compute lag",
                 details={"msme_invoice_rows": msme_inv,
                          "msme_vendor_count": len(msme_vendors),
                          "payment_date_column": None})
        return
    inv_d = pd.to_datetime(inv["invoice_date"], errors="coerce")
    pay_d = pd.to_datetime(inv[pay_col], errors="coerce")
    is_msme = inv["vendor_id"].astype(str).isin(msme_vendors)
    lag = (pay_d - inv_d).dt.days
    late = int(((lag > 45) & is_msme).sum())
    total_msme = int(is_msme.sum())
    sev = "warn" if late > 0 else "info"
    r.record("indian.msme_payment_45_day_compliance",
             "MSME late-payment compliance (MSMED Act §15: 45-day mandate)",
             8, sev, late,
             f"{late:,} of {total_msme:,} MSME invoices paid >45 days late",
             details={"late_msme_invoices": late, "total_msme_invoices": total_msme,
                      "msme_vendor_count": len(msme_vendors),
                      "payment_date_column": pay_col, "threshold_days": 45})


# ============================================================================
# Data Quality Score — completeness + validity + consistency formula
# (from data-quality-scoring.yml)
# ============================================================================

# Template weights per the spec (completeness + validity share these weights)
_TEMPLATE_WEIGHTS = {
    "PO": 0.40, "VENDOR_MASTER": 0.15, "MATERIAL_MASTER": 0.10,
    "ORG_STRUCTURE": 0.15, "PR": 0.05, "GRN": 0.05, "INVOICE": 0.05,
    "CONTRACT_MASTER": 0.05,
}


def _band_for_score(score: float) -> dict:
    if score >= 90: return {"band": "HIGH", "color": "green",
                              "interpretation": "Excellent data quality. All pillars run at High confidence."}
    if score >= 75: return {"band": "GOOD", "color": "light_green",
                              "interpretation": "Solid data quality. All pillars run at Medium-High."}
    if score >= 60: return {"band": "ACCEPTABLE", "color": "yellow",
                              "interpretation": "Workable. Some components skip; verdicts directional."}
    if score >= 40: return {"band": "LOW", "color": "orange",
                              "interpretation": "Significant gaps. Recommend data improvement."}
    return {"band": "VERY_LOW", "color": "red",
            "interpretation": "Major data issues. Improvement workshop with client recommended."}


def compute_data_quality_score(per_upload_reports: list[dict],
                                cross_file_report: dict) -> dict:
    """Compute engagement-level data quality score from per-upload cleansing
    summaries + cross-file recon. Per spec:
        score = 0.40 × completeness + 0.30 × validity + 0.30 × consistency"""
    # ---- Completeness: weighted average of rows kept / rows raw per template
    comp_weighted_sum = 0.0; comp_weight_sum = 0.0
    per_template_completeness = {}
    for u in per_upload_reports:
        ft = u.get("file_type")
        w = _TEMPLATE_WEIGHTS.get(ft, 0.0)
        if w == 0 or u.get("_error"): continue
        raw = max(u.get("row_count_raw") or 0, 1)
        kept = u.get("row_count_cleaned") or 0
        c = min(100.0, 100.0 * kept / raw)
        per_template_completeness[ft] = round(c, 1)
        comp_weighted_sum += w * c
        comp_weight_sum += w
    completeness_pct = round(comp_weighted_sum / comp_weight_sum, 1) if comp_weight_sum else 0.0

    # ---- Validity: weighted average per template, derived from rule severities
    # validity[template] = 100 - penalty(drop+warn rows ÷ raw rows)
    val_weighted_sum = 0.0; val_weight_sum = 0.0
    per_template_validity = {}
    for u in per_upload_reports:
        ft = u.get("file_type")
        w = _TEMPLATE_WEIGHTS.get(ft, 0.0)
        if w == 0 or u.get("_error"): continue
        raw = max(u.get("row_count_raw") or 0, 1)
        rep = u.get("cleansing_report") or {}
        entries = rep.get("entries") or []
        # Penalty: dropped rows count fully, warn rows count half
        dropped = sum(e["rows_affected"] for e in entries if e.get("severity") == "drop")
        warned = sum(e["rows_affected"] for e in entries if e.get("severity") == "warn")
        penalty = min(100.0, 100.0 * (dropped + 0.5 * warned) / raw)
        v = max(0.0, 100.0 - penalty)
        per_template_validity[ft] = round(v, 1)
        val_weighted_sum += w * v
        val_weight_sum += w
    validity_pct = round(val_weighted_sum / val_weight_sum, 1) if val_weight_sum else 0.0

    # ---- Consistency: % of cross-file rules that passed (severity != warn/drop)
    x_entries = (cross_file_report or {}).get("entries") or []
    total_x = len(x_entries)
    passed_x = sum(1 for e in x_entries if e.get("severity") == "info")
    consistency_pct = round(100.0 * passed_x / total_x, 1) if total_x else 0.0

    score = round(0.40 * completeness_pct + 0.30 * validity_pct + 0.30 * consistency_pct, 1)
    band = _band_for_score(score)

    return {
        "score": score,
        "band": band["band"],
        "band_color": band["color"],
        "band_interpretation": band["interpretation"],
        "components": {
            "completeness_pct": completeness_pct,
            "validity_pct": validity_pct,
            "consistency_pct": consistency_pct,
        },
        "weights": {"completeness": 0.40, "validity": 0.30, "consistency": 0.30},
        "per_template_completeness": per_template_completeness,
        "per_template_validity": per_template_validity,
        "cross_file_rules_total": total_x,
        "cross_file_rules_passed": passed_x,
    }


# ============================================================================
# Pillar Feasibility Gates
# (from data-quality-scoring.yml → pillar_feasibility)
# ============================================================================

def compute_pillar_feasibility(per_upload_reports: list[dict],
                                 cross_file_report: dict,
                                 dqs: dict) -> dict:
    """Per-pillar feasibility tier (high / medium / low / skip) based on
    template availability + completeness."""
    completeness = dqs.get("per_template_completeness") or {}
    uploaded_types = {u["file_type"] for u in per_upload_reports if not u.get("_error")}

    def tier_for(po_min: int, vm_min: int = 0, mm_min: int = 0,
                  os_min: int = 0, pr_min: int = 0,
                  pr_required: bool = False, grn_or_inv: bool = False) -> str:
        po = completeness.get("PO", 0)
        vm = completeness.get("VENDOR_MASTER", 0)
        mm = completeness.get("MATERIAL_MASTER", 0)
        os_ = completeness.get("ORG_STRUCTURE", 0)
        pr = completeness.get("PR", 0)
        if pr_required and "PR" not in uploaded_types: return "skip"
        ok = (po >= po_min) and (vm >= vm_min) and (mm >= mm_min) \
             and (os_ >= os_min) and (pr >= pr_min)
        if grn_or_inv and not ({"GRN", "INVOICE"} & uploaded_types): return "skip"
        return "ok" if ok else "degrade"

    def gate(name: str, high: dict, medium: dict, low: dict) -> dict:
        """Each tier dict carries the same keys: po_min, vm_min, etc."""
        for tier, params in (("high", high), ("medium", medium), ("low", low)):
            res = tier_for(**params)
            if res == "skip": return {"tier": "skip", "reason": "required template missing"}
            if res == "ok": return {"tier": tier}
        return {"tier": "skip", "reason": "all tiers failed"}

    pillars = {
        "op_model": gate("op_model",
                          {"po_min": 95, "vm_min": 80},
                          {"po_min": 80}, {"po_min": 60}),
        "org_structure": gate("org_structure",
                                {"po_min": 0, "os_min": 90},
                                {"po_min": 0, "os_min": 75},
                                {"po_min": 0, "os_min": 50}),
        "doa": gate("doa",
                     {"po_min": 90}, {"po_min": 75}, {"po_min": 50}),
        "buying_channel": gate("buying_channel",
                                 {"po_min": 90}, {"po_min": 75}, {"po_min": 60}),
        "pr_to_po": gate("pr_to_po",
                          {"po_min": 95, "pr_min": 85, "pr_required": True},
                          {"po_min": 80, "pr_min": 60, "pr_required": True},
                          {"po_min": 60, "pr_min": 50, "pr_required": True}),
        "post_po": gate("post_po",
                         {"po_min": 95, "grn_or_inv": True},
                         {"po_min": 80, "grn_or_inv": True},
                         {"po_min": 60, "grn_or_inv": True}),
        "material_master": gate("material_master",
                                  {"po_min": 0, "mm_min": 90},
                                  {"po_min": 0, "mm_min": 75},
                                  {"po_min": 0, "mm_min": 50}),
        "supplier": gate("supplier",
                          {"po_min": 0, "vm_min": 90},
                          {"po_min": 0, "vm_min": 75},
                          {"po_min": 0, "vm_min": 60}),
    }
    return pillars


# ============================================================================
# KB-vs-engine implementation audit
# ============================================================================

# Maps every YAML rule id to its implementation status.
# stat values: implemented | not_implemented | handled_at_other_stage | subsumed
_AUDIT: dict[str, dict] = {
    # Universal
    "detect_sheet_structure":          {"stat": "not_implemented", "note": "implicit in pandas header parsing"},
    "identify_column_headers":         {"stat": "handled_at_other_stage", "note": "Stage 5/6 column mapping"},
    "strip_header_repetitions":        {"stat": "not_implemented"},
    "strip_totals_rows":               {"stat": "not_implemented"},
    "handle_merged_cells":             {"stat": "not_implemented"},
    "remove_fully_blank_rows":         {"stat": "implemented", "fires_as": "universal.remove_fully_blank_rows"},
    "remove_fully_blank_columns":      {"stat": "not_implemented"},
    "empty_required_field":            {"stat": "implemented", "fires_as": "universal.empty_required_field",
                                         "note": "PO + PR only; VM/MM/GRN/INV/CM/OS skipped"},
    "normalise_date_format":           {"stat": "implemented", "fires_as": "universal.normalise_date_format"},
    "normalise_numeric_format":        {"stat": "implemented", "fires_as": "universal.normalise_numeric_format"},
    "detect_data_type_mismatch":       {"stat": "subsumed", "note": "silent inside _coerce_types"},
    "trim_whitespace":                 {"stat": "implemented", "fires_as": "universal.trim_whitespace"},
    "fix_encoding":                    {"stat": "not_implemented"},
    "normalise_yes_no":                {"stat": "implemented", "fires_as": "universal.normalise_yes_no"},
    "normalise_text_case":             {"stat": "not_implemented"},
    "detect_exact_duplicate_rows":     {"stat": "implemented", "fires_as": "universal.detect_exact_duplicate_rows"},
    "detect_period_coverage":          {"stat": "implemented", "fires_as": "universal.detect_period_coverage"},
    "detect_period_gaps":              {"stat": "not_implemented"},
    "detect_extreme_outliers":         {"stat": "not_implemented"},
    "detect_zero_negative_values":     {"stat": "subsumed", "note": "PO covered by po_negative_value_handling"},
    "cross_file_id_check":             {"stat": "implemented",
                                         "fires_as": "universal.cross_file_id_check.vendor + .material",
                                         "note": "cross-file recon — requires multiple uploads"},
    # Procurement
    "procurement.column_mapping_confirmation":              {"stat": "handled_at_other_stage", "note": "Stage 6"},
    "procurement.entity_classification_via_stage6_mapping": {"stat": "handled_at_other_stage", "note": "Stage 5/6"},
    "procurement.plant_code_mapped_to_canonical":           {"stat": "handled_at_other_stage", "note": "Stage 6 mapping"},
    "procurement.vendor_type_classification_review":        {"stat": "not_implemented"},
    "procurement.org_entity_mapped_to_canonical":           {"stat": "handled_at_other_stage", "note": "Stage 6 mapping"},
    "procurement.org_role_title_canonicalised":             {"stat": "not_implemented"},
    "procurement.date_format_confirmation":                 {"stat": "subsumed", "note": "universal.normalise_date_format"},
    "procurement.currency_default_confirmation":            {"stat": "not_implemented"},
    "procurement.uom_normalisation_review":                 {"stat": "not_implemented"},
    "procurement.vendor_dedup_semantic":                    {"stat": "implemented", "fires_as": "procurement.vendor_dedup_semantic"},
    "procurement.po_value_currency_normalised":             {"stat": "implemented", "fires_as": "procurement.po_value_currency_normalised"},
    "procurement.po_negative_value_handling":               {"stat": "implemented", "fires_as": "procurement.po_negative_value_handling"},
    "procurement.po_duplicate_line_detection":              {"stat": "implemented", "fires_as": "procurement.po_duplicate_line_detection"},
    "procurement.pr_po_join_via_reference":                 {"stat": "implemented",
                                                              "fires_as": "procurement.pr_po_join_via_reference",
                                                              "note": "cross-file recon"},
    "procurement.uom_canonical_mapping":                    {"stat": "not_implemented"},
    "procurement.contract_reference_derivation":            {"stat": "implemented",
                                                              "fires_as": "procurement.contract_reference_derivation",
                                                              "note": "cross-file recon"},
    "procurement.short_text_pac_detection":                 {"stat": "implemented", "fires_as": "procurement.short_text_pac_detection"},
    "procurement.category_aligned_to_industry_taxonomy":    {"stat": "handled_at_other_stage", "note": "Stage 9 archetype mapping"},
}

# Engine emits but no YAML entry (in legacy KB; KB-PART-5 covers most of these)
_ENGINE_ONLY: list[dict] = [
    {"rule_id": "procurement.vendor_master_dedup",        "note": "Vendor Master branch"},
    {"rule_id": "procurement.material_master_dup_description", "note": "Material Master branch"},
    {"rule_id": "procurement.po_grn_chain_coverage",      "note": "cross-file recon"},
    {"rule_id": "procurement.po_invoice_chain_coverage",  "note": "cross-file recon"},
    {"rule_id": "procurement.grn_invoice_three_way_match", "note": "cross-file recon"},
    {"rule_id": "procurement.po_date_in_future",          "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.po_date_older_than_10y",     "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.qty_price_value_mismatch",   "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.unit_price_zero_qty_positive", "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.po_id_repeats",              "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.single_vendor_concentration_high", "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.split_purchasing_pattern",   "note": "PO Dump anomaly (KB-PART-5)"},
    {"rule_id": "procurement.pr_po_date_sequence",        "note": "cross-template-integrity (KB-PART-5)"},
    {"rule_id": "procurement.pr_po_value_consistency",    "note": "cross-template-integrity (KB-PART-5)"},
    {"rule_id": "procurement.po_invoice_value_consistency", "note": "cross-template-integrity (KB-PART-5)"},
    {"rule_id": "procurement.total_spend_consistency",    "note": "cross-template-integrity (KB-PART-5)"},
    {"rule_id": "indian.gstin_format_validation",         "note": "Indian-context (KB-PART-5)"},
    {"rule_id": "indian.pan_format_validation",           "note": "Indian-context (KB-PART-5)"},
    {"rule_id": "indian.msme_payment_45_day_compliance",  "note": "MSMED Act §15 (KB-PART-5)"},
    {"rule_id": "scope.lookback_window",                  "note": "Stage 2 lookback filter"},
    {"rule_id": "summary.row_count",                      "note": "final delta summary"},
]


# KB-PART-5 spec coverage — separate from _AUDIT (legacy YAMLs).
# Tracks the new bundle's rules vs engine implementation.
_KB_PART_5_COVERAGE: dict[str, dict] = {
    # bronze-validation-rules.yml — file-level
    "file_format_supported":             {"stat": "handled_at_other_stage", "note": "Stage 4 upload guard"},
    "file_size_within_limit":            {"stat": "implemented", "note": "MAX_UPLOAD_SIZE_BYTES enforced at Stage 4"},
    "encoding_valid":                    {"stat": "subsumed", "note": "pandas parse failure surfaces at Stage 4"},
    "header_row_present":                {"stat": "subsumed", "note": "pandas header inference"},
    "minimum_row_count":                 {"stat": "not_implemented"},
    "maximum_row_count":                 {"stat": "not_implemented"},
    # bronze cell-level
    "date_parseable":                    {"stat": "implemented", "fires_as": "universal.normalise_date_format"},
    "number_parseable":                  {"stat": "implemented", "fires_as": "universal.normalise_numeric_format"},
    "text_encoding_clean":               {"stat": "not_implemented"},
    "no_html_artefacts":                 {"stat": "not_implemented"},
    # gold-cleansing currency
    "detect_currency_per_row":           {"stat": "implemented", "fires_as": "procurement.po_value_currency_normalised"},
    "convert_to_engagement_default":     {"stat": "implemented", "fires_as": "procurement.po_value_currency_normalised"},
    "indian_lakh_crore_detection":       {"stat": "not_implemented", "note": "documented in kpi-calculation-rules.yml only"},
    "thousands_separator_normalisation": {"stat": "subsumed", "note": "inside _r_normalise_numerics"},
    # gold-cleansing UoM
    "canonicalise_uom":                  {"stat": "not_implemented"},
    "convert_to_base_uom_per_category":  {"stat": "not_implemented"},
    "l_ambiguity_resolution":            {"stat": "not_implemented"},
    # gold-cleansing dates
    "parse_to_iso_date":                 {"stat": "implemented", "fires_as": "universal.normalise_date_format"},
    "detect_excel_serial_dates":         {"stat": "not_implemented"},
    # vendor dedup
    "vendor_name_canonicalisation":      {"stat": "implemented", "fires_as": "procurement.vendor_dedup_semantic",
                                            "note": "current = exact + simple; spec wants fuzzy + GSTIN/PAN priority"},
    "vendor_gstin_validation":           {"stat": "implemented", "fires_as": "indian.gstin_format_validation"},
    "vendor_pan_validation":             {"stat": "implemented", "fires_as": "indian.pan_format_validation"},
    # material dedup
    "material_code_canonicalisation":    {"stat": "implemented", "fires_as": "procurement.material_master_dup_description"},
    "material_description_clean":        {"stat": "not_implemented"},
    # plant + designation
    "plant_code_dictionary_lookup":      {"stat": "not_implemented", "note": "per-engagement dictionary (V2)"},
    "designation_lookup":                {"stat": "not_implemented", "note": "per-engagement dictionary (V2)"},
    "tier_assignment":                   {"stat": "not_implemented"},
    # PO type tagging
    "explicit_po_type_field":            {"stat": "subsumed", "note": "Stage 9 archetype mapping"},
    "derive_po_type_from_category":      {"stat": "handled_at_other_stage", "note": "Stage 9"},
    "pac_detection":                     {"stat": "implemented", "fires_as": "procurement.short_text_pac_detection"},
    "emergency_detection":               {"stat": "not_implemented"},
    # reference enrichment
    "hsn_code_lookup":                   {"stat": "not_implemented"},
    "sac_code_lookup":                   {"stat": "not_implemented"},
    "gst_rate_consistency":              {"stat": "not_implemented"},
    # cross-template integrity
    "po_vendor_id_exists_in_vendor_master":     {"stat": "implemented", "fires_as": "universal.cross_file_id_check.vendor"},
    "vendor_name_consistency_po_vs_master":     {"stat": "not_implemented"},
    "vendor_active_flag_consistency":           {"stat": "not_implemented"},
    "po_material_code_exists_in_material_master": {"stat": "implemented", "fires_as": "universal.cross_file_id_check.material"},
    "po_uom_consistency_with_material_master":  {"stat": "not_implemented"},
    "pr_to_po_linkage":                         {"stat": "implemented", "fires_as": "procurement.pr_po_join_via_reference"},
    "pr_po_date_sequence":                      {"stat": "implemented", "fires_as": "procurement.pr_po_date_sequence"},
    "pr_po_value_consistency":                  {"stat": "implemented", "fires_as": "procurement.pr_po_value_consistency"},
    "po_grn_linkage":                           {"stat": "implemented", "fires_as": "procurement.po_grn_chain_coverage"},
    "grn_quantity_vs_po_quantity":              {"stat": "not_implemented"},
    "po_invoice_linkage":                       {"stat": "implemented", "fires_as": "procurement.po_invoice_chain_coverage"},
    "invoice_value_vs_po_value":                {"stat": "implemented", "fires_as": "procurement.po_invoice_value_consistency"},
    "po_approver_in_org_structure":             {"stat": "not_implemented"},
    "po_buyer_in_org_structure":                {"stat": "not_implemented"},
    "invoice_vendor_consistency":               {"stat": "not_implemented"},
    "total_spend_consistency":                  {"stat": "implemented", "fires_as": "procurement.total_spend_consistency"},
    "vendor_count_reasonableness":              {"stat": "not_implemented"},
    # indian-context GST/MSME/TDS
    "gstin_format_validation":           {"stat": "implemented", "fires_as": "indian.gstin_format_validation"},
    "state_code_in_gstin_matches_address": {"stat": "not_implemented"},
    "gst_rate_validation":               {"stat": "not_implemented"},
    "input_tax_credit_eligibility":      {"stat": "not_implemented"},
    "hsn_code_format":                   {"stat": "not_implemented"},
    "sac_code_format":                   {"stat": "not_implemented"},
    "hsn_for_goods_sac_for_services":    {"stat": "not_implemented"},
    "hsn_completeness_threshold":        {"stat": "not_implemented"},
    "msme_flag_population":              {"stat": "not_implemented"},
    "msme_compliance_payment_within_45_days": {"stat": "implemented", "fires_as": "indian.msme_payment_45_day_compliance"},
    "msme_share_of_vendor_base":         {"stat": "not_implemented"},
    "tds_threshold_check":               {"stat": "not_implemented"},
    "tds_pan_required":                  {"stat": "not_implemented"},
    "inr_primary_default":               {"stat": "subsumed", "note": "engagement.industry == 'steel/cement' implies INR"},
    "rbi_reference_rate_for_fx":         {"stat": "not_implemented", "note": "FX table hard-coded"},
    "cr_lakh_aware_display":             {"stat": "implemented", "note": "frontend _format_inr"},
    "capex_threshold_default":           {"stat": "not_implemented"},
    "capex_indicators":                  {"stat": "not_implemented"},
    # PO Dump spec anomalies
    "po_value_zero_or_negative":         {"stat": "implemented", "fires_as": "procurement.po_negative_value_handling"},
    "po_id_appears_multiple":            {"stat": "implemented", "fires_as": "procurement.po_id_repeats"},
    "po_date_in_future":                 {"stat": "implemented", "fires_as": "procurement.po_date_in_future"},
    "po_date_older_than_10y":            {"stat": "implemented", "fires_as": "procurement.po_date_older_than_10y"},
    "unit_price_zero_qty_positive":      {"stat": "implemented", "fires_as": "procurement.unit_price_zero_qty_positive"},
    "po_value_qty_unitprice_mismatch":   {"stat": "implemented", "fires_as": "procurement.qty_price_value_mismatch"},
    "single_vendor_over_50_share":       {"stat": "implemented", "fires_as": "procurement.single_vendor_concentration_high"},
    "split_purchasing_clustering":       {"stat": "implemented", "fires_as": "procurement.split_purchasing_pattern"},
    # Org Structure spec (V2)
    "designation_canonicalisation_pipeline": {"stat": "not_implemented", "note": "per-engagement dictionary (V2)"},
    "reports_to_repair_to_78pct":           {"stat": "not_implemented", "note": "V2 — current is 60% raw"},
    "role_classification_4step":             {"stat": "not_implemented", "note": "V2"},
    # Quality scoring + feasibility
    "data_quality_score_formula":        {"stat": "implemented", "fires_as": "engine.compute_data_quality_score"},
    "pillar_feasibility_gates":          {"stat": "implemented", "fires_as": "engine.compute_pillar_feasibility"},
    # HITL workflow
    "hitl_audit_trail":                  {"stat": "not_implemented", "note": "V2 — engagement_overrides logs Stage 6 decisions but not in spec format"},
    "blocking_warning_info_severities":  {"stat": "implemented", "note": "engine severities: fix/drop/warn/info"},
}


def get_rule_audit() -> dict:
    """Returns the KB-vs-engine implementation audit map. Stage 7 surfaces
    this so consultants see the honest gap between documented and wired.
    Includes both legacy YAML and KB-PART-5 bundle coverage."""
    by_stat: dict[str, int] = {}
    for v in _AUDIT.values():
        by_stat[v["stat"]] = by_stat.get(v["stat"], 0) + 1
    kb5_by_stat: dict[str, int] = {}
    for v in _KB_PART_5_COVERAGE.values():
        kb5_by_stat[v["stat"]] = kb5_by_stat.get(v["stat"], 0) + 1
    return {
        "yaml_rules": _AUDIT,
        "engine_only": _ENGINE_ONLY,
        "kb_part_5_coverage": _KB_PART_5_COVERAGE,
        "totals": {
            "yaml_rules_total": len(_AUDIT),
            "engine_only_total": len(_ENGINE_ONLY),
            "by_status": by_stat,
            "kb_part_5_total": len(_KB_PART_5_COVERAGE),
            "kb_part_5_by_status": kb5_by_stat,
        },
    }
