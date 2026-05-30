"""Compute the 8 methodology KPIs from the spec library.

Source of truth for rules:
  kb/functions/procurement/_meta/kpi-calculation-rules.yml
  kb/functions/procurement/_meta/kpi-rca-library.yml
  kb/functions/procurement/_meta/kpi-data-sources.yml

Each result carries:
  id, label, unit, value, available, direction
  source_columns_used, notes, source
  per_canonical:  [{canonical_id, canonical_label, archetype, value, row_count}]
  per_archetype:  [{archetype, value, row_count}]
  data_quality:   {required_cols, completeness_pct, rows_used, rows_available, coverage_pct}
  benchmark:      {typical_low, typical_high, unit, direction, your_position, note}
"""
from __future__ import annotations

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


def _rc_exclusion_set(rules: dict) -> set[str]:
    return {x.lower() for x in (rules.get("rc_adoption", {}).get("exclusion_list_case_insensitive") or [])}


_PAC_FLAG_COLS = ("pac_flag", "pac_pr", "pac", "single_source_flag", "PAC_Flag", "PAC")
_PAC_TEXT_COLS = ("short_text", "pr_text", "remarks", "reason")
_PAC_TEXT_KEYWORDS = ("PAC", "PROPRIETARY", "OEM ONLY", "SOLE SOURCE", "SINGLE SOURCE")
_PAC_YES = {"yes", "y", "true", "1", "pac", "single source", "sole source"}


# ----------------------------------------------------------------------------
# Value-only computers. Each takes a (possibly-subset) df + rules and returns
# either a float value or None (if data insufficient on that subset).
# Used both for the headline KPI value and for per-canonical / per-archetype
# breakdowns. Keep these pure: no side-effects, no logging.
# ----------------------------------------------------------------------------

def _v_tail_spend(df: pd.DataFrame, rules: dict) -> Optional[float]:
    spec = rules.get("tail_spend", {})
    threshold = float(spec.get("threshold_inr_per_line", 100_000))
    col = "net_value_inr" if "net_value_inr" in df.columns else "net_value"
    if col not in df.columns or len(df) == 0:
        return None
    s = pd.to_numeric(df[col], errors="coerce").dropna()
    if len(s) == 0:
        return None
    name_l = col.lower()
    if any(k in name_l for k in ("cr", "crore")):
        s = s * 1e7
    elif s.median() < 10:
        s = s * 1e7
    return round(float((s < threshold).sum() / len(s) * 100), 1)


def _v_rc_adoption(df: pd.DataFrame, rules: dict) -> Optional[float]:
    excl = _rc_exclusion_set(rules)
    cols = [c for c in ("contract_number", "outline_agreement", "scheduling_agreement") if c in df.columns]
    if not cols or len(df) == 0:
        return None
    has_contract = pd.Series(False, index=df.index)
    for col in cols:
        s = df[col].astype(str).str.strip().str.lower()
        col_has = s.notna() & (s != "") & (s != "nan") & (~s.isin(excl))
        has_contract = has_contract | col_has
    return round(float(has_contract.sum() / len(df) * 100), 1)


def _v_pac(df: pd.DataFrame, rules: dict) -> Optional[float]:
    if "po_number" not in df.columns or len(df) == 0:
        return None
    flag = pd.Series(False, index=df.index)
    for col in _PAC_FLAG_COLS:
        if col in df.columns:
            s = df[col].astype(str).str.strip().str.lower()
            flag = flag | s.isin(_PAC_YES)
            break
    for col in _PAC_TEXT_COLS:
        if col in df.columns:
            up = df[col].astype(str).str.upper()
            for kw in _PAC_TEXT_KEYWORDS:
                flag = flag | up.str.contains(kw, regex=False, na=False)
    df_tmp = df[["po_number"]].copy()
    df_tmp["_pac"] = flag.values
    per_po = df_tmp.groupby("po_number")["_pac"].any()
    if len(per_po) == 0:
        return None
    return round(float(per_po.sum() / len(per_po) * 100), 1)


