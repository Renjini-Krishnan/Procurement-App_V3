"""Engagement CRUD + stage progress endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

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
