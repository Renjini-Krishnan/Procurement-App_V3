"""LLM diagnostic + exec-summary endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db
from ..engine import orchestrator
from ..services import llm, llm_prompts, client_autofill


router = APIRouter(prefix="/api", tags=["llm"])


@router.get("/llm/status")
def llm_status():
    """Tells the frontend whether AI is live or in deterministic fallback mode."""
    return llm.status()


class ClientAutofillRequest(BaseModel):
    client_name: str


@router.post("/llm/client-autofill")
def client_autofill_endpoint(payload: ClientAutofillRequest):
    """Suggest engagement-profile fields + primer for a client name."""
    return client_autofill.autofill(payload.client_name)


@router.get("/kb/industries/{industry}/procurement-categories")
def industry_procurement_categories(industry: str):
    return client_autofill.load_categories(industry)


class ExecNarrativeRequest(BaseModel):
    upload_id: str
    industry: str = "steel"


@router.post("/engagement/{engagement_id}/llm/exec-narrative")
def exec_narrative(engagement_id: str, payload: ExecNarrativeRequest):
    eng = db.get_engagement(engagement_id)
    if not eng:
        raise HTTPException(404, "Engagement not found")
    try:
        kp = orchestrator.run_kpi_dashboard(
            engagement_id=engagement_id,
            upload_id=payload.upload_id,
            industry=payload.industry,
        )
    except Exception as e:
        raise HTTPException(500, f"Dashboard run failed: {e}")

    pillars = list(kp.get("pillar_summary", {}).items())
    avg = (sum((p[1].get("pillar_score") or {}).get("score", 0) for p in pillars) / len(pillars)) if pillars else 0
    label = _maturity_label(avg)
    top = sorted(
        [k for k in kp.get("kpis", []) if k.get("status") in ("under", "over")],
        key=lambda k: 0 if k["status"] == "over" else 1,
    )[:5]

    prompt, fallback = llm_prompts.exec_summary_narrative(
        client_name=eng["client_name"],
        industry=eng["industry"],
        overall_maturity=avg,
        label=label,
        pillar_summary=kp.get("pillar_summary", {}),
        top_alerts=top,
    )
    narrative = llm.generate_text(prompt, fallback)
    return {
        "narrative": narrative,
        "llm_enabled": llm.is_enabled(),
        "overall_maturity": avg,
        "maturity_label": label,
    }


def _maturity_label(s: float) -> str:
    if s < 1.5: return "Initial"
    if s < 2.5: return "Developing"
    if s < 3.5: return "Defined"
    if s < 4.5: return "Managed"
    return "Optimised"