def _v_tat(df: pd.DataFrame) -> Optional[float]:
    """Mean PR→PO TAT (IQR-trimmed). Reads pr_release_date or pr_creation_date
    from df (either native column or post-join from orchestrator)."""
    if "po_creation_date" not in df.columns or "po_number" not in df.columns:
        return None
    pr_date_col = next((c for c in ("pr_release_date", "pr_creation_date") if c in df.columns), None)
    if not pr_date_col:
        return None
    dfx = df.dropna(subset=["po_number", "po_creation_date", pr_date_col]).copy()
    if dfx.empty:
        return None
    dfx["po_creation_date"] = pd.to_datetime(dfx["po_creation_date"], errors="coerce")
    dfx[pr_date_col] = pd.to_datetime(dfx[pr_date_col], errors="coerce")
    dfx = dfx.dropna(subset=["po_creation_date", pr_date_col])
    if dfx.empty:
        return None
    grp = dfx.groupby("po_number").agg(po_dt=("po_creation_date", "min"),
                                          pr_dt=(pr_date_col, "min")).reset_index()
    grp["tat_days"] = (grp["po_dt"] - grp["pr_dt"]).dt.total_seconds() / 86400.0
    pos = grp[grp["tat_days"] > 0]
    if pos.empty:
        return None
    q1, q3 = pos["tat_days"].quantile([0.25, 0.75])
    fence = q3 + 1.5 * (q3 - q1)
    trimmed = pos[pos["tat_days"] <= fence] if len(pos) >= 10 else pos
    if trimmed.empty:
        return None
    return round(float(trimmed["tat_days"].mean()), 1)


def _v_otd(df: pd.DataFrame) -> Optional[float]:
    needed = ("delivery_date", "gr_date")
    if not all(c in df.columns for c in needed):
        return None
    dfx = df.dropna(subset=list(needed)).copy()
    if dfx.empty:
        return None
    dfx["delivery_date"] = pd.to_datetime(dfx["delivery_date"], errors="coerce")
    dfx["gr_date"] = pd.to_datetime(dfx["gr_date"], errors="coerce")
    dfx = dfx.dropna(subset=list(needed))
    if dfx.empty:
        return None
    on_time = (dfx["gr_date"] <= dfx["delivery_date"])
    return round(float(on_time.sum() / len(dfx) * 100), 1)


def _v_savings_lpo(df: pd.DataFrame) -> tuple[Optional[float], dict]:
    """Volume-weighted per-material month-over-month price delta.

    Method (sharper than the prior portfolio-wide monthly avg):
      1. For each material_number, compute monthly average unit price.
      2. Keep materials with >=2 months of history.
      3. Per material: savings_pct = (prior_month_avg - latest_month_avg)
                                       / prior_month_avg × 100
      4. Volume-weight savings_pct by material spend in the latest 2 months
         to get a portfolio-wide number.
    Returns (value, calc_meta).
    """
    price_col = next((c for c in ("net_price", "lpo_price") if c in df.columns), None)
    if not price_col or "po_creation_date" not in df.columns:
        return None, {"reason": "missing net_price or po_creation_date"}
    work = df.dropna(subset=["po_creation_date", price_col]).copy()
    work["po_creation_date"] = pd.to_datetime(work["po_creation_date"], errors="coerce")
    work[price_col] = pd.to_numeric(work[price_col], errors="coerce")
    work = work.dropna(subset=["po_creation_date", price_col])
    work = work[work[price_col] > 0]
    if work.empty:
        return None, {"reason": "no rows with positive price"}

    # Material-level path requires material_number
    if "material_number" not in work.columns:
        # Fallback to old portfolio-wide method (clearly noted)
        work["month"] = work["po_creation_date"].dt.to_period("M")
        monthly = work.groupby("month")[price_col].mean().sort_index()
        if len(monthly) < 2:
            return None, {"reason": "<2 months of data; no material_number for fallback"}
        latest, prior = float(monthly.iloc[-1]), float(monthly.iloc[-2])
        if prior == 0: return None, {"reason": "prior month avg was zero"}
        return round((prior - latest) / prior * 100, 1), {
            "method": "portfolio_monthly_fallback",
            "months_observed": int(len(monthly)),
            "latest_avg": round(latest, 2), "prior_avg": round(prior, 2),
            "warning": "material_number column missing — falling back to portfolio-wide monthly mix; result may reflect mix-shift rather than price change."
        }

    work["month"] = work["po_creation_date"].dt.to_period("M")
    per_mat_monthly = work.groupby(["material_number", "month"])[price_col].mean().reset_index()
    counts = per_mat_monthly.groupby("material_number")["month"].count()
    eligible_mats = counts[counts >= 2].index
    if len(eligible_mats) == 0:
        return None, {"reason": "no material has >=2 months of history"}
    eligible = per_mat_monthly[per_mat_monthly["material_number"].isin(eligible_mats)]
    # For each material: latest vs prior month
    rows = []
    for mat, grp in eligible.groupby("material_number"):
        g = grp.sort_values("month")
        prior_p = float(g.iloc[-2][price_col])
        latest_p = float(g.iloc[-1][price_col])
        if prior_p == 0: continue
        sav = (prior_p - latest_p) / prior_p
        rows.append({"material": mat, "savings": sav})
    if not rows:
        return None, {"reason": "no comparable material-level pairs"}
    per_mat = pd.DataFrame(rows)
    # Weight by material spend in last 6 months (proxy for "addressable")
    cutoff_month = work["month"].max()
    last6_mask = work["month"] >= (cutoff_month - 5)
    spend_per_mat = work[last6_mask].groupby("material_number")[price_col].sum()
    per_mat["weight"] = per_mat["material"].map(spend_per_mat).fillna(0)
    if per_mat["weight"].sum() == 0:
        per_mat["weight"] = 1
    weighted = (per_mat["savings"] * per_mat["weight"]).sum() / per_mat["weight"].sum()
    return round(weighted * 100, 1), {
        "method": "volume_weighted_per_material",
        "materials_compared": len(rows),
        "mean_unweighted_savings_pct": round(per_mat["savings"].mean() * 100, 1),
    }


