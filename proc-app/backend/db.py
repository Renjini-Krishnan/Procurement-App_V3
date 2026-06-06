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
    current_stage_id INTEGER DEFAULT 1,
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
    content_hash TEXT,                 -- SHA256 hex of file bytes (dedup detection)
    size_bytes INTEGER,
    auto_classified INTEGER DEFAULT 0, -- 1 if file_type was auto-detected via batch upload
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

CREATE TABLE IF NOT EXISTS pillar_runs (
    id TEXT PRIMARY KEY,
    engagement_id TEXT NOT NULL,
    pillar TEXT NOT NULL,
    pillar_score REAL,
    pillar_label TEXT,
    theme_scores TEXT,                  -- JSON: {theme_id: score}
    headline TEXT,
    ran_at TEXT NOT NULL,
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

-- Reference documents uploaded per engagement (SOP, DoA, process flows, etc.)
-- Drives RAG-grounded AI narratives across all pillars.
CREATE TABLE IF NOT EXISTS engagement_documents (
    id                  TEXT PRIMARY KEY,
    engagement_id       TEXT NOT NULL,
    kind                TEXT NOT NULL,            -- sop / dop / proc_policy / org_chart / asis_flow / cat_strategy / contract_doc / past_report / annual_report / other
    original_filename   TEXT NOT NULL,
    stored_path         TEXT NOT NULL,
    content_hash        TEXT NOT NULL,            -- SHA256, for dedup
    size_bytes          INTEGER NOT NULL,
    mime_type           TEXT,
    page_count          INTEGER,
    parsed_method       TEXT,                     -- pdfplumber / docx / image / md / txt
    chunk_count         INTEGER DEFAULT 0,
    status              TEXT NOT NULL,            -- pending | parsing | embedding | ready | failed
    error_message       TEXT,
    ingest_started_at   TEXT,
    ingest_finished_at  TEXT,
    uploaded_at         TEXT NOT NULL,
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);
CREATE INDEX IF NOT EXISTS idx_eng_docs_eng ON engagement_documents(engagement_id);
CREATE INDEX IF NOT EXISTS idx_eng_docs_status ON engagement_documents(status);

-- Metadata table for chunks. The vector embeddings live in a sqlite-vec
-- virtual table 'engagement_doc_chunks_vec' that's created on first
-- connection (vec0 needs the extension loaded). Chunk_id is the join key.
CREATE TABLE IF NOT EXISTS engagement_doc_chunks_meta (
    chunk_id            TEXT PRIMARY KEY,
    engagement_id       TEXT NOT NULL,
    doc_id              TEXT NOT NULL,
    kind                TEXT NOT NULL,
    page                INTEGER,
    heading             TEXT,
    text                TEXT NOT NULL,
    token_count         INTEGER,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES engagement_documents(id)
);
CREATE INDEX IF NOT EXISTS idx_chunks_meta_eng ON engagement_doc_chunks_meta(engagement_id);
CREATE INDEX IF NOT EXISTS idx_chunks_meta_doc ON engagement_doc_chunks_meta(doc_id);
CREATE INDEX IF NOT EXISTS idx_chunks_meta_kind ON engagement_doc_chunks_meta(kind);

-- Stage 9 manual canonical assignments.
-- Consultant can reassign UNCLASSIFIED (or any) MATKL/EXTWG/MATNR scope to a
-- canonical. Re-running Stage 9 picks these up as Tier B0 (highest priority
-- after Tier A HSN — even Tier A loses if the consultant has set a manual
-- override). One row per (engagement, scope_type, scope_value).
CREATE TABLE IF NOT EXISTS stage9_canonical_overrides (
    engagement_id   TEXT NOT NULL,
    scope_type      TEXT NOT NULL,           -- material_group | external_material_group | material_number | old_material_number
    scope_value     TEXT NOT NULL,           -- the actual MATKL/EXTWG/MATNR/BISMT value
    canonical_id    TEXT NOT NULL,
    set_by          TEXT,
    note            TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (engagement_id, scope_type, scope_value),
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
);
CREATE INDEX IF NOT EXISTS idx_stage9_overrides_eng ON stage9_canonical_overrides(engagement_id);
"""


_VEC_DIM = 768   # Vertex text-embedding-005 output


def _load_sqlite_vec(conn) -> bool:
    """Load the sqlite-vec extension on a connection. Returns True if
    successful. We make this a soft dependency — if loading fails (e.g.
    on a Python build without enable_load_extension) the docs feature is
    disabled with a clear log message, but the rest of the app still
    works."""
    import logging
    log = logging.getLogger("procvault.db")
    try:
        import sqlite_vec
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        return True
    except Exception as e:
        log.warning("sqlite-vec extension unavailable: %s. "
                     "Document ingestion + RAG features will be disabled.", e)
        return False


def init_db() -> None:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(config.DB_PATH) as conn:
        conn.executescript(SCHEMA)
        # Try to load the vec extension so we can CREATE the virtual
        # table. If it's unavailable, the vec table simply isn't created
        # and the documents-ingestion path detects that at runtime.
        if _load_sqlite_vec(conn):
            conn.execute(
                f"""CREATE VIRTUAL TABLE IF NOT EXISTS engagement_doc_chunks_vec
                    USING vec0(chunk_id TEXT PRIMARY KEY, embedding FLOAT[{_VEC_DIM}])"""
            )
        _apply_idempotent_migrations(conn)
        conn.commit()


def _apply_idempotent_migrations(conn) -> None:
    """ALTER TABLE … ADD COLUMN where the column is missing.
    Lets dev DBs upgrade in place without losing seeded engagements."""
    needed = [
        ("uploads", "content_hash", "TEXT"),
        ("uploads", "size_bytes", "INTEGER"),
        ("uploads", "auto_classified", "INTEGER DEFAULT 0"),
    ]
    for table, col, decl in needed:
        existing = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if col not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")

    # The schema default for current_stage_id used to be 4 (Upload), causing
    # every fresh engagement to skip Stages 1-3. Default is now 1. For dev DBs
    # already created under the old default, reset any engagement that is
    # still at stage 4 AND has never had a stage marked done back to Stage 1.
    conn.execute(
        """
        UPDATE engagements SET current_stage_id = 1
        WHERE current_stage_id = 4
        AND id NOT IN (
            SELECT DISTINCT engagement_id FROM stage_progress WHERE status = 'done'
        )
        """
    )


@contextmanager
def db_connection():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    # Load sqlite-vec on every connection so queries against the vec0
    # virtual table work without surprise. No-op if the extension isn't
    # available (silently degrades).
    _load_sqlite_vec(conn)
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
             annual_revenue_inr_cr, fte_count, created_at, updated_at, current_stage_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (eid, client_name, industry, sub_segment,
             json.dumps(plants or []),
             annual_spend_inr_cr, annual_revenue_inr_cr, fte_count, ts, ts, 1),
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


def delete_engagement(engagement_id: str) -> bool:
    """Hard-delete engagement + all owned rows (uploads, qre, runs, findings, overrides).
    File-system upload artefacts are also removed."""
    eng = get_engagement(engagement_id)
    if not eng:
        return False
    with db_connection() as conn:
        conn.execute("DELETE FROM findings WHERE engagement_id = ?", (engagement_id,))
        conn.execute("DELETE FROM stage_progress WHERE engagement_id = ?", (engagement_id,))
        conn.execute("DELETE FROM qre_responses WHERE engagement_id = ?", (engagement_id,))
        conn.execute("DELETE FROM pillar_runs WHERE engagement_id = ?", (engagement_id,))
        conn.execute("DELETE FROM engagement_overrides WHERE engagement_id = ?", (engagement_id,))
        conn.execute("DELETE FROM uploads WHERE engagement_id = ?", (engagement_id,))
        conn.execute("DELETE FROM engagements WHERE id = ?", (engagement_id,))
    # Remove on-disk upload dir
    try:
        import shutil
        from pathlib import Path
        up_dir = Path(__file__).resolve().parent / "data" / "uploads" / engagement_id
        if up_dir.exists():
            shutil.rmtree(up_dir, ignore_errors=True)
    except Exception:
        pass
    return True


def upsert_override(engagement_id: str, key: str, value, override_type: str = "threshold",
                     set_by: Optional[str] = None) -> None:
    ts = now_iso()
    with db_connection() as conn:
        conn.execute(
            """INSERT INTO engagement_overrides
            (engagement_id, key, value, override_type, set_by, set_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(engagement_id, key) DO UPDATE SET
              value = excluded.value,
              override_type = excluded.override_type,
              set_by = excluded.set_by,
              set_at = excluded.set_at""",
            (engagement_id, key, json.dumps(value), override_type, set_by, ts),
        )


def get_overrides(engagement_id: str) -> list[dict]:
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM engagement_overrides WHERE engagement_id = ? ORDER BY key",
            (engagement_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["value"] = json.loads(d["value"])
        except Exception:
            pass
        out.append(d)
    return out


def delete_override(engagement_id: str, key: str) -> bool:
    with db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM engagement_overrides WHERE engagement_id = ? AND key = ?",
            (engagement_id, key),
        )
    return cur.rowcount > 0


# --------------------------------------------------------------------------
# Stage 9 manual canonical overrides (read by classifier as Tier B0)
# --------------------------------------------------------------------------

_VALID_OVERRIDE_SCOPES = {
    "material_group", "external_material_group",
    "material_number", "old_material_number",
}


def upsert_stage9_override(engagement_id: str, scope_type: str, scope_value: str,
                              canonical_id: str, set_by: Optional[str] = None,
                              note: Optional[str] = None) -> None:
    if scope_type not in _VALID_OVERRIDE_SCOPES:
        raise ValueError(f"Invalid scope_type '{scope_type}'. Allowed: {_VALID_OVERRIDE_SCOPES}")
    now = datetime.utcnow().isoformat()
    sv = str(scope_value).strip()
    if scope_type in ("external_material_group", "old_material_number"):
        sv = sv.upper()
    with db_connection() as conn:
        conn.execute(
            """INSERT INTO stage9_canonical_overrides
               (engagement_id, scope_type, scope_value, canonical_id, set_by, note, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(engagement_id, scope_type, scope_value) DO UPDATE SET
                 canonical_id = excluded.canonical_id,
                 set_by       = excluded.set_by,
                 note         = excluded.note,
                 updated_at   = excluded.updated_at""",
            (engagement_id, scope_type, sv, canonical_id, set_by, note, now, now),
        )


def list_stage9_overrides(engagement_id: str) -> list[dict]:
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stage9_canonical_overrides WHERE engagement_id = ? ORDER BY scope_type, scope_value",
            (engagement_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_stage9_overrides_grouped(engagement_id: str) -> dict[str, dict[str, str]]:
    """Return {scope_type: {scope_value: canonical_id}} for fast in-memory lookup
    by the Stage 9 classifier."""
    out: dict[str, dict[str, str]] = {}
    for r in list_stage9_overrides(engagement_id):
        out.setdefault(r["scope_type"], {})[r["scope_value"]] = r["canonical_id"]
    return out


def delete_stage9_override(engagement_id: str, scope_type: str, scope_value: str) -> bool:
    sv = str(scope_value).strip()
    if scope_type in ("external_material_group", "old_material_number"):
        sv = sv.upper()
    with db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM stage9_canonical_overrides WHERE engagement_id = ? AND scope_type = ? AND scope_value = ?",
            (engagement_id, scope_type, sv),
        )
    return cur.rowcount > 0


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


def record_pillar_run(engagement_id: str, pillar: str, pillar_score: dict,
                       theme_scores: dict, headline: str = "") -> str:
    rid = new_id()
    ts = now_iso()
    score_val = None
    label = None
    if isinstance(pillar_score, dict):
        score_val = pillar_score.get("score")
        label = pillar_score.get("label")
    elif pillar_score is not None:
        score_val = float(pillar_score)
    theme_simple = {}
    for k, v in (theme_scores or {}).items():
        if isinstance(v, dict):
            theme_simple[k] = v.get("score")
        else:
            theme_simple[k] = v
    with db_connection() as conn:
        conn.execute(
            """INSERT INTO pillar_runs
            (id, engagement_id, pillar, pillar_score, pillar_label, theme_scores, headline, ran_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (rid, engagement_id, pillar, score_val, label,
             json.dumps(theme_simple), headline, ts),
        )
    return rid


def list_pillar_runs(engagement_id: str, pillar: Optional[str] = None, limit: int = 50) -> list[dict]:
    with db_connection() as conn:
        if pillar:
            rows = conn.execute(
                "SELECT * FROM pillar_runs WHERE engagement_id = ? AND pillar = ? ORDER BY ran_at DESC LIMIT ?",
                (engagement_id, pillar, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM pillar_runs WHERE engagement_id = ? ORDER BY ran_at DESC LIMIT ?",
                (engagement_id, limit),
            ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("theme_scores"):
            try:
                d["theme_scores"] = json.loads(d["theme_scores"])
            except Exception:
                d["theme_scores"] = {}
        out.append(d)
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
