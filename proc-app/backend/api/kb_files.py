"""KB file browser + editor endpoints.

Allows the consultant to view + edit raw KB files (YAML + Markdown) in-app
instead of through the filesystem. Writes are validated (YAML must parse)
and the loader cache is invalidated on every successful write.
"""
from __future__ import annotations

from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import config, kb_loader

router = APIRouter(prefix="/api/kb/files", tags=["kb-files"])


# Roots that are browseable + writable. Each entry is (label, abs path).
KB_ROOTS = {
    "function": config.PROC_KB_ROOT,           # proc-app/kb/functions/procurement
    "standards": config.STANDARDS_DIR,         # shared-kb/standards
    "references": config.REFERENCES_DIR,       # shared-kb/references
    "industries": config.INDUSTRIES_DIR,       # shared-kb/industries
}

ALLOWED_EXTS = {".yml", ".yaml", ".md"}


def _safe_resolve(root_key: str, rel_path: str) -> Path:
    if root_key not in KB_ROOTS:
        raise HTTPException(400, f"Unknown KB root: {root_key}")
    root = KB_ROOTS[root_key].resolve()
    target = (root / rel_path).resolve()
    # Prevent path traversal
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(400, "Path escapes KB root")
    return target


def _walk(root: Path, root_key: str) -> list[dict]:
    if not root.exists():
        return []
    out = []
    for p in sorted(root.rglob("*")):
        if p.is_dir():
            continue
        if p.suffix.lower() not in ALLOWED_EXTS:
            continue
        rel = p.relative_to(root)
        out.append({
            "root": root_key,
            "rel_path": str(rel).replace("\\", "/"),
            "name": p.name,
            "ext": p.suffix.lower().lstrip("."),
            "size_bytes": p.stat().st_size,
        })
    return out


@router.get("/tree")
def list_tree():
    """Return all KB files grouped by root."""
    tree = {}
    for key, path in KB_ROOTS.items():
        tree[key] = _walk(path, key)
    return {"roots": list(KB_ROOTS.keys()), "files": tree}


@router.get("/read")
def read_file(root: str, path: str):
    """Read raw file content."""
    p = _safe_resolve(root, path)
    if not p.exists() or not p.is_file():
        raise HTTPException(404, f"File not found: {root}/{path}")
    if p.suffix.lower() not in ALLOWED_EXTS:
        raise HTTPException(400, "Unsupported file type")
    return {
        "root": root,
        "rel_path": path,
        "ext": p.suffix.lower().lstrip("."),
        "content": p.read_text(encoding="utf-8"),
    }


class WriteRequest(BaseModel):
    root: str
    path: str
    content: str


@router.post("/write")
def write_file(payload: WriteRequest):
    """Write file content. YAML files are validated by yaml.safe_load first."""
    p = _safe_resolve(payload.root, payload.path)
    if not p.exists():
        raise HTTPException(404, f"File not found: {payload.root}/{payload.path}")
    if p.suffix.lower() not in ALLOWED_EXTS:
        raise HTTPException(400, "Unsupported file type")
    # Validate YAML
    if p.suffix.lower() in (".yml", ".yaml"):
        try:
            yaml.safe_load(payload.content)
        except yaml.YAMLError as e:
            raise HTTPException(400, f"YAML parse error: {e}")
    p.write_text(payload.content, encoding="utf-8")
    # Invalidate loader cache
    if hasattr(kb_loader, "_cache"):
        kb_loader._cache.clear()
    return {"status": "ok", "bytes_written": len(payload.content.encode("utf-8"))}
