"""Tier 2 smoke tests: KB file editor + pillar run history."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def test_kb_files_tree():
    from backend.api.kb_files import list_tree
    t = list_tree()
    assert "function" in t["roots"]
    assert len(t["files"]["function"]) > 0


def test_kb_file_roundtrip(tmp_path):
    from backend.api.kb_files import list_tree, read_file, write_file, WriteRequest
    t = list_tree()
    f = t["files"]["function"][0]
    r = read_file("function", f["rel_path"])
    assert r["content"]
    # Roundtrip with same content (should succeed)
    res = write_file(WriteRequest(root="function", path=f["rel_path"], content=r["content"]))
    assert res["status"] == "ok"


def test_kb_file_path_traversal_blocked():
    from backend.api.kb_files import read_file
    with pytest.raises(Exception):
        read_file("function", "../../../etc/passwd")


def test_kb_file_bad_yaml_rejected():
    from backend.api.kb_files import list_tree, write_file, WriteRequest
    t = list_tree()
    yaml_files = [f for f in t["files"]["function"] if f["ext"] in ("yml", "yaml")]
    yf = yaml_files[0]
    with pytest.raises(Exception):
        write_file(WriteRequest(root="function", path=yf["rel_path"], content="{: : : ::"))


@pytest.fixture(scope="module")
def fresh_runs_engagement():
    test_db = Path("/tmp/procvault_tier2_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="Tier2", industry="steel")
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_pillar_run_records_history(fresh_runs_engagement):
    from backend.engine import orchestrator
    from backend import db
    eid = fresh_runs_engagement["engagement_id"]
    upid = fresh_runs_engagement["upload_id"]

    # Run buying-channel twice
    orchestrator.run_buying_channel_pillar(eid, upid, "steel")
    orchestrator.run_buying_channel_pillar(eid, upid, "steel")

    runs = db.list_pillar_runs(eid, pillar="buying-channel")
    assert len(runs) == 2
    assert runs[0]["pillar_score"] is not None
    assert runs[0]["theme_scores"]


def test_multi_pillar_history(fresh_runs_engagement):
    from backend.engine import orchestrator
    from backend import db
    eid = fresh_runs_engagement["engagement_id"]
    upid = fresh_runs_engagement["upload_id"]

    orchestrator.run_doa_pillar(eid, upid, "steel")
    orchestrator.run_org_structure_pillar(eid, upid, "steel")

    all_runs = db.list_pillar_runs(eid)
    pillars = {r["pillar"] for r in all_runs}
    assert "doa" in pillars
    assert "org-structure" in pillars
