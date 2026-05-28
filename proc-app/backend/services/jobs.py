"""Simple in-process background job runner.

Threads run pillar / dashboard / intel calls asynchronously. Status + result
are stored in SQLite so clients can poll. Suitable for V1 (single-process
SQLite); replace with Celery / RQ + Redis when multi-worker.

Status lifecycle:
    queued → running → done | failed | cancelled
"""
from __future__ import annotations

import json
import threading
import time
import traceback
from typing import Any, Callable, Optional

from .. import db


# In-memory registry of running threads (for cancellation hints, not enforcement)
_threads: dict[str, threading.Thread] = {}
_lock = threading.Lock()


# ============================================================================
# Schema bootstrap (called once at app startup)
# ============================================================================

JOBS_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    engagement_id TEXT,
    kind TEXT NOT NULL,                -- pillar.op-model | pillar.doa | kpi-dashboard | intel | export.pptx | ...
    status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | failed | cancelled
    progress INTEGER DEFAULT 0,        -- 0..100
    progress_message TEXT,
    payload TEXT,                      -- JSON inputs
    result TEXT,                       -- JSON outputs (truncated)
    result_summary TEXT,               -- short summary string
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_eng_idx ON jobs (engagement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
"""


def init_jobs_schema():
    with db.db_connection() as conn:
        conn.executescript(JOBS_SCHEMA)


# ============================================================================
# CRUD
# ============================================================================

def create_job(engagement_id: Optional[str], kind: str, payload: dict) -> str:
    jid = db.new_id()
    ts = db.now_iso()
    with db.db_connection() as conn:
        conn.execute(
            """INSERT INTO jobs (id, engagement_id, kind, status, payload, created_at)
               VALUES (?, ?, ?, 'queued', ?, ?)""",
            (jid, engagement_id, kind, json.dumps(payload), ts),
        )
    return jid


def get_job(job_id: str) -> Optional[dict]:
    with db.db_connection() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    for k in ("payload", "result"):
        if d.get(k):
            try: d[k] = json.loads(d[k])
            except Exception: pass
    return d


def list_jobs(engagement_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    with db.db_connection() as conn:
        if engagement_id:
            rows = conn.execute(
                "SELECT id, engagement_id, kind, status, progress, progress_message, "
                "result_summary, error, started_at, completed_at, created_at "
                "FROM jobs WHERE engagement_id = ? ORDER BY created_at DESC LIMIT ?",
                (engagement_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, engagement_id, kind, status, progress, progress_message, "
                "result_summary, error, started_at, completed_at, created_at "
                "FROM jobs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def update_status(job_id: str, status: str, *, progress: Optional[int] = None,
                   progress_message: Optional[str] = None,
                   result: Any = None, result_summary: Optional[str] = None,
                   error: Optional[str] = None):
    fields = ["status = ?"]
    vals: list = [status]
    ts = db.now_iso()
    if progress is not None:
        fields.append("progress = ?"); vals.append(int(progress))
    if progress_message is not None:
        fields.append("progress_message = ?"); vals.append(progress_message)
    if status == "running":
        fields.append("started_at = COALESCE(started_at, ?)"); vals.append(ts)
    if status in ("done", "failed", "cancelled"):
        fields.append("completed_at = ?"); vals.append(ts)
    if result is not None:
        fields.append("result = ?"); vals.append(json.dumps(result, default=str))
    if result_summary is not None:
        fields.append("result_summary = ?"); vals.append(result_summary)
    if error is not None:
        fields.append("error = ?"); vals.append(error)
    vals.append(job_id)
    with db.db_connection() as conn:
        conn.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", vals)


# ============================================================================
# Runner
# ============================================================================

def submit(engagement_id: Optional[str], kind: str, target: Callable[..., Any],
           payload: dict, *,
           summarise: Optional[Callable[[Any], str]] = None,
           trim_result: bool = True) -> str:
    """Submit a callable to run in a background thread.

    target: callable that takes (job_id, **payload) and returns a result.
            Should call jobs.update_status(job_id, ..., progress=..) for progress.

    summarise: optional fn to produce a short summary string from the result.
    trim_result: if True, only store summary in DB (full result discarded after
                 in-memory consumption). Useful for huge dashboards.
    """
    jid = create_job(engagement_id, kind, payload)

    def _run():
        try:
            update_status(jid, "running", progress=1, progress_message="Starting…")
            result = target(jid, **payload)
            summary = summarise(result) if summarise else "done"
            payload_to_store = None if trim_result else result
            update_status(jid, "done", progress=100,
                          progress_message="Complete",
                          result=payload_to_store, result_summary=summary)
        except Exception as e:
            err = f"{type(e).__name__}: {e}\n{traceback.format_exc()[:2000]}"
            update_status(jid, "failed", error=err, progress_message="Failed")
        finally:
            with _lock:
                _threads.pop(jid, None)

    t = threading.Thread(target=_run, daemon=True, name=f"job-{jid}")
    with _lock:
        _threads[jid] = t
    t.start()
    return jid
