"""Upload + column-mapping endpoints (Stage 4 / 5 / 6)."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from .. import db
from ..services import upload_service

router = APIRouter(prefix="/api/engagement", tags=["upload"])


# Shared metadata endpoint (not under /engagement/{id}) — list supported file types
meta_router = APIRouter(prefix="/api", tags=["upload-meta"])


@meta_router.get("/upload-schemas")
def list_upload_schemas():
    from ..services import canonical_schema
    return {"schemas": canonical_schema.list_schema_types()}


@meta_router.get("/upload-schemas/{file_type}")
def get_upload_schema(file_type: str):
    from ..services import canonical_schema
    try:
        return canonical_schema.get_schema(file_type)
    except KeyError:
        raise HTTPException(404, f"Schema not found for file_type={file_type}")


class ConfirmMappingRequest(BaseModel):
    confirmed_mapping: list[dict]


class UseSeedRequest(BaseModel):
    """Demo helper — load the seed PO dataset as if uploaded."""
    pass


@router.post("/{engagement_id}/upload")
async def upload_file(engagement_id: str, file: UploadFile = File(...), file_type: str = "PO"):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    contents = await file.read()
    try:
        result = upload_service.save_upload(
            engagement_id=engagement_id,
            file_type=file_type,
            original_filename=file.filename or "uploaded.csv",
            file_bytes=contents,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.set_stage_status(engagement_id, 4, "done", {"upload_id": result["upload_id"]})
    db.set_stage_status(engagement_id, 5, "done", {"detected_columns": len(result["columns"])})
    db.set_stage_status(engagement_id, 6, "in_progress")
    db.update_engagement_stage(engagement_id, 6)
    return result


@router.post("/{engagement_id}/upload-seed")
def upload_seed(engagement_id: str):
    """Demo helper — populate engagement with the seed PO dataset."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    try:
        result = upload_service.use_seed_dataset(engagement_id)
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))
    db.set_stage_status(engagement_id, 4, "done", {"upload_id": result["upload_id"]})
    db.set_stage_status(engagement_id, 5, "done", {"detected_columns": len(result["columns"])})
    db.set_stage_status(engagement_id, 6, "in_progress")
    db.update_engagement_stage(engagement_id, 6)
    return result


@router.get("/{engagement_id}/uploads")
def list_uploads_endpoint(engagement_id: str):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return upload_service.list_uploads(engagement_id)


@router.get("/{engagement_id}/uploads/{upload_id}")
def get_upload_endpoint(engagement_id: str, upload_id: str):
    upload = upload_service.get_upload(upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found")
    return upload


@router.get("/{engagement_id}/uploads/{upload_id}/preview")
def preview_upload(engagement_id: str, upload_id: str, limit: int = 20):
    """Return the raw column list + first N rows + current mapping for the
    Stage 6 column-mapping UI."""
    upload = upload_service.get_upload(upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found")

    df = upload_service.read_upload_dataframe(upload_id)
    raw_columns = [str(c).strip() for c in df.columns]
    sample_rows = df.head(limit).fillna("").astype(str).values.tolist()
    mapping_state = upload.get("column_mapping") or {}

    from ..services import canonical_schema
    suggestion = canonical_schema.suggest_mapping(raw_columns, upload["file_type"])

    return {
        "upload_id": upload_id,
        "file_type": upload["file_type"],
        "original_filename": upload["original_filename"],
        "row_count": upload["row_count"],
        "columns": raw_columns,
        "sample_rows": sample_rows,
        "suggested_mapping": mapping_state.get("suggested") or suggestion["matches"],
        "confirmed_mapping": mapping_state.get("confirmed"),
        "missing_required": mapping_state.get("missing_required") or suggestion["missing_required"],
        "schema": suggestion["schema"],
    }


@router.post("/{engagement_id}/uploads/{upload_id}/confirm-mapping")
def confirm_mapping_endpoint(engagement_id: str, upload_id: str, payload: ConfirmMappingRequest):
    upload = upload_service.get_upload(upload_id)
    if not upload or upload.get("engagement_id") != engagement_id:
        raise HTTPException(404, "Upload not found")
    try:
        result = upload_service.confirm_mapping(upload_id, payload.confirmed_mapping)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if result["ready_for_bronze"]:
        db.set_stage_status(engagement_id, 6, "done", {"upload_id": upload_id, "mapping_confirmed": True})
        db.update_engagement_stage(engagement_id, 7)
    return result
