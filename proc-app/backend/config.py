"""Configuration + path resolution.

The backend operates against the KB committed in this repo. Paths are
resolved relative to the repo root (Procurement-App_V3/), not the
backend's CWD.
"""
from __future__ import annotations

import os
from pathlib import Path

# Repo root = three levels up from this file (backend/config.py → backend/ → proc-app/ → repo root)
REPO_ROOT = Path(__file__).resolve().parents[2]

# KB roots
PROC_KB_ROOT = REPO_ROOT / "proc-app" / "kb" / "functions" / "procurement"
SHARED_KB_ROOT = REPO_ROOT / "shared-kb"

# Specific paths
STANDARDS_DIR = SHARED_KB_ROOT / "standards"
REFERENCES_DIR = SHARED_KB_ROOT / "references"
INDUSTRIES_DIR = SHARED_KB_ROOT / "industries"

# Pillar dirs
PILLAR_DIRS = {
    "op-model": PROC_KB_ROOT / "op-model",
    "org-structure": PROC_KB_ROOT / "org-structure",
    "buying-channel": PROC_KB_ROOT / "buying-channel",
}

# Industry overlay roots (per industry, per pillar)
def industry_pillar_dir(industry: str, pillar: str) -> Path:
    return INDUSTRIES_DIR / industry / "by-function" / "procurement" / pillar

# Tracker + QRE bank + cleansing rules
TRACKER_PATH = PROC_KB_ROOT / "_meta" / "analysis-requirements-tracker.yml"
QRE_BANK_PATH = PROC_KB_ROOT / "qre" / "qre-bank.yml"
CLEANSING_RULES_PATH = PROC_KB_ROOT / "_meta" / "cleansing-rules.yml"

# SQLite DB location
DB_DIR = Path(__file__).resolve().parent / "data"
DB_DIR.mkdir(exist_ok=True)
DB_PATH = Path(os.environ.get("PROCVAULT_DB_PATH", DB_DIR / "procvault.db"))

# CORS — allow Vite dev server
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
