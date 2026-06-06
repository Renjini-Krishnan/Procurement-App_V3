"""Stage 10 — Per-MG KPI precomputation.

Aggregates the gold-classified PO DataFrame to per-MG metrics that all
Op Model themes consume:
  - total_spend_inr, spend_share_pct
  - po_count, po_count_6mo, distinct_months
  - avg_po_value, median_po_value
  - vendor_count, top_vendor_spend_share
  - plant_count + per-plant vendor distribution
  - is_contracted, contracted_pct
"""
from __future__ import annotations

from collections import defaultdict
from typing import Optional

import pandas as pd


def precompute_mg_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """One row per material group with all derived metrics."""
    if "material_group" not in df.columns:
        raise ValueError("Gold DataFrame missing material_group column")

    df = df.copy()
    # Active rows only (exclude cancellations/returns from positive-spend rollups)
    active = df[df.get("po_status_inferred", "active") == "active"].copy()

    total_spend = active["net_value_inr"].sum()

    grouped = active.groupby("material_group", dropna=False)

    rows = []
    for mg, g in grouped:
        spend = float(g["net_value_inr"].sum())
        po_count = int(g["po_number"].nunique()) if "po_number" in g else len(g)

        # PO count in any rolling 6-month window
        if "po_creation_date" in g.columns:
            dates = g["po_creation_date"].dropna()
            po_count_6mo = _max_po_count_in_6mo(dates) if len(dates) else 0
            distinct_months = int(dates.dt.to_period("M").nunique()) if len(dates) else 0
        else:
            po_count_6mo = po_count
            distinct_months = 0

        vendor_counts = g["vendor_id"].value_counts() if "vendor_id" in g.columns else pd.Series([])
        vendor_spend = g.groupby("vendor_id")["net_value_inr"].sum() if "vendor_id" in g.columns else pd.Series([])
        vendor_count = int(vendor_counts.shape[0])
        top_vendor_share = float(vendor_spend.max() / spend) if len(vendor_spend) and spend > 0 else 0.0

        plant_count = int(g["plant"].nunique()) if "plant" in g.columns else 0
        # Plants list + per-plant top vendor
        plants_data = {}
        if "plant" in g.columns and "vendor_id" in g.columns:
            for plant, pg in g.groupby("plant"):
                pv = pg.groupby("vendor_id")["net_value_inr"].sum()
                top = pv.idxmax() if len(pv) else None
                plants_data[plant] = {
                    "top_vendor": top,
                    "top_vendor_share": float(pv.max() / pg["net_value_inr"].sum()) if pg["net_value_inr"].sum() > 0 else 0.0,
                    "vendor_count": int(pg["vendor_id"].nunique()),
                    "spend": float(pg["net_value_inr"].sum()),
                }

        # Contract derivation — count rows where ANY of the three contract-ref fields is non-blank
        def _nonblank(col):
            if col not in g.columns:
                return pd.Series([False] * len(g), index=g.index)
            return g[col].astype(str).str.strip() != ""
        any_contracted = _nonblank("contract_number") | _nonblank("outline_agreement") | _nonblank("scheduling_agreement")
        is_contracted_count = int(any_contracted.sum())
        contracted_pct = float(is_contracted_count / len(g) * 100) if len(g) else 0.0

        # PAC heuristic from short_text
        pac_count = 0
        if "short_text" in g.columns:
            pac_re = g["short_text"].astype(str).str.contains(
                r"PAC|proprietary|OEM|sole.?source|single.?source", case=False, regex=True, na=False
            )
            pac_count = int(pac_re.sum())
        pac_pct = float(pac_count / len(g) * 100) if len(g) else 0.0

        # Description (first non-blank)
        desc = ""
        if "material_group_desc" in g.columns:
            desc_series = g["material_group_desc"].dropna().astype(str)
            desc_series = desc_series[desc_series.str.strip() != ""]
            if len(desc_series):
                desc = desc_series.iloc[0]

        # Archetype (first non-blank — should be uniform per MG after Stage 9)
        archetype = "UNCLASSIFIED"
        if "archetype" in g.columns:
            mode = g["archetype"].mode()
            archetype = str(mode.iloc[0]) if len(mode) else "UNCLASSIFIED"

        rows.append({
            "material_group": mg,
            "material_group_desc": desc,
            "archetype": archetype,
            "total_spend_inr": spend,
            "spend_share_pct": float(spend / total_spend * 100) if total_spend > 0 else 0.0,
            "po_count": po_count,
            "po_count_6mo": po_count_6mo,
            "distinct_months": distinct_months,
            "avg_po_value": float(g["net_value_inr"].mean()) if len(g) else 0.0,
            "median_po_value": float(g["net_value_inr"].median()) if len(g) else 0.0,
            "vendor_count": vendor_count,
            "top_vendor_share_pct": top_vendor_share * 100,
            "plant_count": plant_count,
            "plants_data": plants_data,
            "contracted_pct": contracted_pct,
            "pac_pct": pac_pct,
        })

    out = pd.DataFrame(rows)
    if len(out):
        out = out.sort_values("total_spend_inr", ascending=False).reset_index(drop=True)
    return out


