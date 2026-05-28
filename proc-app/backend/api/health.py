"""Health + readiness endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from .. import kb_loader

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ready")
def ready():
    """Reports KB load status."""
    summary = kb_loader.validate_all()
    return {
        "status": "ok" if not summary["warnings"] else "degraded",
        "loaded_count": len(summary["loaded"]),
        "warnings": summary["warnings"],
    }
