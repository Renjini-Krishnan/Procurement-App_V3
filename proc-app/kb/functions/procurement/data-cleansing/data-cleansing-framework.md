---
id: data-cleansing-framework
layer: function
function: procurement
domain: data-cleansing
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# Data Cleansing — Framework

## Purpose

Defines the data pipeline that transforms client-uploaded files into analysis-ready Gold data. Every Analyze pillar (Stages 12+) consumes Gold data. Quality of Gold determines quality of findings.

## Layer Definitions

| Layer | What it is | Stored at |
|---|---|---|
| **Stage 4 (Upload)** | Raw client files as received — CSV, XLSX, PDF, Word | Cloud Storage `engagements/<id>/uploads/` |
| **Stage 5 (AI Validation)** | Engine reads raw files; runs structural + initial quality checks; raises flags | Audit log (read-only of Stage 4) |
| **Stage 6 (User Validation)** | Consultant reviews flags via HITL UI; approves / rejects / corrects | Audit log + corrected data in staging |
| **Stage 7 (Bronze)** | Structurally validated raw data. Schema-conforming. Values preserved exactly as uploaded (with corrections from Stage 6 applied). | Cloud SQL `bronze.<template>` tables |
| **Stage 8 (Gold)** | Cleansed, normalised (currency, UoM, dates), deduplicated (vendor, material), canonicalised (plant codes, designations), cross-template joined | Cloud SQL `gold.<template>` tables |
| **Stage 9 (Category Classification)** | Adds canonical `category` to PO records using industry taxonomy + AI classification + consultant validation | Updates `gold.po` |
| **Stage 10 (KPI Calculation)** | Computes engagement-level KPIs (spend totals, PO counts, vendor counts) | `gold.kpis` |

## Per-Template Data Templates

| Template | Stage | Purpose | Pillars consuming |
|---|---|---|---|
| **PO Dump** | Mandatory | Central artefact — all PO records | Op Model, Buying Channel, PR-to-PO, Post-PO, DoA, Supplier |
| **PR** | Optional | Purchase Requisitions | PR-to-PO |
| **GRN** | Optional | Goods Receipt Notes | Post-PO |
| **Invoice** | Optional | Invoice records | Post-PO |
| **Material Master** | Recommended | Item-level data | Material Master pillar, Op Model |
| **Vendor Master** | Recommended | Vendor metadata | Supplier, Tail Spend (Op Model) |
| **Org Structure / Employee Master** | Mandatory for Org Structure pillar | FTE records | Org Structure |
| **Vendor Performance** | Optional | OTD, quality, scorecard | Supplier |

## Cleansing Principles

1. **Preserve raw values in Bronze** — Gold transformations are reversible; original always recoverable
2. **Feasibility honesty** — if cleansing fails for X% of rows, flag clearly; don't fabricate
3. **HITL for ambiguity** — AI flags; consultant decides; corrections logged
4. **Reference data joins, not invention** — use authoritative lookup tables (HSN codes, currency codes, UoM)
5. **Deterministic where possible** — rule-based cleansing first; AI only for genuinely ambiguous cases
6. **Engagement-scoped** — every transformation tied to engagement ID for audit

## HITL Pattern at Each Stage

```
Stage 5: AI surfaces issue
        ↓
Stage 6: UI shows flag → consultant: Approve / Reject / Correct
        ↓
Stage 7: Bronze stores the decision (audit log)
        ↓
Stage 8: Gold applies the decision (transformation)
        ↓
Audit log persists indefinitely
```

## Data Quality Score (engagement-level)

Computed at end of Stage 8 across all templates:

```
data_quality_score = (
  0.40 × completeness_pct      # % of required fields populated
+ 0.30 × validity_pct          # % passing validation rules
+ 0.30 × consistency_pct       # % of cross-references that resolve
)
```

| Score | Band | Pillar feasibility |
|---|---|---|
| 90-100 | HIGH | All pillars run at High confidence |
| 75-90 | GOOD | All pillars run at Medium-High |
| 60-75 | ACCEPTABLE | Most pillars run; some components skip |
| <60 | LOW | Many components skip; pillar verdicts directional |

Detailed thresholds in `data-quality-scoring.yml`.

## Cross-References

| File | Role |
|---|---|
| `bronze-validation-rules.yml` | Structural rules for Bronze layer |
| `gold-cleansing-rules.yml` | Normalisation + enrichment for Gold layer |
| `cross-template-integrity-rules.yml` | Referential integrity rules |
| `indian-context-rules.yml` | GST / HSN / MSME / INR rules |
| `data-quality-scoring.yml` | Score formula + pillar feasibility gates |
| `templates/*-cleansing-spec.md` | Template-specific specifications |
| `hitl-correction-workflow.md` | User correction workflow |
| `shared-kb/references/master-data/currencies.yml` | Currency reference |
| `shared-kb/references/master-data/units-of-measure.yml` | UoM reference |
| `shared-kb/standards/data-quality-universal.yml` | Universal cleansing standards |

## Versioning

- v1.0 — Initial framework (2026-05-28). Bronze + Gold layers defined. 11 template-specific specs to follow.