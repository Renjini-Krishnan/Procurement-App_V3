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


@router.post("/{engagement_id}/run-intel")
def run_intel(engagement_id: str, payload: RunPillarRequest):
    """Stage 8/9/10 intel (no pillar). Used by Stage 9, 10, 11 screens."""
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    upload = upload_service.get_upload(payload.upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found for this engagement")
    try:
        return orchestrator.run_intel(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"Intel run failed: {e}")


@router.get("/{engagement_id}/cleansing-report.csv")
def cleansing_report_csv(engagement_id: str, scope: str = "all"):
    """Download the Stage 7 cleansing report as CSV.

    scope=all (default): all uploads + cross-file recon
    scope=cross_only:    only cross-file recon
    scope=<upload_id>:   only that upload's report
    """
    from fastapi.responses import Response
    import csv, io

    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    uploads = upload_service.list_uploads(engagement_id)
    if not uploads:
        raise HTTPException(404, "No uploads found")
    po_upload = next((u for u in uploads if u.get("file_type") == "PO"), uploads[0])
    try:
        intel = orchestrator.run_intel(engagement_id, po_upload["id"], industry=eng.get("industry") or "steel")
    except Exception as e:
        raise HTTPException(500, f"Cleansing run failed: {e}")

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["scope", "file_type", "upload_id", "rule_id", "rule_name",
                 "severity", "rows_affected", "action", "details_json"])
    import json as _json
    if scope in ("all", "cross_only"):
        for e in (intel.get("cross_file_recon") or {}).get("entries", []):
            w.writerow(["cross_file", "", "", e["rule_id"], e["rule_name"],
                         e["severity"], e["rows_affected"], e["action"],
                         _json.dumps(e.get("details") or {})])
    if scope == "all" or (scope not in ("cross_only", "all")):
        for u in intel.get("per_upload_reports", []):
            if scope not in ("all",) and u["upload_id"] != scope:
                continue
            rep = u.get("cleansing_report") or {}
            for e in rep.get("entries", []):
                w.writerow(["per_upload", u.get("file_type"), u["upload_id"],
                             e["rule_id"], e["rule_name"], e["severity"],
                             e["rows_affected"], e["action"],
                             _json.dumps(e.get("details") or {})])
    csv_text = buf.getvalue()
    filename = f"cleansing-report-{engagement_id}-{scope}.csv"
    return Response(content=csv_text, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/{engagement_id}/findings")
def list_findings(engagement_id: str, pillar: str = None):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"findings": orchestrator.get_findings(engagement_id, pillar)}


@router.get("/{engagement_id}/pillar-runs")
def list_pillar_runs(engagement_id: str, pillar: str = None):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"runs": orchestrator.get_pillar_runs(engagement_id, pillar)}
