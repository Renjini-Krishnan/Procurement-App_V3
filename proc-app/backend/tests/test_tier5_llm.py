"""Tier 5 — LLM service + KB methodology integration.

These tests assume the Vertex AI SDK is NOT authenticated. The expected
behaviour everywhere is the deterministic fallback path. With ADC set up
on a developer machine, the same call sites switch to live Gemini output
without code changes.
"""
from __future__ import annotations

import os
import sys
import yaml
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


# --------------------------------------------------------------------------
# LLM service — fallback path
# --------------------------------------------------------------------------

def test_llm_module_loads_without_sdk():
    from backend.services import llm
    # Should not raise even with no SDK installed
    s = llm.status()
    assert s["model"] == "gemini-2.5-pro"
    assert "Application Default Credentials" in s["auth_method"]


def test_llm_generate_text_returns_fallback_when_disabled():
    from backend.services import llm
    result = llm.generate_text("any prompt", "deterministic fallback")
    if not llm.is_enabled():
        assert result == "deterministic fallback"


def test_llm_generate_json_returns_fallback_when_disabled():
    from backend.services import llm
    fallback = [{"a": 1}, {"a": 2}]
    result = llm.generate_json("any prompt", fallback)
    if not llm.is_enabled():
        assert result == fallback


# --------------------------------------------------------------------------
# Prompt construction
# --------------------------------------------------------------------------

def test_finding_narrative_prompt_includes_pillar_implication():
    from backend.services import llm_prompts
    prompt, fallback = llm_prompts.finding_narrative(
        kpi_id="rc_adoption", pillar="buying-channel",
        value=42, unit="%", status="under",
        band_low=60, band_high=85, delta="-18 below band",
        finding_template="RC at 42% vs band 60-85%",
    )
    # Pillar-specific implication should appear in the prompt
    assert "buying-channel" in prompt
    assert "rc_adoption" in prompt or "RC Adoption" in prompt
    assert "60" in prompt and "85" in prompt
    # Fallback non-empty
    assert fallback


def test_exec_summary_prompt_renders():
    from backend.services import llm_prompts
    prompt, fallback = llm_prompts.exec_summary_narrative(
        client_name="ACME Steel", industry="steel",
        overall_maturity=2.4, label="Developing",
        pillar_summary={"op-model": {"pillar_score": {"score": 1.8, "label": "Developing"},
                                      "in_band": 3, "under": 5, "over": 2}},
        top_alerts=[{"pillar": "op-model", "label": "Tail spend %",
                      "value": 45, "unit": "%", "status": "over"}],
    )
    assert "ACME Steel" in prompt
    assert "Developing" in prompt
    assert "Tail spend" in prompt
    assert "Developing" in fallback


def test_column_mapping_prompt_renders():
    from backend.services import llm_prompts
    canonical = [{"field": "po_number", "type": "string", "required": True,
                   "aliases": ["PO_Number", "EBELN"], "description": "PO doc number"}]
    prompt, fallback = llm_prompts.column_mapping(
        raw_columns=["EBELN", "Net Value"],
        canonical_fields=canonical,
        heuristic_mapping=[{"raw_column": "EBELN", "suggested_field": "po_number",
                              "confidence": "high", "match_reason": "alias"}],
        file_type="PO",
    )
    assert "EBELN" in prompt
    assert "po_number" in prompt
    # Fallback = heuristic mapping (typed list)
    assert isinstance(fallback, list)


# --------------------------------------------------------------------------
# KB methodology files load
# --------------------------------------------------------------------------

def test_kpi_rca_library_loads():
    from backend import config
    path = config.PROC_KB_ROOT / "_meta" / "kpi-rca-library.yml"
    assert path.exists()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert "kpis" in data
    # All 8 KPIs from the spec
    expected = {"tat_pr_to_po", "savings_over_lpo", "spend_per_fte", "rc_adoption",
                 "otd", "supplier_defect_rate", "sourcing_tool_usage",
                 "pac_single_vendor", "tail_spend"}
    assert expected.issubset(set(data["kpis"].keys()))
    # Every KPI has 4 bands with insight + action + benefit + pillar_implications
    for kpi_id, kpi in data["kpis"].items():
        assert set(kpi["bands"].keys()) == {1, 2, 3, 4}, f"{kpi_id} missing bands"
        for band_id, band in kpi["bands"].items():
            assert band.get("insight"), f"{kpi_id} band {band_id} missing insight"
            assert band.get("action"), f"{kpi_id} band {band_id} missing action"
            assert band.get("benefit"), f"{kpi_id} band {band_id} missing benefit"
            assert band.get("pillar_implications"), f"{kpi_id} band {band_id} missing pillar_implications"


def test_cross_kpi_causal_rules_load():
    from backend import config
    path = config.PROC_KB_ROOT / "_meta" / "cross-kpi-causal-rules.yml"
    assert path.exists()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    rule_ids = {r["id"] for r in data.get("rules", [])}
    assert {"tat_x_rc", "savings_x_rc", "pac_x_otd", "sourcing_x_savings"}.issubset(rule_ids)


def test_kpi_calculation_rules_yaml_loads():
    from backend import config
    path = config.PROC_KB_ROOT / "_meta" / "kpi-calculation-rules.yml"
    assert path.exists()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    # Sample top-level keys per spec
    for key in ("tat", "savings_over_lpo", "rc_adoption", "tail_spend",
                  "otd", "spend_unit_detection", "pac", "column_alias_resolution"):
        assert key in data, f"missing {key}"


def test_per_pillar_kpi_implications_present():
    from backend import config
    for pillar in ("op-model", "buying-channel", "org-structure", "doa"):
        path = config.PROC_KB_ROOT / pillar / "rca-rules.yml"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        assert "kpi_implications" in data, f"{pillar} missing kpi_implications section"
        impls = data["kpi_implications"]
        assert len(impls) > 0
        # Every implication references the central library
        for impl in impls:
            assert impl.get("kpi_id"), f"{pillar} entry missing kpi_id"
            assert impl.get("central_library_ref", "").startswith("kpi-rca-library#")


# --------------------------------------------------------------------------
# Endpoint registration
# --------------------------------------------------------------------------

def test_llm_status_endpoint_registered():
    from backend.main import create_app
    app = create_app()
    routes = {r.path for r in app.routes}
    assert "/api/llm/status" in routes
    assert "/api/engagement/{engagement_id}/llm/exec-narrative" in routes
