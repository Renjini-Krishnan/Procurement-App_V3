"""Tier 1 smoke tests: engagement update, QRE roundtrip, intel endpoint."""
from __future__ import annotations

import os
import sys
import json
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="module")
def fresh_tier1_engagement():
    test_db = Path("/tmp/procvault_tier1_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="Tier1 Test", industry="steel",
                                plants=["P1", "P2"], annual_spend_inr_cr=5000,
                                fte_count=80)
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_engagement_update(fresh_tier1_engagement):
    from backend import db
    eid = fresh_tier1_engagement["engagement_id"]
    updated = db.update_engagement(eid, {"fte_count": 120, "plants": ["P1", "P2", "P3"]})
    assert updated["fte_count"] == 120
    assert updated["plants"] == ["P1", "P2", "P3"]
    assert updated["client_name"] == "Tier1 Test"   # unchanged


def test_qre_roundtrip(fresh_tier1_engagement):
    from backend import db
    eid = fresh_tier1_engagement["engagement_id"]
    seed = Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"
    items = json.loads(seed.read_text())["responses"][:10]
    n = db.upsert_qre_responses(eid, items)
    assert n == 10
    got = db.get_qre_responses(eid)
    assert len(got) == 10
    assert got[0]["score"] is not None
    # Idempotent upsert
    db.upsert_qre_responses(eid, items)
    assert len(db.get_qre_responses(eid)) == 10


def test_run_intel(fresh_tier1_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_intel(
        engagement_id=fresh_tier1_engagement["engagement_id"],
        upload_id=fresh_tier1_engagement["upload_id"],
        industry="steel",
    )
    assert "gold_summary" in r
    assert "classify_summary" in r
    assert "portfolio_summary" in r
    assert "by_archetype" in r
    assert r["mg_count"] > 0
    assert len(r["per_mg_table"]) > 0


def test_kpi_dashboard_uses_db_qre(fresh_tier1_engagement):
    """If QRE responses are in DB, the orchestrator should use them not the seed."""
    from backend import db
    from backend.engine import orchestrator
    eid = fresh_tier1_engagement["engagement_id"]
    # Set a distinctive D1.1 score
    db.upsert_qre_responses(eid, [{"id": "D1.1", "score": 4, "evidence": "test-override",
                                     "area": "Strategy", "question": "?", "required": True}])
    qre = orchestrator._load_qre(eid)
    # Should pull from DB. D1.1 should reflect our override.
    d11 = next((r for r in qre["responses"] if r["id"] == "D1.1"), None)
    assert d11 is not None
    assert d11["score"] == 4
    assert d11.get("evidence") == "test-override"
