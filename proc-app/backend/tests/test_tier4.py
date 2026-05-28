"""Tier 4 tests — seed datasets for all 8 types, background job runner."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


# --------------------------------------------------------------------------
# Seed dataset coverage
# --------------------------------------------------------------------------

def test_all_seeds_present():
    from backend.services import upload_service
    seeds = upload_service.list_available_seeds()
    types = {s["file_type"] for s in seeds}
    assert types == {"PO", "PR", "VENDOR_MASTER", "MATERIAL_MASTER",
                      "ORG_STRUCTURE", "CONTRACT_MASTER", "GRN", "INVOICE"}


@pytest.fixture(scope="module")
def fresh_seedall_engagement():
    test_db = Path("/tmp/procvault_seedall_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    from backend.services import jobs
    jobs.init_jobs_schema()
    eng = db.create_engagement(client_name="SeedAll", industry="steel")
    yield {"engagement_id": eng["id"]}
    if test_db.exists(): test_db.unlink()


def test_each_seed_loads_and_maps_cleanly(fresh_seedall_engagement):
    from backend.services import upload_service
    eid = fresh_seedall_engagement["engagement_id"]
    for ft in ["PO", "PR", "VENDOR_MASTER", "MATERIAL_MASTER",
                "ORG_STRUCTURE", "CONTRACT_MASTER", "GRN", "INVOICE"]:
        r = upload_service.use_seed_dataset(eid, ft)
        assert r["row_count"] > 0, f"{ft} has no rows"
        mapped = sum(1 for m in r["suggested_mapping"] if m["suggested_field"])
        total = len(r["suggested_mapping"])
        assert mapped == total, f"{ft} only mapped {mapped}/{total}"
        assert len(r["missing_required"]) == 0, f"{ft} missing required: {r['missing_required']}"


# --------------------------------------------------------------------------
# Background job runner
# --------------------------------------------------------------------------

def test_job_lifecycle_simple(fresh_seedall_engagement):
    """A trivial job goes queued → running → done."""
    from backend.services import jobs
    eid = fresh_seedall_engagement["engagement_id"]

    def _work(job_id):
        jobs.update_status(job_id, "running", progress=50, progress_message="halfway")
        time.sleep(0.05)
        return {"ok": True, "value": 42}

    jid = jobs.submit(eid, "test.trivial", _work, payload={},
                       summarise=lambda r: f"ok value={r['value']}")
    # Poll up to 2s
    for _ in range(40):
        j = jobs.get_job(jid)
        if j["status"] in ("done", "failed"):
            break
        time.sleep(0.05)
    assert j["status"] == "done"
    assert j["progress"] == 100
    assert "value=42" in j["result_summary"]


def test_job_failure_captured(fresh_seedall_engagement):
    from backend.services import jobs
    eid = fresh_seedall_engagement["engagement_id"]

    def _bomb(job_id):
        raise RuntimeError("boom")

    jid = jobs.submit(eid, "test.bomb", _bomb, payload={})
    for _ in range(40):
        j = jobs.get_job(jid)
        if j["status"] in ("done", "failed"):
            break
        time.sleep(0.05)
    assert j["status"] == "failed"
    assert "boom" in j["error"]


def test_job_engagement_scoping(fresh_seedall_engagement):
    from backend.services import jobs
    eid = fresh_seedall_engagement["engagement_id"]
    jid = jobs.submit(eid, "test.scope", lambda job_id: {"x": 1}, {},
                       summarise=lambda r: "ok")
    time.sleep(0.2)
    listed = jobs.list_jobs(eid)
    assert any(j["id"] == jid for j in listed)
    # Unrelated engagement sees nothing
    other = jobs.list_jobs("nonexistent-eid")
    assert not any(j["id"] == jid for j in other)


def test_pillar_job_via_target_runs(fresh_seedall_engagement):
    """Submit a real pillar job and verify it completes."""
    from backend.services import jobs, upload_service
    from backend.api import jobs as jobs_api
    eid = fresh_seedall_engagement["engagement_id"]

    # PO upload (re-using existing seed)
    r = upload_service.use_seed_dataset(eid, "PO")
    upid = r["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in r["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)

    target = jobs_api._target_run_pillar("buying-channel")
    jid = jobs.submit(eid, "pillar.buying-channel", target,
                      {"engagement_id": eid, "upload_id": upid, "industry": "steel"},
                      summarise=lambda r: f"score={r['pillar_score']['score']}")
    # Wait up to 30s
    for _ in range(300):
        j = jobs.get_job(jid)
        if j["status"] in ("done", "failed"):
            break
        time.sleep(0.1)
    assert j["status"] == "done", f"job failed: {j.get('error')}"
    assert "score=" in j["result_summary"]
