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


@meta_router.get("/cleansing/audit")
def cleansing_audit():
    """KB-vs-engine implementation audit map. Surfaced at Stage 7."""
    from ..engine import cleansing_engine
    return cleansing_engine.get_rule_audit()


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
    except upload_service.FileTooLargeError as e:
        raise HTTPException(413, str(e))
    except upload_service.DuplicateUploadError as e:
        # 409 Conflict — surface the existing upload_id so client can offer "use existing"
        raise HTTPException(409, detail={"message": str(e),
                                         "existing_upload_id": e.existing_upload_id})
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.set_stage_status(engagement_id, 4, "done", {"upload_id": result["upload_id"]})
    db.set_stage_status(engagement_id, 5, "done", {"detected_columns": len(result["columns"])})
    db.set_stage_status(engagement_id, 6, "in_progress")
    db.update_engagement_stage(engagement_id, 6)
    return result


@router.post("/{engagement_id}/upload-seed")
def upload_seed(engagement_id: str, file_type: str = "PO"):
    """Demo helper — populate engagement with the seed dataset for the
    requested file_type (default PO)."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    try:
        result = upload_service.use_seed_dataset(engagement_id, file_type=file_type)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    db.set_stage_status(engagement_id, 4, "done", {"upload_id": result["upload_id"]})
    db.set_stage_status(engagement_id, 5, "done", {"detected_columns": len(result["columns"])})
    db.set_stage_status(engagement_id, 6, "in_progress")
    db.update_engagement_stage(engagement_id, 6)
    return result


@meta_router.get("/seeds")
def list_seeds():
    return {"seeds": upload_service.list_available_seeds()}


# --------------------------------------------------------------------------
# Blank-template downloads
# --------------------------------------------------------------------------

from fastapi.responses import StreamingResponse
import io as _io


@meta_router.get("/upload-templates/{file_type}/blank.csv")
def template_csv(file_type: str):
    try:
        body = upload_service.blank_template_csv(file_type)
    except KeyError as e:
        raise HTTPException(404, f"Unknown file type: {file_type}")
    name = f"procvault-{file_type.lower()}-template.csv"
    return StreamingResponse(_io.BytesIO(body), media_type="text/csv",
                              headers={"Content-Disposition": f'attachment; filename="{name}"'})


@meta_router.get("/upload-templates/{file_type}/blank.xlsx")
def template_xlsx(file_type: str):
    try:
        body = upload_service.blank_template_xlsx(file_type)
    except KeyError as e:
        raise HTTPException(404, f"Unknown file type: {file_type}")
    name = f"procvault-{file_type.lower()}-template.xlsx"
    return StreamingResponse(_io.BytesIO(body),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}"'})


# --------------------------------------------------------------------------
# Batch upload with auto-classification
# --------------------------------------------------------------------------

@router.post("/{engagement_id}/upload-batch")
async def upload_batch(engagement_id: str, files: list[UploadFile] = File(...)):
    """Accept multiple files; auto-classify each by header overlap; persist all.

    Returns one entry per file with classification result + upload_id (or
    error reason). Duplicates short-circuit to the existing upload_id."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    results = []
    for f in files:
        contents = await f.read()
        entry = {"original_filename": f.filename, "size_bytes": len(contents)}
        # Size check
        if len(contents) > upload_service.MAX_UPLOAD_SIZE_BYTES:
            entry.update({"status": "rejected", "reason":
                f"File is {len(contents) / 1024 / 1024:.1f} MB; limit is "
                f"{upload_service.MAX_UPLOAD_SIZE_MB} MB"})
            results.append(entry); continue
        # Parse header to classify
        try:
            import io as _io2
            suffix = (f.filename or "").lower()
            if suffix.endswith((".csv", ".tsv", ".txt")):
                head_df = __import__("pandas").read_csv(_io2.BytesIO(contents), nrows=1, low_memory=False)
            else:
                head_df = __import__("pandas").read_excel(_io2.BytesIO(contents), nrows=1)
            raw_cols = [str(c).strip() for c in head_df.columns]
        except Exception as e:
            entry.update({"status": "rejected", "reason": f"Could not parse header: {e}"})
            results.append(entry); continue
        classified = upload_service.classify_file_type(raw_cols)
        entry["classification"] = classified
        if classified["best"] is None or classified["confidence"] in ("none", "low"):
            entry.update({"status": "low_confidence",
                          "reason": f"Auto-classifier {classified['confidence']} confidence (best: {classified['best']} @ {classified['score']:.0%})",
                          "suggested_file_type": classified["best"]})
            results.append(entry); continue
        # Save
        try:
            result = upload_service.save_upload(
                engagement_id=engagement_id, file_type=classified["best"],
                original_filename=f.filename, file_bytes=contents,
                auto_classified=True,
            )
            entry.update({"status": "uploaded", "upload_id": result["upload_id"],
                          "file_type": classified["best"], "row_count": result["row_count"]})
        except upload_service.DuplicateUploadError as e:
            entry.update({"status": "duplicate", "existing_upload_id": e.existing_upload_id,
                          "reason": str(e)})
        except (ValueError, upload_service.FileTooLargeError) as e:
            entry.update({"status": "rejected", "reason": str(e)})
        results.append(entry)

    db.set_stage_status(engagement_id, 4, "done", {"batch_count": len(results)})
    db.update_engagement_stage(engagement_id, 5)
    return {"engagement_id": engagement_id, "files": results}


# --------------------------------------------------------------------------
# Surface dedup + size errors via the single-file endpoint
# --------------------------------------------------------------------------

# Monkey-patch the existing /upload route to handle the new exceptions cleanly


@router.get("/{engagement_id}/uploads")
def list_uploads_endpoint(engagement_id: str):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return upload_service.list_uploads(engagement_id)


@router.get("/{engagement_id}/uploads/summary")
def uploads_summary_endpoint(engagement_id: str):
    """Per-upload classification + quick stats, surfaced on Stage 5."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return upload_service.build_upload_summary(engagement_id)


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
    # Only advance the engagement to Bronze once EVERY upload is confirmed.
    status = upload_service.list_validation_status(engagement_id)
    result["all_ready_for_bronze"] = status["all_ready_for_bronze"]
    result["confirmed_count"] = status["confirmed"]
    result["total_uploads"] = status["total"]
    if status["all_ready_for_bronze"]:
        db.set_stage_status(engagement_id, 6, "done",
                             {"confirmed_count": status["confirmed"], "all_mapped": True})
        db.update_engagement_stage(engagement_id, 7)
    return result


@router.get("/{engagement_id}/validation-status")
def validation_status_endpoint(engagement_id: str):
    """Multi-file mapping tracker for Stage 6."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return upload_service.list_validation_status(engagement_id)
