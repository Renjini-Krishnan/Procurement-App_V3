---
id: po-dump-cleansing-spec
layer: function
function: procurement
domain: data-cleansing
template: po_dump
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# PO Dump — Cleansing Specification

## Why PO Dump matters most

PO Dump is the **central artefact** of procurement data. Every Analyze pillar consumes it; it drives 80%+ of findings. Cleansing PO Dump well is the single highest-leverage investment in data quality.

## Required vs Optional columns

### Mandatory columns (all 15)

| Column | Type | Why mandatory |
|---|---|---|
| `po_id` | string | Primary key |
| `po_date` | date | Time-series anchoring |
| `vendor_id` | string | Vendor analysis foundation |
| `vendor_name` | string | Human readability + dedup |
| `material_code` | string | Material Master link |
| `material_description` | string | Category classification fallback |
| `quantity` | number | UoM analysis |
| `uom` | string | UoM normalisation |
| `unit_price` | number | Price benchmarking |
| `po_value` | number | Foundation for all spend analysis |
| `po_currency` | string | FX normalisation |
| `plant` | string | Plant-level breakdowns |
| `buying_entity` | string | Op Model centralization analysis |
| `buyer_id` | string | Org Structure linkage |
| `po_approver_designation` | string | DoA compliance analysis |

### Optional columns (15+, value-add when present)

| Column | Type | What it enables |
|---|---|---|
| `po_approver_id` | string | DoA breach attribution at individual level |
| `bu` | string | BU-level breakdowns |
| `cost_centre` | string | Cost centre-level analysis |
| `payment_terms` | string | DPO + working capital |
| `po_type` | enum | Capex/opex/services/PAC/emergency tagging |
| `hsn_code` | string | Indian GST validation |
| `sac_code` | string | Indian services tax |
| `gst_rate_pct` | number | Input tax credit |
| `contract_ref` | string | Rate contract / framework linkage |
| `rate_contract_flag` | boolean | Buying Channel analysis |
| `delivery_location` | string | Logistics analysis |
| `requested_delivery_date` | date | OTD baseline |
| `incoterms` | string | International POs |
| `negotiation_indicator` | string | Savings vs LPO |
| `pac_flag` | boolean | PAC governance |
| `emergency_flag` | boolean | Emergency procurement |

## Cleansing Stages

### Stage 4 (Upload) → Stage 5 (AI Validation)

AI scan produces:

- File-level: format, encoding, header detection (per `bronze-validation-rules.yml`)
- Column inventory: which mandatory columns present, which missing
- Row count + first-row preview
- Initial flags list

### Stage 5 → Stage 6 (User Validation)

Consultant reviews via HITL UI:

| Flag | UI prompt | Default action |
|---|---|---|
| `column_missing` | "po_value column missing — please map" | Map to actual column in file |
| `null_pct_exceeds` | "vendor_id is 12% null — accept or improve?" | Accept OR request improved file |
| `date_format_ambiguous` | "Dates appear DD/MM — confirm?" | Confirm format |
| `currency_inconsistent` | "5% of rows have non-INR currency. Convert?" | Yes/No |
| `plant_code_unfamiliar` | "Plant code 'JSW-BLY' — canonicalise to?" | Pick from list / add new |
| `approver_designation_unfamiliar` | "Designation 'AVP Procurement' — canonical?" | Map to canonical |

### Stage 6 → Stage 7 (Bronze)

- All consultant decisions applied
- Raw values preserved alongside canonical/normalised
- Audit log: every transformation logged with rule_id + consultant_id + timestamp

### Stage 7 → Stage 8 (Gold)

Transformations applied (per `gold-cleansing-rules.yml`):

