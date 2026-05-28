"""Procvault Backend — FastAPI app entry.

Run locally:
    cd proc-app/backend
    pip install -r requirements.txt
    uvicorn proc-app.backend.main:app --reload --port 8000

OR from repo root:
    python -m uvicorn proc_app.backend.main:app --reload --port 8000
(if the project is installed) — see README.md for the local-dev recipe.
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from . import config, db, kb_loader
from .api import engagement, exports, health, jobs, kb, kb_files, llm as llm_api, pillar, qre, upload


# ---------- Logging configuration ----------

LOG_JSON = os.environ.get("PROCVAULT_LOG_JSON", "0") in ("1", "true", "yes")
LOG_LEVEL = os.environ.get("PROCVAULT_LOG_LEVEL", "INFO").upper()


class JsonFormatter(logging.Formatter):
    """One JSON object per log line — production-friendly."""
    def format(self, record):
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Pull custom attrs
        for k in ("request_id", "engagement_id", "duration_ms", "method", "path", "status"):
            v = getattr(record, k, None)
            if v is not None:
                payload[k] = v
        return json.dumps(payload, default=str)


def _configure_logging():
    handler = logging.StreamHandler()
    if LOG_JSON:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(LOG_LEVEL)


_configure_logging()
log = logging.getLogger("procvault")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Procvault Backend",
        description="Procurement Functional Assessment App — engine + KB serving layer",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_logger(request: Request, call_next):
        rid = uuid.uuid4().hex[:8]
        t0 = time.time()
        response = await call_next(request)
        dur_ms = int((time.time() - t0) * 1000)
        # Extract engagement_id from path if present
        eng_id = None
        parts = request.url.path.split("/")
        if "engagement" in parts:
            try:
                eng_id = parts[parts.index("engagement") + 1]
                if eng_id in ("", "new"):
                    eng_id = None
            except (ValueError, IndexError):
                pass
        log.info("http",
                  extra={"request_id": rid, "engagement_id": eng_id,
                         "method": request.method, "path": request.url.path,
                         "status": response.status_code, "duration_ms": dur_ms})
        response.headers["X-Request-ID"] = rid
        return response

    app.include_router(health.router)
    app.include_router(engagement.router)
    app.include_router(upload.router)
    app.include_router(upload.meta_router)
    app.include_router(pillar.router)
    app.include_router(qre.router)
    app.include_router(kb.router)
    app.include_router(kb_files.router)
    app.include_router(exports.router)
    app.include_router(jobs.router)
    app.include_router(llm_api.router)

    @app.on_event("startup")
    def on_startup():
        db.init_db()
        from .services import jobs as jobs_service
        jobs_service.init_jobs_schema()
        log.info("SQLite initialised at %s", config.DB_PATH)
        try:
            summary = kb_loader.validate_all()
            log.info("KB loaded: %d files, %d warnings", len(summary["loaded"]), len(summary["warnings"]))
            for w in summary["warnings"]:
                log.warning("KB warning: %s", w)
        except Exception as e:
            log.error("KB validation failed at startup: %s", e)
            raise

    return app


app = create_app()
