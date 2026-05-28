"""DoA engine smoke tests."""
from __future__ import annotations

import os
import sys
import json
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="module")
def fresh_doa_engagement():
    test_db = Path("/tmp/procvault_doa_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db, kb_loader
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="DoA Test", industry="steel")
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_doa_pillar_runs(fresh_doa_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_doa_pillar(
        engagement_id=fresh_doa_engagement["engagement_id"],
        upload_id=fresh_doa_engagement["upload_id"],
        industry="steel",
    )
    assert result["pillar"] == "doa"
    assert "themes" in result
    assert len(result["themes"]) == 5
    for theme_id in ["document-audit", "robustness", "po-compliance", "system-enforcement", "bucket-optimisation"]:
        assert theme_id in result["themes"]
        assert "headline" in result["themes"][theme_id]


def test_doa_pillar_score_in_range(fresh_doa_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_doa_pillar(
        engagement_id=fresh_doa_engagement["engagement_id"],
        upload_id=fresh_doa_engagement["upload_id"],
        industry="steel",
    )
    ps = result["pillar_score"]
    assert 1.0 <= ps["score"] <= 5.0
    for tname, s in result["theme_scores"].items():
        assert 1 <= s["score"] <= 5


def test_doa_reference_template_loaded(fresh_doa_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_doa_pillar(
        engagement_id=fresh_doa_engagement["engagement_id"],
        upload_id=fresh_doa_engagement["upload_id"],
        industry="steel",
    )
    # Robustness theme reads the reference template
    rb = result["themes"]["robustness"]
    assert rb["metrics"]["reference_mandatory_cases_count"] > 0
