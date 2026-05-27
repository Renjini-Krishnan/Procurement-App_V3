# Pending Work Tracker

Running list of work explicitly deferred. Update as items land or new ones surface.

## KB — files referenced but not yet authored / materialised

### From the KB-PART bundles (foundation gap)
| # | File | Source | Status | Notes |
|---|---|---|---|---|
| 1 | `proc-app/kb/functions/procurement/_meta/analysis-requirements-tracker.yml` | V5 (raw) | **Partial: `.broken.yml` saved with content intact, ~95% indent-fixed but nested-list edge cases break parse.** Needs proper YAML-aware reflow or clean source re-upload. | Build-time artefact; not consumed at runtime per its own header. All ~50 analysis entries, all aggregate views present in `.broken.yml` — content loss = 0; only indent inconsistencies remain. |
| 2 | `shared-kb/references/sources-library.yml` | V6 regeneration prompt | Deferred | Regenerate when first referenced by analysis that needs source citations |
| 3 | `shared-kb/references/master-data/units-of-measure.yml` | V6 regeneration prompt | Deferred | Regenerate when first UoM normalisation is needed |

### Steel industry-wide foundation (referenced by every Steel overlay; not authored)
| File | Referenced by | Status |
|---|---|---|
| `shared-kb/industries/steel/industry-context.md` | all Steel filter files | Not authored |
| `shared-kb/industries/steel/value-chain.md` | all Steel filter files | Not authored |
| `shared-kb/industries/steel/regulatory.md` | all Steel filter files | Not authored |
| `shared-kb/industries/steel/categories-master.yml` | all Steel filter files (category patterns) | Not authored |
| `shared-kb/industries/steel/glossary-industry.md` | all Steel filter files | Not authored |
| `shared-kb/industries/steel/financial-snapshot.md` | benchmark contextualisation | Not authored |

### Remaining Build-1 pillars (per HANDOFF Section 10)
| # | Pillar | Status | Estimated files |
|---|---|---|---|
| 3 | Buying Channel | Title only — not yet designed | ~26–33 (5 files × 4-5 themes + 8 engine assets) |
| 4 | PR-to-PO | Title only | ~26–33 |
| 5 | Post-PO | Title only | ~26–33 |
| 6 | Material Master | Title only | ~26–33 |
| 7 | Supplier | Title only | ~26–33 |

### Cross-cutting
| Item | Status | Notes |
|---|---|---|
| `qre/qre-bank.yml` consolidation | Not authored | QRE questions currently defined inline in tracker; bank file pending |
| `data-templates/` Excel templates | Not authored | For Stage 4 uploads (PO, Org Structure, etc.) |

## App build (Code + Design)

Not started. Scope, sequencing, and tech-stack confirmation parked per user direction. Locked target stack from HANDOFF Section 3: GCP Cloud Run + Cloud SQL with pgvector + Cloud Storage + Vertex AI Gemini + GitHub.

## Industries

Build-1 industry scope confirmed: **Steel only** (Cement deferred to Build-2 per user direction 2026-05-27).

## Naming

Working internal name "Procvault" retained; final name TBD.

## Open design questions (from HANDOFF Section 14, still unresolved)

- Should the 5 pending pillars also have feasibility lens applied + boundaries (no ₹ for some)?
- At what stage do we shift from KB authoring to actual app build?
- Should existing Op Model + Org Structure files get retroactive feasibility lens pass? *(Decided: no — apply going forward only)*
