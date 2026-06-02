"""V2 pillars — Material Master, PR-to-PO, Post-PO, Supplier.

Each pillar follows the same shape:
  themes:        {theme_id: {label, metrics, ...}}
  theme_scores:  {theme_id: {score, label, band}}
  pillar_score:  float (0-5)
  rca_cards:     list of {theme, severity, headline, cause, recommendation}

Uses already-loaded dataframes (PO + optional PR/GRN/INVOICE/VENDOR_MASTER/
MATERIAL_MASTER) from the multi-upload bronze pass. Each pillar fails open:
if a required file is missing, the corresponding themes degrade to LOW
confidence with an explicit "data missing" note.

Scoring band convention (per existing pillars):
  >= 4.5 → Optimised
  >= 3.5 → Managed
  >= 2.5 → Defined
  >= 1.5 → Developing
  else   → Initial
"""
from __future__ import annotations

from typing import Optional

import pandas as pd


# ─── Helpers ────────────────────────────────────────────────────────────────

def _band_label(score: float) -> str:
    if score >= 4.5: return "Optimised"
    if score >= 3.5: return "Managed"
    if score >= 2.5: return "Defined"
    if score >= 1.5: return "Developing"
    return "Initial"


def _band_tone(score: float) -> str:
    if score >= 3.5: return "success"
    if score >= 2.5: return "info"
    return "warn"


def _pct(numer: float, denom: float) -> float:
    return round(100.0 * numer / denom, 1) if denom else 0.0


def _score_from_pct(pct: float, *, higher_is_better: bool = True,
                     low_threshold: float = 30, mid_threshold: float = 60,
                     high_threshold: float = 85) -> float:
    """Map a 0-100% metric to a 0-5 score."""
    if not higher_is_better:
        pct = 100 - pct
    if pct >= high_threshold: return 4.5
    if pct >= mid_threshold:  return 3.5
    if pct >= low_threshold:  return 2.5
    if pct > 0:               return 1.5
    return 0.5


def _theme_result(label: str, score: float, **metrics) -> dict:
    return {
        "label": label,
        "score": round(score, 1),
        "band": _band_label(score),
        "available": True,
        **metrics,
    }


def _unavailable(label: str, *, required: list[str], reason: str = "input",
                   note: Optional[str] = None) -> dict:
    """V2-shape 'data not available' theme — score=None, band tells the
    UI to render a missing-data badge instead of fabricating a 1.0.
    `required` lists the missing inputs (column names, file types, QRE ids)."""
    if note is None:
        if reason == "file":
            note = f"Required file(s) not uploaded: {', '.join(required)}"
        elif reason == "columns":
            note = f"Required column(s) missing: {', '.join(required)}"
        elif reason == "rows":
            note = f"No rows available for this metric ({', '.join(required)})."
        else:
            note = f"Required inputs missing: {', '.join(required)}"
    return {
        "label": label,
        "score": None,
        "band": "Data not available",
        "available": False,
        "missing_inputs": list(required),
        "missing_reason": reason,
        "metric_value": None,
        "note": note,
    }


def _v2_pillar_score(themes: dict, weights: dict) -> dict:
    """Weighted average over AVAILABLE themes only. Returns
    {score, label, coverage_pct, ...} — same shape as the V1 aggregator."""
    total_w = sum(weights.values())
    available = {k: v for k, v in themes.items() if v.get("score") is not None}
    if not available:
        return {
            "score": None, "label": "Data not available",
            "coverage_pct": 0,
            "themes_available": 0, "themes_total": len(themes),
            "missing_themes": list(themes.keys()),
        }
    avail_w = sum(weights.get(k, 0) for k in available) or total_w
    score = sum(themes[k]["score"] * weights.get(k, 0) for k in available) / avail_w
    cov = round(100 * avail_w / total_w, 1) if total_w else 100
    suffix = "" if cov >= 99 else f" (partial · {cov}% computed)"
    return {
        "score": round(score, 1), "label": _band_label(score) + suffix,
        "coverage_pct": cov,
        "themes_available": len(available),
        "themes_total": len(themes),
        "missing_themes": [k for k in themes if themes[k].get("score") is None],
    }


# ────────────────────────────────────────────────────────────────────────────
# 1. Material Master pillar
# ────────────────────────────────────────────────────────────────────────────