# ----------------------------------------------------------------------------
# Breakdown helper: run a value-fn over per_canonical / per_archetype subsets
# ----------------------------------------------------------------------------

def _breakdown(df: pd.DataFrame, group_col: str, value_fn,
                taxonomy_lookup: Optional[dict] = None) -> list[dict]:
    if group_col not in df.columns:
        return []
    out = []
    for g, sub in df.groupby(group_col):
        if not g or str(g).lower() in ("nan", "unclassified") and group_col == "canonical_id":
            # Keep UNCLASSIFIED visible — useful to flag
            pass
        v = value_fn(sub)
        meta = (taxonomy_lookup or {}).get(g) or {}
        entry = {
            group_col: str(g),
            "value": v,
            "row_count": int(len(sub)),
        }
        if group_col == "canonical_id":
            entry["canonical_label"] = meta.get("label") or str(g)
            entry["archetype"] = meta.get("archetype")
        out.append(entry)
    return out


# ----------------------------------------------------------------------------
# Data-quality coverage per KPI
# ----------------------------------------------------------------------------

def _data_quality(df: pd.DataFrame, required_cols, mode: str = "all_of") -> dict:
    """Compute per-column completeness + rows-usable.
    mode='all_of':  rows_used = rows where every required_col is populated
    mode='any_of':  rows_used = rows where at least one required_col is populated
    """
    cols = list(required_cols or [])
    if not cols or len(df) == 0:
        return {"required_cols": cols, "mode": mode, "coverage_pct": 0.0,
                "rows_available": int(len(df)), "rows_used": 0,
                "per_column_completeness_pct": {}}
    present = [c for c in cols if c in df.columns]
    missing = [c for c in cols if c not in df.columns]
    per_col_pct: dict[str, float] = {}
    if mode == "any_of":
        any_pop = pd.Series(False, index=df.index)
        for c in present:
            col_pop = df[c].notna() & (df[c].astype(str).str.strip() != "")
            per_col_pct[c] = round(float(col_pop.sum() / len(df) * 100), 1)
            any_pop = any_pop | col_pop
        rows_with = any_pop
    else:  # all_of
        rows_with = pd.Series(True, index=df.index)
        for c in present:
            col_pop = df[c].notna() & (df[c].astype(str).str.strip() != "")
            per_col_pct[c] = round(float(col_pop.sum() / len(df) * 100), 1)
            rows_with = rows_with & col_pop
        for c in missing:
            per_col_pct[c] = 0.0
            rows_with = pd.Series(False, index=df.index)
    rows_used = int(rows_with.sum())
    return {
        "required_cols": cols, "mode": mode, "missing_cols": missing,
        "rows_available": int(len(df)), "rows_used": rows_used,
        "coverage_pct": round(rows_used / max(len(df), 1) * 100, 1),
        "per_column_completeness_pct": per_col_pct,
    }


