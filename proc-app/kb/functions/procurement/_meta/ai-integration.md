# AI Element — Vertex AI Gemini 2.5 Pro Integration Spec

**Layer:** function-level (procurement). Platform-wide AI configuration.
**Sibling files:** `_meta/cleansing-rules.yml`, `_meta/analysis-requirements-tracker.yml`.
**Engine code that follows this spec:** `backend/services/llm.py`, `backend/services/llm_prompts.py`.

---

## Stack

| Component | Value |
|---|---|
| Model | `gemini-2.5-pro` |
| Platform | Google Vertex AI |
| Auth | Application Default Credentials (ADC) — no API keys in code |
| SDK | `vertexai` (from `google-cloud-aiplatform`) |
| Default project | `gen-lang-client-0226029743` |
| Default region | `us-central1` |

## Setup on a new machine

```bash
# 1. Install (already in requirements.txt)
pip install google-cloud-aiplatform

# 2. Authenticate ONCE per machine
gcloud auth application-default login
```

This creates `~/.config/gcloud/application_default_credentials.json`.
No API key is ever stored in code or env vars.

## Environment overrides (optional)

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_VERTEX_PROJECT` | `gen-lang-client-0226029743` | GCP project to bill |
| `GEMINI_VERTEX_LOCATION` | `us-central1` | Vertex AI region |
| `GEMINI_MODEL` | `gemini-2.5-pro` | Model name |
| `PROCVAULT_LLM_FINDINGS` | `0` | Set to `1` to enable LLM finding narratives in KPI dashboard |
| `PROCVAULT_LLM_COLMAP` | `0` | Set to `1` to enable LLM column-mapping suggestions in Stage 5 |

## Mandatory pattern

Every LLM call goes through `services/llm.py` helpers and must supply a
**deterministic fallback**. If Vertex AI is unavailable (no ADC, network
error, quota), the helper returns the fallback. The app **never breaks**.

```python
from backend.services import llm
text = llm.generate_text(prompt, fallback="<deterministic string>")
```

`llm.is_enabled()` and `GET /api/llm/status` report live vs fallback state.

## Where AI is wired (V1)

| Call site | Behaviour | Flag |
|---|---|---|
| KPI Dashboard findings (`engine/kpi_calculator.py`) | LLM rewrites each KPI finding into 2-3 consultant sentences (loads context from `_meta/kpi-rca-library.yml`) | `PROCVAULT_LLM_FINDINGS=1` |
| Exec Summary narrative (`POST /api/engagement/{id}/llm/exec-narrative`) | LLM produces 3-4-sentence executive paragraph from pillar scores + top KPIs | always on when LLM enabled |
| Stage 5 column mapping (`services/canonical_schema.suggest_mapping`) | LLM revises heuristic suggestions for noisy real-world headers | `PROCVAULT_LLM_COLMAP=1` |

Each call site has a deterministic fallback that produces useful output
when LLM is off. Defaults are off so the KPI dashboard remains fast.

## Cost

Gemini 2.5 Pro on Vertex AI bills per token to the GCP project. The
project `gen-lang-client-0226029743` is the Accenture GCP project
currently bearing the cost.
