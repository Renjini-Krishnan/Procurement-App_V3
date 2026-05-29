"""Compute the 8 methodology KPIs from the spec library.

Source of truth for rules:
  kb/functions/procurement/_meta/kpi-calculation-rules.yml
  kb/functions/procurement/_meta/kpi-calculation-rules.md
  kb/functions/procurement/_meta/kpi-rca-library.yml

Each result carries:
  id, label, unit, value, available, source_columns_used,
  notes (calc trace), source (KB pointer), direction (higher_is_better /
  lower_is_better), confidence
"""
from __future__ import annotations

import re
from datetime import timedelta
from typing import Optional

import pandas as pd
import yaml

from .. import config


def _load_calc_rules() -> dict:
    p = config.PROC_KB_ROOT / "_meta" / "kpi-calculation-rules.yml"
    if not p.exists():
        return {}
    try:
        return yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


# RC exclusion list from KB
def _rc_exclusion_set(rules: dict) -> set[str]:
    return {x.lower() for x in (rules.get("rc_adoption", {}).get("exclusion_list_case_insensitive") or [])}


# ---------------------------------------------------------------------------
# Spend unit detection (sum-based — INR vs thousands vs crore)
# ---------------------------------------------------------------------------

def _to_cr(series: pd.Series) -> float:
    """Sum-based unit detection per kpi-calculation-rules#spend_unit_detection."""
    s = series.dropna()
    if s.dtype == "object":
        # Strip commas first ("1,23,456" -> 123456)
        s = pd.to_numeric(s.astype(str).str.replace(",", "", regex=False), errors="coerce")
    s = s.dropna()
    if s.empty:
        return 0.0
    total = float(s.sum())
    if total >= 1e7:
        return total / 1e7
    if total >= 1e5:
        return total / 1e5
    return total


# ---------------------------------------------------------------------------
# KPI: Tail Spend %
# ---------------------------------------------------------------------------

def kpi_tail_spend(df_gold: pd.DataFrame, rules: dict) -> dict:
    spec = rules.get("tail_spend", {})
    threshold = float(spec.get("threshold_inr_per_line", 100_000))
    label_threshold = spec.get("threshold_label", "INR 1 Lakh")
    col = "net_value_inr" if "net_value_inr" in df_gold.columns else "net_value"
    if col not in df_gold.columns or len(df_gold) == 0:
        return _unavail("tail_spend", "Tail Spend %", "%", "Tail spend computed per kpi-calculation-rules.yml#tail_spend",
                         [col])
    s = pd.to_numeric(df_gold[col], errors="coerce").dropna()
    # Unit detection
    name_l = col.lower()
    if any(k in name_l for k in ("cr", "crore")):
        s = s * 1e7
    elif s.median() < 10:
        s = s * 1e7
    pct = float((s < threshold).sum() / max(len(s), 1) * 100)
    return {
        "id": "tail_spend", "label": "Tail Spend %",
        "value": round(pct, 1), "unit": "%",
        "direction": "lower_is_better",
        "available": True,
        "source_columns_used": [col],
        "notes": f"PO lines below ₹{label_threshold} as % of all lines (n={len(s):,}); fixed threshold per spec.",
        "source": "kb/_meta/kpi-calculation-rules.yml#tail_spend",
    }


# ---------------------------------------------------------------------------
# KPI: RC Adoption %
# ---------------------------------------------------------------------------

def kpi_rc_adoption(df_gold: pd.DataFrame, rules: dict) -> dict:
    excl = _rc_exclusion_set(rules)
    agreement_cols = [c for c in ("contract_number", "outline_agreement",
                                    "scheduling_agreement") if c in df_gold.columns]
    if not agreement_cols:
        return _unavail("rc_adoption", "RC Adoption %", "%",
                         "RC adoption per kpi-calculation-rules.yml#rc_adoption", agreement_cols)
    has_contract = pd.Series(False, index=df_gold.index)
    for col in agreement_cols:
        s = df_gold[col].astype(str).str.strip().str.lower()
        col_has = s.notna() & (s != "") & (s != "nan") & (~s.isin(excl))
        has_contract = has_contract | col_has
    pct = float(has_contract.sum() / max(len(df_gold), 1) * 100)
    return {
        "id": "rc_adoption", "label": "RC Adoption %",
        "value": round(pct, 1), "unit": "%",
        "direction": "higher_is_better",
        "available": True,
        "source_columns_used": agreement_cols,
        "notes": (f"% of PO lines with valid contract/agreement reference (excluded values: "
                   f"{', '.join(sorted(excl)[:6])}…)"),
        "source": "kb/_meta/kpi-calculation-rules.yml#rc_adoption",
    }


