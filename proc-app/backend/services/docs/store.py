"""Document storage + DB metadata. Bytes go to disk under
`backend/data/uploads/<engagement_id>/docs/`. Metadata in
`engagement_documents`. Dedup by SHA256 — re-uploading the same file is
a no-op that returns the existing doc_id."""
from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from typing import Optional

from ... import config, db

VALID_KINDS = {
    "sop", "dop", "proc_policy", "org_chart", "asis_flow",
    "cat_strategy", "contract_doc", "past_report", "annual_report", "other",
}
MAX_BYTES = 50 * 1024 * 1024       # 50 MB per file
MAX_DOCS_PER_ENG = 20

DOCS_DIR = config.BACKEND_DIR / "data" / "uploads" if hasattr(config, "BACKEND_DIR") else None
if DOCS_DIR is None:
    DOCS_DIR = Path(__file__).resolve().parents[2] / "data" / "uploads"


def save_document(engagement_id: str, original_filename: str,
                    file_bytes: bytes, kind: str,
                    mime_type: Optional[str] = None) -> dict:
    """Save the file + insert metadata row. Returns the doc row dict.
    Caller is responsible for kicking off ingest_async(doc_id)."""
    if kind not in VALID_KINDS:
        raise ValueError(f"Invalid kind '{kind}'. Allowed: {sorted(VALID_KINDS)}")
    if len(file_bytes) > MAX_BYTES:
        raise ValueError(f"File too large ({len(file_bytes)} bytes > {MAX_BYTES})")

    # Cap on doc count
    with db.db_connection() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM engagement_documents WHERE engagement_id = ?",
            (engagement_id,),
        ).fetchone()[0]
    if count >= MAX_DOCS_PER_ENG:
        raise ValueError(f"Engagement has {MAX_DOCS_PER_ENG} documents already. "
                          "Delete an old one first.")

    content_hash = hashlib.sha256(file_bytes).hexdigest()

    # Dedup — same file already uploaded?
    with db.db_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM engagement_documents WHERE engagement_id = ? AND content_hash = ?",
            (engagement_id, content_hash),
        ).fetchone()
    if existing:
        return dict(existing)

    # Save to disk
    doc_id = uuid.uuid4().hex[:12]
    docs_dir = DOCS_DIR / engagement_id / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(original_filename).suffix.lower() or ".bin"
    stored_path = docs_dir / f"{doc_id}{suffix}"
    stored_path.write_bytes(file_bytes)

    ts = db.now_iso()
    with db.db_connection() as conn:
        conn.execute(
            """INSERT INTO engagement_documents
               (id, engagement_id, kind, original_filename, stored_path,
                content_hash, size_bytes, mime_type, status, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (doc_id, engagement_id, kind, original_filename, str(stored_path),
             content_hash, len(file_bytes), mime_type, ts),
        )
        row = conn.execute(
            "SELECT * FROM engagement_documents WHERE id = ?", (doc_id,)
        ).fetchone()
    return dict(row)


def list_documents(engagement_id: str) -> list[dict]:
    with db.db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM engagement_documents WHERE engagement_id = ? ORDER BY uploaded_at DESC",
            (engagement_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_document(doc_id: str) -> Optional[dict]:
    with db.db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM engagement_documents WHERE id = ?", (doc_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_document(doc_id: str) -> bool:
    doc = get_document(doc_id)
    if not doc:
        return False
    # File on disk
    try:
        Path(doc["stored_path"]).unlink(missing_ok=True)
    except Exception:
        pass
    # DB rows: chunks meta + vector + doc
    with db.db_connection() as conn:
        # Collect chunk ids first so we can purge from the vector table
        chunk_ids = [r[0] for r in conn.execute(
            "SELECT chunk_id FROM engagement_doc_chunks_meta WHERE doc_id = ?", (doc_id,)
        ).fetchall()]
        conn.execute("DELETE FROM engagement_doc_chunks_meta WHERE doc_id = ?", (doc_id,))
        for cid in chunk_ids:
            try:
                conn.execute("DELETE FROM engagement_doc_chunks_vec WHERE chunk_id = ?", (cid,))
            except Exception:
                pass
        conn.execute("DELETE FROM engagement_documents WHERE id = ?", (doc_id,))
    return True


def update_kind(doc_id: str, kind: str) -> bool:
    if kind not in VALID_KINDS:
        raise ValueError(f"Invalid kind '{kind}'")
    with db.db_connection() as conn:
        cur = conn.execute(
            "UPDATE engagement_documents SET kind = ? WHERE id = ?",
            (kind, doc_id),
        )
        # Also update the meta-table chunks so retrieval-by-kind keeps working
        conn.execute(
            "UPDATE engagement_doc_chunks_meta SET kind = ? WHERE doc_id = ?",
            (kind, doc_id),
        )
        return cur.rowcount > 0
