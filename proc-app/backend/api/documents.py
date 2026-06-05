"""Engagement document endpoints — upload, list, delete, retag.
Phase 1: simple synchronous upload + background ingest.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import db
from ..services.docs import ingest, retrieve, store

router = APIRouter(prefix="/api/engagement", tags=["documents"])


class DocKindUpdate(BaseModel):
    kind: str


@router.post("/{engagement_id}/documents")
async def upload_document(
    engagement_id: str,
    file: UploadFile = File(...),
    kind: str = Form(...),
):
    """Upload a reference document. Kicks off background ingestion."""
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    content = await file.read()
    try:
        row = store.save_document(
            engagement_id=engagement_id,
            original_filename=file.filename or "uploaded.bin",
            file_bytes=content,
            kind=kind,
            mime_type=file.content_type,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    # Kick off background ingest only for newly-saved docs (dedup hits
    # return the existing row, which may already be 'ready').
    if row.get("status") == "pending":
        ingest.ingest_async(row["id"])
    return row


@router.get("/{engagement_id}/documents")
def list_documents(engagement_id: str):
    if not db.get_engagement(engagement_id):
        raise HTTPException(404, f"Engagement {engagement_id} not found")
    return {"documents": store.list_documents(engagement_id)}


@router.get("/{engagement_id}/documents/{doc_id}/download")
def download_document(engagement_id: str, doc_id: str):
    doc = store.get_document(doc_id)
    if not doc or doc["engagement_id"] != engagement_id:
        raise HTTPException(404, "Document not found")
    p = Path(doc["stored_path"])
    if not p.exists():
        raise HTTPException(410, "File missing on disk")
    return StreamingResponse(
        io.BytesIO(p.read_bytes()),
        media_type=doc.get("mime_type") or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc["original_filename"]}"'},
    )


@router.delete("/{engagement_id}/documents/{doc_id}")
def delete_document(engagement_id: str, doc_id: str):
    doc = store.get_document(doc_id)
    if not doc or doc["engagement_id"] != engagement_id:
        raise HTTPException(404, "Document not found")
    store.delete_document(doc_id)
    return {"status": "deleted", "id": doc_id}


@router.patch("/{engagement_id}/documents/{doc_id}")
def update_doc_kind(engagement_id: str, doc_id: str, payload: DocKindUpdate):
    doc = store.get_document(doc_id)
    if not doc or doc["engagement_id"] != engagement_id:
        raise HTTPException(404, "Document not found")
    try:
        store.update_kind(doc_id, payload.kind)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return store.get_document(doc_id)


@router.post("/{engagement_id}/documents/{doc_id}/reingest")
def reingest_document(engagement_id: str, doc_id: str):
    doc = store.get_document(doc_id)
    if not doc or doc["engagement_id"] != engagement_id:
        raise HTTPException(404, "Document not found")
    # Reset status + clear existing chunks before re-ingesting
    with db.db_connection() as conn:
        chunk_ids = [r[0] for r in conn.execute(
            "SELECT chunk_id FROM engagement_doc_chunks_meta WHERE doc_id = ?", (doc_id,)
        ).fetchall()]
        conn.execute("DELETE FROM engagement_doc_chunks_meta WHERE doc_id = ?", (doc_id,))
        for cid in chunk_ids:
            try: conn.execute("DELETE FROM engagement_doc_chunks_vec WHERE chunk_id = ?", (cid,))
            except Exception: pass
        conn.execute(
            "UPDATE engagement_documents SET status='pending', error_message=NULL, "
            "chunk_count=0 WHERE id = ?", (doc_id,)
        )
    ingest.ingest_async(doc_id)
    return {"status": "queued"}


@router.get("/{engagement_id}/documents/{doc_id}/chunks")
def list_chunks(engagement_id: str, doc_id: str, limit: int = 200):
    doc = store.get_document(doc_id)
    if not doc or doc["engagement_id"] != engagement_id:
        raise HTTPException(404, "Document not found")
    return {"doc_id": doc_id, "chunks": retrieve.list_chunks_for_doc(doc_id, limit=limit)}
