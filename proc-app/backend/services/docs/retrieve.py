"""Retrieval — top_k chunks for a query, filtered by engagement_id +
optional kinds list.

Uses sqlite-vec for the ANN search. Falls back to "return empty" if the
extension or vectors are unavailable so downstream prompts work without
RAG context.
"""
from __future__ import annotations

import logging
import struct
from dataclasses import dataclass
from typing import Optional

from ... import db
from . import embedding

log = logging.getLogger("procvault.docs.retrieve")


@dataclass
class Hit:
    chunk_id: str
    doc_id: str
    text: str
    page: Optional[int]
    heading: Optional[str]
    kind: str
    distance: float            # cosine distance: 0 = identical, 2 = opposite
    # Source-doc metadata, hydrated for citation rendering
    doc_filename: Optional[str] = None
    doc_short_label: Optional[str] = None


def top_k(*, engagement_id: str, query: str,
          kinds: Optional[list[str]] = None,
          k: int = 5,
          min_chars: int = 30) -> list[Hit]:
    """Return up to k most-similar chunks. Always returns a list (possibly
    empty) — never raises."""
    if not query or len(query) < 3:
        return []

    # Embed the query
    qvec = embedding.embed_one(query)
    if qvec is None:
        return []

    qblob = struct.pack(f"<{len(qvec)}f", *qvec)

    # Build kind filter
    kind_clause = ""
    params: list = [qblob]
    if kinds:
        placeholders = ",".join("?" * len(kinds))
        kind_clause = f"AND m.kind IN ({placeholders})"
        params.extend(kinds)
    params.append(engagement_id)
    # Over-fetch a bit so the engagement+kind filter still gives us k
    candidates_k = max(k * 4, 20)
    params.append(candidates_k)

    sql = f"""
        SELECT v.chunk_id, v.distance, m.doc_id, m.text, m.page, m.heading, m.kind,
               d.original_filename
        FROM engagement_doc_chunks_vec v
          JOIN engagement_doc_chunks_meta m USING (chunk_id)
          JOIN engagement_documents d ON d.id = m.doc_id
        WHERE v.embedding MATCH ?
          {kind_clause}
          AND m.engagement_id = ?
          AND d.status = 'ready'
        ORDER BY v.distance
        LIMIT ?
    """

    try:
        with db.db_connection() as conn:
            rows = conn.execute(sql, params).fetchall()
    except Exception as e:
        log.warning("Retrieval query failed: %s", e)
        return []

    hits: list[Hit] = []
    for r in rows:
        text = r["text"] or ""
        if len(text) < min_chars:
            continue
        hits.append(Hit(
            chunk_id=r["chunk_id"],
            doc_id=r["doc_id"],
            text=text,
            page=r["page"],
            heading=r["heading"],
            kind=r["kind"],
            distance=float(r["distance"]),
            doc_filename=r["original_filename"],
            doc_short_label=_short_label(r["kind"], r["original_filename"], r["page"], r["heading"]),
        ))
        if len(hits) >= k:
            break
    return hits


def _short_label(kind: str, filename: str, page: Optional[int],
                  heading: Optional[str]) -> str:
    """Generate a 1-line citation label like 'SOP §4.2' or 'DoA p.3'."""
    kind_label = {
        "sop": "SOP", "dop": "DoA", "proc_policy": "Procurement Policy",
        "org_chart": "Org Chart", "asis_flow": "As-Is Process Flow",
        "cat_strategy": "Category Strategy", "contract_doc": "Contract",
        "past_report": "Past Report", "annual_report": "Annual Report",
        "other": filename.rsplit(".", 1)[0][:30],
    }.get(kind, kind)
    if heading:
        section = heading[:40]
        return f"{kind_label} · {section}"
    if page:
        return f"{kind_label} p.{page}"
    return kind_label


def list_chunks_for_doc(doc_id: str, limit: int = 200) -> list[dict]:
    """Debug helper — return chunks of one doc so the UI can show them
    in the 'Documents referenced' drawer."""
    with db.db_connection() as conn:
        rows = conn.execute(
            "SELECT chunk_id, page, heading, text, token_count "
            "FROM engagement_doc_chunks_meta WHERE doc_id = ? "
            "ORDER BY page, chunk_id LIMIT ?",
            (doc_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]
