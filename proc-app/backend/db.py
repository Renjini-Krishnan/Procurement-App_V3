"""SQLite schema + connection.

V1 stores engagement metadata + uploads + per-stage progress + findings.
SQLite mimics the eventual Postgres + Cloud SQL shape, so the schema is
written with future migration in mind (TEXT for JSON blobs, ISO 8601
timestamps).
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Optional

from . import config


SCHEMA = """
CREATE TABLE IF NOT EXISTS engagements (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    industry TEXT NOT NULL,
    sub_segment TEXT,
    plants TEXT,                       -- JSON array of plant codes
    annual_spend_inr_cr REAL,
    annual_revenue_inr_cr REAL,
    fte_count INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    current_stage_id INTEGER DEFAULT 4,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    engagement_id TEXT NOT NULL,
    file_type TEXT NOT NULL,           -- PO / PR / Vendor_Master / Material_Master / Org_Structure
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    row_count INTEGER,
    column_mapping TEXT,               -- JSON: raw_column -> canonical_field
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);

CREATE TABLE IF NOT EXISTS stage_progress (
    engagement_id TEXT NOT NULL,
    stage_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',     -- todo / in_progress / done / skipped
    output TEXT,                              -- JSON blob of stage output
    started_at TEXT,
    completed_at TEXT,
    PRIMARY KEY (engagement_id, stage_id),
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    engagement_id TEXT NOT NULL,
    pillar TEXT NOT NULL,
    theme TEXT NOT NULL,
    component_id TEXT NOT NULL,
    severity TEXT,                          -- high / medium / low
    headline TEXT NOT NULL,
    body TEXT,
    metrics TEXT,                           -- JSON blob
    rca_pattern_id TEXT,
    recommendation_id TEXT,
    citations TEXT,                         -- JSON array
    created_at TEXT NOT NULL,
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);

CREATE TABLE IF NOT EXISTS qre_responses (
    engagement_id TEXT NOT NULL,
    qre_id TEXT NOT NULL,                   -- e.g., 'D2.1'
    area TEXT,
    question TEXT,
    required INTEGER DEFAULT 0,
    score INTEGER,                          -- 1..4
    evidence TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (engagement_id, qre_id),
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);

CREATE TABLE IF NOT EXISTS engagement_overrides (
    engagement_id TEXT NOT NULL,
    key TEXT NOT NULL,                      -- e.g., "benchmark.opmodel.centralisation.savings_rate"
    value TEXT NOT NULL,                    -- JSON-encoded override value
    override_type TEXT NOT NULL,            -- benchmark / threshold / rule_param
    set_by TEXT,
    set_at TEXT NOT NULL,
    PRIMARY KEY (engagement_id, key),
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);
"""


def init_db() -> None:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(config.DB_PATH) as conn:
        conn.executescript(SCHEMA)
        conn.commit()


@contextmanager
def db_connection():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# --------------------------------------------------------------------------
# Engagement CRUD
# --------------------------------------------------------------------------

def create_engagement(
    client_name: str,
    industry: str,
    sub_segment: Optional[str] = None,
    plants: Optional[list[str]] = None,
    annual_spend_inr_cr: Optional[float] = None,
    annual_revenue_inr_cr: Optional[float] = None,
    fte_count: Optional[int] = None,
) -> dict:
    eid = new_id()
    ts = now_iso()
    with db_connection() as conn:
        conn.execute(
            """
            INSERT INTO engagements
            (id, client_name, industry, sub_segment, plants, annual_spend_inr_cr,
             annual_revenue_inr_cr, fte_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (eid, client_name, industry, sub_segment,
             json.dumps(plants or []),
             annual_spend_inr_cr, annual_revenue_inr_cr, fte_count, ts, ts),
        )
    return get_engagement(eid)


