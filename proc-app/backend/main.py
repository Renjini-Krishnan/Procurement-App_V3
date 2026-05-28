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

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db, kb_loader
from .api import engagement, health, kb, pillar, qre, upload

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
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

    app.include_router(health.router)
    app.include_router(engagement.router)
    app.include_router(upload.router)
    app.include_router(pillar.router)
    app.include_router(qre.router)
    app.include_router(kb.router)

    @app.on_event("startup")
    def on_startup():
        db.init_db()
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