1. **Currency**: convert all to engagement_default (typically INR) using RBI rates
2. **UoM**: canonicalise + add `quantity_normalised` to base UoM per category
3. **Dates**: ISO 8601 across the board
4. **Vendor**: dedup using fuzzy match + GSTIN/PAN; link to vendor_master if uploaded
5. **Material**: dedup + link to material_master
6. **Plant**: canonicalise via per-engagement dictionary
7. **Approver designation**: canonicalise + assign tier
8. **PO type**: derive from category if not explicit; PAC + emergency detection
9. **HSN/SAC**: validate format + lookup category
10. **Cross-template integrity**: flag orphans (per cross-template-integrity-rules.yml)

## Specific PO Dump Anomalies to Detect

### Outliers + suspicious values

| Anomaly | Detection | Action |
|---|---|---|
| `po_value` = 0 OR negative | po_value <= 0 | HITL flag — credit note OR error? |
| Same `po_id` appears multiple times | Duplicate rows | HITL flag — dedup OR legitimate amendment |
| `po_date` in future | po_date > today | HITL flag — data error OR forward-dated |
| `po_date` older than 10 years | po_date < today - 10y | HITL flag — legacy data |
| `unit_price` 0 but quantity > 0 | unit_price = 0 AND qty > 0 | HITL flag — free issue OR error |
| `po_value` != quantity × unit_price (more than 5% off) | abs diff > 5% | HITL flag — discount/tax/data error |

### Vendor anomalies

| Anomaly | Detection |
|---|---|
| Single vendor > 50% of total spend | Concentration risk flag |
| New vendor (never seen before in engagement) | Investigate onboarding |
| Vendor active flag = false in master | Possible deactivated vendor used |
| Vendor name has special chars / encoding issues | HITL flag |

### PO timing anomalies

| Anomaly | Detection |
|---|---|
| Many POs on same day for same vendor (clustering) | Possible split-purchasing |
| PO-to-GRN lag very short (< 7 days for typical 30-day items) | Possible emergency / fictitious PO |
| PO created after material received (PO date > GRN date) | Post-facto PO — control finding |

### Approval anomalies

| Anomaly | Detection |
|---|---|
| Same approver for very large % of POs | Workload concentration (see DoA Theme 3) |
| PO approved by designation below DoA threshold | Breach (DoA Theme 3 C1) |
| PO routing skipped intermediate tier | Tier jump (DoA Theme 3 C4) |

## Stage 8 → Pillar Consumption

Gold PO data is then consumed by:

| Pillar | What it uses from PO Dump |
|---|---|
| Op Model | category, vendor_id, plant, buying_entity, po_value (all themes) |
| Org Structure | buyer_id, po_approver_id (for productivity + concentration analysis) |
| Buying Channel | rate_contract_flag, contract_ref, po_value, category |
| PR-to-PO | po_id, po_date (linked to PR template) |
| Post-PO | po_id, po_date (linked to GRN + Invoice templates) |
| DoA | po_value, po_approver_designation, po_approver_id, plant, category |
| Material Master | material_code, material_description |
| Supplier | vendor_id, po_value (concentration), po_date (trend) |

## Quality Score Contribution

Per `data-quality-scoring.yml`, PO Dump carries:
- 40% weight in completeness_pct
- 40% weight in validity_pct
- ~50% weight in consistency_pct (most cross-template links involve PO)

Net: PO Dump quality drives ~45% of overall engagement data quality score.

## Editable Configuration

```yaml
_editable_config:
  mandatory_columns_strict_mode: true       # if false, allow proceeding with missing mandatory columns
  max_null_pct_blocking: 50                 # above this, hard-block proceeding
  duplicate_po_id_handling: "flag_for_review"  # alternative: auto_dedup_keep_first
  outlier_detection_method: "iqr_3x"        # alternative: zscore_3, manual_threshold
  fuzzy_match_threshold_vendor_name: 0.85
  enable_split_purchasing_detection: true
  split_purchasing_window_days: 30
  split_purchasing_aggregate_threshold_pct: 80   # if aggregate > 80% of higher tier threshold
```