def run_material_master(po_df: pd.DataFrame, mm_df: Optional[pd.DataFrame],
                          canonical_classification: dict) -> dict:
    """Material Master pillar. 3 themes:
      mm1_coverage:      % PO rows with material_number populated
      mm2_master_quality: duplicates + missing-field rate in MM file
      mm3_classification: canonical_id assignment rate (proxy for MM quality)
    """
    themes: dict = {}
    rca_cards: list[dict] = []

    # mm1 — PO coverage of material_number
    if "material_number" in po_df.columns:
        n_with = int(po_df["material_number"].dropna().astype(str).str.strip().replace("", pd.NA).notna().sum())
        pct = _pct(n_with, len(po_df))
        themes["mm1_coverage"] = _theme_result(
            "PO coverage of material_number", _score_from_pct(pct),
            metric_value=pct, metric_unit="%", rows_with=n_with, total_rows=len(po_df),
            note=f"{n_with:,} of {len(po_df):,} PO rows carry a material_number ({pct}%).",
        )
        if pct < 60:
            rca_cards.append({
                "theme": "mm1_coverage", "severity": "high",
                "headline": f"Material code missing on {100-pct:.0f}% of PO rows",
                "cause": "Free-text purchases bypass the material master; cataloguing discipline gap.",
                "recommendation": "Implement minimum 80% material_number coverage as a P-card / e-procurement gate.",
            })
    else:
        themes["mm1_coverage"] = _unavailable(
            "PO coverage of material_number",
            required=["material_number"], reason="columns")

    # mm2 — Master quality (duplicate descriptions + active flag)
    if mm_df is not None and len(mm_df) > 0:
        total = len(mm_df)
        dup_desc = 0
        if "material_description" in mm_df.columns:
            dup_desc = int(mm_df["material_description"].duplicated().sum())
        active_pct = 100.0
        if "active_flag" in mm_df.columns:
            active = mm_df["active_flag"].astype(str).str.lower().isin({"true", "1", "y", "yes"})
            active_pct = _pct(int(active.sum()), total)
        dup_rate = _pct(dup_desc, total)
        score = 5.0 - min(4.0, dup_rate / 5)  # 5% dup => -1 score
        themes["mm2_master_quality"] = _theme_result(
            "Master quality", score,
            metric_value=dup_rate, metric_unit="% duplicates",
            total=total, duplicate_descriptions=dup_desc, active_pct=active_pct,
            note=f"{total:,} materials · {dup_desc:,} duplicate descriptions ({dup_rate}%) · {active_pct}% active.",
        )
        if dup_rate > 5:
            rca_cards.append({
                "theme": "mm2_master_quality", "severity": "medium",
                "headline": f"{dup_desc:,} duplicate material descriptions in master",
                "cause": "Material onboarding lacks dedup check; same item enters under multiple codes.",
                "recommendation": "Run quarterly dedup sweep + add fuzzy-match gate at material creation.",
            })
    else:
        themes["mm2_master_quality"] = _unavailable(
            "Master quality",
            required=["Material Master file"], reason="file")

    # mm3 — Canonical classification rate
    cc_stats = (canonical_classification or {}).get("stats") or {}
    unclass_pct = cc_stats.get("unclassified_pct", 100.0)
    assigned_pct = 100.0 - unclass_pct
    themes["mm3_classification"] = _theme_result(
        "Canonical classification rate", _score_from_pct(assigned_pct),
        metric_value=assigned_pct, metric_unit="%",
        canonicals=(canonical_classification or {}).get("taxonomy_canonicals"),
        note=f"{assigned_pct:.1f}% of PO rows mapped to a canonical category.",
    )
    if unclass_pct > 15:
        rca_cards.append({
            "theme": "mm3_classification", "severity": "medium",
            "headline": f"{unclass_pct}% PO rows unclassified",
            "cause": "Missing material descriptors or non-standard text patterns; taxonomy keywords don't cover the long tail.",
            "recommendation": "Add engagement-specific synonyms to categories-master.yml (Stage 9 review queue).",
        })

    theme_scores = {k: {"score": v["score"], "label": v["band"]} for k, v in themes.items()}
    weights = {"mm1_coverage": 0.40, "mm2_master_quality": 0.30, "mm3_classification": 0.30}
    pillar_score = _v2_pillar_score(themes, weights)
    return {
        "pillar": "material-master",
        "pillar_score": pillar_score,
        "themes": themes, "theme_scores": theme_scores,
        "rca_cards": rca_cards,
    }


# ────────────────────────────────────────────────────────────────────────────
# 2. PR-to-PO pillar
# ────────────────────────────────────────────────────────────────────────────

