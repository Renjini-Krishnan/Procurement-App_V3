"""End-to-end engine smoke test.

Runs Stage 8 → 9 → 10 → 12 (all 4 Op Model themes) against the committed
seed PO dataset. Verifies the pipeline completes, produces findings for
each theme, and the maturity scoring is in the 1-5 range.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Allow `from backend import ...` when running pytest from proc-app/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="module")
def fresh_engagement():
    """Create a fresh engagement with the seed PO dataset uploaded + mapped."""
    # Point at an isolated test DB so we don't trample the dev DB
    test_db = Path("/tmp/procvault_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)

    # Force re-import of config + db with the new env var
    import importlib
    from backend import config, db, kb_loader
    importlib.reload(config)
    importlib.reload(db)

    db.init_db()
    eng = db.create_engagement(client_name="Test Steel Mill", industry="steel")

    # Upload seed + confirm mapping
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)

    yield {"engagement_id": eng["id"], "upload_id": upid}

    # Cleanup
    if test_db.exists():
        test_db.unlink()


def test_full_pipeline_runs(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    assert result["pillar"] == "op-model"
    assert result["industry"] == "steel"
    assert "gold_summary" in result
    assert result["gold_summary"]["row_count"] > 0
    assert result["gold_summary"]["mg_count"] > 0


def test_stage9_classifies_majority(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    # We expect classification to handle the bulk of the data
    unclassified_pct = result["classify_summary"]["unclassified_pct"]
    assert unclassified_pct < 30, f"Unclassified % too high: {unclassified_pct}"


def test_all_four_themes_run(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    themes = result["themes"]
    assert "centralisation" in themes
    assert "shared-services" in themes
    assert "coe" in themes
    assert "tail-spend" in themes
    for t, td in themes.items():
        assert "headline" in td
        assert "metrics" in td
        assert "components" in td


def test_scores_in_range(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    for tname, score in result["theme_scores"].items():
        assert 1 <= score["score"] <= 5, f"{tname} score out of range: {score['score']}"
    pillar = result["pillar_score"]
    assert 1.0 <= pillar["score"] <= 5.0


def test_centralisation_finds_candidates(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    cent = result["themes"]["centralisation"]
    # Synthetic data is engineered to surface multi-plant categories
    assert cent["metrics"]["candidate_count"] >= 5
    assert cent["metrics"]["savings_range_inr_cr"][1] > 0


def test_ss1_quadrant_classification(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    ss1 = result["themes"]["shared-services"]["components"]["ss1_volume_value_quadrant"]
    # All 4 quadrants should have some categories given the synthetic data spread
    assert len(ss1["q1_categories"]) >= 1
    assert len(ss1["q4_categories"]) >= 1


def test_steel_overlay_applied_in_benchmarks(fresh_engagement):
    """Verify the cascade is wired — Steel overlay overrides function default."""
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    c4 = result["themes"]["centralisation"]["components"]["c4_savings_quantification"]
    # Steel overrides opmodel.centralisation.savings_rate
    assert c4["benchmark_overridden_by"] == "industry_overlay"


def test_rca_rules_fire(fresh_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_op_model(
        engagement_id=fresh_engagement["engagement_id"],
        upload_id=fresh_engagement["upload_id"],
        industry="steel",
    )
    # We expect at least one RCA rule to fire with the synthetic data shape
    assert len(result["rca_cards"]) >= 1
    for card in result["rca_cards"]:
        assert "rule_id" in card
        assert "root_causes" in card
        assert "confidence" in card
