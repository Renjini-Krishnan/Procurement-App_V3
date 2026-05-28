"""Smoke tests for KB loader.

Run from proc-app/ directory:
    python -m pytest backend/tests -v
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `from backend import ...` when running pytest from proc-app/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend import kb_loader  # noqa: E402


def test_universal_data_quality_loads():
    d = kb_loader.get_data_quality_universal()
    assert "rules" in d
    assert len(d["rules"]) >= 20


def test_tracker_loads():
    d = kb_loader.get_tracker()
    assert "analyses" in d
    assert len(d["analyses"]) >= 40   # Op Model + Org Structure + Buying Channel = ~55


def test_op_model_config_loads():
    d = kb_loader.get_pillar_config("op-model")
    assert "themes" in d
    # 4 themes for Op Model
    assert len(d["themes"]) == 4


def test_op_model_benchmarks_load():
    d = kb_loader.get_pillar_benchmarks("op-model")
    assert "benchmarks" in d
    assert len(d["benchmarks"]) >= 9


def test_steel_overlay_benchmarks_load():
    d = kb_loader.get_industry_pillar_overlay("steel", "op-model", "benchmarks")
    assert "overrides" in d
    assert len(d["overrides"]) >= 5


def test_benchmark_cascade_function_only():
    resolved = kb_loader.resolve_pillar_benchmarks("op-model", industry=None)
    assert resolved["industry"] is None
    assert resolved["pillar"] == "op-model"
    assert "opmodel.centralisation.savings_rate" in resolved["benchmarks"]
    # All should be sourced from function_default when no industry
    for bid, b in resolved["benchmarks"].items():
        assert b["_source"] == "function_default"


def test_benchmark_cascade_with_steel_overlay():
    resolved = kb_loader.resolve_pillar_benchmarks("op-model", industry="steel")
    assert resolved["industry"] == "steel"
    cent = resolved["benchmarks"].get("opmodel.centralisation.savings_rate")
    assert cent is not None
    # Steel overlay overrides centralisation savings rate
    assert cent["_overridden_by"] == "industry_overlay"
    assert cent["_source"] == "industry_overlay"


def test_buying_channel_pillar_loads():
    d = kb_loader.get_pillar_config("buying-channel")
    assert "themes" in d
    # Single-theme pillar
    assert len(d["themes"]) == 1
    theme = d["themes"]["buying-channel-strategy"]
    assert len(theme["components"]) == 13


def test_list_pillar_files():
    files = kb_loader.list_pillar_files("op-model")
    # Op Model has 4 YAML + ~9 MD files
    assert len(files["yml"]) >= 4
    assert len(files["md"]) >= 5
    assert "analysis-config.yml" in files["yml"]


def test_reload_clears_cache():
    kb_loader.get_pillar_config("op-model")
    assert any(k.startswith("pillar_config:op-model") for k in kb_loader._cache)
    kb_loader.reload_all()
    assert not kb_loader._cache
