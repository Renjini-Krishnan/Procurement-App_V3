"""Document ingestion pipeline.

Runs synchronously in a background thread (kicked off by the upload
endpoint). Flow:
    pending → parsing → embedding → ready
                                  → failed (any step crashed)

Chunking strategy:
    For each Block (page, heading, text) from the parser, split text into
    ~1024-token windows with 128-token overlap. Each window inherits the
    block's page + heading. Token count is approximated as len(text)//4
    (good enough for English; we don't depend on exact counts).
"""
from __future__ import annotations

import json
import logging
import struct
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from ... import db
from . import embedding, parse

log = logging.getLogger("procvault.docs.ingest")

CHUNK_MAX_CHARS = 4096   # ~1024 tokens
CHUNK_OVERLAP_CHARS = 512   # ~128 tokens


def ingest_document(doc_id: str) -> None:
    """End-to-end: parse → chunk → embed → store. Updates document row
    status as we go. Designed to be invoked in a background thread —
    catches every exception and persists the error message."""
    log.info("Ingest started for doc_id=%s", doc_id)
    _set_status(doc_id, "parsing", started=True)

    try:
        with db.db_connection() as conn:
            row = conn.execute(
                "SELECT id, engagement_id, kind, stored_path, mime_type "
                "FROM engagement_documents WHERE id = ?", (doc_id,)
            ).fetchone()
        if not row:
            log.warning("Ingest: doc not found %s", doc_id); return

        # 1. Parse
        try:
            parsed_method, blocks = parse.parse_document(Path(row["stored_path"]), row["mime_type"])
        except parse.ParseError as e:
            _set_status(doc_id, "failed", error=str(e), finished=True)
            return

        # 2. Chunk
        chunks = _chunk_blocks(blocks)
        log.info("Ingest: %d chunks from %d blocks for doc %s",
                 len(chunks), len(blocks), doc_id)
        _set_status(doc_id, "embedding", parsed_method=parsed_method, page_count=_max_page(blocks))

        if not chunks:
            _set_status(doc_id, "failed", error="No chunks produced after splitting",
                          finished=True)
            return

        # 3. Embed
        texts = [c["text"] for c in chunks]
        vectors = embedding.embed_batch(texts)
        succ_count = sum(1 for v in vectors if v is not None)
        if succ_count == 0 and embedding.is_enabled():
            _set_status(doc_id, "failed", error="All embedding calls failed", finished=True)
            return
        # If embedding is disabled (no ADC), keep going: we store chunks
        # without vectors. RAG retrieval just returns no results until
        # ADC is configured + re-ingest is triggered.
        if not embedding.is_enabled():
            log.info("Embedding disabled (no ADC) — chunks stored without vectors")

        # 4. Write chunks + vectors
        ts = db.now_iso()
        with db.db_connection() as conn:
            for c, v in zip(chunks, vectors):
                chunk_id = uuid.uuid4().hex
                conn.execute(
                    """INSERT INTO engagement_doc_chunks_meta
                       (chunk_id, engagement_id, doc_id, kind, page, heading,
                        text, token_count, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (chunk_id, row["engagement_id"], doc_id, row["kind"],
                     c["page"], c["heading"], c["text"], c["token_count"], ts),
                )
                if v is not None:
                    blob = _vec_to_blob(v)
                    try:
                        conn.execute(
                            "INSERT INTO engagement_doc_chunks_vec(chunk_id, embedding) VALUES (?, ?)",
                            (chunk_id, blob),
                        )
                    except Exception as e:
                        log.warning("vec insert failed for chunk %s: %s", chunk_id, e)

        _set_status(doc_id, "ready", chunk_count=len(chunks), finished=True)
        log.info("Ingest complete for %s: %d chunks (%d embedded)",
                 doc_id, len(chunks), succ_count)

    except Exception as e:
        log.exception("Ingest crashed for %s", doc_id)
        try: _set_status(doc_id, "failed", error=f"{type(e).__name__}: {e}", finished=True)
        except Exception: pass


def ingest_async(doc_id: str) -> None:
    """Fire-and-forget background thread. Used by the upload endpoint."""
    t = threading.Thread(target=ingest_document, args=(doc_id,), daemon=True)
    t.start()


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _chunk_blocks(blocks: list[parse.Block]) -> list[dict]:
    """Split each block's text into overlapping windows. Each chunk
    inherits the block's page + heading."""
    chunks = []
    for b in blocks:
        text = b.text.strip()
        if not text:
            continue
        if len(text) <= CHUNK_MAX_CHARS:
            chunks.append({"page": b.page, "heading": b.heading, "text": text,
                            "token_count": len(text) // 4})
            continue
        start = 0
        while start < len(text):
            end = min(start + CHUNK_MAX_CHARS, len(text))
            # Try to break at a paragraph or sentence boundary near `end`
            if end < len(text):
                for cut in ("\n\n", "\n", ". ", " "):
                    idx = text.rfind(cut, start + CHUNK_MAX_CHARS - 200, end)
                    if idx != -1:
                        end = idx + len(cut); break
            window = text[start:end].strip()
            if window:
                chunks.append({"page": b.page, "heading": b.heading, "text": window,
                                "token_count": len(window) // 4})
            if end >= len(text):
                break
            start = max(end - CHUNK_OVERLAP_CHARS, end)   # forward progress
    return chunks


def _max_page(blocks: list[parse.Block]) -> int:
    return max((b.page for b in blocks), default=1)


def _vec_to_blob(v: list[float]) -> bytes:
    """sqlite-vec wants a contiguous float32 blob, little-endian."""
    return struct.pack(f"<{len(v)}f", *v)


def _set_status(doc_id: str, status: str, *,
                  error: Optional[str] = None,
                  parsed_method: Optional[str] = None,
                  page_count: Optional[int] = None,
                  chunk_count: Optional[int] = None,
                  started: bool = False,
                  finished: bool = False) -> None:
    ts = db.now_iso()
    sets = ["status = ?"]
    vals: list = [status]
    if error is not None:        sets.append("error_message = ?");      vals.append(error)
    if parsed_method is not None:sets.append("parsed_method = ?");      vals.append(parsed_method)
    if page_count is not None:   sets.append("page_count = ?");          vals.append(page_count)
    if chunk_count is not None:  sets.append("chunk_count = ?");         vals.append(chunk_count)
    if started:                   sets.append("ingest_started_at = ?");   vals.append(ts)
    if finished:                  sets.append("ingest_finished_at = ?");  vals.append(ts)
    sql = f"UPDATE engagement_documents SET {', '.join(sets)} WHERE id = ?"
    vals.append(doc_id)
    with db.db_connection() as conn:
        conn.execute(sql, vals)
