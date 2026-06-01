"""Org Structure engine smoke tests."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="module")
def fresh_os_engagement():
    test_db = Path("/tmp/procvault_os_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="OS Test", industry="steel")
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    # Pre-fill QRE — Org Structure pillar requires QRE to compute themes
    import json as _json
    from pathlib import Path as _Path
    seed_path = _Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"
    if seed_path.exists():
        d = _json.loads(seed_path.read_text())
        answered = [r for r in d.get("responses", []) if r.get("score") is not None]
        if answered:
            db.upsert_qre_responses(eng["id"], answered)
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_org_structure_runs(fresh_os_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_org_structure_pillar(
        engagement_id=fresh_os_engagement["engagement_id"],
        upload_id=fresh_os_engagement["upload_id"],
        industry="steel",
    )
    assert r["pillar"] == "org-structure"
    assert len(r["themes"]) == 4
    for tid in ["organisation-posture", "fte-sizing-role-composition",
                "spend-fte-distribution", "hierarchy-span"]:
        assert tid in r["themes"]


def test_org_structure_score_in_range(fresh_os_engagement):
    from backend.engine import orchestrator
    r = orchestrator.run_org_structure_pillar(
        engagement_id=fresh_os_engagement["engagement_id"],
        upload_id=fresh_os_engagement["upload_id"],
        industry="steel",
    )
    ps = r["pillar_score"]
    assert 1 <= ps["score"] <= 5
    for ts in r["theme_scores"].values():
        assert 1 <= ts["score"] <= 5
