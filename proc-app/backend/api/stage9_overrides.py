"""Stage 9 manual canonical override endpoints.

Consultants use these to fix UNCLASSIFIED MATKL/EXTWG/MATNR rows by
assigning them to a canonical category. The next Stage 9 run picks up
the override as Tier B0 (highest priority).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db

router = APIRouter(prefix="/api/engagement", tags=["stage9-overrides"])


VALID_SCOPES = {"material_group", "external_material_group",
                  "material_number", "old_material_number"}


class OverrideRequest(BaseModel):
    scope_type: str
    scope_value: str
    canonical_id: str
    note: Optional[str] = None


class OverrideBulkRequest(BaseModel):
    items: list[OverrideRequest]


@router.get("/{engagement_id}/stage9-overrides")
def list_overrides(engagement_id: str):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"overrides": db.list_stage9_overrides(engagement_id)}


@router.post("/{engagement_id}/stage9-overrides")
def upsert_override(engagement_id: str, payload: OverrideRequest):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    if payload.scope_type not in VALID_SCOPES:
        raise HTTPException(400, f"scope_type must be one of {sorted(VALID_SCOPES)}")
    if not payload.scope_value.strip():
        raise HTTPException(400, "scope_value cannot be empty")
    if not payload.canonical_id.strip():
        raise HTTPException(400, "canonical_id cannot be empty")
    db.upsert_stage9_override(
        engagement_id, payload.scope_type, payload.scope_value,
        payload.canonical_id, note=payload.note,
    )
    return {"ok": True}


@router.post("/{engagement_id}/stage9-overrides/bulk")
def upsert_bulk(engagement_id: str, payload: OverrideBulkRequest):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    saved = 0
    errors: list[str] = []
    for item in payload.items:
        if item.scope_type not in VALID_SCOPES:
            errors.append(f"invalid scope_type {item.scope_type} for value {item.scope_value}")
            continue
        if not item.scope_value.strip() or not item.canonical_id.strip():
            errors.append(f"empty scope_value or canonical_id at {item.scope_type}={item.scope_value}")
            continue
        db.upsert_stage9_override(
            engagement_id, item.scope_type, item.scope_value,
            item.canonical_id, note=item.note,
        )
        saved += 1
    return {"saved": saved, "errors": errors}


@router.delete("/{engagement_id}/stage9-overrides/{scope_type}/{scope_value:path}")
def delete_override(engagement_id: str, scope_type: str, scope_value: str):
    if scope_type not in VALID_SCOPES:
        raise HTTPException(400, f"scope_type must be one of {sorted(VALID_SCOPES)}")
    removed = db.delete_stage9_override(engagement_id, scope_type, scope_value)
    return {"removed": bool(removed)}
