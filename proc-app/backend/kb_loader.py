"""KB Loader — reads YAML/MD KB files, caches in memory, resolves cascades.

Cascade order (most-specific wins):
    engagement_override (in SQLite, future)
    → industry_overlay (in shared-kb/industries/<ind>/)
    → function_default (in proc-app/kb/functions/<func>/<pillar>/)
    → universal_standards (in shared-kb/standards/)

This loader handles the bottom three layers (universal, function, industry).
Engagement overrides come from the DB and are applied on top at API time.

Validation: at startup, every known YAML file is parsed. If any fails to
parse, the loader raises — fail fast rather than serving bad data.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import yaml

from . import config


# In-memory cache. Cleared via reload_all() if needed (e.g., dev hot-reload).
_cache: dict[str, Any] = {}


def _load_yaml(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"KB file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if data is None:
        return {}
    return data


def _load_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _cache_get(key: str, loader_fn):
    if key not in _cache:
        _cache[key] = loader_fn()
    return _cache[key]


# --------------------------------------------------------------------------
# Universal standards
# --------------------------------------------------------------------------

def get_data_quality_universal() -> dict:
    return _cache_get(
        "data_quality_universal",
        lambda: _load_yaml(config.STANDARDS_DIR / "data-quality-universal.yml"),
    )


def get_scoring_scale() -> dict:
    return _cache_get(
        "scoring_scale",
        lambda: _load_yaml(config.STANDARDS_DIR / "scoring-scale.yml"),
    )


def get_currencies() -> dict:
    return _cache_get(
        "currencies",
        lambda: _load_yaml(config.REFERENCES_DIR / "master-data" / "currencies.yml"),
    )


# --------------------------------------------------------------------------
# Function-level (procurement) — meta + qre + cleansing
# --------------------------------------------------------------------------

def get_tracker() -> dict:
    return _cache_get("tracker", lambda: _load_yaml(config.TRACKER_PATH))


def get_qre_bank() -> dict:
    return _cache_get("qre_bank", lambda: _load_yaml(config.QRE_BANK_PATH))


def get_cleansing_rules() -> dict:
    return _cache_get("cleansing_rules", lambda: _load_yaml(config.CLEANSING_RULES_PATH))


# --------------------------------------------------------------------------
# Pillar files — function default
# --------------------------------------------------------------------------

PILLAR_YAML_FILES = ["analysis-config", "benchmarks", "rca-rules", "scoring-descriptors"]
PILLAR_MD_FILES = ["analysis-framework", "rca-patterns", "recommendations", "prompts"]


def get_pillar_config(pillar: str) -> dict:
    return _cache_get(
        f"pillar_config:{pillar}",
        lambda: _load_yaml(config.PILLAR_DIRS[pillar] / "analysis-config.yml"),
    )


def get_pillar_benchmarks(pillar: str) -> dict:
    """Function-default benchmarks for a pillar (industry overlay applied separately)."""
    return _cache_get(
        f"pillar_benchmarks:{pillar}",
        lambda: _load_yaml(config.PILLAR_DIRS[pillar] / "benchmarks.yml"),
    )


def get_pillar_rca_rules(pillar: str) -> dict:
    return _cache_get(
        f"pillar_rca_rules:{pillar}",
        lambda: _load_yaml(config.PILLAR_DIRS[pillar] / "rca-rules.yml"),
    )


def get_pillar_scoring_descriptors(pillar: str) -> dict:
    return _cache_get(
        f"pillar_scoring:{pillar}",
        lambda: _load_yaml(config.PILLAR_DIRS[pillar] / "scoring-descriptors.yml"),
    )


def get_pillar_md(pillar: str, name: str) -> str:
    """Read a markdown file in the pillar dir (e.g., 'analysis-framework')."""
    return _cache_get(
        f"pillar_md:{pillar}:{name}",
        lambda: _load_text(config.PILLAR_DIRS[pillar] / f"{name}.md"),
    )


def list_pillar_files(pillar: str) -> dict[str, list[str]]:
    """Return the yml + md files present in a pillar dir."""
    pdir = config.PILLAR_DIRS[pillar]
    if not pdir.exists():
        return {"yml": [], "md": []}
    return {
        "yml": sorted(p.name for p in pdir.glob("*.yml")),
        "md": sorted(p.name for p in pdir.glob("*.md")),
    }


# --------------------------------------------------------------------------
# Industry overlay
# --------------------------------------------------------------------------

def get_industry_pillar_overlay(industry: str, pillar: str, overlay_name: str) -> dict:
    """Load a specific overlay file under industries/<ind>/.../<pillar>/.

    overlay_name examples: 'benchmarks', 'centralisation-filters',
    'shared-services-filters', 'coe-filters', 'tail-spend-filters',
    'archetype-overrides'.
    """
    key = f"industry_overlay:{industry}:{pillar}:{overlay_name}"
    return _cache_get(
        key,
        lambda: _load_yaml(config.industry_pillar_dir(industry, pillar) / f"{overlay_name}.yml"),
    )


def list_industry_overlay_files(industry: str, pillar: str) -> list[str]:
    pdir = config.industry_pillar_dir(industry, pillar)
    if not pdir.exists():
        return []
    return sorted(p.name for p in pdir.glob("*.yml"))


# --------------------------------------------------------------------------
# Cascade — benchmark resolution
# --------------------------------------------------------------------------

def resolve_pillar_benchmarks(pillar: str, industry: Optional[str] = None) -> dict:
    """Return the effective benchmarks dict after applying the cascade.

    Output shape:
      {
        "pillar": "op-model",
        "industry": "steel" | None,
        "benchmarks": {
          <benchmark_id>: {
            ...benchmark entry...,
            "_source": "function_default" | "industry_overlay",
            "_overridden_by": "industry_overlay" if overridden, else None,
          },
          ...
        }
      }
    """
    function_default = get_pillar_benchmarks(pillar)
    function_benchmarks = {b["id"]: dict(b, _source="function_default", _overridden_by=None)
                            for b in (function_default.get("benchmarks") or [])}

    if industry:
        overlay = get_industry_pillar_overlay(industry, pillar, "benchmarks")
        # Apply overrides
        for ov in (overlay.get("overrides") or []):
            bid = ov.get("benchmark_id")
            if bid and bid in function_benchmarks:
                merged = dict(function_benchmarks[bid])
                # Overlay fields supersede function defaults for ANY field present
                for k, v in ov.items():
                    if k == "benchmark_id":
                        continue
                    merged[k] = v
                merged["_source"] = "industry_overlay"
                merged["_overridden_by"] = "industry_overlay"
                function_benchmarks[bid] = merged
        # Apply additions (industry-specific benchmarks with no function default)
        for add in (overlay.get("additions") or []):
            if isinstance(add, dict) and add.get("id"):
                function_benchmarks[add["id"]] = dict(add, _source="industry_overlay", _overridden_by=None)

    return {
        "pillar": pillar,
        "industry": industry,
        "benchmarks": function_benchmarks,
    }


# --------------------------------------------------------------------------
# Startup validation
# --------------------------------------------------------------------------

def validate_all() -> dict:
    """Parse every known KB file at startup. Raises on any parse failure.
    Returns a summary of what was loaded.
    """
    summary = {"loaded": [], "warnings": []}

    # Universal
    for name, fn in [
        ("data_quality_universal", get_data_quality_universal),
        ("scoring_scale", get_scoring_scale),
        ("currencies", get_currencies),
    ]:
        try:
            fn()
            summary["loaded"].append(name)
        except FileNotFoundError as e:
            summary["warnings"].append(str(e))

    # Function-level
    for name, fn in [
        ("tracker", get_tracker),
        ("qre_bank", get_qre_bank),
        ("cleansing_rules", get_cleansing_rules),
    ]:
        try:
            fn()
            summary["loaded"].append(name)
        except FileNotFoundError as e:
            summary["warnings"].append(str(e))

    # Pillars + overlays
    for pillar in config.PILLAR_DIRS.keys():
        for ymlname in PILLAR_YAML_FILES:
            try:
                fn = {
                    "analysis-config": get_pillar_config,
                    "benchmarks": get_pillar_benchmarks,
                    "rca-rules": get_pillar_rca_rules,
                    "scoring-descriptors": get_pillar_scoring_descriptors,
                }[ymlname]
                fn(pillar)
                summary["loaded"].append(f"{pillar}/{ymlname}.yml")
            except FileNotFoundError as e:
                summary["warnings"].append(f"{pillar}/{ymlname}.yml: {e}")

        # Steel overlay for this pillar (if dir exists)
        for ov_name in list_industry_overlay_files("steel", pillar):
            overlay_id = ov_name.replace(".yml", "")
            try:
                get_industry_pillar_overlay("steel", pillar, overlay_id)
                summary["loaded"].append(f"steel/{pillar}/{ov_name}")
            except FileNotFoundError as e:
                summary["warnings"].append(f"steel/{pillar}/{ov_name}: {e}")

    return summary


def reload_all() -> None:
    """Drop the cache. Next call re-reads from disk. Useful for dev / tests."""
    _cache.clear()
