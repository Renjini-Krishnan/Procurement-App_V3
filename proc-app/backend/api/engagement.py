"""Engagement CRUD + stage progress endpoints."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db
from ..models import (
    EngagementCreate,
    EngagementResponse,
    StageProgressUpdate,
)

router = APIRouter(prefix="/api/engagement", tags=["engagement"])


@router.post("", response_model=EngagementResponse)
def create_engagement(payload: EngagementCreate):
    eng = db.create_engagement(
        client_name=payload.client_name,
        industry=payload.industry,
        sub_segment=payload.sub_segment,
        plants=payload.plants,
        annual_spend_inr_cr=payload.annual_spend_inr_cr,
        annual_revenue_inr_cr=payload.annual_revenue_inr_cr,
        fte_count=payload.fte_count,
    )
    return EngagementResponse(**eng)


@router.get("", response_model=list[EngagementResponse])
def list_engagements():
    return [EngagementResponse(**e) for e in db.list_engagements()]


@router.get("/{engagement_id}", response_model=EngagementResponse)
def get_engagement(engagement_id: str):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return EngagementResponse(**eng)


@router.patch("/{engagement_id}", response_model=EngagementResponse)
def update_engagement(engagement_id: str, payload: EngagementCreate):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    updated = db.update_engagement(engagement_id, payload.model_dump())
    return EngagementResponse(**updated)


@router.delete("/{engagement_id}")
def delete_engagement(engagement_id: str):
    if not db.delete_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"status": "deleted", "engagement_id": engagement_id}


class OverrideRequest(BaseModel):
    key: str
    value: Any
    override_type: str = "threshold"


@router.get("/{engagement_id}/overrides")
def list_overrides(engagement_id: str):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"overrides": db.get_overrides(engagement_id)}


@router.post("/{engagement_id}/overrides")
def upsert_override(engagement_id: str, payload: OverrideRequest):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    db.upsert_override(engagement_id, payload.key, payload.value, payload.override_type)
    return {"status": "ok", "key": payload.key}


@router.delete("/{engagement_id}/overrides/{key}")
def delete_override(engagement_id: str, key: str):
    if not db.delete_override(engagement_id, key):
        raise HTTPException(404, f"Override '{key}' not found for engagement")
    return {"status": "deleted", "key": key}


@router.get("/{engagement_id}/benchmarks/{pillar}")
def list_pillar_benchmarks(engagement_id: str, pillar: str):
    """Returns the rolled-up benchmark list for a pillar with cascade
    visibility — each entry reports which layer (function / industry /
    engagement) supplied the active value, so the UI can render
    "Function default", "Steel overlay", "Override for this engagement"
    badges and a quick "Reset to default" action."""
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    from ..engine.orchestrator import _load_pillar_benchmarks
    industry = eng.get("industry") or "steel"
    merged = _load_pillar_benchmarks(pillar, industry, engagement_id=engagement_id)
    # Re-load WITHOUT the engagement layer so the UI can show the
    # underlying cascade value behind any override (for "reset" preview).
    base = _load_pillar_benchmarks(pillar, industry, engagement_id=None)
    payload = []
    for bid, b in merged.items():
        entry = {**b, "base": base.get(bid)}
        payload.append(entry)
    return {
        "engagement_id": engagement_id,
        "pillar": pillar,
        "industry": industry,
        "benchmarks": payload,
    }


@router.get("/{engagement_id}/stages")
def get_stages(engagement_id: str):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    progress = db.get_stage_progress(engagement_id)
    return {"engagement_id": engagement_id, "current_stage_id": eng["current_stage_id"], "progress": progress}


@router.post("/{engagement_id}/stages/{stage_id}")
def set_stage(engagement_id: str, stage_id: int, payload: StageProgressUpdate):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    db.set_stage_status(engagement_id, stage_id, payload.status, payload.output)
    if payload.status == "in_progress":
        db.update_engagement_stage(engagement_id, stage_id)
    return {"status": "ok", "engagement_id": engagement_id, "stage_id": stage_id, "new_status": payload.status}
