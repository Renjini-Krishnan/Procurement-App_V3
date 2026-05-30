"""Stage 8 — Gold Data transformations.

Takes the raw uploaded PO DataFrame + confirmed column mapping and produces
a clean canonical-named DataFrame ready for analysis:
  - Renames columns to canonical fields (po_number, net_value, etc.)
  - Parses dates
  - Normalises currency to INR
  - Deduplicates vendors semantically
  - Tags negative-value rows
  - Drops rows missing required fields
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

import pandas as pd

from ..services import upload_service


# Fixed FX rates for V1 (RBI reference rates approx 2024-2025 avg).
# Production: pull from an fx_rates table refreshed daily.
FX_RATES_TO_INR = {
    "INR": 1.0,
    "USD": 83.0,
    "EUR": 90.0,
    "GBP": 104.0,
    "AED": 22.6,
    "SGD": 62.0,
    "JPY": 0.55,
    "CNY": 11.5,
    "AUD": 54.0,
    "ZAR": 4.5,
}


def build_gold_dataframe(upload_id: str, lookback_months: Optional[int] = None) -> pd.DataFrame:
    """Backwards-compatible wrapper around build_gold_dataframe_with_report."""
    df, _report = build_gold_dataframe_with_report(upload_id, lookback_months=lookback_months)
    return df


def build_gold_dataframe_with_report(upload_id: str, lookback_months: Optional[int] = None):
    """Apply canonical mapping + cleanse via the rule-tracking engine.

    lookback_months: if set, drops rows where po_creation_date (or
        pr_creation_date for PR uploads) is older than today - months.
        Honours scope.lookback_months from Stage 2.

    Returns (gold_df, cleansing_report_dict).
    """
    upload = upload_service.get_upload(upload_id)
    if not upload:
        raise ValueError(f"Upload {upload_id} not found")

    df_raw = upload_service.read_upload_dataframe(upload_id)
    mapping_state = upload.get("column_mapping") or {}
    confirmed = mapping_state.get("confirmed") or mapping_state.get("suggested")
    if not confirmed:
        raise ValueError(f"No column mapping confirmed for upload {upload_id}")

    rename_map = {}
    for m in confirmed:
        raw = m.get("raw_column")
        canonical = m.get("canonical_field") or m.get("suggested_field")
        if raw and canonical:
            rename_map[raw] = canonical

    df = df_raw.rename(columns=rename_map).copy()
    canonical_cols = [c for c in set(rename_map.values()) if c in df.columns]
    df = df.loc[:, canonical_cols]
    if df.columns.duplicated().any():
        df = df.loc[:, ~df.columns.duplicated()]

    df = _coerce_types(df)

    # Run cleansing engine (rule-tracking) — uses primitives below.
    from . import cleansing_engine
    file_type = upload.get("file_type", "PO")
    df, report = cleansing_engine.apply_pipeline(df, file_type=file_type)

    # Stage 8 Gold enrichment — adds derived columns (po_type_inferred,
    # is_capex, is_pac, is_emergency, approver_tier). Bronze = cleansed;
    # Gold = cleansed + enriched. Skipped for non-PO file_types.
    from . import gold_enrichment
    df, enrichment_report = gold_enrichment.apply_enrichment(df, file_type=file_type)
    for e in enrichment_report.entries:
        rows_affected = sum(v for v in e.get("counts", {}).values() if isinstance(v, int))
        action = (f"added column: {e['column_added']}" if e.get("column_added")
                   else "skipped (see details.reason)")
        report.record(rule_id=e["rule_id"], rule_name=e["rule_name"],
                       stage=8, severity=e["severity"],
                       rows_affected=rows_affected, action=action,
                       details={**e.get("details", {}), "counts": e["counts"],
                                 "column_added": e.get("column_added")})

    # Apply Stage-2 lookback filter AFTER cleansing (dates are coerced now)
    if lookback_months and lookback_months > 0:
        date_col = next((c for c in ("po_creation_date", "pr_creation_date", "posting_date")
                           if c in df.columns), None)
        if date_col:
            from datetime import datetime, timedelta
            cutoff = datetime.utcnow() - timedelta(days=int(lookback_months) * 30)
            before = len(df)
            dates = pd.to_datetime(df[date_col], errors="coerce")
            df = df[dates >= cutoff].reset_index(drop=True)
            dropped = before - len(df)
            report.record(
                rule_id="scope.lookback_window",
                rule_name=f"Stage 2 lookback filter — keep last {lookback_months} months",
                stage=7, severity="drop", rows_affected=dropped,
                action=f"kept rows >= {cutoff.date().isoformat()} ({date_col})",
                details={"lookback_months": lookback_months, "cutoff": cutoff.date().isoformat(),
                         "date_column": date_col, "kept": len(df), "dropped": dropped},
            )

    return df.reset_index(drop=True), {
        "entries": report.entries,
        "summary": report.summary(),
    }


# --------------------------------------------------------------------------
# Type coercion
# --------------------------------------------------------------------------

def _coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    if "po_creation_date" in df.columns:
        df["po_creation_date"] = _parse_dates(df["po_creation_date"])
    if "net_value" in df.columns:
        df["net_value"] = pd.to_numeric(df["net_value"], errors="coerce")
    if "quantity" in df.columns:
        df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    for c in ["po_number", "material_group", "vendor_id", "plant", "currency",
              "material_group_desc", "short_text", "contract_number",
              "outline_agreement", "scheduling_agreement", "item_category",
              "material_type", "purchase_group", "cost_center", "vendor_name", "uom"]:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip()
            df[c] = df[c].replace({"nan": "", "None": ""})
    return df


def _parse_dates(s: pd.Series) -> pd.Series:
    """Try multiple common date formats; fall back to pandas inference."""
    # Try dd-mm-yyyy first (Indian default)
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            parsed = pd.to_datetime(s, format=fmt, errors="raise")
            return parsed
        except Exception:
            continue
    return pd.to_datetime(s, errors="coerce", dayfirst=True)


# --------------------------------------------------------------------------
# Vendor dedup
# --------------------------------------------------------------------------

_SUFFIXES = re.compile(
    r"\b(pvt\s*\.?\s*ltd|private\s+limited|ltd\.?|limited|inc|inc\.|corporation|"
    r"corp\.?|llc|llp|industries|inds\.?|company|co\.?|group|enterprises|"
    r"holdings|international|intl|global)\b",
    re.IGNORECASE,
)


def _normalise_vendor_name(name: str) -> str:
    if not name:
        return ""
    # Strip accents + lowercase
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = name.lower()
    # Remove suffixes
    name = _SUFFIXES.sub("", name)
    # Collapse non-alnum
    name = re.sub(r"[^a-z0-9]+", "", name)
    return name


def _dedup_vendors(df: pd.DataFrame) -> pd.DataFrame:
    if "vendor_name" not in df.columns:
        return df
    df = df.copy()
    df["vendor_name_normalised"] = df["vendor_name"].apply(_normalise_vendor_name)
    # If vendor_id present, also use it as a stable key
    if "vendor_id" in df.columns:
        # Map: vendor_id -> canonical_vendor_name (mode of vendor_name per id)
        canonical_by_id = (
            df.groupby("vendor_id")["vendor_name"]
            .agg(lambda s: s.mode().iloc[0] if not s.mode().empty else s.iloc[0])
            .to_dict()
        )
        df["canonical_vendor_name"] = df["vendor_id"].map(canonical_by_id)
    else:
        df["canonical_vendor_name"] = df["vendor_name"]
    return df


# --------------------------------------------------------------------------
# Currency normalisation
# --------------------------------------------------------------------------

def _normalise_currency_to_inr(df: pd.DataFrame) -> pd.DataFrame:
    if "net_value" not in df.columns:
        return df
    df = df.copy()
    if "currency" in df.columns:
        rates = df["currency"].map(lambda c: FX_RATES_TO_INR.get(c, 1.0)).fillna(1.0)
        df["net_value_inr"] = df["net_value"] * rates
        df["fx_rate_applied"] = rates
    else:
        df["net_value_inr"] = df["net_value"]
        df["fx_rate_applied"] = 1.0
    return df


# --------------------------------------------------------------------------
# Negative value tagging
# --------------------------------------------------------------------------

def _tag_negative_values(df: pd.DataFrame) -> pd.DataFrame:
    if "net_value_inr" not in df.columns:
        return df
    df = df.copy()
    df["po_status_inferred"] = df["net_value_inr"].apply(
        lambda v: "cancellation_or_return" if pd.notna(v) and v < 0 else "active"
    )
    return df


# --------------------------------------------------------------------------
# Summary (for QA report / display)
# --------------------------------------------------------------------------

def summarise(df: pd.DataFrame) -> dict:
    """Return a high-level summary of the gold DataFrame."""
    out: dict = {
        "row_count": len(df),
        "po_count": int(df["po_number"].nunique()) if "po_number" in df.columns else None,
        "mg_count": int(df["material_group"].nunique()) if "material_group" in df.columns else None,
        "vendor_count": int(df["vendor_id"].nunique()) if "vendor_id" in df.columns else None,
        "plant_count": int(df["plant"].nunique()) if "plant" in df.columns else None,
        "total_spend_inr": float(df["net_value_inr"].sum()) if "net_value_inr" in df.columns else None,
    }
    if "po_creation_date" in df.columns:
        valid = df["po_creation_date"].dropna()
        if len(valid):
            out["date_min"] = str(valid.min().date())
            out["date_max"] = str(valid.max().date())
            out["months_span"] = int(((valid.max() - valid.min()).days // 30) + 1)
    if "po_status_inferred" in df.columns:
        out["cancellation_count"] = int((df["po_status_inferred"] == "cancellation_or_return").sum())
    # Gold-enrichment surfacing
    if "po_type_inferred" in df.columns:
        out["po_type_breakdown"] = {
            str(k): int(v) for k, v in df["po_type_inferred"].value_counts().items()
        }
    if "is_capex" in df.columns:
        out["capex_po_count"] = int(df["is_capex"].sum())
    if "is_pac" in df.columns:
        out["pac_po_count"] = int(df["is_pac"].sum())
    if "is_emergency" in df.columns:
        out["emergency_po_count"] = int(df["is_emergency"].sum())
    if "approver_tier" in df.columns:
        tier_counts = df["approver_tier"].value_counts(dropna=True).to_dict()
        out["approver_tier_breakdown"] = {str(int(k)): int(v) for k, v in tier_counts.items()}
    return out