# ----------------------------------------------------------------------------
# Benchmark resolver
# ----------------------------------------------------------------------------

def _benchmark(rules: dict, kpi_id: str, value: Optional[float]) -> Optional[dict]:
    b = (rules.get("benchmarks") or {}).get(kpi_id)
    if not b: return None
    direction = b.get("direction", "higher_is_better")
    lo, hi = b.get("typical_low"), b.get("typical_high")
    position = None
    if value is not None and lo is not None and hi is not None:
        if direction == "higher_is_better":
            if value < lo:    position = "below_typical"
            elif value > hi:  position = "above_typical_good"
            else:             position = "within_typical"
        else:  # lower_is_better
            if value > hi:    position = "above_typical_bad"
            elif value < lo:  position = "below_typical_good"
            else:             position = "within_typical"
    return {
        "typical_low": lo, "typical_high": hi,
        "unit": b.get("unit"), "direction": direction,
        "your_position": position, "note": b.get("note"),
    }


# ============================================================================
# Public KPI builders — each returns a fully-decorated KPI result
# ============================================================================

def _unavail(id_, label, unit, reason, cols, direction="higher_is_better"):
    return {
        "id": id_, "label": label, "value": None, "unit": unit,
        "available": False, "direction": direction,
        "source_columns_used": cols,
        "notes": reason,
        "source": "kb/_meta/kpi-calculation-rules.yml#" + id_,
        "per_canonical": [], "per_archetype": [],
        "data_quality": {"required_cols": cols, "coverage_pct": 0,
                          "rows_available": 0, "rows_used": 0,
                          "per_column_completeness_pct": {}},
        "benchmark": None,
    }


def _decorate(result: dict, df: pd.DataFrame, value_fn, required_cols,
               rules: dict, taxonomy_lookup: Optional[dict] = None,
               dq_mode: str = "all_of") -> dict:
    """Add per_canonical, per_archetype, data_quality, benchmark to a KPI result."""
    result.setdefault("per_canonical", [])
    result.setdefault("per_archetype", [])
    result["per_canonical"] = _breakdown(df, "canonical_id", value_fn, taxonomy_lookup)
    result["per_archetype"] = _breakdown(df, "archetype", value_fn)
    result["data_quality"] = _data_quality(df, required_cols, mode=dq_mode)
    result["benchmark"] = _benchmark(rules, result["id"], result.get("value"))
    return result


def kpi_tail_spend(df_gold: pd.DataFrame, rules: dict, taxonomy_lookup=None) -> dict:
    v = _v_tail_spend(df_gold, rules)
    if v is None:
        return _decorate(_unavail("tail_spend", "Tail Spend %", "%",
                                     "Requires net_value column with positive values.",
                                     ["net_value"], direction="lower_is_better"),
                          df_gold, lambda s: _v_tail_spend(s, rules), ["net_value"],
                          rules, taxonomy_lookup)
    spec = rules.get("tail_spend", {})
    result = {
        "id": "tail_spend", "label": "Tail Spend %",
        "value": v, "unit": "%", "available": True,
        "direction": "lower_is_better",
        "source_columns_used": ["net_value"],
        "notes": f"PO lines below ₹{spec.get('threshold_label', 'INR 1 Lakh')} as % of all lines.",
        "source": "kb/_meta/kpi-calculation-rules.yml#tail_spend",
    }
    return _decorate(result, df_gold, lambda s: _v_tail_spend(s, rules),
                      ["net_value"], rules, taxonomy_lookup)


