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


def build_gold_dataframe(upload_id: str) -> pd.DataFrame:
    """Apply canonical mapping + cleanse + return gold DataFrame."""
    upload = upload_service.get_upload(upload_id)
    if not upload:
        raise ValueError(f"Upload {upload_id} not found")

    df_raw = upload_service.read_upload_dataframe(upload_id)
    mapping_state = upload.get("column_mapping") or {}
    confirmed = mapping_state.get("confirmed") or mapping_state.get("suggested")
    if not confirmed:
        raise ValueError(f"No column mapping confirmed for upload {upload_id}")

    # raw_column -> canonical_field
    rename_map = {}
    for m in confirmed:
        raw = m.get("raw_column")
        canonical = m.get("canonical_field") or m.get("suggested_field")
        if raw and canonical and canonical in df_raw.columns is False:
            rename_map[raw] = canonical
        elif raw and canonical:
            rename_map[raw] = canonical

    df = df_raw.rename(columns=rename_map).copy()
    # Drop unmapped raw columns + collapse any duplicate canonical names
    canonical_cols = [c for c in set(rename_map.values()) if c in df.columns]
    df = df.loc[:, canonical_cols]
    # If duplicate column labels emerged from the rename (rare: two raw columns
    # mapped to the same canonical), keep the first occurrence
    if df.columns.duplicated().any():
        df = df.loc[:, ~df.columns.duplicated()]

    # Type coercion
    df = _coerce_types(df)

    # Vendor dedup (canonical_vendor_name)
    df = _dedup_vendors(df)

    # Currency normalisation
    df = _normalise_currency_to_inr(df)

    # Negative value tagging
    df = _tag_negative_values(df)

    # Drop rows with missing required keys
    for col in ["po_number", "material_group", "net_value", "vendor_id", "plant"]:
        if col in df.columns:
            df = df.dropna(subset=[col])

    return df.reset_index(drop=True)


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
    return out
