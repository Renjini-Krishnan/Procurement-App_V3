"""Buying Channel engine smoke tests."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="module")
def fresh_bc_engagement():
    test_db = Path("/tmp/procvault_bc_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="BC Test", industry="steel")
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_buying_channel_runs(fresh_bc_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_buying_channel_pillar(
        engagement_id=fresh_bc_engagement["engagement_id"],
        upload_id=fresh_bc_engagement["upload_id"],
        industry="steel",
    )
    assert r["pillar"] == "buying-channel"
    assert "buying-channel-strategy" in r["themes"]
    theme = r["themes"]["buying-channel-strategy"]
    assert "headline" in theme
    assert "components" in theme
    # 13 components expected
    comp = theme["components"]
    for k in ["bc1_portfolio_channel_mix", "bc3_archetype_channel_heatmap",
              "bc5_match_status", "bc6_migration_opportunities",
              "bc8_sole_source_risk", "bc13_contract_coverage_lift"]:
        assert k in comp


def test_buying_channel_score_in_range(fresh_bc_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_buying_channel_pillar(
        engagement_id=fresh_bc_engagement["engagement_id"],
        upload_id=fresh_bc_engagement["upload_id"],
        industry="steel",
    )
    assert 1 <= r["pillar_score"]["score"] <= 5


def test_buying_channel_match_status_present(fresh_bc_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_buying_channel_pillar(
        engagement_id=fresh_bc_engagement["engagement_id"],
        upload_id=fresh_bc_engagement["upload_id"],
        industry="steel",
    )
    bc5 = r["themes"]["buying-channel-strategy"]["components"]["bc5_match_status"]
    total = bc5["already_right_count"] + bc5["misrouted_count"] + bc5["over_engineered_count"] + bc5["unrecoverable_count"]
    assert total > 0


def test_buying_channel_per_mg_table_has_required_fields(fresh_bc_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_buying_channel_pillar(
        engagement_id=fresh_bc_engagement["engagement_id"],
        upload_id=fresh_bc_engagement["upload_id"],
        industry="steel",
    )
    rows = r["themes"]["buying-channel-strategy"]["per_mg_table"]
    assert len(rows) > 0
    for row in rows[:5]:
        assert "current_channel" in row
        assert "recommended_channel" in row
        assert "match_status" in row
