"""Stage 30 KPI Dashboard end-to-end test."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="module")
def fresh_kpi_engagement():
    test_db = Path("/tmp/procvault_kpi_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    # Engagement-level fields the org-structure pillar uses for fte-sizing
    eng = db.create_engagement(client_name="KPI Test", industry="steel",
                                  fte_count=50, annual_spend_inr_cr=250)
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    # Pre-fill QRE responses so QRE-dependent pillars (DoA, Org Structure)
    # produce themes instead of the needs_qre stub.
    import json as _json
    from pathlib import Path as _Path
    seed_path = _Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"
    if seed_path.exists():
        d = _json.loads(seed_path.read_text())
        answered = [r for r in d.get("responses", []) if r.get("score") is not None]
        if answered:
            db.upsert_qre_responses(eng["id"], answered)
    # Seed a DoA tier matrix so the po-compliance theme can produce KPIs.
    db.upsert_override(eng["id"], "doa.tier_thresholds_inr", [
        {"label": "Tier 1 — Manager",  "max_inr": 500000},
        {"label": "Tier 2 — Sr Mgr",   "max_inr": 5000000},
        {"label": "Tier 3 — Director", "max_inr": 25000000},
        {"label": "Tier 4 — CXO",      "max_inr": 100000000},
        {"label": "Tier 5 — Board",    "max_inr": None},
    ], override_type="threshold")
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_kpi_dashboard_runs(fresh_kpi_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_kpi_dashboard(
        engagement_id=fresh_kpi_engagement["engagement_id"],
        upload_id=fresh_kpi_engagement["upload_id"],
        industry="steel",
    )
    assert "kpis" in r
    assert "pillar_summary" in r
    assert len(r["kpis"]) > 10   # all 4 pillars combined


def test_kpi_dashboard_all_pillars_represented(fresh_kpi_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_kpi_dashboard(
        engagement_id=fresh_kpi_engagement["engagement_id"],
        upload_id=fresh_kpi_engagement["upload_id"],
        industry="steel",
    )
    pillars_in_kpis = {k["pillar"] for k in r["kpis"]}
    for p in ["op-model", "buying-channel", "org-structure", "doa"]:
        assert p in pillars_in_kpis
        assert p in r["pillar_summary"]


def test_kpi_dashboard_kpi_shape(fresh_kpi_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_kpi_dashboard(
        engagement_id=fresh_kpi_engagement["engagement_id"],
        upload_id=fresh_kpi_engagement["upload_id"],
        industry="steel",
    )
    k = r["kpis"][0]
    for f in ["id", "label", "pillar", "theme", "value", "unit", "band",
              "band_meaning", "status", "delta", "spark", "benchmark",
              "finding", "drill_down"]:
        assert f in k, f"missing field {f}"
    assert k["status"] in {"in", "under", "over", "unknown"}


def test_kpi_dashboard_pillar_summary_has_counts(fresh_kpi_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_kpi_dashboard(
        engagement_id=fresh_kpi_engagement["engagement_id"],
        upload_id=fresh_kpi_engagement["upload_id"],
        industry="steel",
    )
    for pid, s in r["pillar_summary"].items():
        assert s["kpi_count"] == s["in_band"] + s["under"] + s["over"] + sum(
            1 for k in r["kpis"] if k["pillar"] == pid and k["status"] == "unknown"
        )