# ---------------------------------------------------------------------------
# KPI: PAC % (single-vendor)
# ---------------------------------------------------------------------------

_PAC_FLAG_COLS = ("pac_flag", "pac_pr", "pac", "single_source_flag", "PAC_Flag", "PAC")
_PAC_TEXT_COLS = ("short_text", "pr_text", "remarks", "reason")
_PAC_TEXT_KEYWORDS = ("PAC", "PROPRIETARY", "OEM ONLY", "SOLE SOURCE", "SINGLE SOURCE")
_PAC_YES = {"yes", "y", "true", "1", "pac", "single source", "sole source"}


def kpi_pac(df_gold: pd.DataFrame, rules: dict) -> dict:
    if "po_number" not in df_gold.columns:
        return _unavail("pac", "PAC %", "%",
                         "PAC detection per kpi-calculation-rules.yml#pac", ["po_number"])
    flag = pd.Series(False, index=df_gold.index)
    used = []
    for col in _PAC_FLAG_COLS:
        if col in df_gold.columns:
            s = df_gold[col].astype(str).str.strip().str.lower()
            flag = flag | s.isin(_PAC_YES)
            used.append(col); break
    for col in _PAC_TEXT_COLS:
        if col in df_gold.columns:
            up = df_gold[col].astype(str).str.upper()
            for kw in _PAC_TEXT_KEYWORDS:
                flag = flag | up.str.contains(kw, regex=False, na=False)
            used.append(col)
    df_tmp = df_gold[["po_number"]].copy()
    df_tmp["_pac"] = flag
    per_po = df_tmp.groupby("po_number")["_pac"].any()
    pct = float(per_po.sum() / max(len(per_po), 1) * 100)
    return {
        "id": "pac", "label": "PAC / Single-Vendor PRs %",
        "value": round(pct, 1), "unit": "%",
        "direction": "lower_is_better",
        "available": True,
        "source_columns_used": used or ["—"],
        "notes": f"Unique PO numbers flagged PAC by binary column or text keywords (denominator = {len(per_po):,} POs).",
        "source": "kb/_meta/kpi-calculation-rules.yml#pac",
    }


# ---------------------------------------------------------------------------
# KPI: Spend per FTE (₹ Cr per FTE)
# ---------------------------------------------------------------------------

def kpi_spend_per_fte(df_gold: pd.DataFrame, fte_count: Optional[int]) -> dict:
    if not fte_count or fte_count <= 0:
        return _unavail("spend_per_fte", "Spend per FTE (₹ Cr/FTE)", "₹ Cr/FTE",
                         "Set engagement.fte_count on Stage 1 to compute this.", [])
    col = "net_value_inr" if "net_value_inr" in df_gold.columns else "net_value"
    if col not in df_gold.columns:
        return _unavail("spend_per_fte", "Spend per FTE (₹ Cr/FTE)", "₹ Cr/FTE",
                         "Spend per FTE requires net_value column.", [col])
    total_cr = _to_cr(df_gold[col])
    val = round(total_cr / fte_count, 2)
    return {
        "id": "spend_per_fte", "label": "Spend per FTE (₹ Cr/FTE)",
        "value": val, "unit": "₹ Cr/FTE",
        "direction": "higher_is_better",
        "available": True,
        "source_columns_used": [col],
        "notes": f"Total addressable spend ₹{total_cr:.1f} Cr / {fte_count} procurement FTEs.",
        "source": "kb/_meta/kpi-calculation-rules.yml#spend_unit_detection",
    }


# ---------------------------------------------------------------------------
# KPI: TAT (PR-to-PO)
# ---------------------------------------------------------------------------