def _max_po_count_in_6mo(dates: pd.Series) -> int:
    """Compute max PO count in any rolling 6-month window."""
    if dates.empty:
        return 0
    sorted_dates = sorted(dates)
    n = len(sorted_dates)
    max_count = 0
    j = 0
    for i in range(n):
        while j < n and (sorted_dates[j] - sorted_dates[i]).days <= 180:
            j += 1
        count = j - i
        if count > max_count:
            max_count = count
    return max_count


def portfolio_summary(df_mg: pd.DataFrame) -> dict:
    """Portfolio-level aggregates (used by all themes)."""
    if df_mg.empty:
        return {}
    return {
        "mg_count": len(df_mg),
        "total_spend_inr": float(df_mg["total_spend_inr"].sum()),
        "total_po_count": int(df_mg["po_count"].sum()),
        "by_archetype": {
            arch: {
                "mg_count": int(len(g)),
                "total_spend_inr": float(g["total_spend_inr"].sum()),
                "spend_share_pct": float(g["total_spend_inr"].sum() / df_mg["total_spend_inr"].sum() * 100)
                                    if df_mg["total_spend_inr"].sum() > 0 else 0.0,
            }
            for arch, g in df_mg.groupby("archetype")
        },
    }


# --------------------------------------------------------------------------
# Canonical-category aggregation (Stage 9 → Stage 12 unit of analysis)
# --------------------------------------------------------------------------

