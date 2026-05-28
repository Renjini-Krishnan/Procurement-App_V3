# Procvault — Frontend

V1 frontend for the Procurement Functional Assessment App. React + Vite. Indigo direction default.

## Run locally

```bash
cd proc-app/frontend
npm install
npm run dev
```

App runs at http://localhost:5173. Backend (FastAPI) proxied at `/api` → `http://localhost:8000` (see `vite.config.js`).

## Structure

```
src/
├── main.jsx               # React root + tokens.css import
├── App.jsx                # Router
├── design/
│   ├── tokens.css         # CSS variables: 3 directions (violet / indigo / enterprise) + global
│   ├── components.jsx     # Button, Input, Select, Card, Badge, Tabs, Callout, DataTable, Bar
│   ├── icons.jsx          # Minimal stroke icons
│   └── Logo.jsx           # Vault logo (mark + wordmark)
├── data/
│   └── stages.js          # 30-stage workflow (mirrors design system STAGES)
└── screens/
    ├── Landing.jsx        # Hero + principles
    ├── WorkspaceShell.jsx # Left rail with stage list + main canvas
    └── StagePlaceholder.jsx  # Generic per-stage view (replaced as chunks land)
```

## Direction

Indigo set as default via `<html data-direction="indigo">` in `index.html`. To preview other directions, change the attribute to `violet` or `enterprise`.

## Status

**Chunk 1 of 5** — scaffold only. Landing screen + workspace shell + stage rail wired. Per-stage logic comes in subsequent chunks.
