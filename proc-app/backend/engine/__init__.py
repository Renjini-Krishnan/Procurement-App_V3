"""Procvault engine — runs cleansing + classification + pillar analyses.

Modules:
  gold_data      — Stage 8: apply column mapping + vendor dedup + currency norm
  stage9_classify — Stage 9 stub: archetype + reclassified_category per row
  stage10_kpis   — Stage 10: precompute per-MG aggregations
  op_model/      — Stage 12: 4 themes (Centralisation, Shared Services, CoE, Tail Spend)
  rca_engine     — Evaluates rca-rules.yml triggers against findings
  scoring        — 1-5 maturity score per theme using scoring-descriptors.yml
  orchestrator   — Runs Stage 8 → 9 → 10 → 12 end-to-end for a pillar
"""