def precompute_canonical_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """One row per Stage 9 canonical_id with same metric shape as df_mg.

    This is the unit-of-analysis Op Model themes consume. Each row also
    carries a `members` list — the underlying MATKLs that map to this
    canonical, with their own per-MG spend/po/vendor/plant breakdown.

    UNCLASSIFIED rows surface as a separate canonical with id 'UNCLASSIFIED'.
    """
    if "canonical_id" not in df.columns:
        raise ValueError("Gold DataFrame missing canonical_id column — run Stage 9 first")

    df = df.copy()
    active = df[df.get("po_status_inferred", "active") == "active"].copy()

    # Replace NaN/empty with 'UNCLASSIFIED' so the bucket surfaces explicitly
    active["canonical_id"] = active["canonical_id"].fillna("UNCLASSIFIED")
    active.loc[active["canonical_id"].astype(str).str.strip() == "", "canonical_id"] = "UNCLASSIFIED"

    total_spend = active["net_value_inr"].sum()
    grouped = active.groupby("canonical_id", dropna=False)

    rows = []
    for cid, g in grouped:
        spend = float(g["net_value_inr"].sum())
        po_count = int(g["po_number"].nunique()) if "po_number" in g else len(g)

        if "po_creation_date" in g.columns:
            dates = g["po_creation_date"].dropna()
            po_count_6mo = _max_po_count_in_6mo(dates) if len(dates) else 0
            distinct_months = int(dates.dt.to_period("M").nunique()) if len(dates) else 0
        else:
            po_count_6mo = po_count
            distinct_months = 0

        vendor_spend = g.groupby("vendor_id")["net_value_inr"].sum() if "vendor_id" in g.columns else pd.Series([])
        vendor_count = int(g["vendor_id"].nunique()) if "vendor_id" in g.columns else 0
        top_vendor_share = float(vendor_spend.max() / spend) if len(vendor_spend) and spend > 0 else 0.0
        top_vendor_id = vendor_spend.idxmax() if len(vendor_spend) else None

        plant_count = int(g["plant"].nunique()) if "plant" in g.columns else 0
        plants_list = sorted(g["plant"].dropna().astype(str).unique().tolist()) if "plant" in g.columns else []

        # Per-plant rollup (for centralisation overlap analysis on canonical level)
        plants_data = {}
        if "plant" in g.columns and "vendor_id" in g.columns:
            for plant, pg in g.groupby("plant"):
                pv = pg.groupby("vendor_id")["net_value_inr"].sum()
                plants_data[plant] = {
                    "top_vendor": pv.idxmax() if len(pv) else None,
                    "top_vendor_share": float(pv.max() / pg["net_value_inr"].sum()) if pg["net_value_inr"].sum() > 0 else 0.0,
                    "vendor_count": int(pg["vendor_id"].nunique()),
                    "spend": float(pg["net_value_inr"].sum()),
                }

        def _nonblank(col):
            if col not in g.columns:
                return pd.Series([False] * len(g), index=g.index)
            return g[col].astype(str).str.strip() != ""
        any_contracted = _nonblank("contract_number") | _nonblank("outline_agreement") | _nonblank("scheduling_agreement")
        contracted_pct = float(any_contracted.sum() / len(g) * 100) if len(g) else 0.0

        # Archetype + label from first non-blank (uniform within canonical)
        archetype = "UNCLASSIFIED"
        if "archetype" in g.columns:
            mode = g["archetype"].mode()
            archetype = str(mode.iloc[0]) if len(mode) else "UNCLASSIFIED"
        canonical_label = cid
        if "canonical_label" in g.columns:
            lbl_series = g["canonical_label"].dropna().astype(str)
            lbl_series = lbl_series[lbl_series.str.strip() != ""]
            if len(lbl_series):
                canonical_label = lbl_series.iloc[0]

        # ----- Members: per-MATKL breakdown inside this canonical -----
        members = []
        if "material_group" in g.columns:
            for mg, mg_g in g.groupby("material_group", dropna=False):
                if pd.isna(mg) or str(mg).strip() == "":
                    continue
                mg_spend = float(mg_g["net_value_inr"].sum())
                mg_vendor_spend = mg_g.groupby("vendor_id")["net_value_inr"].sum() if "vendor_id" in mg_g.columns else pd.Series([])
                mg_desc = ""
                if "material_group_desc" in mg_g.columns:
                    d = mg_g["material_group_desc"].dropna().astype(str)
                    d = d[d.str.strip() != ""]
                    if len(d):
                        mg_desc = d.iloc[0]
                top_vendor_name = ""
                if "vendor_name" in mg_g.columns and len(mg_vendor_spend):
                    top_vid = mg_vendor_spend.idxmax()
                    name_series = mg_g[mg_g["vendor_id"] == top_vid]["vendor_name"].dropna().astype(str)
                    if len(name_series):
                        top_vendor_name = name_series.iloc[0]
                members.append({
                    "material_group": str(mg),
                    "material_group_desc": mg_desc,
                    "spend_inr": mg_spend,
                    "spend_share_in_canonical_pct": float(mg_spend / spend * 100) if spend > 0 else 0.0,
                    "po_count": int(mg_g["po_number"].nunique()) if "po_number" in mg_g else len(mg_g),
                    "line_count": int(len(mg_g)),
                    "vendor_count": int(mg_g["vendor_id"].nunique()) if "vendor_id" in mg_g.columns else 0,
                    "top_vendor_id": str(mg_vendor_spend.idxmax()) if len(mg_vendor_spend) else None,
                    "top_vendor_name": top_vendor_name,
                    "plant_count": int(mg_g["plant"].nunique()) if "plant" in mg_g.columns else 0,
                    "plants": sorted(mg_g["plant"].dropna().astype(str).unique().tolist()) if "plant" in mg_g.columns else [],
                })
            members.sort(key=lambda m: -m["spend_inr"])

        rows.append({
            "canonical_id": str(cid),
            "canonical_label": canonical_label,
            "archetype": archetype,
            "total_spend_inr": spend,
            "spend_share_pct": float(spend / total_spend * 100) if total_spend > 0 else 0.0,
            "po_count": po_count,
            "po_count_6mo": po_count_6mo,
            "distinct_months": distinct_months,
            "avg_po_value": float(g["net_value_inr"].mean()) if len(g) else 0.0,
            "median_po_value": float(g["net_value_inr"].median()) if len(g) else 0.0,
            "vendor_count": vendor_count,
            "top_vendor_id": str(top_vendor_id) if top_vendor_id is not None else None,
            "top_vendor_share_pct": top_vendor_share * 100,
            "plant_count": plant_count,
            "plants": plants_list,
            "plants_data": plants_data,
            "contracted_pct": contracted_pct,
            "matkl_count": len(members),
            "members": members,
        })

    out = pd.DataFrame(rows)
    if len(out):
        out = out.sort_values("total_spend_inr", ascending=False).reset_index(drop=True)
    return out


def unclassified_bucket(df_canonical: pd.DataFrame) -> Optional[dict]:
    """Extract the UNCLASSIFIED canonical row as a separate bucket the UI
    can render with an inline reassign affordance. Returns None if no
    unclassified rows exist."""
    if df_canonical.empty:
        return None
    mask = df_canonical["canonical_id"].astype(str).str.upper() == "UNCLASSIFIED"
    sub = df_canonical[mask]
    if len(sub) == 0:
        return None
    row = sub.iloc[0]
    total = df_canonical["total_spend_inr"].sum()
    return {
        "canonical_id": "UNCLASSIFIED",
        "total_spend_inr": float(row["total_spend_inr"]),
        "spend_share_pct": float(row["total_spend_inr"] / total * 100) if total > 0 else 0.0,
        "po_count": int(row["po_count"]),
        "matkl_count": int(row["matkl_count"]),
        # Top 20 unclassified MATKLs by spend — these are what the consultant
        # reassigns inline from the Op Model page.
        "top_matkls": (row.get("members") or [])[:20],
    }