def run_pr_to_po(po_df: pd.DataFrame, pr_df: Optional[pd.DataFrame]) -> dict:
    themes: dict = {}
    rca_cards: list[dict] = []

    if pr_df is None or len(pr_df) == 0:
        themes["pr1_conversion"]         = _unavailable("PR→PO conversion rate", required=["PR file"], reason="file")
        themes["pr2_tat"]                = _unavailable("Mean PR→PO TAT", required=["PR file"], reason="file")
        themes["pr3_value_consistency"]  = _unavailable("PR estimate vs PO actual", required=["PR file"], reason="file")
    else:
        # pr1 — Conversion rate (needs pr_number on PR file + pr_reference on PO file)
        if "pr_number" not in pr_df.columns or "pr_reference" not in po_df.columns:
            missing = [c for c in [("pr_number", "PR file"), ("pr_reference", "PO file")]
                        if c[0] not in (pr_df if c[1] == "PR file" else po_df).columns]
            themes["pr1_conversion"] = _unavailable(
                "PR→PO conversion rate",
                required=[c[0] for c in missing], reason="columns")
        else:
            pr_keys = set(pr_df["pr_number"].dropna().astype(str))
            po_refs = set(po_df["pr_reference"].dropna().astype(str))
            if len(pr_keys) == 0:
                themes["pr1_conversion"] = _unavailable(
                    "PR→PO conversion rate", required=["non-empty pr_number values"],
                    reason="rows")
            else:
                linked = pr_keys & po_refs
                conv_pct = _pct(len(linked), len(pr_keys))
                themes["pr1_conversion"] = _theme_result(
                    "PR→PO conversion rate", _score_from_pct(conv_pct),
                    metric_value=conv_pct, metric_unit="%",
                    converted=len(linked), total_prs=len(pr_keys),
                    note=f"{len(linked):,} of {len(pr_keys):,} PRs converted to a PO ({conv_pct}%).",
                )
        # RCA fires only when pr1_conversion produced a real score
        if themes["pr1_conversion"].get("score") is not None and themes["pr1_conversion"].get("metric_value", 100) < 70:
            conv_pct = themes["pr1_conversion"]["metric_value"]
            rca_cards.append({
                "theme": "pr1_conversion", "severity": "high",
                "headline": f"{100-conv_pct:.0f}% of PRs never became POs",
                "cause": "Approval bottleneck or rejected requirements not closed out; PR creates noise.",
                "recommendation": "Add 30-day auto-close rule on unactioned PRs + monthly aging review.",
            })

        # pr2 — TAT
        if all(c in po_df.columns for c in ("pr_reference", "po_creation_date")) and \
           all(c in pr_df.columns for c in ("pr_number", "pr_creation_date")):
            pr_dt_map = dict(zip(pr_df["pr_number"].astype(str),
                                    pd.to_datetime(pr_df["pr_creation_date"], errors="coerce")))
            refs = po_df["pr_reference"].astype(str)
            po_dt = pd.to_datetime(po_df["po_creation_date"], errors="coerce")
            tats = []
            for ref, pd_dt in zip(refs, po_dt):
                prd = pr_dt_map.get(ref)
                if prd is not None and not pd.isna(prd) and not pd.isna(pd_dt):
                    diff = (pd_dt - prd).days
                    if 0 <= diff <= 365: tats.append(diff)
            mean_tat = round(sum(tats) / len(tats), 1) if tats else None
            if mean_tat is None:
                themes["pr2_tat"] = _unavailable("Mean PR→PO TAT", required=["linked PR-PO rows"], reason="rows")
            else:
                # Lower is better; <=7 → 5, <=14 → 4, <=21 → 3, <=30 → 2, else 1
                score = 5.0 if mean_tat <= 7 else 4.0 if mean_tat <= 14 else 3.0 if mean_tat <= 21 else 2.0 if mean_tat <= 30 else 1.0
                themes["pr2_tat"] = _theme_result(
                    "Mean PR→PO TAT", score,
                    metric_value=mean_tat, metric_unit="days",
                    linked_pairs=len(tats),
                    note=f"Mean TAT {mean_tat} days across {len(tats):,} linked PR-PO pairs.",
                )
                if mean_tat > 14:
                    rca_cards.append({
                        "theme": "pr2_tat", "severity": "medium",
                        "headline": f"Mean PR→PO TAT is {mean_tat} days",
                        "cause": "Multi-tier sequential approval + paper / email back-and-forth.",
                        "recommendation": "Parallelise tier 1+2 approvals; introduce 48h SLA per tier with auto-escalation.",
                    })
        else:
            themes["pr2_tat"] = _unavailable("Mean PR→PO TAT",
                required=["pr_reference", "pr_creation_date"], reason="columns")

        # pr3 — Value consistency
        if all(c in pr_df.columns for c in ("pr_number", "pr_total_value")) and \
           all(c in po_df.columns for c in ("pr_reference", "net_value")):
            pr_val_map = dict(zip(pr_df["pr_number"].astype(str),
                                     pd.to_numeric(pr_df["pr_total_value"], errors="coerce")))
            checked = devs = 0
            for ref, pv in zip(po_df["pr_reference"].astype(str),
                                  pd.to_numeric(po_df["net_value"], errors="coerce")):
                prv = pr_val_map.get(ref)
                if prv is None or pd.isna(prv) or pd.isna(pv) or pv == 0: continue
                checked += 1
                if abs(prv - pv) / abs(pv) > 0.20: devs += 1
            dev_pct = _pct(devs, checked)
            score = _score_from_pct(dev_pct, higher_is_better=False, low_threshold=10, mid_threshold=25, high_threshold=50)
            themes["pr3_value_consistency"] = _theme_result(
                "PR estimate vs PO actual (>20% deviation %)", score,
                metric_value=dev_pct, metric_unit="%",
                deviating=devs, checked=checked,
                note=f"{devs:,} of {checked:,} linked PR-PO pairs deviate by >20% ({dev_pct}%).",
            )
        else:
            themes["pr3_value_consistency"] = _unavailable(
                "PR estimate vs PO actual",
                required=["pr_total_value", "net_value"], reason="columns")

    theme_scores = {k: {"score": v["score"], "label": v["band"]} for k, v in themes.items()}
    weights = {"pr1_conversion": 0.40, "pr2_tat": 0.40, "pr3_value_consistency": 0.20}
    pillar_score = _v2_pillar_score(themes, weights)
    return {
        "pillar": "pr-to-po",
        "pillar_score": pillar_score,
        "themes": themes, "theme_scores": theme_scores, "rca_cards": rca_cards,
    }


