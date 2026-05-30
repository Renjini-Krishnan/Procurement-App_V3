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


# ============================================================================
# Cross-file recon — joins between PO / PR / GRN / Invoice / Vendor / Contract
# Each rule takes a dict of {file_type: dataframe} (only those uploaded) +
# the shared report. Designed to NEVER raise — missing inputs are skipped.
# ============================================================================

def apply_cross_file_recon(dfs: dict[str, pd.DataFrame]) -> CleansingReport:
    """Run every cross-file rule that has its inputs present."""
    report = CleansingReport()
    _x_pr_po_join(dfs, report)
    _x_po_grn_chain(dfs, report)
    _x_po_invoice_chain(dfs, report)
    _x_grn_invoice_chain(dfs, report)
    _x_vendor_existence_in_master(dfs, report)
    _x_contract_po_linkage(dfs, report)
    _x_material_existence_in_master(dfs, report)
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

# Engine emits but no YAML entry
_ENGINE_ONLY: list[dict] = [
    {"rule_id": "procurement.vendor_master_dedup",        "note": "Vendor Master branch"},
    {"rule_id": "procurement.material_master_dup_description", "note": "Material Master branch"},
    {"rule_id": "procurement.po_grn_chain_coverage",      "note": "cross-file recon"},
    {"rule_id": "procurement.po_invoice_chain_coverage",  "note": "cross-file recon"},
    {"rule_id": "procurement.grn_invoice_three_way_match", "note": "cross-file recon"},
    {"rule_id": "scope.lookback_window",                  "note": "Stage 2 lookback filter"},
    {"rule_id": "summary.row_count",                      "note": "final delta summary"},
]


def get_rule_audit() -> dict:
    """Returns the KB-vs-engine implementation audit map. Stage 7 surfaces
    this so consultants see the honest gap between documented and wired."""
    by_stat: dict[str, int] = {}
    for v in _AUDIT.values():
        by_stat[v["stat"]] = by_stat.get(v["stat"], 0) + 1
    return {
        "yaml_rules": _AUDIT,
        "engine_only": _ENGINE_ONLY,
        "totals": {
            "yaml_rules_total": len(_AUDIT),
            "engine_only_total": len(_ENGINE_ONLY),
            "by_status": by_stat,
        },
    }
