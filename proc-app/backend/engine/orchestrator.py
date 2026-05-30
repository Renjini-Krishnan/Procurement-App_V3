"""Pipeline orchestrator — runs Stage 8 → 9 → 10 → 12 (pillar) end-to-end.

Public entry: run_op_model(engagement_id, upload_id, industry='steel') → dict
"""
from __future__ import annotations

import json
import time
import uuid
from typing import Any, Optional

import pandas as pd

from .. import db, kb_loader
from . import gold_data, rca_engine, scoring, stage9_classify, stage10_kpis
from . import kpi_calculator
from .buying_channel import run_buying_channel
from .doa import run_doa
from .op_model import run_centralisation, run_coe, run_shared_services, run_tail_spend
from .org_structure import run_org_structure


# Op Model theme weights (from analysis-config.yml — function default)
OP_MODEL_THEME_WEIGHTS = {
    "centralisation": 0.35,
    "shared-services": 0.25,
    "coe": 0.20,
    "tail-spend": 0.20,
}


def run_op_model(engagement_id: str, upload_id: str, industry: str = "steel") -> dict:
    """End-to-end Stage 8 → 9 → 10 → 12 for Op Model."""
    timings = {}
    t0 = time.time()

    # Stage 8 — Gold Data
    df_gold = gold_data.build_gold_dataframe(upload_id, lookback_months=_load_scope_lookback(engagement_id))
    gold_summary = gold_data.summarise(df_gold)
    timings["stage8_gold"] = round(time.time() - t0, 2)

    # Stage 9 — Classify
    t1 = time.time()
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    classify_summary = stage9_classify.summarise(df_classified)
    timings["stage9_classify"] = round(time.time() - t1, 2)

    # Stage 10 — KPIs (per-MG metrics)
    t2 = time.time()
    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    portfolio = stage10_kpis.portfolio_summary(df_mg)
    timings["stage10_kpis"] = round(time.time() - t2, 2)

    # Stage 12 — Op Model themes
    t3 = time.time()
    cent = run_centralisation(df_mg, industry=industry)
    ss = run_shared_services(df_mg, industry=industry)
    coe_out = run_coe(df_mg, ss["components"]["ss1_volume_value_quadrant"], industry=industry)
    tail = run_tail_spend(df_mg, df_classified, ss["components"]["ss1_volume_value_quadrant"], industry=industry)
    timings["stage12_op_model"] = round(time.time() - t3, 2)

    # Scoring
    theme_scores = {
        "centralisation": scoring.score_centralisation(cent),
        "shared-services": scoring.score_shared_services(ss),
        "coe": scoring.score_coe(coe_out),
        "tail-spend": scoring.score_tail_spend(tail),
    }
    pillar_score = scoring.pillar_score(theme_scores, OP_MODEL_THEME_WEIGHTS)

    # RCA
    theme_outputs = {
        "centralisation": cent,
        "shared-services": ss,
        "coe": coe_out,
        "tail-spend": tail,
    }
    rca_cards = rca_engine.run_rca_op_model(theme_outputs)

    timings["total"] = round(time.time() - t0, 2)

    result = {
        "engagement_id": engagement_id,
        "upload_id": upload_id,
        "pillar": "op-model",
        "industry": industry,
        "gold_summary": gold_summary,
        "classify_summary": classify_summary,
        "portfolio": portfolio,
        "themes": theme_outputs,
        "theme_scores": theme_scores,
        "pillar_score": pillar_score,
        "rca_cards": rca_cards,
        "timings_seconds": timings,
    }

    # Persist findings
    _persist_findings(engagement_id, result)
    _record_run(engagement_id, "op-model", result)
    db.set_stage_status(engagement_id, 8, "done", {"row_count": gold_summary.get("row_count")})
    db.set_stage_status(engagement_id, 9, "done", {"unclassified_pct": classify_summary.get("unclassified_pct")})
    db.set_stage_status(engagement_id, 10, "done", {"mg_count": len(df_mg)})
    db.set_stage_status(engagement_id, 12, "done", {"pillar_score": pillar_score})
    db.update_engagement_stage(engagement_id, 13)

    return result


