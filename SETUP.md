# Procvault — Setup on a new device

This guide gets you from a fresh machine to a running app in ~15 minutes.

## What's portable in the repo

- All source code (Python backend + React frontend)
- KB taxonomy + benchmarks + filters (`shared-kb/`, `proc-app/kb/`)
- Tests (73, all passing on main)

## What's NOT in the repo (and how to handle each)

| Element | Status | What to do |
|---|---|---|
| Engagement data (SQLite DB) | gitignored | Re-created on first run; start fresh |
| Uploaded PO/PR files | gitignored | Re-upload via UI when you need them |
| Document vectors (sqlite-vec) | gitignored | Re-ingest via the Documents shelf if you want RAG |
| Vertex AI credentials | gitignored | Optional — set if you want AI narratives |

You do **not** need to copy any data from the old machine — everything regenerates.

---

## Step 1 — Clone

```bash
git clone https://github.com/renjini-krishnan/procurement-app_v3.git
cd procurement-app_v3
```

## Step 2 — Backend

Requires Python 3.11 or later.

```bash
cd proc-app
python -m venv .venv
source .venv/bin/activate                # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

If `sqlite-vec` fails to install (rare — needs a recent pip), the app will
still run; document ingestion + RAG narratives just stay disabled with a
log warning.

## Step 3 — Frontend

Requires Node 20+ (Node 22 verified).

```bash
cd frontend
npm install
```

## Step 4 — Run

Two terminals:

```bash
# Terminal 1 — backend
cd proc-app
source .venv/bin/activate
uvicorn backend.main:app --port 8000
```

```bash
# Terminal 2 — frontend
cd proc-app/frontend
npm run dev
```

Open http://localhost:5173. The first request will create
`proc-app/backend/data/procvault.db` automatically.

## Step 5 — Smoke test

In the UI:
1. Create an engagement (Stage 1)
2. Upload a PO Excel dump (Stage 4) — try with a multi-sheet file to see
   the FY-tab collation panel
3. Confirm column mapping (Stage 6)
4. Open the Op Model page (Stage 12) — should run end-to-end in 2-3 s

Or via API:

```bash
curl -X POST http://localhost:8000/api/engagement \
  -H 'Content-Type: application/json' \
  -d '{"client_name":"Test","industry":"steel","sub_segment":"integrated",
       "plants":["P1"],"annual_spend_inr_cr":100,"annual_revenue_inr_cr":1000,
       "fte_count":20}'
```

---

## Optional — Vertex AI for LLM narratives

Without this, all engine outputs (scores, RCA, KPIs) still work. Only the
"AI verdict" narrative blocks on each pillar page fall back to a
deterministic stub instead of a Gemini-generated explanation.

1. Create a Google Cloud project with Vertex AI enabled
2. Create a service account with `roles/aiplatform.user`
3. Download the JSON key
4. Set the env var before starting uvicorn:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_LOCATION=us-central1
```

Verify the backend picked it up:

```bash
curl http://localhost:8000/api/llm/status
# Returns {"vertex_ai_available": true, ...} if creds are good
```

---

## Optional — Custom KB tweaks

Everything the consultant edits in the in-app KB editor is YAML on disk.
If you want pre-loaded edits on the new device, just commit them to the
repo before cloning:

- `shared-kb/industries/<industry>/categories-master.yml` — canonical taxonomy
- `shared-kb/industries/<industry>/by-function/procurement/<pillar>/*.yml` — benchmarks + filters
- `proc-app/kb/functions/procurement/<pillar>/*.yml` — function defaults

The KB cascade resolves them automatically: function default → industry
overlay → engagement override.

---

## Optional — Migrating live engagements from the old device

Only if you want to keep work-in-progress engagements (you said you
don't, so skip this section). The portable state is:

```
proc-app/backend/data/procvault.db          # all engagement metadata
proc-app/backend/data/uploads/<eng_id>/...  # raw uploaded files
```

`tar -czf state.tar.gz proc-app/backend/data/` on the old device, copy
across, extract to the same relative path on the new device, start the
servers. Engagement IDs + upload IDs are preserved.

---

## Troubleshooting

**Backend exits immediately**: usually a missing dep. Re-run
`pip install -r requirements.txt`. The most common miss is `openpyxl`
(needed for Excel reads).

**Frontend shows "Cannot connect to backend"**: the Vite dev server proxies
`/api/*` to `http://localhost:8000`. Confirm backend is on port 8000.

**Op Model page is blank**: check the browser console. If you see
`Element type is invalid`, you're on a commit before the icon fix
(`4837b80`) — pull main.

**`sqlite-vec` install fails on Windows**: use WSL2 or install the
pre-built wheel. The app still runs without it (RAG features disabled).

**"No taxonomy" error in Stage 9 results**: `shared-kb/industries/<industry>/categories-master.yml`
must exist for your engagement's industry. Currently shipping: `steel`
(full, v1.1). Cement is a stub.