# ────────────────────────────────────────────────────────────────────────────
# 3. Post-PO pillar
# ────────────────────────────────────────────────────────────────────────────

def run_post_po(po_df: pd.DataFrame, grn_df: Optional[pd.DataFrame],
                  inv_df: Optional[pd.DataFrame]) -> dict:
    themes: dict = {}
    rca_cards: list[dict] = []

    # pp1 — GRN coverage
    if grn_df is not None and "po_number" in grn_df.columns and "po_number" in po_df.columns:
        po_keys = set(po_df["po_number"].dropna().astype(str))
        grn_pos = set(grn_df["po_number"].dropna().astype(str))
        covered = po_keys & grn_pos
        cov_pct = _pct(len(covered), len(po_keys))
        themes["pp1_grn_coverage"] = _theme_result(
            "PO → GRN coverage", _score_from_pct(cov_pct),
            metric_value=cov_pct, metric_unit="%",
            covered=len(covered), total=len(po_keys),
            note=f"{len(covered):,} of {len(po_keys):,} POs have at least one GRN ({cov_pct}%).",
        )
        if cov_pct < 80:
            rca_cards.append({
                "theme": "pp1_grn_coverage", "severity": "medium",
                "headline": f"GRN posted for only {cov_pct}% of POs",
                "cause": "Services / catalogue POs may not require GRN; or delayed GRN posting.",
                "recommendation": "Tag GRN-required POs explicitly; enforce 7-day GRN SLA post receipt.",
            })
    else:
        themes["pp1_grn_coverage"] = _unavailable("PO → GRN coverage",
            required=["GRN file"], reason="file")

    # pp2 — Three-way match
    if grn_df is not None and inv_df is not None and \
       "po_number" in grn_df.columns and "po_number" in inv_df.columns:
        grn_pos = set(grn_df["po_number"].dropna().astype(str))
        inv_pos = set(inv_df["po_number"].dropna().astype(str))
        matched = grn_pos & inv_pos
        gap = (grn_pos | inv_pos) - matched
        match_pct = _pct(len(matched), len(grn_pos | inv_pos))
        themes["pp2_three_way_match"] = _theme_result(
            "PO ↔ GRN ↔ Invoice match rate", _score_from_pct(match_pct),
            metric_value=match_pct, metric_unit="%",
            matched=len(matched), gap=len(gap),
            note=f"{len(matched):,} POs have both GRN and Invoice; {len(gap):,} have only one side ({match_pct}% match).",
        )
        if match_pct < 75:
            rca_cards.append({
                "theme": "pp2_three_way_match", "severity": "high",
                "headline": f"Three-way match gap of {100-match_pct:.0f}%",
                "cause": "Receipt or invoice not aligned with PO — risk of duplicate / unsupported payments.",
                "recommendation": "Enforce 3-way match before payment release; investigate top vendors with mismatches.",
            })
    else:
        themes["pp2_three_way_match"] = _unavailable(
            "PO ↔ GRN ↔ Invoice match rate",
            required=["GRN file", "Invoice file"], reason="file")

    # pp3 — OTD %
    if all(c in po_df.columns for c in ("delivery_date", "gr_date")):
        dfx = po_df.dropna(subset=["delivery_date", "gr_date"]).copy()
        if not dfx.empty:
            dfx["delivery_date"] = pd.to_datetime(dfx["delivery_date"], errors="coerce")
            dfx["gr_date"] = pd.to_datetime(dfx["gr_date"], errors="coerce")
            dfx = dfx.dropna(subset=["delivery_date", "gr_date"])
            if not dfx.empty:
                on_time = (dfx["gr_date"] <= dfx["delivery_date"]).sum()
                otd_pct = _pct(int(on_time), len(dfx))
                themes["pp3_otd"] = _theme_result(
                    "On-Time Delivery %", _score_from_pct(otd_pct, low_threshold=50, mid_threshold=75, high_threshold=92),
                    metric_value=otd_pct, metric_unit="%",
                    on_time=int(on_time), total=len(dfx),
                    note=f"{int(on_time):,} of {len(dfx):,} deliveries on or before promised date ({otd_pct}%).",
                )
                if otd_pct < 75:
                    rca_cards.append({
                        "theme": "pp3_otd", "severity": "medium",
                        "headline": f"OTD at {otd_pct}% (below 75% threshold)",
                        "cause": "Supplier reliability gap; possible aggressive promised dates.",
                        "recommendation": "Vendor scorecard with OTD penalty clauses; review top 10 worst-performing vendors.",
                    })
            else:
                themes["pp3_otd"] = _unavailable("On-Time Delivery %",
                    required=["delivery_date", "gr_date"], reason="rows")
        else:
            themes["pp3_otd"] = _unavailable("On-Time Delivery %",
                required=["delivery_date", "gr_date"], reason="rows")
    else:
        themes["pp3_otd"] = _unavailable("On-Time Delivery %",
            required=["delivery_date", "gr_date"], reason="columns")

    theme_scores = {k: {"score": v["score"], "label": v["band"]} for k, v in themes.items()}
    weights = {"pp1_grn_coverage": 0.35, "pp2_three_way_match": 0.35, "pp3_otd": 0.30}
    pillar_score = _v2_pillar_score(themes, weights)
    return {
        "pillar": "post-po",
        "pillar_score": pillar_score,
        "themes": themes, "theme_scores": theme_scores, "rca_cards": rca_cards,
    }


