"""Pillar run + results endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db
from ..engine import orchestrator
from ..services import upload_service

router = APIRouter(prefix="/api/engagement", tags=["pillar"])


class RunPillarRequest(BaseModel):
    upload_id: str
    industry: str = "steel"


@router.post("/{engagement_id}/run-pillar/op-model")
def run_op_model(engagement_id: str, payload: RunPillarRequest):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    upload = upload_service.get_upload(payload.upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found for this engagement")
    try:
        result = orchestrator.run_op_model(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"Pillar run failed: {e}")
    return result


@router.post("/{engagement_id}/run-pillar/doa")
def run_doa_pillar(engagement_id: str, payload: RunPillarRequest):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    upload = upload_service.get_upload(payload.upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found for this engagement")
    try:
        result = orchestrator.run_doa_pillar(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"DoA pillar run failed: {e}")
    return result


@router.post("/{engagement_id}/run-pillar/buying-channel")
def run_buying_channel_pillar(engagement_id: str, payload: RunPillarRequest):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    upload = upload_service.get_upload(payload.upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found for this engagement")
    try:
        result = orchestrator.run_buying_channel_pillar(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"Buying Channel pillar run failed: {e}")
    return result


@router.post("/{engagement_id}/run-pillar/org-structure")
def run_org_structure_pillar(engagement_id: str, payload: RunPillarRequest):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    upload = upload_service.get_upload(payload.upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found for this engagement")
    try:
        result = orchestrator.run_org_structure_pillar(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"Org Structure pillar run failed: {e}")
    return result


@router.post("/{engagement_id}/run-kpi-dashboard")
def run_kpi_dashboard(engagement_id: str, payload: RunPillarRequest):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    upload = upload_service.get_upload(payload.upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found for this engagement")
    try:
        result = orchestrator.run_kpi_dashboard(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"KPI dashboard run failed: {e}")
    return result


@router.get("/{engagement_id}/findings")
def list_findings(engagement_id: str, pillar: str = None):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"findings": orchestrator.get_findings(engagement_id, pillar)}
