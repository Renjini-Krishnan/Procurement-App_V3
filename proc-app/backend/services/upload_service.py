"""Upload + parse service.

Handles client file uploads (PO dumps initially), persists to filesystem,
records metadata in SQLite, and surfaces the raw columns for Stage 5/6
column-mapping HITL.
"""
from __future__ import annotations

import io
import json
import shutil
import uuid
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from .. import config, db
from . import canonical_schema


UPLOADS_DIR = Path(__file__).resolve().parents[1] / "data" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(
    engagement_id: str,
    file_type: str,
    original_filename: str,
    file_bytes: bytes,
) -> dict:
    """Persist uploaded file to disk + insert into SQLite uploads table.

    Returns metadata including parsed columns + sample rows + suggested mapping.
    """
    # Persist file
    upload_id = uuid.uuid4().hex[:12]
    engagement_dir = UPLOADS_DIR / engagement_id
    engagement_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(original_filename).suffix.lower() or ".csv"
    stored_path = engagement_dir / f"{upload_id}{suffix}"
    stored_path.write_bytes(file_bytes)

    # Parse — CSV or Excel
    try:
        if suffix in (".csv", ".tsv", ".txt"):
            df = pd.read_csv(io.BytesIO(file_bytes), low_memory=False)
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        # Clean up file + raise
        stored_path.unlink(missing_ok=True)
        raise ValueError(f"Could not parse file '{original_filename}': {e}") from e

    raw_columns = [str(c).strip() for c in df.columns]
    row_count = len(df)
    sample_rows = df.head(5).fillna("").astype(str).values.tolist()

    # Suggest column mapping
    suggestion = canonical_schema.suggest_mapping(raw_columns, file_type)

    # Insert into uploads table
    ts = db.now_iso()
    with db.db_connection() as conn:
        conn.execute(
            """
            INSERT INTO uploads
            (id, engagement_id, file_type, original_filename, stored_path,
             row_count, column_mapping, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                upload_id,
                engagement_id,
                file_type,
                original_filename,
                str(stored_path),
                row_count,
                json.dumps({"suggested": suggestion["matches"], "confirmed": None}),
                ts,
            ),
        )

    return {
        "upload_id": upload_id,
        "engagement_id": engagement_id,
        "file_type": file_type,
        "original_filename": original_filename,
        "row_count": row_count,
        "columns": raw_columns,
        "sample_rows": sample_rows,
        "suggested_mapping": suggestion["matches"],
        "missing_required": suggestion["missing_required"],
        "schema": suggestion["schema"],
        "uploaded_at": ts,
    }


def get_upload(upload_id: str) -> Optional[dict]:
    with db.db_connection() as conn:
        row = conn.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    if d.get("column_mapping"):
        try:
            d["column_mapping"] = json.loads(d["column_mapping"])
        except Exception:
            pass
    return d


def list_uploads(engagement_id: str) -> list[dict]:
    with db.db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM uploads WHERE engagement_id = ? ORDER BY uploaded_at DESC",
            (engagement_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("column_mapping"):
            try:
                d["column_mapping"] = json.loads(d["column_mapping"])
            except Exception:
                pass
        out.append(d)
    return out


def confirm_mapping(upload_id: str, confirmed_mapping: list[dict]) -> dict:
    """Persist consultant-confirmed column mapping.

    confirmed_mapping = [
      {"raw_column": "Pur.Order Number", "canonical_field": "po_number"},
      ...
    ]
    """
    upload = get_upload(upload_id)
    if not upload:
        raise ValueError(f"Upload {upload_id} not found")

    schema = canonical_schema.get_schema(upload["file_type"])
    required_fields = {f["field"] for f in schema["fields"] if f["required"]}
    mapped_canonical = {m["canonical_field"] for m in confirmed_mapping if m.get("canonical_field")}
    missing = sorted(required_fields - mapped_canonical)

    # Merge: keep suggested + store confirmed
    current = upload.get("column_mapping") or {}
    if not isinstance(current, dict):
        current = {}
    current["confirmed"] = confirmed_mapping
    current["missing_required"] = missing

    with db.db_connection() as conn:
        conn.execute(
            "UPDATE uploads SET column_mapping = ? WHERE id = ?",
            (json.dumps(current), upload_id),
        )

    return {
        "upload_id": upload_id,
        "confirmed_mapping": confirmed_mapping,
        "missing_required": missing,
        "ready_for_bronze": len(missing) == 0,
    }


def read_upload_dataframe(upload_id: str) -> pd.DataFrame:
    """Read the stored file back into a DataFrame for downstream stages."""
    upload = get_upload(upload_id)
    if not upload:
        raise ValueError(f"Upload {upload_id} not found")
    path = Path(upload["stored_path"])
    suffix = path.suffix.lower()
    if suffix in (".csv", ".tsv", ".txt"):
        return pd.read_csv(path, low_memory=False)
    return pd.read_excel(path)


def get_seed_dataset_path() -> Path:
    """Return the path to the demo PO seed dataset (generated at build time)."""
    return Path(__file__).resolve().parents[1] / "data" / "seed" / "demo_po_dump.csv"


def use_seed_dataset(engagement_id: str) -> dict:
    """Convenience for the demo flow — uses the committed seed CSV as if uploaded."""
    seed_path = get_seed_dataset_path()
    if not seed_path.exists():
        raise FileNotFoundError(f"Seed dataset not found at {seed_path}")
    return save_upload(
        engagement_id=engagement_id,
        file_type="PO",
        original_filename="demo_po_dump.csv",
        file_bytes=seed_path.read_bytes(),
    )