def kpi_rc_adoption(df_gold: pd.DataFrame, rules: dict, taxonomy_lookup=None) -> dict:
    cols_present = [c for c in ("contract_number", "outline_agreement",
                                  "scheduling_agreement") if c in df_gold.columns]
    if not cols_present:
        return _decorate(_unavail("rc_adoption", "RC Adoption %", "%",
                                     "Requires contract_number, outline_agreement, or scheduling_agreement.",
                                     ["contract_number"], direction="higher_is_better"),
                          df_gold, lambda s: _v_rc_adoption(s, rules),
                          ["contract_number"], rules, taxonomy_lookup)
    v = _v_rc_adoption(df_gold, rules)
    excl = _rc_exclusion_set(rules)
    result = {
        "id": "rc_adoption", "label": "RC Adoption %",
        "value": v, "unit": "%", "available": v is not None,
        "direction": "higher_is_better",
        "source_columns_used": cols_present,
        "notes": (f"% PO lines with valid contract/agreement reference (excluded values: "
                   f"{', '.join(sorted(excl)[:6])}…)"),
        "source": "kb/_meta/kpi-calculation-rules.yml#rc_adoption",
    }
    return _decorate(result, df_gold, lambda s: _v_rc_adoption(s, rules),
                      cols_present, rules, taxonomy_lookup, dq_mode="any_of")


def kpi_pac(df_gold: pd.DataFrame, rules: dict, taxonomy_lookup=None) -> dict:
    if "po_number" not in df_gold.columns:
        return _decorate(_unavail("pac", "PAC / Single-Vendor PRs %", "%",
                                     "Requires po_number.", ["po_number"],
                                     direction="lower_is_better"),
                          df_gold, lambda s: _v_pac(s, rules), ["po_number"],
                          rules, taxonomy_lookup)
    v = _v_pac(df_gold, rules)
    used = []
    for c in _PAC_FLAG_COLS:
        if c in df_gold.columns: used.append(c); break
    for c in _PAC_TEXT_COLS:
        if c in df_gold.columns: used.append(c)
    result = {
        "id": "pac", "label": "PAC / Single-Vendor PRs %",
        "value": v, "unit": "%", "available": v is not None,
        "direction": "lower_is_better",
        "source_columns_used": used or ["—"],
        "notes": "Unique PO numbers flagged PAC by binary column or text keywords.",
        "source": "kb/_meta/kpi-calculation-rules.yml#pac",
    }
    return _decorate(result, df_gold, lambda s: _v_pac(s, rules),
                      ["po_number"], rules, taxonomy_lookup)


def kpi_spend_per_fte(df_gold: pd.DataFrame, fte_count: Optional[int],
                        rules: dict, taxonomy_lookup=None) -> dict:
    if not fte_count or fte_count <= 0:
        return _decorate(_unavail("spend_per_fte", "Spend per FTE (₹ Cr/FTE)", "₹ Cr/FTE",
                                     "Set engagement.fte_count on Stage 1 to compute.", [],
                                     direction="higher_is_better"),
                          df_gold, lambda s: None, [], rules, taxonomy_lookup)
    col = "net_value_inr" if "net_value_inr" in df_gold.columns else "net_value"
    if col not in df_gold.columns:
        return _decorate(_unavail("spend_per_fte", "Spend per FTE (₹ Cr/FTE)", "₹ Cr/FTE",
                                     "Requires net_value.", [col], direction="higher_is_better"),
                          df_gold, lambda s: None, [col], rules, taxonomy_lookup)

    def _v(sub):
        s = pd.to_numeric(sub[col], errors="coerce").dropna()
        if s.empty: return None
        total = float(s.sum())
        if total >= 1e7:    cr = total / 1e7
        elif total >= 1e5:  cr = total / 1e5
        else:               cr = total
        return round(cr / fte_count, 2)

    v = _v(df_gold)
    result = {
        "id": "spend_per_fte", "label": "Spend per FTE (₹ Cr/FTE)",
        "value": v, "unit": "₹ Cr/FTE", "available": v is not None,
        "direction": "higher_is_better",
        "source_columns_used": [col],
        "notes": f"Total addressable spend / {fte_count} procurement FTEs.",
        "source": "kb/_meta/kpi-calculation-rules.yml#spend_unit_detection",
    }
    return _decorate(result, df_gold, _v, [col], rules, taxonomy_lookup)


