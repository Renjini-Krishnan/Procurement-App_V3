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
    # DoA pillar requires QRE responses — load demo seed answers for the
    # test fixture so the pillar produces themes (instead of needs_qre stub).
    import json as _json
    from pathlib import Path as _Path
    seed_path = _Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"
    if seed_path.exists():
        d = _json.loads(seed_path.read_text())
        answered = [r for r in d.get("responses", []) if r.get("score") is not None]
        if answered:
            db.upsert_qre_responses(eng["id"], answered)
    # Seed a DoA tier matrix so the po-compliance theme has its required
    # input (without it, the theme correctly returns 'data not available').
    db.upsert_override(eng["id"], "doa.tier_thresholds_inr", [
        {"label": "Tier 1 — Manager",  "max_inr": 500000},
        {"label": "Tier 2 — Sr Mgr",   "max_inr": 5000000},
        {"label": "Tier 3 — Director", "max_inr": 25000000},
        {"label": "Tier 4 — CXO",      "max_inr": 100000000},
        {"label": "Tier 5 — Board",    "max_inr": None},
    ], override_type="threshold")
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
        # Either the theme is available (must have headline) or explicitly
        # unavailable (must say so + list missing inputs).
        t = result["themes"][theme_id]
        if t.get("available") is False:
            assert t.get("missing_inputs"), f"{theme_id} unavailable but no missing_inputs listed"
            assert t.get("note"), f"{theme_id} unavailable but no note explaining why"
        else:
            assert "headline" in t, f"{theme_id} available but no headline"


def test_doa_pillar_score_in_range(fresh_doa_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_doa_pillar(
        engagement_id=fresh_doa_engagement["engagement_id"],
        upload_id=fresh_doa_engagement["upload_id"],
        industry="steel",
    )
    ps = result["pillar_score"]
    # Pillar score is None when no themes are available; otherwise 1-5.
    if ps["score"] is None:
        assert ps["label"].startswith("Data not available")
    else:
        assert 1.0 <= ps["score"] <= 5.0
    for tname, s in result["theme_scores"].items():
        sc = s.get("score")
        if sc is None:
            assert s.get("label") == "Data not available"
        else:
            assert 1 <= sc <= 5


def test_doa_reference_template_loaded(fresh_doa_engagement):
    from backend.engine import orchestrator
    result = orchestrator.run_doa_pillar(
        engagement_id=fresh_doa_engagement["engagement_id"],
        upload_id=fresh_doa_engagement["upload_id"],
        industry="steel",
    )
    # Robustness theme reads the reference template — only when available.
    rb = result["themes"]["robustness"]
    if rb.get("available", True):
        assert rb["metrics"]["reference_mandatory_cases_count"] > 0
