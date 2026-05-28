"""KB query endpoints. Surfaces loaded KB content + cascade resolution."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from .. import config, kb_loader
from ..models import CascadedBenchmarks

router = APIRouter(prefix="/api/kb", tags=["kb"])


# --------------------------------------------------------------------------
# Stages (the 30-stage workflow definition) — sourced from frontend stages.js
# eventually; for now hard-coded so backend can serve it independently.
# --------------------------------------------------------------------------

STAGES = [
    # Diagnostic
    {"id": 1,  "phase": "Diagnostic", "name": "Client",          "slug": "client"},
    {"id": 2,  "phase": "Diagnostic", "name": "Scope",           "slug": "scope"},
    {"id": 3,  "phase": "Diagnostic", "name": "Guidelines",      "slug": "guidelines"},
    {"id": 4,  "phase": "Diagnostic", "name": "Data Upload",     "slug": "upload"},
    {"id": 5,  "phase": "Diagnostic", "name": "AI Validation",   "slug": "ai-validation"},
    {"id": 6,  "phase": "Diagnostic", "name": "User Validation", "slug": "user-validation"},
    {"id": 7,  "phase": "Diagnostic", "name": "Bronze Data",     "slug": "bronze-data"},
    {"id": 8,  "phase": "Diagnostic", "name": "Gold Data",       "slug": "gold-data"},
    # Analyze
    {"id": 9,  "phase": "Analyze",    "name": "Category Class.", "slug": "categorisation"},
    {"id": 10, "phase": "Analyze",    "name": "KPI Calculation", "slug": "kpis"},
    {"id": 11, "phase": "Analyze",    "name": "Primer",          "slug": "primer"},
    {"id": 12, "phase": "Analyze",    "name": "Op Model",        "slug": "op-model"},
    {"id": 13, "phase": "Analyze",    "name": "Org Structure",   "slug": "org-structure"},
    {"id": 14, "phase": "Analyze",    "name": "DoA",             "slug": "doa"},
    {"id": 16, "phase": "Analyze",    "name": "Buying Channel",  "slug": "buying-channel"},
    {"id": 18, "phase": "Analyze",    "name": "Material Master", "slug": "material-master", "locked": True},
    {"id": 20, "phase": "Analyze",    "name": "PR-to-PO",        "slug": "pr-to-po",       "locked": True},
    {"id": 21, "phase": "Analyze",    "name": "Post-PO",         "slug": "post-po",        "locked": True},
    {"id": 22, "phase": "Analyze",    "name": "Supplier",        "slug": "supplier",       "locked": True},
    # Output
    {"id": 28, "phase": "Output",     "name": "Findings deck",   "slug": "findings-deck",  "locked": True},
    {"id": 29, "phase": "Output",     "name": "Exec summary",    "slug": "exec-summary",   "locked": True},
    {"id": 30, "phase": "Output",     "name": "KPI dashboard",   "slug": "kpi-dashboard",  "locked": True},
]


@router.get("/stages")
def get_stages():
    return {"stages": STAGES}


# --------------------------------------------------------------------------
# Pillar listing + structure
# --------------------------------------------------------------------------

@router.get("/pillars")
def list_pillars():
    """List authored pillars + their file presence."""
    out = []
    for pillar in config.PILLAR_DIRS.keys():
        files = kb_loader.list_pillar_files(pillar)
        try:
            cfg = kb_loader.get_pillar_config(pillar)
            themes = list((cfg.get("themes") or {}).keys())
            components_count = sum(
                len(t.get("components") or [])
                for t in (cfg.get("themes") or {}).values()
            )
        except Exception:
            themes, components_count = [], 0
        out.append({
            "pillar": pillar,
            "themes": themes,
            "components_count": components_count,
            "files_present": files,
        })
    return {"pillars": out}


@router.get("/pillars/{pillar}/config")
def get_pillar_config_endpoint(pillar: str):
    if pillar not in config.PILLAR_DIRS:
        raise HTTPException(404, f"Unknown pillar: {pillar}")
    return kb_loader.get_pillar_config(pillar)


@router.get("/pillars/{pillar}/benchmarks", response_model=CascadedBenchmarks)
def get_pillar_benchmarks_endpoint(
    pillar: str,
    industry: Optional[str] = Query(None, description="Apply industry overlay (e.g., 'steel')"),
):
    if pillar not in config.PILLAR_DIRS:
        raise HTTPException(404, f"Unknown pillar: {pillar}")
    resolved = kb_loader.resolve_pillar_benchmarks(pillar, industry=industry)
    return CascadedBenchmarks(**resolved)


@router.get("/pillars/{pillar}/rca-rules")
def get_pillar_rca_rules_endpoint(pillar: str):
    if pillar not in config.PILLAR_DIRS:
        raise HTTPException(404, f"Unknown pillar: {pillar}")
    return kb_loader.get_pillar_rca_rules(pillar)


@router.get("/pillars/{pillar}/scoring-descriptors")
def get_pillar_scoring(pillar: str):
    if pillar not in config.PILLAR_DIRS:
        raise HTTPException(404, f"Unknown pillar: {pillar}")
    return kb_loader.get_pillar_scoring_descriptors(pillar)


@router.get("/pillars/{pillar}/md/{name}")
def get_pillar_md_endpoint(pillar: str, name: str):
    if pillar not in config.PILLAR_DIRS:
        raise HTTPException(404, f"Unknown pillar: {pillar}")
    content = kb_loader.get_pillar_md(pillar, name)
    if not content:
        raise HTTPException(404, f"Markdown file '{name}.md' not found for pillar {pillar}")
    return {"pillar": pillar, "name": name, "content": content}


# --------------------------------------------------------------------------
# Universal + function-level meta
# --------------------------------------------------------------------------

@router.get("/standards/data-quality-universal")
def get_data_quality_universal():
    return kb_loader.get_data_quality_universal()


@router.get("/standards/scoring-scale")
def get_scoring_scale():
    return kb_loader.get_scoring_scale()


@router.get("/meta/tracker")
def get_tracker():
    return kb_loader.get_tracker()


@router.get("/meta/qre-bank")
def get_qre_bank():
    return kb_loader.get_qre_bank()


@router.get("/meta/cleansing-rules")
def get_cleansing_rules():
    return kb_loader.get_cleansing_rules()


# --------------------------------------------------------------------------
# Industry overlay listings
# --------------------------------------------------------------------------

@router.get("/industries/{industry}/{pillar}/overlays")
def list_overlays(industry: str, pillar: str):
    files = kb_loader.list_industry_overlay_files(industry, pillar)
    return {"industry": industry, "pillar": pillar, "overlay_files": files}


@router.get("/industries/{industry}/{pillar}/overlays/{name}")
def get_overlay(industry: str, pillar: str, name: str):
    return kb_loader.get_industry_pillar_overlay(industry, pillar, name)