def kpi_tat(df_gold: pd.DataFrame, rules: dict, taxonomy_lookup=None) -> dict:
    v = _v_tat(df_gold)
    pr_date_col = next((c for c in ("pr_release_date", "pr_creation_date") if c in df_gold.columns), None)
    if v is None:
        cols_needed = ["po_number", "po_creation_date", pr_date_col or "pr_release_date"]
        return _decorate(_unavail("tat", "TAT (PR-to-PO, days)", "days",
                                     "Requires po_number + po_creation_date + PR-release-date "
                                     "(join PO with PR file on pr_reference=pr_number).",
                                     cols_needed, direction="lower_is_better"),
                          df_gold, _v_tat, cols_needed, rules, taxonomy_lookup)
    result = {
        "id": "tat", "label": "TAT (PR-to-PO, days)",
        "value": v, "unit": "days", "available": True,
        "direction": "lower_is_better",
        "source_columns_used": ["po_number", "po_creation_date", pr_date_col],
        "notes": "Mean PR→PO TAT, IQR-trimmed upper fence (1.5×). Joined from PR file.",
        "source": "kb/_meta/kpi-calculation-rules.yml#tat",
    }
    return _decorate(result, df_gold, _v_tat,
                      ["po_number", "po_creation_date", pr_date_col],
                      rules, taxonomy_lookup)


def kpi_savings_lpo(df_gold: pd.DataFrame, rules: dict, taxonomy_lookup=None) -> dict:
    v, meta = _v_savings_lpo(df_gold)
    cols_used = [c for c in ("net_price", "po_creation_date", "material_number") if c in df_gold.columns]
    if v is None:
        return _decorate(_unavail("savings_over_lpo", "Savings over LPO %", "%",
                                     meta.get("reason", "data insufficient"), cols_used,
                                     direction="higher_is_better"),
                          df_gold, lambda s: (_v_savings_lpo(s) or (None, {}))[0],
                          cols_used, rules, taxonomy_lookup)
    note = f"Volume-weighted per-material month-over-month price delta. {meta.get('materials_compared')} materials compared; mean unweighted {meta.get('mean_unweighted_savings_pct')}%."
    if meta.get("warning"):
        note += " ⚠ " + meta["warning"]
    # Sanity flag: extreme values usually mean low data density per material
    # OR a deliberate seed (synthetic prices). Surface this so the consultant
    # knows to trust or discount the number.
    if v is not None and abs(v) > 50:
        note += (f" ⚠ Result outside typical [-15%..+15%] range — likely insufficient"
                  f" per-material monthly history or synthetic price data; verify with client.")
    result = {
        "id": "savings_over_lpo", "label": "Savings over LPO %",
        "value": v, "unit": "%", "available": True,
        "direction": "higher_is_better",
        "source_columns_used": cols_used,
        "notes": note,
        "source": "kb/_meta/kpi-calculation-rules.yml#savings_over_lpo",
    }
    return _decorate(result, df_gold,
                      lambda s: (_v_savings_lpo(s) or (None, {}))[0],
                      cols_used, rules, taxonomy_lookup)


def kpi_otd(df_gold: pd.DataFrame, rules: dict, taxonomy_lookup=None) -> dict:
    needed = ["delivery_date", "gr_date"]
    if not all(c in df_gold.columns for c in needed):
        return _decorate(_unavail("otd", "On-Time Delivery %", "%",
                                     "Requires delivery_date + gr_date.", needed,
                                     direction="higher_is_better"),
                          df_gold, _v_otd, needed, rules, taxonomy_lookup)
    v = _v_otd(df_gold)
    if v is None:
        return _decorate(_unavail("otd", "On-Time Delivery %", "%",
                                     "No rows with both dates.", needed,
                                     direction="higher_is_better"),
                          df_gold, _v_otd, needed, rules, taxonomy_lookup)
    result = {
        "id": "otd", "label": "On-Time Delivery %",
        "value": v, "unit": "%", "available": True,
        "direction": "higher_is_better",
        "source_columns_used": needed,
        "notes": "Strict — no grace period, partial deliveries not on-time.",
        "source": "kb/_meta/kpi-calculation-rules.yml#otd",
    }
    return _decorate(result, df_gold, _v_otd, needed, rules, taxonomy_lookup)


