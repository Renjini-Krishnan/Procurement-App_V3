# Procvault — Backend

FastAPI + SQLite + PyYAML. Serves the KB (YAML files committed in `proc-app/kb/` + `shared-kb/`) and per-engagement metadata.

## Run locally

```bash
cd proc-app
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

API at http://localhost:8000. Interactive docs at http://localhost:8000/docs.

Vite frontend (port 5173) proxies `/api/*` to this backend automatically.

## Run tests

```bash
cd proc-app
pip install pytest
python -m pytest backend/tests -v
```

## Structure

```
backend/
├── main.py              # FastAPI app + startup
├── config.py            # Paths + CORS + DB location
├── db.py                # SQLite schema + CRUD helpers
├── kb_loader.py         # YAML/MD loader + cascade resolution
├── models.py            # Pydantic request/response shapes
├── api/
│   ├── health.py        # GET /api/health, /api/ready
│   ├── engagement.py    # CRUD + stage progress for engagements
│   └── kb.py            # KB query endpoints + cascade lookups
├── data/                # SQLite DB lives here (gitignored)
├── requirements.txt
└── tests/
    └── test_kb_loader.py
```

## Endpoints (V1 set)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/ready` | KB load status |
| GET | `/api/kb/stages` | 30-stage workflow definition |
| GET | `/api/kb/pillars` | List authored pillars + themes + components count |
| GET | `/api/kb/pillars/{pillar}/config` | analysis-config.yml |
| GET | `/api/kb/pillars/{pillar}/benchmarks?industry=steel` | Cascaded benchmarks |
| GET | `/api/kb/pillars/{pillar}/rca-rules` | rca-rules.yml |
| GET | `/api/kb/pillars/{pillar}/scoring-descriptors` | scoring-descriptors.yml |
| GET | `/api/kb/pillars/{pillar}/md/{name}` | Markdown file (analysis-framework, rca-patterns, etc.) |
| GET | `/api/kb/standards/data-quality-universal` | Universal data quality rules |
| GET | `/api/kb/meta/tracker` | analysis-requirements-tracker.yml |
| GET | `/api/kb/meta/qre-bank` | qre-bank.yml |
| GET | `/api/kb/meta/cleansing-rules` | cleansing-rules.yml |
| GET | `/api/kb/industries/{ind}/{pillar}/overlays` | List industry overlay files |
| GET | `/api/kb/industries/{ind}/{pillar}/overlays/{name}` | Specific overlay file |
| POST | `/api/engagement` | Create engagement |
| GET | `/api/engagement` | List all engagements |
| GET | `/api/engagement/{id}` | Get engagement |
| GET | `/api/engagement/{id}/stages` | Per-stage progress |
| POST | `/api/engagement/{id}/stages/{stage_id}` | Update stage status / store output |

## Cascade model

`/api/kb/pillars/op-model/benchmarks?industry=steel` returns:

```json
{
  "pillar": "op-model",
  "industry": "steel",
  "benchmarks": {
    "opmodel.centralisation.savings_rate": {
      "id": "...",
      "primary": {...},
      "_source": "industry_overlay",
      "_overridden_by": "industry_overlay"
    },
    ...
  }
}
```

The cascade applied:
1. Start with function defaults (`proc-app/kb/functions/procurement/op-model/benchmarks.yml`)
2. Apply industry overrides (`shared-kb/industries/steel/by-function/procurement/op-model/benchmarks.yml` `overrides:` array)
3. Append industry-only additions (`additions:` array)
4. Tag each benchmark with `_source` and `_overridden_by` for traceability

Engagement-level overrides (Layer 4 in cascade) come from `engagement_overrides` table in SQLite — applied at API call time once the engagement context is known.

## Status

**Chunk 2 of 5** — backend scaffold + KB loader + cascade resolution + engagement CRUD. No engine logic yet (Chunks 3-5).
