"""Pipeline orchestrator — runs Stage 8 → 9 → 10 → 12 (pillar) end-to-end.

Public entry: run_op_model(engagement_id, upload_id, industry='steel') → dict
"""
from __future__ import annotations

import json
import time
import uuid
from typing import Any, Optional

from .. import db, kb_loader
from . import gold_data, rca_engine, scoring, stage9_classify, stage10_kpis
from .doa import run_doa
from .op_model import run_centralisation, run_coe, run_shared_services, run_tail_spend


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
    df_gold = gold_data.build_gold_dataframe(upload_id)
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
    db.set_stage_status(engagement_id, 8, "done", {"row_count": gold_summary.get("row_count")})
    db.set_stage_status(engagement_id, 9, "done", {"unclassified_pct": classify_summary.get("unclassified_pct")})
    db.set_stage_status(engagement_id, 10, "done", {"mg_count": len(df_mg)})
    db.set_stage_status(engagement_id, 12, "done", {"pillar_score": pillar_score})
    db.update_engagement_stage(engagement_id, 13)

    return result


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
    df_gold = gold_data.build_gold_dataframe(upload_id)
    timings["stage8_gold"] = round(time.time() - t0, 2)
    t1 = time.time()
    df_classified = stage9_classify.classify_dataframe(df_gold, industry=industry)
    timings["stage9_classify"] = round(time.time() - t1, 2)
    t2 = time.time()
    df_mg = stage10_kpis.precompute_mg_metrics(df_classified)
    timings["stage10_kpis"] = round(time.time() - t2, 2)
    t3 = time.time()

    # Default QRE: load seed if not provided
    if qre_responses is None:
        from pathlib import Path
        import json
        seed = Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"
        if seed.exists():
            qre_responses = json.loads(seed.read_text())

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