def kpi_tat(df_gold: pd.DataFrame) -> dict:
    df = df_gold
    if not {"po_number", "po_creation_date"}.issubset(df.columns):
        return _unavail("tat", "TAT (PR-to-PO, days)", "days",
                         "TAT requires po_number + po_creation_date + a PR-release-date column.", [])
    pr_date_col = None
    for c in ("pr_release_date", "pr_creation_date"):
        if c in df.columns:
            pr_date_col = c; break
    if not pr_date_col:
        return _unavail("tat", "TAT (PR-to-PO, days)", "days",
                         "TAT requires pr_release_date (or pr_creation_date) in PO dump.",
                         ["pr_release_date"])
    dfx = df.dropna(subset=["po_number", "po_creation_date", pr_date_col]).copy()
    dfx["po_creation_date"] = pd.to_datetime(dfx["po_creation_date"], errors="coerce")
    dfx[pr_date_col] = pd.to_datetime(dfx[pr_date_col], errors="coerce")
    dfx = dfx.dropna(subset=["po_creation_date", pr_date_col])
    if dfx.empty:
        return _unavail("tat", "TAT (PR-to-PO, days)", "days",
                         "No rows with valid PR + PO dates.", [pr_date_col, "po_creation_date"])
    grp = dfx.groupby("po_number").agg(
        po_dt=("po_creation_date", "min"), pr_dt=(pr_date_col, "min")
    ).reset_index()
    grp["tat_days"] = (grp["po_dt"] - grp["pr_dt"]).dt.total_seconds() / 86400.0
    n_before = len(grp)
    pos = grp[grp["tat_days"] > 0]
    n_pos = len(pos)
    q1, q3 = pos["tat_days"].quantile([0.25, 0.75])
    fence = q3 + 1.5 * (q3 - q1)
    trimmed = pos[pos["tat_days"] <= fence] if len(pos) >= 10 else pos
    if trimmed.empty:
        return _unavail("tat", "TAT (PR-to-PO, days)", "days",
                         "No PO rows survived TAT filter.", [pr_date_col, "po_creation_date"])
    mean_tat = round(float(trimmed["tat_days"].mean()), 1)
    return {
        "id": "tat", "label": "TAT (PR-to-PO, days)",
        "value": mean_tat, "unit": "days",
        "direction": "lower_is_better",
        "available": True,
        "source_columns_used": ["po_number", "po_creation_date", pr_date_col],
        "notes": (f"Dedup → {n_before:,} unique POs; {n_pos:,} positive; IQR fence={fence:.0f}d, "
                   f"used {len(trimmed):,} rows."),
        "source": "kb/_meta/kpi-calculation-rules.yml#tat",
    }


# ---------------------------------------------------------------------------
# KPI: Savings over LPO (% — monthly avg method)
# ---------------------------------------------------------------------------

def kpi_savings_lpo(df_gold: pd.DataFrame) -> dict:
    price_col = None
    for c in ("net_price", "lpo_price"):
        if c in df_gold.columns:
            price_col = c; break
    if not price_col or "po_creation_date" not in df_gold.columns:
        return _unavail("savings_over_lpo", "Savings over LPO %", "%",
                         "Savings requires net_price + po_creation_date.", [])
    df = df_gold.dropna(subset=["po_creation_date", price_col]).copy()
    df["po_creation_date"] = pd.to_datetime(df["po_creation_date"], errors="coerce")
    df[price_col] = pd.to_numeric(df[price_col], errors="coerce")
    df = df.dropna(subset=["po_creation_date", price_col])
    if df.empty:
        return _unavail("savings_over_lpo", "Savings over LPO %", "%",
                         "No rows with valid date + price.", [price_col])
    df["month"] = df["po_creation_date"].dt.to_period("M")
    monthly = df.groupby("month")[price_col].mean().sort_index()
    if len(monthly) < 2:
        return _unavail("savings_over_lpo", "Savings over LPO %", "%",
                         "Need at least 2 months of price data.", [price_col, "po_creation_date"])
    latest = float(monthly.iloc[-1])
    prior = float(monthly.iloc[-2])
    if prior == 0:
        return _unavail("savings_over_lpo", "Savings over LPO %", "%",
                         "Prior month average price was zero.", [price_col])
    pct = (prior - latest) / prior * 100
    return {
        "id": "savings_over_lpo", "label": "Savings over LPO %",
        "value": round(pct, 1), "unit": "%",
        "direction": "higher_is_better",
        "available": True,
        "source_columns_used": [price_col, "po_creation_date"],
        "notes": f"Latest month avg price ({latest:.0f}) vs prior month ({prior:.0f}) — {len(monthly)} months observed.",
        "source": "kb/_meta/kpi-calculation-rules.yml#savings_over_lpo",
    }