# ────────────────────────────────────────────────────────────────────────────
# 4. Supplier pillar
# ────────────────────────────────────────────────────────────────────────────

def run_supplier(po_df: pd.DataFrame, vm_df: Optional[pd.DataFrame]) -> dict:
    themes: dict = {}
    rca_cards: list[dict] = []

    # sup1 — Concentration (top vendor share + HHI proxy)
    if "vendor_id" in po_df.columns and "net_value" in po_df.columns:
        v = pd.to_numeric(po_df["net_value"], errors="coerce").fillna(0)
        total = float(v.sum())
        if total > 0:
            spend = po_df.assign(_v=v).groupby("vendor_id")["_v"].sum().sort_values(ascending=False)
            top1 = float(spend.iloc[0]) / total if len(spend) else 0
            top10 = float(spend.head(10).sum()) / total if len(spend) >= 10 else 1.0
            # HHI: sum of squared share percentages (0-10000)
            shares = spend / total
            hhi = float((shares ** 2).sum() * 10000)
            # Score: top1 < 0.20 + top10 < 0.70 + HHI < 1500 → diversified
            score = 4.5
            if top1 > 0.30: score -= 1.5
            elif top1 > 0.20: score -= 0.5
            if hhi > 2500: score -= 1.0
            elif hhi > 1500: score -= 0.5
            score = max(1.0, score)
            themes["sup1_concentration"] = _theme_result(
                "Vendor concentration (top 1 share + HHI)", score,
                metric_value=round(top1 * 100, 1), metric_unit="%",
                top_vendor_share_pct=round(top1 * 100, 1),
                top10_share_pct=round(top10 * 100, 1),
                hhi=round(hhi, 0),
                vendor_count=len(spend),
                note=f"Top vendor {top1*100:.1f}% of spend; top 10 {top10*100:.1f}%; HHI {hhi:.0f} (concentration index).",
            )
            if top1 > 0.30 or hhi > 2500:
                rca_cards.append({
                    "theme": "sup1_concentration", "severity": "high",
                    "headline": f"Top vendor controls {top1*100:.0f}% of spend",
                    "cause": "Single-vendor dependency; switching cost or PAC-locked specifications.",
                    "recommendation": "Develop alternate vendor for top-3 categories; build dual-source RFP plan.",
                })

    # sup2 — Active vendors used vs master count
    if vm_df is not None and len(vm_df) > 0 and "vendor_id" in po_df.columns:
        master_total = len(vm_df)
        used = po_df["vendor_id"].dropna().astype(str).nunique()
        utilization = _pct(used, master_total)
        score = 4.5 if 30 <= utilization <= 70 else (3.5 if 20 <= utilization <= 85 else 2.0)
        themes["sup2_master_utilization"] = _theme_result(
            "Vendor master utilization", score,
            metric_value=utilization, metric_unit="%",
            used_vendors=used, master_total=master_total,
            note=f"{used:,} of {master_total:,} vendors in master are transacted with ({utilization}%).",
        )
        if utilization < 20:
            rca_cards.append({
                "theme": "sup2_master_utilization", "severity": "low",
                "headline": f"Only {utilization}% of master vendors are active",
                "cause": "Vendor master overpopulated with historical / one-off vendors.",
                "recommendation": "Annual dormancy purge for vendors with no PO in 24 months.",
            })

    # sup3 — MSME share (if MSME flag present)
    msme_pct = None
    if vm_df is not None and "msme_flag" in vm_df.columns and "vendor_id" in po_df.columns:
        msme_vendors = set(vm_df[vm_df["msme_flag"].astype(str).str.lower().isin({"true","yes","1","y"})]["vendor_id"].astype(str))
        if "net_value" in po_df.columns:
            v = pd.to_numeric(po_df["net_value"], errors="coerce").fillna(0)
            total = float(v.sum())
            msme_spend = float(v[po_df["vendor_id"].astype(str).isin(msme_vendors)].sum())
            msme_pct = _pct(msme_spend, total) if total > 0 else 0
            # Govt target: 25%; non-PSU benchmark: 5-15% directional
            score = 5.0 if msme_pct >= 25 else 4.0 if msme_pct >= 15 else 3.0 if msme_pct >= 5 else 2.0
            themes["sup3_msme"] = _theme_result(
                "MSME spend share", score,
                metric_value=msme_pct, metric_unit="%",
                msme_vendor_count=len(msme_vendors),
                msme_spend_inr=msme_spend,
                note=f"{msme_pct}% of spend with MSME vendors (govt PSU target 25%).",
            )
            if msme_pct < 5:
                rca_cards.append({
                    "theme": "sup3_msme", "severity": "low",
                    "headline": f"MSME spend share at {msme_pct}%",
                    "cause": "Limited MSME vendor base or selection bias toward larger suppliers.",
                    "recommendation": "MSME vendor development programme; aggregator partnerships for indirect categories.",
                })
    if "sup3_msme" not in themes:
        themes["sup3_msme"] = _unavailable("MSME spend share",
            required=["Vendor Master file", "msme_flag column"], reason="file")

    # Ensure all 3 themes present
    if "sup1_concentration" not in themes:
        themes["sup1_concentration"] = _unavailable("Vendor concentration",
            required=["vendor_id", "net_value"], reason="columns")
    if "sup2_master_utilization" not in themes:
        themes["sup2_master_utilization"] = _unavailable("Vendor master utilization",
            required=["Vendor Master file"], reason="file")

    theme_scores = {k: {"score": v["score"], "label": v["band"]} for k, v in themes.items()}
    weights = {"sup1_concentration": 0.45, "sup2_master_utilization": 0.30, "sup3_msme": 0.25}
    pillar_score = _v2_pillar_score(themes, weights)
    return {
        "pillar": "supplier",
        "pillar_score": pillar_score,
        "themes": themes, "theme_scores": theme_scores, "rca_cards": rca_cards,
    }