def run_intel(engagement_id: str, upload_id: str, industry: str = "steel") -> dict:
    """Stage 8 + 9 + 10 only — pre-pillar gold/classify/portfolio view.
    Used by Stage 7 (Bronze report), 9 (Categorisation), 10 (KPIs), 11 (Primer)."""
    t0 = time.time()
    df_gold, cleansing_report = gold_data.build_gold_dataframe_with_report(upload_id, lookback_months=_load_scope_lookback(engagement_id))
    gold_summary = gold_data.summarise(df_gold)
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    classify_summary = stage9_classify.summarise(df_classified)

    # Stage 9 canonical classification (6-tier accumulator). Runs alongside
    # the V1 archetype classifier — adds canonical_id + signal_trace columns
    # without disturbing downstream pillars that key off archetype.
    from . import stage9_canonical_classify
    df_classified, canonical_report = stage9_canonical_classify.classify_canonical(
        df_classified, industry=industry,
    )

    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    portfolio = stage10_kpis.portfolio_summary(df_mg)

    # Per-archetype breakdown with spend Cr
    by_arch = {}
    for arch, info in portfolio.get("by_archetype", {}).items():
        by_arch[arch] = {
            "mg_count": info["mg_count"],
            "total_spend_inr_cr": round(info["total_spend_inr"] / 1e7, 1),
            "spend_share_pct": round(info["spend_share_pct"], 1),
        }

    # Top categories by spend (per-MG table)
    keep_cols = ["material_group", "material_group_desc", "archetype",
                 "total_spend_inr", "po_count", "po_count_6mo", "distinct_months",
                 "avg_po_value", "vendor_count", "top_vendor_share_pct",
                 "plant_count", "contracted_pct", "pac_pct"]
    keep_cols = [c for c in keep_cols if c in df_mg.columns]
    top_mg = df_mg.nlargest(50, "total_spend_inr")[keep_cols].copy()
    top_mg["total_spend_inr_cr"] = (top_mg["total_spend_inr"] / 1e7).round(2)
    per_mg_table = top_mg.to_dict(orient="records")

    db.set_stage_status(engagement_id, 8, "done", {"row_count": gold_summary.get("row_count")})
    db.set_stage_status(engagement_id, 9, "done", {"unclassified_pct": classify_summary.get("unclassified_pct")})
    db.set_stage_status(engagement_id, 10, "done", {"mg_count": len(df_mg)})

    # Multi-upload cleansing + cross-file recon (V2)
    per_upload_reports, cross_file_report = _run_multi_upload_bronze(engagement_id, lookback_months=_load_scope_lookback(engagement_id))

    # Methodology KPIs — TAT, RC%, Savings, PAC%, Tail%, Spend/FTE, OTD, Sourcing Tool
    # Now with per-canonical + per-archetype breakdowns + DQ + benchmarks.
    from . import methodology_kpis
    eng = db.get_engagement(engagement_id) or {}
    qre = _load_qre(engagement_id)

    # Look up PR cleaned df from the multi-upload bronze pass (for TAT join)
    pr_df = None
    for u in per_upload_reports:
        if u.get("file_type") == "PR" and not u.get("_error"):
            try:
                pr_df, _ = gold_data.build_gold_dataframe_with_report(
                    u["upload_id"], lookback_months=_load_scope_lookback(engagement_id),
                )
            except Exception:
                pr_df = None
            break

    # Build taxonomy lookup {canonical_id → {label, archetype}} for breakdowns
    taxonomy_lookup = {t["id"]: {"label": t.get("label", t["id"]),
                                   "archetype": t.get("archetype")}
                        for t in (canonical_report.get("taxonomy") or [])}

    methodology = methodology_kpis.compute_all(
        df_classified,
        fte_count=eng.get("fte_count"),
        qre_responses=qre,
        pr_df=pr_df,
        taxonomy_lookup=taxonomy_lookup,
    )

    # Per-canonical aggregate table (replaces / sits alongside per_mg_table)
    per_canonical_table: list[dict] = []
    if "canonical_id" in df_classified.columns:
        for cid, sub in df_classified.groupby("canonical_id"):
            meta = taxonomy_lookup.get(cid, {})
            spend_col = "net_value_inr" if "net_value_inr" in sub.columns else "net_value"
            spend = float(pd.to_numeric(sub[spend_col], errors="coerce").fillna(0).sum()) if spend_col in sub.columns else 0
            per_canonical_table.append({
                "canonical_id": str(cid),
                "canonical_label": meta.get("label") or str(cid),
                "archetype": meta.get("archetype"),
                "row_count": int(len(sub)),
                "po_count": int(sub["po_number"].nunique()) if "po_number" in sub.columns else 0,
                "vendor_count": int(sub["vendor_id"].nunique()) if "vendor_id" in sub.columns else 0,
                "plant_count": int(sub["plant"].nunique()) if "plant" in sub.columns else 0,
                "total_spend_inr": spend,
                "total_spend_inr_cr": round(spend / 1e7, 2),
            })
        per_canonical_table.sort(key=lambda r: -r["total_spend_inr"])

    # Data Quality Score + Pillar Feasibility (KB-PART-5)
    from . import cleansing_engine
    dqs = cleansing_engine.compute_data_quality_score(per_upload_reports, cross_file_report)
    pillar_feasibility = cleansing_engine.compute_pillar_feasibility(per_upload_reports, cross_file_report, dqs)

    return {
        "engagement_id": engagement_id,
        "upload_id": upload_id,
        "industry": industry,
        "gold_summary": gold_summary,
        "classify_summary": classify_summary,
        "portfolio_summary": portfolio,
        "by_archetype": by_arch,
        "per_mg_table": per_mg_table,
        "per_canonical_table": per_canonical_table,
        "mg_count": len(df_mg),
        "cleansing_report": cleansing_report,
        "per_upload_reports": per_upload_reports,
        "cross_file_recon": cross_file_report,
        "data_quality_score": dqs,
        "pillar_feasibility": pillar_feasibility,
        "canonical_classification": canonical_report,
        "methodology_kpis": methodology,
        "timings_seconds": {"total": round(time.time() - t0, 2)},
    }


