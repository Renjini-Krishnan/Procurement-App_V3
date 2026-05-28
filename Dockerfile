# Procvault — full-stack container.
# Build frontend (vite) in stage 1, run FastAPI + serve static dist in stage 2.

# ----- Stage 1: build frontend -----
FROM node:20-alpine AS frontend

WORKDIR /app/frontend
COPY proc-app/frontend/package.json proc-app/frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY proc-app/frontend/ ./
RUN npm run build


# ----- Stage 2: backend + serve static -----
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROCVAULT_LOG_JSON=1 \
    PROCVAULT_LOG_LEVEL=INFO

WORKDIR /app

# System deps for lxml, openpyxl
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libxml2-dev libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

COPY proc-app/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY proc-app/ ./proc-app/
COPY shared-kb/ ./shared-kb/

# Frontend static dist
COPY --from=frontend /app/frontend/dist ./proc-app/frontend/dist

# Mount the built dist as a static directory served by FastAPI in production.
# (The startup script handles this — falls back to API-only if dist missing.)

EXPOSE 8000

WORKDIR /app/proc-app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
