"""Background job submission + polling endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db
from ..services import jobs


router = APIRouter(prefix="/api/engagement", tags=["jobs"])


class SubmitRequest(BaseModel):
    upload_id: str
    industry: str = "steel"


# ---------- Targets ----------

def _target_run_pillar(pillar_slug: str):
    """Return a callable suitable for jobs.submit."""
    from ..engine import orchestrator
    runner_map = {
        "op-model":       orchestrator.run_op_model,
        "doa":            orchestrator.run_doa_pillar,
        "buying-channel": orchestrator.run_buying_channel_pillar,
        "org-structure":  orchestrator.run_org_structure_pillar,
    }
    if pillar_slug not in runner_map:
        return None

    def _run(job_id, engagement_id, upload_id, industry):
        jobs.update_status(job_id, "running", progress=10, progress_message=f"Stage 8/9/10 for {pillar_slug}")
        return runner_map[pillar_slug](
            engagement_id=engagement_id, upload_id=upload_id, industry=industry,
        )
    return _run


def _target_run_kpi_dashboard():
    from ..engine import orchestrator

    def _run(job_id, engagement_id, upload_id, industry):
        jobs.update_status(job_id, "running", progress=10, progress_message="Running all 4 pillars")
        result = orchestrator.run_kpi_dashboard(
            engagement_id=engagement_id, upload_id=upload_id, industry=industry,
        )
        jobs.update_status(job_id, "running", progress=90, progress_message="Assembling KPIs")
        return result
    return _run


# ---------- Endpoints ----------

@router.post("/{engagement_id}/jobs/run-pillar/{pillar_slug}")
def submit_pillar_job(engagement_id: str, pillar_slug: str, payload: SubmitRequest):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, "Engagement not found")
    target = _target_run_pillar(pillar_slug)
    if not target:
        raise HTTPException(400, f"Unknown pillar slug: {pillar_slug}")

    def _summary(r):
        s = (r or {}).get("pillar_score") or {}
        return f"{pillar_slug} score={s.get('score','—')} ({s.get('label','—')})"

    jid = jobs.submit(
        engagement_id, f"pillar.{pillar_slug}", target,
        {"engagement_id": engagement_id, "upload_id": payload.upload_id, "industry": payload.industry},
        summarise=_summary,
    )
    return {"job_id": jid, "status": "queued"}


@router.post("/{engagement_id}/jobs/run-kpi-dashboard")
def submit_kpi_job(engagement_id: str, payload: SubmitRequest):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, "Engagement not found")
    target = _target_run_kpi_dashboard()

    def _summary(r):
        n = len(r.get("kpis", [])) if isinstance(r, dict) else 0
        return f"KPI dashboard · {n} KPIs"

    jid = jobs.submit(
        engagement_id, "kpi-dashboard", target,
        {"engagement_id": engagement_id, "upload_id": payload.upload_id, "industry": payload.industry},
        summarise=_summary,
    )
    return {"job_id": jid, "status": "queued"}


@router.get("/{engagement_id}/jobs")
def list_jobs(engagement_id: str, limit: int = 50):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, "Engagement not found")
    return {"jobs": jobs.list_jobs(engagement_id, limit=limit)}


@router.get("/{engagement_id}/jobs/{job_id}")
def get_job(engagement_id: str, job_id: str):
    j = jobs.get_job(job_id)
    if not j or j.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Job not found")
    return j