def _run_multi_upload_bronze(engagement_id: str, lookback_months: Optional[int] = None) -> tuple[list[dict], dict]:
    """Run the cleansing pipeline on EVERY upload (PO + PR + GRN + Invoice +
    masters), then run cross-file recon. Returns (per_upload_reports, cross_file_report).
    Never raises — failures degrade to an entry with _error set."""
    from ..services import upload_service
    from . import cleansing_engine

    per_upload: list[dict] = []
    cleaned_dfs: dict[str, "pd.DataFrame"] = {}

    uploads = upload_service.list_uploads(engagement_id)
    for u in uploads:
        ft = u.get("file_type")
        entry = {
            "upload_id": u["id"],
            "file_type": ft,
            "original_filename": u.get("original_filename"),
            "row_count_raw": u.get("row_count"),
        }
        try:
            df, report = gold_data.build_gold_dataframe_with_report(
                u["id"], lookback_months=lookback_months
            )
            entry["row_count_cleaned"] = int(len(df))
            entry["cleansing_report"] = report
            cleaned_dfs[ft] = df
        except Exception as e:
            entry["_error"] = str(e)
        per_upload.append(entry)

    cross_report = cleansing_engine.apply_cross_file_recon(cleaned_dfs)
    cross_file_report = {
        "entries": cross_report.entries,
        "summary": cross_report.summary(),
        "available_file_types": sorted(list(cleaned_dfs.keys())),
    }
    return per_upload, cross_file_report


def _load_scope_lookback(engagement_id: str) -> Optional[int]:
    """Pull scope.lookback_months from engagement_overrides. None if unset."""
    try:
        for o in db.get_overrides(engagement_id):
            if o.get("key") == "scope.lookback_months":
                v = o.get("value")
                if isinstance(v, (int, float)) and v > 0:
                    return int(v)
    except Exception:
        pass
    return None


def _load_qre(engagement_id: str) -> dict:
    """Return QRE for engagement: DB-stored if any, else seed template."""
    stored = db.get_qre_responses(engagement_id)
    if stored and any(r.get("score") is not None for r in stored):
        return {"responses": [r for r in stored if r.get("score") is not None]}
    from pathlib import Path
    seed = Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"
    if seed.exists():
        return json.loads(seed.read_text())
    return {"responses": []}


