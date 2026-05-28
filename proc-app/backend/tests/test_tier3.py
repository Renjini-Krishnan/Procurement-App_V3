"""Tier 3 tests — multi-type schemas, cleansing engine, PPT/Excel export,
comparison, overrides, engagement delete."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


# --------------------------------------------------------------------------
# Schema loader — all 8 file types
# --------------------------------------------------------------------------

def test_all_schemas_load():
    from backend.services import canonical_schema as cs
    types = [s["file_type"] for s in cs.list_schema_types()]
    assert set(types) == {"PO", "PR", "VENDOR_MASTER", "MATERIAL_MASTER",
                           "ORG_STRUCTURE", "CONTRACT_MASTER", "GRN", "INVOICE"}
    for t in types:
        schema = cs.get_schema(t)
        assert len(schema["fields"]) > 0
        assert any(f["required"] for f in schema["fields"])


def test_schema_mapping_works_for_each_type():
    from backend.services import canonical_schema as cs
    samples = {
        "VENDOR_MASTER": ["Vendor Number", "NAME1", "GSTIN"],
        "MATERIAL_MASTER": ["Material_Number", "Description", "MATKL", "MTART"],
        "ORG_STRUCTURE": ["Employee_ID", "Reports_To", "Designation"],
        "CONTRACT_MASTER": ["Contract_Number", "BSART", "LIFNR"],
        "GRN": ["GRN_Number", "BWART", "MENGE"],
        "INVOICE": ["Invoice_Number", "BLDAT", "WRBTR"],
    }
    for ft, cols in samples.items():
        result = cs.suggest_mapping(cols, ft)
        # At least one column should map
        mapped = sum(1 for m in result["matches"] if m["suggested_field"])
        assert mapped > 0, f"No columns mapped for {ft}: {cols}"


# --------------------------------------------------------------------------
# Cleansing engine
# --------------------------------------------------------------------------

@pytest.fixture(scope="module")
def fresh_t3_engagement():
    test_db = Path("/tmp/procvault_t3_test.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="T3 Test", industry="steel",
                                annual_spend_inr_cr=5000, fte_count=80)
    from backend.services import upload_service
    result = upload_service.use_seed_dataset(eng["id"])
    upid = result["upload_id"]
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in result["suggested_mapping"]]
    upload_service.confirm_mapping(upid, conf)
    yield {"engagement_id": eng["id"], "upload_id": upid}
    if test_db.exists(): test_db.unlink()


def test_cleansing_report_fires(fresh_t3_engagement):
    from backend.engine import gold_data
    _df, report = gold_data.build_gold_dataframe_with_report(fresh_t3_engagement["upload_id"])
    assert report["summary"]["rules_fired"] > 0
    severities = set(e["severity"] for e in report["entries"])
    assert "fix" in severities or "info" in severities


def test_intel_exposes_cleansing_report(fresh_t3_engagement):
    from backend.engine import orchestrator
    intel = orchestrator.run_intel(
        fresh_t3_engagement["engagement_id"],
        fresh_t3_engagement["upload_id"], "steel",
    )
    assert "cleansing_report" in intel
    assert intel["cleansing_report"]["summary"]["rules_fired"] > 0


# --------------------------------------------------------------------------
# PPT + Excel exports
# --------------------------------------------------------------------------

def test_ppt_findings_deck_generates(fresh_t3_engagement):
    from backend import db
    from backend.engine import orchestrator
    from backend.services import ppt_generator
    eng = db.get_engagement(fresh_t3_engagement["engagement_id"])
    kp = orchestrator.run_kpi_dashboard(
        eng["id"], fresh_t3_engagement["upload_id"], "steel",
    )
    pptx = ppt_generator.generate_findings_deck(eng, kp)
    assert len(pptx) > 10_000   # non-trivial PPTX
    assert pptx[:2] == b"PK"    # PPTX is a zip


def test_ppt_exec_summary_generates(fresh_t3_engagement):
    from backend import db
    from backend.engine import orchestrator
    from backend.services import ppt_generator
    eng = db.get_engagement(fresh_t3_engagement["engagement_id"])
    kp = orchestrator.run_kpi_dashboard(eng["id"], fresh_t3_engagement["upload_id"], "steel")
    pptx = ppt_generator.generate_exec_summary_deck(eng, kp)
    assert len(pptx) > 10_000
    assert pptx[:2] == b"PK"


# --------------------------------------------------------------------------
# Comparison
# --------------------------------------------------------------------------

def test_comparison_after_two_runs(fresh_t3_engagement):
    from backend.engine import orchestrator
    from backend.api.exports import compare_runs
    orchestrator.run_kpi_dashboard(fresh_t3_engagement["engagement_id"],
                                     fresh_t3_engagement["upload_id"], "steel")
    orchestrator.run_kpi_dashboard(fresh_t3_engagement["engagement_id"],
                                     fresh_t3_engagement["upload_id"], "steel")
    cmp = compare_runs(fresh_t3_engagement["engagement_id"])
    assert len(cmp["comparisons"]) == 4
    for c in cmp["comparisons"]:
        assert c["current"] is not None
        assert c["prior"] is not None
        assert c["delta"] is not None
        assert c["trend"] in ("up", "down", "flat")


# --------------------------------------------------------------------------
# KPI band overrides
# --------------------------------------------------------------------------

def test_kpi_band_override_persists_and_applies(fresh_t3_engagement):
    from backend import db
    from backend.engine import orchestrator
    eid = fresh_t3_engagement["engagement_id"]
    upid = fresh_t3_engagement["upload_id"]

    # Baseline KPI dashboard
    kp1 = orchestrator.run_kpi_dashboard(eid, upid, "steel")
    target = next((k for k in kp1["kpis"] if k["status"] in ("in", "under", "over")), None)
    assert target

    # Apply a band override that should flip status
    if target["band_meaning"] == "higher_is_better":
        new_band = {"low": 9999, "high": 99999}  # force "under"
        expected_status = "under"
    elif target["band_meaning"] == "lower_is_better":
        new_band = {"low": 0, "high": 0}  # force "over" if value > 0
        expected_status = "over" if isinstance(target["value"], (int, float)) and target["value"] > 0 else None
    else:
        new_band = {"low": 9999, "high": 99999}
        expected_status = "under"

    db.upsert_override(eid, target["id"], new_band, "kpi_band")

    # Re-run
    kp2 = orchestrator.run_kpi_dashboard(eid, upid, "steel")
    after = next(k for k in kp2["kpis"] if k["id"] == target["id"])
    assert after["band_overridden"]
    assert after["band"] == new_band
    if expected_status:
        assert after["status"] == expected_status

    # Clear override
    db.delete_override(eid, target["id"])
    kp3 = orchestrator.run_kpi_dashboard(eid, upid, "steel")
    cleared = next(k for k in kp3["kpis"] if k["id"] == target["id"])
    assert not cleared["band_overridden"]


# --------------------------------------------------------------------------
# Engagement delete (using its OWN fixture to avoid breaking other tests)
# --------------------------------------------------------------------------

def test_engagement_delete_removes_everything():
    test_db = Path("/tmp/procvault_t3_delete.db")
    if test_db.exists():
        test_db.unlink()
    os.environ["PROCVAULT_DB_PATH"] = str(test_db)
    import importlib
    from backend import config, db
    importlib.reload(config); importlib.reload(db)
    db.init_db()
    eng = db.create_engagement(client_name="Doomed", industry="steel")
    eid = eng["id"]
    from backend.services import upload_service
    r = upload_service.use_seed_dataset(eid)
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in r["suggested_mapping"]]
    upload_service.confirm_mapping(r["upload_id"], conf)
    db.upsert_qre_responses(eid, [{"id": "D1.1", "score": 3}])
    db.upsert_override(eid, "x.y", {"low": 1, "high": 2}, "kpi_band")

    # Sanity: things exist
    assert db.get_engagement(eid) is not None
    assert len(db.get_qre_responses(eid)) == 1
    assert len(db.get_overrides(eid)) == 1

    # Delete
    assert db.delete_engagement(eid) is True

    # Everything gone
    assert db.get_engagement(eid) is None
    assert db.get_qre_responses(eid) == []
    assert db.get_overrides(eid) == []

    if test_db.exists(): test_db.unlink()