# ---------------------------------------------------------------------------
# KPI: OTD (deferred — Post-PO data needed)
# ---------------------------------------------------------------------------

def kpi_otd(df_gold: pd.DataFrame) -> dict:
    needed = {"delivery_date", "gr_date"}
    if not needed.issubset(df_gold.columns):
        return _unavail("otd", "On-Time Delivery %", "%",
                         "OTD requires both delivery_date + gr_date (Post-PO pillar territory).",
                         list(needed))
    df = df_gold.dropna(subset=list(needed)).copy()
    df["delivery_date"] = pd.to_datetime(df["delivery_date"], errors="coerce")
    df["gr_date"] = pd.to_datetime(df["gr_date"], errors="coerce")
    df = df.dropna(subset=list(needed))
    if df.empty:
        return _unavail("otd", "On-Time Delivery %", "%",
                         "No rows with both dates.", list(needed))
    on_time = (df["gr_date"] <= df["delivery_date"])
    pct = float(on_time.sum() / len(df) * 100)
    return {
        "id": "otd", "label": "On-Time Delivery %",
        "value": round(pct, 1), "unit": "%",
        "direction": "higher_is_better",
        "available": True,
        "source_columns_used": ["delivery_date", "gr_date"],
        "notes": f"Strict (no grace, partial delivery not on-time). {len(df):,} rows with both dates.",
        "source": "kb/_meta/kpi-calculation-rules.yml#otd",
    }


# ---------------------------------------------------------------------------
# KPI: Sourcing Tool Usage (QRE-based proxy; ERP data lacks the signal in V1)
# ---------------------------------------------------------------------------

def kpi_sourcing_tool_usage(qre_responses: Optional[dict]) -> dict:
    if not qre_responses:
        return _unavail("sourcing_tool_usage", "Sourcing Tool Usage %", "%",
                         "Estimated from QRE response D12.1 (digital sourcing maturity).", [])
    qre_idx = {r["id"]: r for r in qre_responses.get("responses", [])}
    score = qre_idx.get("D12.1", {}).get("score")
    if score is None:
        return _unavail("sourcing_tool_usage", "Sourcing Tool Usage %", "%",
                         "QRE D12.1 not answered.", [])
    # 1-4 score → approximate % digital sourcing (heuristic)
    approx = {1: 10, 2: 35, 3: 65, 4: 90}.get(int(score), 0)
    return {
        "id": "sourcing_tool_usage", "label": "Sourcing Tool Usage %",
        "value": approx, "unit": "%",
        "direction": "higher_is_better",
        "available": True,
        "source_columns_used": ["QRE.D12.1"],
        "notes": f"QRE-derived proxy (score {score}/4 → ~{approx}%). Real digital % needs e-sourcing platform integration.",
        "source": "kb/_meta/kpi-rca-library.yml#sourcing_tool_usage",
    }


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def compute_all(df_gold: pd.DataFrame, *, fte_count: Optional[int] = None,
                  qre_responses: Optional[dict] = None) -> list[dict]:
    rules = _load_calc_rules()
    return [
        kpi_tat(df_gold),
        kpi_savings_lpo(df_gold),
        kpi_rc_adoption(df_gold, rules),
        kpi_pac(df_gold, rules),
        kpi_tail_spend(df_gold, rules),
        kpi_spend_per_fte(df_gold, fte_count),
        kpi_otd(df_gold),
        kpi_sourcing_tool_usage(qre_responses),
    ]


def _unavail(id_, label, unit, reason, cols):
    return {
        "id": id_, "label": label, "value": None, "unit": unit,
        "available": False,
        "source_columns_used": cols,
        "notes": reason,
        "source": "kb/_meta/kpi-calculation-rules.yml#" + id_,
    }