def _persist_findings(engagement_id: str, result: dict) -> None:
    """Persist a small set of high-level findings to the findings table for later
    UI retrieval. V1 stores theme-level headlines + key metrics."""
    with db.db_connection() as conn:
        # Clear prior findings for this engagement + op-model
        conn.execute(
            "DELETE FROM findings WHERE engagement_id = ? AND pillar = ?",
            (engagement_id, "op-model"),
        )
        ts = db.now_iso()
        for theme_id, theme_data in result["themes"].items():
            fid = uuid.uuid4().hex[:12]
            conn.execute(
                """INSERT INTO findings
                (id, engagement_id, pillar, theme, component_id, severity,
                 headline, body, metrics, rca_pattern_id, recommendation_id,
                 citations, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    fid,
                    engagement_id,
                    "op-model",
                    theme_id,
                    "headline",
                    "medium",
                    theme_data.get("headline", ""),
                    json.dumps(theme_data.get("metrics", {})),
                    json.dumps(theme_data.get("metrics", {})),
                    None,
                    None,
                    json.dumps([]),
                    ts,
                ),
            )


def run_doa_pillar(engagement_id: str, upload_id: str, industry: str = "steel", qre_responses: Optional[dict] = None) -> dict:
    """Stage 14 — DoA pillar. Re-uses Stage 8/9/10 outputs."""
    import time
    timings = {}
    t0 = time.time()
    df_gold = gold_data.build_gold_dataframe(upload_id, lookback_months=_load_scope_lookback(engagement_id))
    timings["stage8_gold"] = round(time.time() - t0, 2)
    t1 = time.time()
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    timings["stage9_classify"] = round(time.time() - t1, 2)
    t2 = time.time()
    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    timings["stage10_kpis"] = round(time.time() - t2, 2)
    t3 = time.time()

    # Default QRE: prefer DB, fall back to seed
    if qre_responses is None:
        qre_responses = _load_qre(engagement_id)

    result = run_doa(df_classified, df_mg, qre_responses)
    timings["stage14_doa"] = round(time.time() - t3, 2)
    timings["total"] = round(time.time() - t0, 2)

    result["engagement_id"] = engagement_id
    result["upload_id"] = upload_id
    result["industry"] = industry
    result["timings_seconds"] = timings

    # Persist + advance stages
    db.set_stage_status(engagement_id, 14, "done", {"pillar_score": result["pillar_score"]})
    db.update_engagement_stage(engagement_id, 15)
    _persist_findings_doa(engagement_id, result)
    _record_run(engagement_id, "doa", result)

    return result


def _persist_findings_doa(engagement_id: str, result: dict) -> None:
    import json
    import uuid
    with db.db_connection() as conn:
        conn.execute("DELETE FROM findings WHERE engagement_id = ? AND pillar = ?", (engagement_id, "doa"))
        ts = db.now_iso()
        for theme_id, theme_data in result["themes"].items():
            fid = uuid.uuid4().hex[:12]
            conn.execute(
                """INSERT INTO findings
                (id, engagement_id, pillar, theme, component_id, severity,
                 headline, body, metrics, rca_pattern_id, recommendation_id,
                 citations, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (fid, engagement_id, "doa", theme_id, "headline", "medium",
                 theme_data.get("headline", ""), json.dumps(theme_data.get("metrics", {})),
                 json.dumps(theme_data.get("metrics", {})), None, None, json.dumps([]), ts),
            )


def run_buying_channel_pillar(engagement_id: str, upload_id: str, industry: str = "steel") -> dict:
    """Stage 16 — Buying Channel pillar."""
    timings = {}
    t0 = time.time()
    df_gold = gold_data.build_gold_dataframe(upload_id, lookback_months=_load_scope_lookback(engagement_id))
    timings["stage8_gold"] = round(time.time() - t0, 2)
    t1 = time.time()
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    timings["stage9_classify"] = round(time.time() - t1, 2)
    t2 = time.time()
    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    timings["stage10_kpis"] = round(time.time() - t2, 2)
    t3 = time.time()
    result = run_buying_channel(df_classified, df_mg, industry=industry)
    timings["stage16_buying_channel"] = round(time.time() - t3, 2)
    timings["total"] = round(time.time() - t0, 2)

    result["engagement_id"] = engagement_id
    result["upload_id"] = upload_id
    result["industry"] = industry
    result["timings_seconds"] = timings

    db.set_stage_status(engagement_id, 16, "done", {"pillar_score": result["pillar_score"]})
    db.update_engagement_stage(engagement_id, 17)
    _persist_findings_generic(engagement_id, result, "buying-channel")
    _record_run(engagement_id, "buying-channel", result)
    return result


def run_org_structure_pillar(engagement_id: str, upload_id: str, industry: str = "steel",
                              qre_responses: Optional[dict] = None) -> dict:
    """Stage 13 — Org Structure pillar (V1 QRE-driven)."""
    timings = {}
    t0 = time.time()
    df_gold = gold_data.build_gold_dataframe(upload_id, lookback_months=_load_scope_lookback(engagement_id))
    timings["stage8_gold"] = round(time.time() - t0, 2)
    t1 = time.time()
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    timings["stage9_classify"] = round(time.time() - t1, 2)
    t2 = time.time()
    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    timings["stage10_kpis"] = round(time.time() - t2, 2)

    # Load QRE: prefer DB, fall back to seed
    if qre_responses is None:
        qre_responses = _load_qre(engagement_id)

    engagement = db.get_engagement(engagement_id) or {}

    t3 = time.time()
    result = run_org_structure(df_mg, df_gold, engagement, qre_responses=qre_responses)
    timings["stage13_org_structure"] = round(time.time() - t3, 2)
    timings["total"] = round(time.time() - t0, 2)

    result["engagement_id"] = engagement_id
    result["upload_id"] = upload_id
    result["industry"] = industry
    result["timings_seconds"] = timings

    db.set_stage_status(engagement_id, 13, "done", {"pillar_score": result["pillar_score"]})
    db.update_engagement_stage(engagement_id, 14)
    _persist_findings_generic(engagement_id, result, "org-structure")
    _record_run(engagement_id, "org-structure", result)
    return result


def run_kpi_dashboard(engagement_id: str, upload_id: str, industry: str = "steel",
                       qre_responses: Optional[dict] = None) -> dict:
    """Stage 30 — KPI Dashboard. Runs all 4 pillars, assembles unified KPI list."""
    timings = {}
    t0 = time.time()

    # Stage 8/9/10 once
    df_gold = gold_data.build_gold_dataframe(upload_id, lookback_months=_load_scope_lookback(engagement_id))
    timings["stage8_gold"] = round(time.time() - t0, 2)
    t1 = time.time()
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    timings["stage9_classify"] = round(time.time() - t1, 2)
    t2 = time.time()
    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    portfolio = stage10_kpis.portfolio_summary(df_mg)
    timings["stage10_kpis"] = round(time.time() - t2, 2)

    # Op Model
    t3 = time.time()
    cent = run_centralisation(df_mg, industry=industry)
    ss = run_shared_services(df_mg, industry=industry)
    coe_out = run_coe(df_mg, ss["components"]["ss1_volume_value_quadrant"], industry=industry)
    tail = run_tail_spend(df_mg, df_classified, ss["components"]["ss1_volume_value_quadrant"], industry=industry)
    op_theme_scores = {
        "centralisation": scoring.score_centralisation(cent),
        "shared-services": scoring.score_shared_services(ss),
        "coe": scoring.score_coe(coe_out),
        "tail-spend": scoring.score_tail_spend(tail),
    }
    op_result = {
        "pillar": "op-model",
        "themes": {"centralisation": cent, "shared-services": ss, "coe": coe_out, "tail-spend": tail},
        "theme_scores": op_theme_scores,
        "pillar_score": scoring.pillar_score(op_theme_scores, OP_MODEL_THEME_WEIGHTS),
    }
    timings["op_model"] = round(time.time() - t3, 2)

    # Buying Channel
    t4 = time.time()
    bc_result = run_buying_channel(df_classified, df_mg, industry=industry)
    timings["buying_channel"] = round(time.time() - t4, 2)

    # Load QRE: prefer DB, fall back to seed
    if qre_responses is None:
        qre_responses = _load_qre(engagement_id)
    engagement = db.get_engagement(engagement_id) or {}

    # Org Structure
    t5 = time.time()
    org_result = run_org_structure(df_mg, df_gold, engagement, qre_responses=qre_responses)
    timings["org_structure"] = round(time.time() - t5, 2)

    # DoA
    t6 = time.time()
    doa_result = run_doa(df_classified, df_mg, qre_responses)
    timings["doa"] = round(time.time() - t6, 2)

    # Assemble unified KPI list
    pillar_results = {
        "op-model": op_result,
        "buying-channel": bc_result,
        "org-structure": org_result,
        "doa": doa_result,
    }
    # Record each pillar run for comparison history
    for pid, pres in pillar_results.items():
        _record_run(engagement_id, pid, pres)

    t7 = time.time()
    # Pull engagement-level overrides for KPI bands
    override_rows = db.get_overrides(engagement_id)
    band_overrides = {}
    for row in override_rows:
        if row.get("override_type") == "kpi_band":
            band_overrides[row["key"]] = row["value"]
    kpis = kpi_calculator.assemble_kpis(pillar_results, df_classified, overrides=band_overrides)
    timings["kpi_assemble"] = round(time.time() - t7, 2)

    # Pillar-level summaries (for sidebar counts)
    pillar_summary = {
        pid: {
            "pillar_score": pres["pillar_score"],
            "kpi_count": sum(1 for k in kpis if k["pillar"] == pid),
            "in_band": sum(1 for k in kpis if k["pillar"] == pid and k["status"] == "in"),
            "under": sum(1 for k in kpis if k["pillar"] == pid and k["status"] == "under"),
            "over": sum(1 for k in kpis if k["pillar"] == pid and k["status"] == "over"),
        }
        for pid, pres in pillar_results.items()
    }

    timings["total"] = round(time.time() - t0, 2)

    db.set_stage_status(engagement_id, 30, "done", {"kpi_count": len(kpis)})
    db.update_engagement_stage(engagement_id, 30)

    return {
        "engagement_id": engagement_id,
        "upload_id": upload_id,
        "industry": industry,
        "portfolio": portfolio,
        "kpis": kpis,
        "pillar_summary": pillar_summary,
        "pillar_results": pillar_results,
        "timings_seconds": timings,
    }


def _record_run(engagement_id: str, pillar: str, result: dict) -> None:
    themes = result.get("themes") or {}
    first_theme = next(iter(themes.values()), {}) if themes else {}
    headline = first_theme.get("headline", "") if isinstance(first_theme, dict) else ""
    db.record_pillar_run(
        engagement_id=engagement_id,
        pillar=pillar,
        pillar_score=result.get("pillar_score"),
        theme_scores=result.get("theme_scores", {}),
        headline=headline,
    )


def _persist_findings_generic(engagement_id: str, result: dict, pillar: str) -> None:
    with db.db_connection() as conn:
        conn.execute("DELETE FROM findings WHERE engagement_id = ? AND pillar = ?", (engagement_id, pillar))
        ts = db.now_iso()
        for theme_id, theme_data in result.get("themes", {}).items():
            fid = uuid.uuid4().hex[:12]
            conn.execute(
                """INSERT INTO findings
                (id, engagement_id, pillar, theme, component_id, severity,
                 headline, body, metrics, rca_pattern_id, recommendation_id,
                 citations, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (fid, engagement_id, pillar, theme_id, "headline", "medium",
                 theme_data.get("headline", ""), json.dumps(theme_data.get("metrics", {})),
                 json.dumps(theme_data.get("metrics", {})), None, None, json.dumps([]), ts),
            )


def get_pillar_runs(engagement_id: str, pillar: Optional[str] = None) -> list[dict]:
    return db.list_pillar_runs(engagement_id, pillar=pillar)


def get_findings(engagement_id: str, pillar: Optional[str] = None) -> list[dict]:
    with db.db_connection() as conn:
        if pillar:
            rows = conn.execute(
                "SELECT * FROM findings WHERE engagement_id = ? AND pillar = ? ORDER BY created_at DESC",
                (engagement_id, pillar),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM findings WHERE engagement_id = ? ORDER BY created_at DESC",
                (engagement_id,),
            ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        for k in ("metrics", "citations"):
            if d.get(k):
                try:
                    d[k] = json.loads(d[k])
                except Exception:
                    pass
        out.append(d)
    return out