def get_engagement(engagement_id: str) -> Optional[dict]:
    with db_connection() as conn:
        row = conn.execute("SELECT * FROM engagements WHERE id = ?", (engagement_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["plants"] = json.loads(d["plants"] or "[]")
    return d


def list_engagements() -> list[dict]:
    with db_connection() as conn:
        rows = conn.execute("SELECT * FROM engagements ORDER BY updated_at DESC").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["plants"] = json.loads(d["plants"] or "[]")
        out.append(d)
    return out


def update_engagement(engagement_id: str, fields: dict) -> Optional[dict]:
    """Patch-update engagement core profile fields."""
    allowed = {"client_name", "industry", "sub_segment", "plants",
               "annual_spend_inr_cr", "annual_revenue_inr_cr", "fte_count"}
    sets, vals = [], []
    for k, v in fields.items():
        if k not in allowed: continue
        if k == "plants":
            sets.append("plants = ?")
            vals.append(json.dumps(v or []))
        else:
            sets.append(f"{k} = ?")
            vals.append(v)
    if not sets:
        return get_engagement(engagement_id)
    sets.append("updated_at = ?")
    vals.append(now_iso())
    vals.append(engagement_id)
    with db_connection() as conn:
        conn.execute(f"UPDATE engagements SET {', '.join(sets)} WHERE id = ?", vals)
    return get_engagement(engagement_id)


def update_engagement_stage(engagement_id: str, stage_id: int) -> None:
    with db_connection() as conn:
        conn.execute(
            "UPDATE engagements SET current_stage_id = ?, updated_at = ? WHERE id = ?",
            (stage_id, now_iso(), engagement_id),
        )


# --------------------------------------------------------------------------
# Stage progress
# --------------------------------------------------------------------------

def get_stage_progress(engagement_id: str) -> dict[int, dict]:
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stage_progress WHERE engagement_id = ?", (engagement_id,)
        ).fetchall()
    out: dict[int, dict] = {}
    for r in rows:
        d = dict(r)
        if d.get("output"):
            try:
                d["output"] = json.loads(d["output"])
            except Exception:
                pass
        out[d["stage_id"]] = d
    return out


def upsert_qre_responses(engagement_id: str, responses: list[dict]) -> int:
    """Bulk-upsert QRE responses."""
    ts = now_iso()
    with db_connection() as conn:
        for r in responses:
            conn.execute(
                """INSERT INTO qre_responses
                (engagement_id, qre_id, area, question, required, score, evidence, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(engagement_id, qre_id) DO UPDATE SET
                  area = excluded.area, question = excluded.question,
                  required = excluded.required, score = excluded.score,
                  evidence = excluded.evidence, updated_at = excluded.updated_at""",
                (engagement_id, r["id"], r.get("area"), r.get("question"),
                 1 if r.get("required") else 0, r.get("score"),
                 r.get("evidence"), ts),
            )
    return len(responses)


def get_qre_responses(engagement_id: str) -> list[dict]:
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM qre_responses WHERE engagement_id = ? ORDER BY qre_id",
            (engagement_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        out.append({
            "id": d["qre_id"],
            "area": d["area"],
            "question": d["question"],
            "required": bool(d["required"]),
            "score": d["score"],
            "evidence": d["evidence"],
        })
    return out


def set_stage_status(engagement_id: str, stage_id: int, status: str, output: Any = None) -> None:
    ts = now_iso()
    output_json = json.dumps(output) if output is not None else None
    with db_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM stage_progress WHERE engagement_id = ? AND stage_id = ?",
            (engagement_id, stage_id),
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE stage_progress SET status = ?, output = ?,
                   completed_at = CASE WHEN ? = 'done' THEN ? ELSE completed_at END
                   WHERE engagement_id = ? AND stage_id = ?""",
                (status, output_json, status, ts, engagement_id, stage_id),
            )
        else:
            conn.execute(
                """INSERT INTO stage_progress
                   (engagement_id, stage_id, status, output, started_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (engagement_id, stage_id, status, output_json, ts,
                 ts if status == "done" else None),
            )
