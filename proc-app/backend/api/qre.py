"""QRE (Qualitative Response Evaluation) endpoints.

V1 — Stage 6 captures 52 maturity questions per Client Pack v10.
Responses feed the DoA + Org Structure engines (QRE-driven scoring).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db

router = APIRouter(prefix="/api/engagement", tags=["qre"])


SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_qre_responses.json"


def _load_template() -> list[dict]:
    """Load the QRE question template (52 questions) from seed."""
    if SEED_PATH.exists():
        d = json.loads(SEED_PATH.read_text())
        return d.get("responses", [])
    return []


class QREResponse(BaseModel):
    id: str
    area: Optional[str] = None
    question: Optional[str] = None
    required: bool = False
    score: Optional[int] = None
    evidence: Optional[str] = None


class QRESubmit(BaseModel):
    responses: list[QREResponse]


@router.get("/{engagement_id}/qre")
def get_qre(engagement_id: str):
    """Return current QRE for engagement, falling back to seed template
    for unanswered questions."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    stored = {r["id"]: r for r in db.get_qre_responses(engagement_id)}
    template = _load_template()
    merged = []
    for q in template:
        if q["id"] in stored:
            r = stored[q["id"]]
            merged.append({**q, "score": r.get("score"), "evidence": r.get("evidence")})
        else:
            merged.append({**q, "score": None, "evidence": None})
    # Areas summary
    areas = {}
    for q in merged:
        a = q.get("area") or "Other"
        areas.setdefault(a, {"total": 0, "answered": 0})
        areas[a]["total"] += 1
        if q.get("score") is not None:
            areas[a]["answered"] += 1
    answered = sum(1 for q in merged if q.get("score") is not None)
    return {
        "engagement_id": engagement_id,
        "responses": merged,
        "areas": areas,
        "answered": answered,
        "total": len(merged),
    }


@router.post("/{engagement_id}/qre")
def save_qre(engagement_id: str, payload: QRESubmit):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    items = [r.model_dump() for r in payload.responses]
    count = db.upsert_qre_responses(engagement_id, items)
    return {"saved": count}