def kpi_sourcing_tool_usage(qre_responses: Optional[dict], rules: dict) -> dict:
    if not qre_responses:
        return _decorate(_unavail("sourcing_tool_usage", "Sourcing Tool Usage %", "%",
                                     "Estimated from QRE D12.1 (digital sourcing maturity).", [],
                                     direction="higher_is_better"),
                          pd.DataFrame(), lambda s: None, [], rules, None)
    qre_idx = {r["id"]: r for r in qre_responses.get("responses", [])}
    score = qre_idx.get("D12.1", {}).get("score")
    if score is None:
        return _decorate(_unavail("sourcing_tool_usage", "Sourcing Tool Usage %", "%",
                                     "QRE D12.1 not answered.", [], direction="higher_is_better"),
                          pd.DataFrame(), lambda s: None, [], rules, None)
    approx = {1: 10, 2: 35, 3: 65, 4: 90}.get(int(score), 0)
    result = {
        "id": "sourcing_tool_usage", "label": "Sourcing Tool Usage %",
        "value": approx, "unit": "%", "available": True,
        "direction": "higher_is_better",
        "source_columns_used": ["QRE.D12.1"],
        "notes": f"QRE-derived proxy (score {score}/4 → ~{approx}%). Real digital % needs e-sourcing platform integration.",
        "source": "kb/_meta/kpi-rca-library.yml#sourcing_tool_usage",
    }
    result["per_canonical"] = []
    result["per_archetype"] = []
    result["data_quality"] = {"required_cols": ["QRE.D12.1"], "coverage_pct": 100.0,
                                "rows_available": 1, "rows_used": 1,
                                "per_column_completeness_pct": {"QRE.D12.1": 100.0}}
    result["benchmark"] = _benchmark(rules, "sourcing_tool_usage", approx)
    return result


# ============================================================================
# Driver
# ============================================================================

def compute_all(df_gold: pd.DataFrame, *,
                  fte_count: Optional[int] = None,
                  qre_responses: Optional[dict] = None,
                  pr_df: Optional[pd.DataFrame] = None,
                  taxonomy_lookup: Optional[dict] = None) -> list[dict]:
    """Compute the 8 methodology KPIs with per-canonical + per-archetype
    breakdowns + DQ + benchmarks.

    pr_df: optional PR DataFrame. If provided, joined onto df_gold on
           pr_reference = pr_number so kpi_tat can fire even when the PO
           dump doesn't carry a PR date column natively.
    taxonomy_lookup: {canonical_id → {label, archetype}} for breakdown labels.
    """
    rules = _load_calc_rules()

    # Cross-file PR join — adds pr_release_date / pr_creation_date to PO rows
    # so kpi_tat can compute on engagements with separate PR uploads.
    if pr_df is not None and len(pr_df) > 0 and "pr_reference" in df_gold.columns:
        join_date_col = next((c for c in ("pr_release_date", "pr_creation_date")
                                if c in pr_df.columns), None)
        if join_date_col and "pr_number" in pr_df.columns:
            pr_min = (pr_df.dropna(subset=["pr_number", join_date_col])
                          .copy())
            pr_min[join_date_col] = pd.to_datetime(pr_min[join_date_col], errors="coerce")
            pr_min = pr_min.dropna(subset=[join_date_col])
            pr_min = pr_min.groupby("pr_number", as_index=False)[join_date_col].min()
            df_gold = df_gold.merge(
                pr_min, left_on="pr_reference", right_on="pr_number",
                how="left", suffixes=("", "_prfile"),
            )
            if "pr_number_prfile" in df_gold.columns:
                df_gold = df_gold.drop(columns=["pr_number_prfile"])
            elif "pr_number" in df_gold.columns and "pr_reference" in df_gold.columns:
                # Drop the just-joined pr_number to avoid clashes
                if df_gold["pr_number"].isna().all():
                    df_gold = df_gold.drop(columns=["pr_number"])

    return [
        kpi_tat(df_gold, rules, taxonomy_lookup),
        kpi_savings_lpo(df_gold, rules, taxonomy_lookup),
        kpi_rc_adoption(df_gold, rules, taxonomy_lookup),
        kpi_pac(df_gold, rules, taxonomy_lookup),
        kpi_tail_spend(df_gold, rules, taxonomy_lookup),
        kpi_spend_per_fte(df_gold, fte_count, rules, taxonomy_lookup),
        kpi_otd(df_gold, rules, taxonomy_lookup),
        kpi_sourcing_tool_usage(qre_responses, rules),
    ]
