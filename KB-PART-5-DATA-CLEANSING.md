# KB-PART-5 — Data Cleansing Rules (Bronze → Gold)

## Purpose

Comprehensive set of rules for the **data cleansing pipeline** in Stages 4-8 of the Procurement Assessment App. Defines what happens to client-uploaded data as it moves from raw upload (Bronze) to analysis-ready (Gold).

This bundle is the **specification handed to the tech team** when Phase 6 (App build) starts. It is also a reference for the KB Editor UI once data quality dashboards are built.

## Layer model

```
Stage 4: Data Upload          → Raw files (CSV / XLSX / PDF) — pre-Bronze
Stage 5: AI Validation        → Structural + initial quality checks → flags raised
Stage 6: User Validation      → Consultant reviews + corrects via HITL
Stage 7: Bronze Data          → Structurally validated, raw values preserved
Stage 8: Gold Data            → Cleansed, normalised, enriched, joined → analysis-ready
                            (Stage 9: Category Classification → adds canonical category)
                            (Stage 10: KPI Calculation → uses Gold)
                            (Stage 12+: Pillar Analyses → use Gold)
```

## Files in this bundle (11)

| # | File | Path | Type |
|---|---|---|---|
| 1 | data-cleansing-framework.md | proc-app/kb/functions/procurement/data-cleansing/ | Framework overview |
| 2 | bronze-validation-rules.yml | proc-app/kb/functions/procurement/data-cleansing/ | Structural rules |
| 3 | gold-cleansing-rules.yml | proc-app/kb/functions/procurement/data-cleansing/ | Normalisation + enrichment |
| 4 | cross-template-integrity-rules.yml | proc-app/kb/functions/procurement/data-cleansing/ | Referential integrity |
| 5 | indian-context-rules.yml | proc-app/kb/functions/procurement/data-cleansing/ | GST/HSN/MSME/INR |
| 6 | data-quality-scoring.yml | proc-app/kb/functions/procurement/data-cleansing/ | Scoring + pillar feasibility gates |
| 7 | po-dump-cleansing-spec.md | proc-app/kb/functions/procurement/data-cleansing/templates/ | PO Dump (central artefact) |
| 8 | vendor-master-cleansing-spec.md | proc-app/kb/functions/procurement/data-cleansing/templates/ | Vendor master |
| 9 | material-master-cleansing-spec.md | proc-app/kb/functions/procurement/data-cleansing/templates/ | Material master |
| 10 | org-structure-cleansing-spec.md | proc-app/kb/functions/procurement/data-cleansing/templates/ | Org Structure (role classification) |
| 11 | hitl-correction-workflow.md | proc-app/kb/functions/procurement/data-cleansing/ | User correction workflow |

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/data-cleansing-framework.md`**
Type: Data Cleansing — Framework Overview
==================================================================

```markdown
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
```

END OF FILE 1. (data-cleansing/data-cleansing-framework.md)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/bronze-validation-rules.yml`**
Type: Bronze layer — Structural validation rules
==================================================================

```yaml
# =============================================================================
# Bronze Validation Rules
# =============================================================================
# Purpose: Structural validation rules applied at Stage 5 (AI Validation) and
#          Stage 6 (User Validation) before data is promoted to Bronze.
#
# Logic Embodied: For each data template, define mandatory columns, data types,
#                 completeness thresholds, and structural anomaly detection.
#                 Engine runs these rules at Stage 5; flags raised to UI for
#                 Stage 6 consultant review.
# =============================================================================

metadata:
  id: bronze-validation-rules
  layer: function
  function: procurement
  domain: data-cleansing
  version: 1.0
  last_updated: 2026-05-28
  owner: kb-admin
  status: active

# =============================================================================
# FILE-LEVEL VALIDATION (applied before any column-level checks)
# =============================================================================

file_level_rules:

  - rule_id: file_format_supported
    description: "File must be CSV, XLSX, XLS, or TSV"
    severity: blocking
    detection: |
      Check file extension + MIME type. Reject PDF, DOC, RTF.
    action_on_fail: REJECT_UPLOAD

  - rule_id: file_size_within_limit
    description: "File size <= 100 MB"
    severity: blocking
    detection: file size > 100 MB
    action_on_fail: REJECT_UPLOAD

  - rule_id: encoding_valid
    description: "UTF-8, UTF-16, or ISO-8859-1 encoding"
    severity: blocking
    detection: parser cannot decode file
    action_on_fail: REJECT_UPLOAD

  - rule_id: header_row_present
    description: "First row contains column headers (not data)"
    severity: blocking
    detection: |
      Heuristic: first row contains mostly text; all subsequent rows have
      numbers / dates in expected positions.
    action_on_fail: REQUEST_HEADER_ROW_CONFIRMATION

  - rule_id: minimum_row_count
    description: "Data file has at least 10 data rows"
    severity: warning
    detection: data row count < 10
    action_on_fail: FLAG_FOR_REVIEW
    note: "Could be a small client OR truncated upload"

  - rule_id: maximum_row_count
    description: "Data file has at most 5 million data rows"
    severity: blocking
    detection: data row count > 5,000,000
    action_on_fail: REQUEST_FILE_SPLIT
    note: "Single file performance — split into multiple uploads"

# =============================================================================
# COLUMN-LEVEL VALIDATION
# =============================================================================
# Per template, define required + optional columns with their types
# =============================================================================

column_rules:

  po_dump:
    required_columns:
      - { name: po_id, type: string, max_null_pct: 0 }
      - { name: po_date, type: date, max_null_pct: 0 }
      - { name: vendor_id, type: string, max_null_pct: 5 }
      - { name: vendor_name, type: string, max_null_pct: 5 }
      - { name: material_code, type: string, max_null_pct: 30, note: "Often blank for services POs" }
      - { name: material_description, type: string, max_null_pct: 10 }
      - { name: quantity, type: number, max_null_pct: 30 }
      - { name: uom, type: string, max_null_pct: 30 }
      - { name: unit_price, type: number, max_null_pct: 30 }
      - { name: po_value, type: number, max_null_pct: 0 }
      - { name: po_currency, type: string, max_null_pct: 0, default: INR }
      - { name: plant, type: string, max_null_pct: 5 }
      - { name: buying_entity, type: string, max_null_pct: 10, note: "central/plant/BU; may be derived in Stage 6" }
      - { name: buyer_id, type: string, max_null_pct: 20 }
      - { name: po_approver_designation, type: string, max_null_pct: 30 }

    optional_columns:
      - { name: po_approver_id, type: string }
      - { name: bu, type: string }
      - { name: cost_centre, type: string }
      - { name: payment_terms, type: string }
      - { name: po_type, type: string, allowed: [capex, opex, services, pac, emergency] }
      - { name: hsn_code, type: string }
      - { name: sac_code, type: string }
      - { name: gst_rate_pct, type: number }
      - { name: contract_ref, type: string }
      - { name: rate_contract_flag, type: boolean }

    rules:
      - rule_id: po_id_unique
        description: "po_id must be unique within file"
        severity: warning
        action_on_fail: FLAG_DUPLICATES
      - rule_id: po_value_positive
        description: "po_value > 0"
        severity: warning
        detection: po_value <= 0
        action_on_fail: FLAG_FOR_REVIEW
        note: "Could be credit note OR data error"
      - rule_id: po_date_within_range
        description: "po_date within last 5 years OR within configured engagement window"
        severity: warning
        detection: po_date outside [engagement.from_date, engagement.to_date]

  pr:
    required_columns:
      - { name: pr_id, type: string, max_null_pct: 0 }
      - { name: pr_date, type: date, max_null_pct: 0 }
      - { name: requester_id, type: string, max_null_pct: 5 }
      - { name: pr_value_estimated, type: number, max_null_pct: 10 }
      - { name: category, type: string, max_null_pct: 20 }
      - { name: approval_status, type: string, allowed: [approved, rejected, pending], max_null_pct: 0 }
      - { name: po_id, type: string, max_null_pct: 30, note: "Blank for pending/rejected PRs" }

    rules:
      - rule_id: pr_date_before_po_date
        description: "If po_id present, pr_date <= po_date"
        severity: warning

  grn:
    required_columns:
      - { name: grn_id, type: string, max_null_pct: 0 }
      - { name: po_id, type: string, max_null_pct: 0 }
      - { name: grn_date, type: date, max_null_pct: 0 }
      - { name: quantity_received, type: number, max_null_pct: 0 }
      - { name: quantity_accepted, type: number, max_null_pct: 0 }
      - { name: quantity_rejected, type: number, max_null_pct: 5, default: 0 }

    rules:
      - rule_id: grn_quantity_balance
        description: "quantity_accepted + quantity_rejected = quantity_received"
        severity: warning

  invoice:
    required_columns:
      - { name: invoice_id, type: string, max_null_pct: 0 }
      - { name: po_id, type: string, max_null_pct: 5 }
      - { name: invoice_date, type: date, max_null_pct: 0 }
      - { name: vendor_id, type: string, max_null_pct: 0 }
      - { name: invoice_value, type: number, max_null_pct: 0 }
      - { name: invoice_currency, type: string, max_null_pct: 0 }
      - { name: gst_amount, type: number, max_null_pct: 15, note: "Indian context" }
      - { name: payment_status, type: string, allowed: [paid, pending, partial], max_null_pct: 5 }

  material_master:
    required_columns:
      - { name: material_code, type: string, max_null_pct: 0 }
      - { name: material_description, type: string, max_null_pct: 0 }
      - { name: category, type: string, max_null_pct: 10 }
      - { name: uom, type: string, max_null_pct: 5 }
      - { name: active_flag, type: boolean, max_null_pct: 0, default: true }

  vendor_master:
    required_columns:
      - { name: vendor_id, type: string, max_null_pct: 0 }
      - { name: vendor_name, type: string, max_null_pct: 0 }
      - { name: gstin, type: string, max_null_pct: 15, note: "Indian; may be blank for foreign vendors" }
      - { name: pan, type: string, max_null_pct: 10 }
      - { name: msme_flag, type: boolean, max_null_pct: 20, default: false }
      - { name: active_flag, type: boolean, max_null_pct: 0, default: true }

    optional_columns:
      - { name: vendor_category, type: string }
      - { name: country, type: string, default: IN }
      - { name: city, type: string }
      - { name: payment_terms, type: string }
      - { name: bank_account_no, type: string }
      - { name: contact_email, type: string }

  org_structure:
    required_columns:
      - { name: employee_id, type: string, max_null_pct: 0 }
      - { name: employee_name, type: string, max_null_pct: 0 }
      - { name: role_title, type: string, max_null_pct: 5 }
      - { name: designation, type: string, max_null_pct: 5 }
      - { name: entity, type: string, max_null_pct: 5, note: "central / plant_X / BU_X" }
      - { name: reports_to, type: string, max_null_pct: 30, note: "~60% raw typical; Stage 6 uplift target 78%" }
      - { name: active_flag, type: boolean, max_null_pct: 0, default: true }

    optional_columns:
      - { name: function, type: string }
      - { name: cost_centre, type: string }
      - { name: location, type: string }
      - { name: hire_date, type: date }

  vendor_performance:
    required_columns:
      - { name: vendor_id, type: string, max_null_pct: 0 }
      - { name: period, type: date, max_null_pct: 0 }
      - { name: otd_pct, type: number, max_null_pct: 10 }
      - { name: quality_pct, type: number, max_null_pct: 10 }

# =============================================================================
# UNIVERSAL CELL-LEVEL CHECKS
# =============================================================================

universal_cell_checks:

  - rule_id: date_parseable
    description: "All date cells parse to valid ISO date"
    severity: warning
    formats_accepted: [YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, MM/DD/YYYY]
    action_on_ambiguous: FLAG_FOR_FORMAT_CONFIRMATION
    note: "DD/MM vs MM/DD ambiguity → request explicit format from user"

  - rule_id: number_parseable
    description: "All number cells parse to valid numeric"
    severity: warning
    handle_thousands_separator: true   # 1,00,000 (Indian) and 100,000 (Western) both OK
    handle_currency_prefix: true       # ₹100, $100, etc.

  - rule_id: text_encoding_clean
    description: "No mojibake (encoding errors)"
    severity: warning
    detection: presence of replacement chars (�) or known mojibake patterns
    action_on_fail: REQUEST_FILE_RE_UPLOAD

  - rule_id: no_html_artefacts
    description: "No HTML tags / entities in cells"
    severity: warning
    detection: presence of <tag>, &nbsp;, &amp;, etc.
    action_on_fail: STRIP_AND_FLAG

  - rule_id: trim_whitespace
    description: "Strip leading/trailing whitespace from all text cells"
    severity: auto-fix
    note: "Applied silently; no flag"

# =============================================================================
# Editable Configuration
# Adding a required column: HIGH risk (partner) — affects all engagements
# Changing max_null_pct thresholds: MEDIUM (peer)
# Changing severity: MEDIUM
# Universal cell checks: HIGH (changes core parsing behaviour)
# =============================================================================
```

END OF FILE 2. (data-cleansing/bronze-validation-rules.yml)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/gold-cleansing-rules.yml`**
Type: Gold layer — Normalisation + enrichment rules
==================================================================

```yaml
# =============================================================================
# Gold Cleansing Rules
# =============================================================================
# Purpose: Transformation rules applied between Bronze and Gold. Includes
#          normalisation (currency, UoM, dates), deduplication (vendor, material),
#          canonicalisation (plant codes, designations), and enrichment.
#
# Logic Embodied: For each template + each rule, define detection logic +
#                 transformation logic + auto-apply / HITL escalation threshold.
# =============================================================================

metadata:
  id: gold-cleansing-rules
  layer: function
  function: procurement
  domain: data-cleansing
  version: 1.0
  last_updated: 2026-05-28
  owner: kb-admin
  status: active

# =============================================================================
# 1. CURRENCY NORMALISATION
# =============================================================================

currency_normalisation:

  - rule_id: detect_currency_per_row
    description: "Determine currency for each PO/Invoice row"
    logic: |
      Priority order:
        1. Explicit po_currency / invoice_currency column value
        2. Currency prefix in value cell (₹, $, €, £)
        3. Engagement-default currency (typically INR)
    action: SET_NORMALISED_CURRENCY_COLUMN

  - rule_id: convert_to_engagement_default
    description: "Convert all values to engagement-default currency (typically INR)"
    logic: |
      For each row where currency != engagement_default:
        Apply FX rate (RBI reference rate for INR-related; ECB for EUR-related)
        FX date = po_date (or invoice_date for invoices)
        Store: po_value_inr, po_value_original, fx_rate_used, fx_date
    confidence_threshold:
      auto_apply: |
        - po_currency is recognised AND
        - FX rate available for po_date AND
        - converted_value within reasonable bounds (5x median of category)
      hitl_required: |
        - Unrecognised currency code → FLAG: "Verify currency"
        - FX rate unavailable for date → FLAG: "Use closest date?"
        - Converted value outlier → FLAG: "Possible currency error"

  - rule_id: indian_lakh_crore_detection
    description: "Detect values stored in lakh/crore vs absolute INR"
    logic: |
      If column header contains "Cr" / "crore" → multiply by 10,000,000
      If column header contains "L" / "lakh" → multiply by 100,000
      If individual cell has "Cr" / "lakh" suffix → multiply accordingly
      If ambiguous (median value 50-500) → HITL flag

  - rule_id: thousands_separator_normalisation
    description: "Normalise Indian (1,00,000) vs Western (100,000) thousands separators"
    logic: |
      Strip all commas; preserve decimal point.
      "1,00,000.50" → 100000.50
      "1,000,000.50" → 1000000.50
      Both yield numeric form.

# =============================================================================
# 2. UoM NORMALISATION
# =============================================================================

uom_normalisation:

  - rule_id: canonicalise_uom
    description: "Map UoM variants to canonical form via units-of-measure.yml"
    logic: |
      Lookup: cell value in units-of-measure.yml.aliases
      If found → use canonical id (e.g., "tonne" → "MT")
      If not found → HITL flag for consultant
    reference_file: shared-kb/references/master-data/units-of-measure.yml

  - rule_id: convert_to_base_uom_per_category
    description: "Convert quantities to base UoM per category"
    logic: |
      For each row:
        category_default_uom = lookup from category-taxonomy
        if row.uom != category_default_uom:
          conversion_factor = uom.conversion_factor_to_base
          quantity_normalised = quantity × conversion_factor / category_default_uom.conversion_factor
    note: "Enables consistent per-MT or per-kg metrics across PO records of same category"

  - rule_id: l_ambiguity_resolution
    description: "Resolve 'L' = litre vs lakh ambiguity"
    logic: |
      If column is quantity / UoM → "L" = litre
      If column is value / currency → "L" = lakh
      If standalone cell with no column context → HITL flag

# =============================================================================
# 3. DATE NORMALISATION
# =============================================================================

date_normalisation:

  - rule_id: parse_to_iso_date
    description: "All dates → ISO 8601 (YYYY-MM-DD)"
    logic: |
      Accept formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, MM/DD/YYYY
      For DD/MM vs MM/DD ambiguity: use engagement.date_format setting (default DD/MM for Indian)
    action_on_ambiguous: HITL_FLAG

  - rule_id: detect_excel_serial_dates
    description: "Excel stores dates as integers (44197 = 2021-01-01)"
    logic: |
      If date column has numeric values 20000-50000 (Excel serial range) → treat as Excel serial date
      Convert: 1900-01-01 + (value - 2) days [accounting for Excel's 1900 leap year bug]

# =============================================================================
# 4. VENDOR DEDUPLICATION
# =============================================================================

vendor_deduplication:

  - rule_id: vendor_name_canonicalisation
    description: "Identify duplicate vendor records via fuzzy name matching"
    logic: |
      For each pair of vendor records (within Vendor Master):
        similarity_score = fuzzy_match(vendor_name_a, vendor_name_b)
        If similarity_score >= 0.90 AND GSTIN matches → AUTO-MERGE
        If similarity_score >= 0.85 AND PAN matches → AUTO-MERGE
        If similarity_score >= 0.85 AND no ID match → HITL FLAG
        If similarity_score 0.70-0.85 → HITL FLAG
        If similarity_score < 0.70 → not duplicate
    methods:
      - "Token sort ratio (handles word order variations)"
      - "Levenshtein distance (handles typos)"
      - "Phonetic match (handles transliteration variants)"
    indian_specific_logic: |
      - Suffixes like "Pvt Ltd", "Private Limited", "Limited", "LLP", "Inc"
        normalised before comparison
      - "AND" / "&" / "and" treated as same
      - Address-based disambiguation: if same name + different city → likely
        legitimate separate vendors (don't merge)

  - rule_id: vendor_gstin_validation
    description: "Validate GSTIN format"
    logic: |
      15-character format: 2-digit state code + 10-char PAN + 1-char entity + Z + checksum
      Regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$
      If invalid → HITL flag

  - rule_id: vendor_pan_validation
    description: "Validate PAN format"
    logic: |
      10-character format: AAAAA9999A
      Regex: ^[A-Z]{5}[0-9]{4}[A-Z]{1}$

# =============================================================================
# 5. MATERIAL DEDUPLICATION
# =============================================================================

material_deduplication:

  - rule_id: material_code_canonicalisation
    description: "Identify duplicate material records"
    logic: |
      Match on (material_code) primary; fallback fuzzy on description.
      If two material_codes have description similarity > 0.95 → HITL FLAG
    note: "Material master deduplication often controversial — same code, different
           specs is real; same description, different code may be legitimate variants"

  - rule_id: material_description_clean
    description: "Strip extraneous formatting from material descriptions"
    logic: |
      - Trim whitespace
      - Collapse multiple spaces
      - Remove HTML tags
      - Normalise "MM" / "mm" / "Millimeter" to canonical
      - Normalise dimensions (e.g., "10x20" / "10 X 20" / "10*20" → "10x20")

# =============================================================================
# 6. PLANT CODE CANONICALISATION
# =============================================================================

plant_canonicalisation:

  - rule_id: plant_code_dictionary_lookup
    description: "Map plant codes to canonical names"
    logic: |
      Engagement-specific dictionary built at Stage 6:
        - Consultant + client review unique plant codes/names in PO data
        - Confirm canonical name per plant
        - Build mapping: {code → canonical_name, name → canonical_name}
      Apply mapping to all PO records.
    examples:
      - "JSW Bellary / Vijaynagar / BLY / Plant 1" → canonical "Vijaynagar"
      - "Tata Jamshedpur / TJSR / Plant A" → canonical "Jamshedpur"

# =============================================================================
# 7. APPROVER DESIGNATION CANONICALISATION
# =============================================================================

approver_designation_canonicalisation:

  - rule_id: designation_lookup
    description: "Map approver designations to canonical org tier"
    logic: |
      Per-engagement designation dictionary built at Stage 6:
        - Consultant + client confirm canonical for each unique designation
        - Build mapping: {designation_variant → canonical_designation → tier_level}
    examples:
      - "Sr. Manager / Sr Manager / Senior Manager" → "Sr Manager" → Tier 3
      - "AGM Procurement / Asst GM / AGM" → "AGM" → Tier 3
      - "CPO / Chief Procurement Officer / Head Procurement" → "CPO" → Tier 4

  - rule_id: tier_assignment
    description: "Assign tier number based on canonical designation"
    logic: |
      Use Org Structure data (employee_id → designation → tier) + DoA
      structure (designation → tier).
      Conflict resolution: DoA takes precedence (DoA defines authority).

# =============================================================================
# 8. PO TYPE TAGGING (capex/opex/services/PAC/emergency)
# =============================================================================

po_type_tagging:

  - rule_id: explicit_po_type_field
    description: "If po_type column present, use it directly"
    logic: |
      Accept values: capex, opex, services, pac, emergency, or aliases
      Aliases: capital_expenditure → capex; revenue → opex; etc.

  - rule_id: derive_po_type_from_category
    description: "If po_type missing, derive from category"
    logic: |
      Category-taxonomy.yml defines per-category default po_type
      Examples:
        category "Plant Expansion" → po_type: capex
        category "MRO Consumables" → po_type: opex
        category "Professional Services" → po_type: services
      If category ambiguous → HITL flag

  - rule_id: pac_detection
    description: "Detect PAC POs from notes / approval chain / single-source flag"
    logic: |
      Sources of PAC signal:
        - Column "pac_flag" if present
        - Notes / comments containing "PAC", "Proprietary"
        - approval_chain showing CPO + Technical Head joint
        - Single vendor for material_code over time
      HITL confirmation for ambiguous cases.

  - rule_id: emergency_detection
    description: "Detect emergency POs"
    logic: |
      Sources:
        - Column "emergency_flag" if present
        - Notes / comments containing "emergency", "urgent", "breakdown"
        - PO-to-GRN cycle time very short (< 7 days for typical 30-day items)
        - Post-facto approval pattern (PO date > approval date)
      HITL confirmation.

# =============================================================================
# 9. REFERENCE DATA ENRICHMENT
# =============================================================================

reference_enrichment:

  - rule_id: hsn_code_lookup
    description: "Validate + enrich HSN codes via official reference"
    logic: |
      HSN codes have 4/6/8-digit structure (Indian GST).
      Lookup HSN code → category, GST rate, description.
      Flag HSN codes that don't match GST official list.
    reference_file: shared-kb/references/master-data/hsn-codes.yml (TBD)

  - rule_id: sac_code_lookup
    description: "Validate + enrich SAC codes (services)"
    logic: |
      6-digit SAC code; similar lookup.
    reference_file: shared-kb/references/master-data/sac-codes.yml (TBD)

  - rule_id: gst_rate_consistency
    description: "Check po_gst_rate matches HSN code expected rate"
    logic: |
      If HSN code present + po_gst_rate present → verify match
      Mismatch → HITL flag

# =============================================================================
# 10. CATEGORY CLASSIFICATION (Stage 9 — references this file)
# =============================================================================

# Note: Stage 9 (Category Classification) is a separate stage AFTER Gold but
# uses Gold data. Rules in `category-classification-rules.yml` (TBD).
# For now, Gold cleansing tags PO records as 'category_unclassified' if no
# category present; Stage 9 then runs reclassification.

# =============================================================================
# Editable Configuration
# Adding a new transformation rule: HIGH (partner) — changes Gold data
# Modifying fuzzy match thresholds: MEDIUM
# Modifying detection logic (logic field): HIGH
# Reference file paths: MEDIUM
# =============================================================================
```

END OF FILE 3. (data-cleansing/gold-cleansing-rules.yml)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/cross-template-integrity-rules.yml`**
Type: Cross-template referential integrity
==================================================================

```yaml
# =============================================================================
# Cross-Template Integrity Rules
# =============================================================================
# Purpose: Referential integrity rules across data templates. Detects orphan
#          records (foreign keys that don't resolve), inconsistent values, and
#          cross-template anomalies.
#
# Logic Embodied: Run at end of Stage 7 (Bronze) before Gold promotion. Flags
#                 raised to consultant for review; auto-resolution where safe.
# =============================================================================

metadata:
  id: cross-template-integrity-rules
  layer: function
  function: procurement
  domain: data-cleansing
  version: 1.0
  last_updated: 2026-05-28
  owner: kb-admin
  status: active

integrity_rules:

  # =========================================================================
  # PO ↔ VENDOR MASTER
  # =========================================================================

  - rule_id: po_vendor_id_exists_in_vendor_master
    description: "Every PO's vendor_id should exist in Vendor Master"
    severity: warning
    detection: |
      Left join: PO.vendor_id → Vendor Master.vendor_id
      Flag PO records where join fails
    action_on_fail:
      - If Vendor Master uploaded: HITL flag — "Add vendor to master?"
      - If Vendor Master not uploaded: auto-create stub record in gold.vendor (active_flag=unknown)
    threshold: |
      If > 10% of POs have orphan vendors → consider Vendor Master incomplete
      Engagement-level data quality flag

  - rule_id: vendor_name_consistency_po_vs_master
    description: "PO.vendor_name should match Vendor Master.vendor_name for same vendor_id"
    severity: warning
    detection: |
      For each PO with valid vendor_id:
        If PO.vendor_name fuzzy_match Vendor Master.vendor_name < 0.85 → flag
    action_on_fail: HITL FLAG — "Vendor name mismatch — which is correct?"

  - rule_id: vendor_active_flag_consistency
    description: "POs should be against active vendors"
    severity: warning
    detection: |
      PO joined to Vendor Master.active_flag = false → flag
      (Could be legitimate — vendor deactivated AFTER PO date — or data error)

  # =========================================================================
  # PO ↔ MATERIAL MASTER
  # =========================================================================

  - rule_id: po_material_code_exists_in_material_master
    description: "PO.material_code should exist in Material Master"
    severity: warning
    detection: |
      Left join: PO.material_code → Material Master.material_code
      Flag PO records where join fails AND material_code is not blank
    action_on_fail:
      - If material code looks valid format: HITL FLAG — "Add to material master?"
      - If material_code blank: assume services PO (often legitimate)

  - rule_id: po_uom_consistency_with_material_master
    description: "PO.uom should match Material Master.uom for same material_code"
    severity: warning
    detection: |
      For each PO with valid material_code:
        If PO.uom != Material Master.uom → flag
    action_on_fail: HITL FLAG — "UoM mismatch"

  # =========================================================================
  # PR ↔ PO
  # =========================================================================

  - rule_id: pr_to_po_linkage
    description: "PRs marked 'approved' should have a po_id"
    severity: warning
    detection: |
      PR.approval_status = 'approved' AND PR.po_id IS NULL → flag
    note: "Could indicate PRs that were never converted to POs (process gap) or
           data linkage gap"

  - rule_id: pr_po_date_sequence
    description: "PR.pr_date <= PO.po_date (for linked records)"
    severity: warning
    detection: |
      Join PR to PO on po_id; if PR.pr_date > PO.po_date → flag
    note: "Reverse-dated PRs typically data entry error OR post-facto PR creation"

  - rule_id: pr_po_value_consistency
    description: "PR.pr_value_estimated approximately equal to PO.po_value"
    severity: info
    detection: |
      |PR.pr_value_estimated - PO.po_value| / PO.po_value > 0.50 → flag
    note: "Large deviations may indicate negotiation impact (savings KPI) OR
           wrong PR-PO linkage"

  # =========================================================================
  # PO ↔ GRN
  # =========================================================================

  - rule_id: po_grn_linkage
    description: "Material POs (not services) should have GRN records"
    severity: info
    detection: |
      PO.po_type != 'services' AND NOT EXISTS (GRN with po_id) → flag
    note: "Missing GRN could mean: incomplete data upload, PO not yet received,
           or services PO miscategorised"

  - rule_id: grn_quantity_vs_po_quantity
    description: "Sum of GRN.quantity_received should approximate PO.quantity"
    severity: info
    detection: |
      For each PO: sum(GRN.quantity_received) compared to PO.quantity
      Tolerance: ±5%
    note: "Helps identify partial deliveries, over/under-deliveries"

  # =========================================================================
  # PO ↔ INVOICE
  # =========================================================================

  - rule_id: po_invoice_linkage
    description: "Each PO should typically have an Invoice"
    severity: info
    detection: |
      PO.po_type != 'pending' AND NOT EXISTS (Invoice with po_id) → flag
    note: "Missing invoice could mean: incomplete data, vendor hasn't invoiced
           yet, or partial deliveries with consolidated invoicing"

  - rule_id: invoice_value_vs_po_value
    description: "Invoice value within reasonable range of PO value"
    severity: warning
    detection: |
      |Invoice.invoice_value - PO.po_value| / PO.po_value > 0.20 → flag
      (Excluding multi-invoice POs where partial invoicing is expected)
    note: "Significant deviations may indicate billing errors, scope changes,
           or wrong linkage"

  # =========================================================================
  # PO ↔ ORG STRUCTURE
  # =========================================================================

  - rule_id: po_approver_in_org_structure
    description: "PO.po_approver_id should exist in Org Structure"
    severity: warning
    detection: |
      PO.po_approver_id not in Org Structure.employee_id → flag
    note: "Could be: approver no longer in org (left), data error, or system
           ID mismatch"

  - rule_id: po_buyer_in_org_structure
    description: "PO.buyer_id should exist in Org Structure"
    severity: info
    detection: |
      PO.buyer_id not in Org Structure.employee_id → flag

  # =========================================================================
  # INVOICE ↔ VENDOR MASTER
  # =========================================================================

  - rule_id: invoice_vendor_consistency
    description: "Invoice.vendor_id should match PO.vendor_id (for linked invoices)"
    severity: warning
    detection: |
      Invoice.po_id present + Invoice.vendor_id != PO.vendor_id → flag
    note: "Vendor mismatch between PO and Invoice is a control concern"

  # =========================================================================
  # AGGREGATE-LEVEL INTEGRITY
  # =========================================================================

  - rule_id: total_spend_consistency
    description: "Total PO spend approximately equal to total Invoice spend"
    severity: info
    detection: |
      |SUM(PO.po_value) - SUM(Invoice.invoice_value)| / SUM(PO.po_value) > 0.15 → flag
    note: "Large divergence typically indicates incomplete data uploads OR
           significant unbilled deliveries"

  - rule_id: vendor_count_reasonableness
    description: "# unique vendors in PO data should match Vendor Master count"
    severity: info
    detection: |
      |UNIQUE(PO.vendor_id) count - Vendor Master count| / Vendor Master count > 0.30 → flag

# =============================================================================
# RESOLUTION SUMMARY
# =============================================================================

resolution_summary:
  auto_resolved:
    - "Stub vendor records created for orphan PO vendor_ids (if Vendor Master not uploaded)"
    - "Materials with services PO (blank material_code) — treated as legitimate"
  hitl_flag:
    - "Vendor name mismatches"
    - "UoM mismatches between PO and Material Master"
    - "Large value deviations (PO vs Invoice)"
    - "Approver not in Org Structure (likely deactivated employee)"
  warning_aggregated_to_data_quality_score:
    - "Orphan rate (% of records with unresolved foreign keys)"
    - "Consistency rate (% of cross-template values matching)"

# =============================================================================
# Editable Configuration
# Adding a new integrity rule: HIGH risk (partner)
# Tolerance thresholds: MEDIUM
# Severity assignments: MEDIUM
# =============================================================================
```

END OF FILE 4. (data-cleansing/cross-template-integrity-rules.yml)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/indian-context-rules.yml`**
Type: Indian-context cleansing rules (GST/HSN/MSME/INR)
==================================================================

```yaml
# =============================================================================
# Indian-Context Data Cleansing Rules
# =============================================================================
# Purpose: India-specific data cleansing — GST, HSN/SAC codes, MSME compliance,
#          INR currency primary, TDS thresholds, Companies Act references.
# =============================================================================

metadata:
  id: indian-context-rules
  layer: function
  function: procurement
  domain: data-cleansing
  version: 1.0
  last_updated: 2026-05-28
  owner: kb-admin
  status: active
  geography: india

# =============================================================================
# GST VALIDATION
# =============================================================================

gst_rules:

  - rule_id: gstin_format_validation
    description: "GSTIN must conform to 15-char format"
    regex: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    structure: |
      2-digit state code | 10-char PAN | 1-char entity type | Z | checksum
    invalid_action: HITL_FLAG

  - rule_id: state_code_in_gstin_matches_address
    description: "First 2 digits of GSTIN should match vendor's state of registration"
    state_codes_reference: |
      01 = Jammu & Kashmir | 02 = Himachal Pradesh | ... | 27 = Maharashtra | 33 = Tamil Nadu | ...
    invalid_action: HITL_FLAG_LOW_PRIORITY

  - rule_id: gst_rate_validation
    description: "GST rate should be 0%, 5%, 12%, 18%, or 28%"
    allowed_rates: [0, 5, 12, 18, 28]
    invalid_action: HITL_FLAG

  - rule_id: input_tax_credit_eligibility
    description: "Tag input tax credit eligibility"
    logic: |
      Input GST = po_value × gst_rate / 100
      Eligible for ITC if:
        - vendor_gstin valid
        - HSN/SAC code present
        - invoice within ITC timeframe (180 days from invoice date typical)
      Tag: itc_eligible: true | false | partial

# =============================================================================
# HSN / SAC CODES
# =============================================================================

hsn_sac_rules:

  - rule_id: hsn_code_format
    description: "HSN code: 4 / 6 / 8 digit numeric"
    regex: "^[0-9]{4,8}$"
    note: "8-digit mandatory for invoices > ₹5 Cr (per GST mandates)"

  - rule_id: sac_code_format
    description: "SAC code: 6 digit numeric"
    regex: "^[0-9]{6}$"

  - rule_id: hsn_for_goods_sac_for_services
    description: "Goods POs should have HSN; services POs should have SAC"
    logic: |
      If po_type = goods AND sac_code present (no hsn_code) → flag
      If po_type = services AND hsn_code present (no sac_code) → flag

  - rule_id: hsn_completeness_threshold
    description: "≥ 90% of POs should have HSN/SAC code"
    metric_type: percentage
    threshold: 90
    note: "Below this threshold = HSN/SAC discipline gap (audit finding)"

# =============================================================================
# MSME VALIDATION
# =============================================================================

msme_rules:

  - rule_id: msme_flag_population
    description: "Vendor.msme_flag should be populated"
    severity: warning
    detection: msme_flag IS NULL OR msme_flag NOT IN [true, false]
    action_on_fail: HITL_FLAG — "Verify MSME status"

  - rule_id: msme_compliance_payment_within_45_days
    description: "Identify late payments to MSME vendors (MSMED Act § 15)"
    logic: |
      For invoices from MSME vendors:
        payment_lag_days = payment_date - invoice_received_date
        If payment_lag_days > 45 → flag MSME_LATE_PAYMENT
    note: |
      Critical Indian compliance check. Late payments to MSME = legal liability
      (interest at 3× bank rate per MSMED Act § 16).

  - rule_id: msme_share_of_vendor_base
    description: "Track MSME share of vendor count + spend"
    output_metrics:
      - msme_vendor_count_pct
      - msme_spend_pct
    benchmark: |
      Indian government targets:
        - 25% of total procurement value from MSE (Micro + Small)
        - Specifically: 3% from MSE owned by SC/ST entrepreneurs
        - 3% from MSE owned by women entrepreneurs
    note: "Applies primarily to government / PSU procurement. Private sector
           tracks but not regulated."

# =============================================================================
# TDS RULES
# =============================================================================

tds_rules:

  - rule_id: tds_threshold_check
    description: "Identify POs requiring TDS deduction"
    logic: |
      Section 194Q — TDS on purchase of goods:
        - Vendor turnover > ₹10 Cr (preceding FY)
        - Purchase from this vendor > ₹50 lakh in current FY
        - TDS rate: 0.1% on amount exceeding ₹50 lakh
      Section 194C — TDS on contracts:
        - Single payment > ₹30,000 OR aggregate > ₹1 lakh
        - TDS rate: 1% (individual) / 2% (companies)
    output:
      - tds_applicable: true | false
      - tds_section: 194Q / 194C / etc.
      - tds_rate_pct
      - tds_amount_inr

  - rule_id: tds_pan_required
    description: "If TDS applicable, vendor PAN must be present"
    severity: warning
    detection: tds_applicable = true AND vendor.pan IS NULL → flag
    note: "Without PAN, TDS rate doubles (Section 206AA)"

# =============================================================================
# CURRENCY — INR PRIMARY
# =============================================================================

currency_rules:

  - rule_id: inr_primary_default
    description: "Default currency = INR for Indian engagements"
    setting: engagement.default_currency = INR
    note: "Unless engagement is foreign-owned Indian operation with parent-company
           reporting in different currency"

  - rule_id: rbi_reference_rate_for_fx
    description: "Use RBI reference rate for INR-related FX conversion"
    source: "RBI Reference Rates published daily"
    fallback: "Use closest prior business day if PO date is non-trading day"

  - rule_id: cr_lakh_aware_display
    description: "Display amounts in Indian numbering convention"
    logic: |
      Value > ₹10,000,000 → display in Cr (e.g., ₹2.5 Cr)
      Value ₹100,000 - ₹10,000,000 → display in lakh (e.g., ₹5 lakh)
      Value < ₹100,000 → display in absolute (e.g., ₹85,000)

# =============================================================================
# CAPEX VS OPEX (Indian Accounting Convention)
# =============================================================================

capex_opex_rules:

  - rule_id: capex_threshold_default
    description: "Asset acquisition threshold for capex classification"
    default_threshold_inr: 50000   # ₹50,000 — typical capitalisation threshold
    note: |
      Companies Act 2013 + AS 10 (Property, Plant & Equipment):
      Items below threshold expensed; above capitalised.
      Engagement-specific override possible (some clients use ₹100,000 or
      ₹500,000 thresholds).

  - rule_id: capex_indicators
    description: "Heuristics to flag capex POs"
    indicators:
      - "Category in [Plant Expansion, New Equipment, Building, Vehicle, IT Infrastructure (above threshold)]"
      - "NFA (Note for Approval) reference present"
      - "Depreciation rate indicated"
      - "po_value > ₹50 lakh (single asset)"

# =============================================================================
# REGULATORY REFERENCES (for cross-pillar audit findings)
# =============================================================================

regulatory_references:

  - reference_id: companies_act_2013
    document: "Companies Act 2013"
    relevant_sections:
      - "Schedule V — managerial authority limits"
      - "Section 188 — RPT approval thresholds"
      - "Section 196-197 — managerial remuneration"
    procurement_relevance: "DoA tier thresholds for related party transactions"

  - reference_id: sebi_lodr
    document: "SEBI Listing Obligations & Disclosure Requirements"
    relevant_sections:
      - "Regulation 23 — Related Party Transactions"
      - "Regulation 30 — Material Event Disclosure"
    procurement_relevance: "Material contracts above 10% of turnover require disclosure"

  - reference_id: msmed_act_2006
    document: "Micro, Small & Medium Enterprises Development Act 2006"
    relevant_sections:
      - "Section 15 — 45-day payment mandate"
      - "Section 16 — Interest on delayed payment"
    procurement_relevance: "Payment workflow + TReDS discipline"

  - reference_id: rbi_fema
    document: "RBI / FEMA Regulations"
    relevant_sections:
      - "Foreign exchange management for imports"
      - "ECB regulations for foreign-currency procurement"
    procurement_relevance: "Import POs, foreign currency invoices"

  - reference_id: cvc_guidelines
    document: "Central Vigilance Commission Guidelines"
    applies_to: ["psu", "government", "public_sector_partner"]
    procurement_relevance: "Tendering procedures, single-tender justification"

# =============================================================================
# Editable Configuration
# Regulatory references: HIGH (partner) — legal accuracy critical
# Threshold values (capex, TDS, MSME): MEDIUM (peer)
# GST format regex: HIGH (changes are rare; require KB lead + tax specialist)
# =============================================================================
```

END OF FILE 5. (data-cleansing/indian-context-rules.yml)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/data-quality-scoring.yml`**
Type: Data Quality Scoring + Pillar Feasibility Gates
==================================================================

```yaml
# =============================================================================
# Data Quality Scoring + Pillar Feasibility Gates
# =============================================================================
# Purpose: Methodology for computing engagement-level data quality score (1-100)
#          and per-pillar feasibility gates (which pillars run at what confidence).
# =============================================================================

metadata:
  id: data-quality-scoring
  layer: function
  function: procurement
  domain: data-cleansing
  version: 1.0
  last_updated: 2026-05-28
  owner: kb-admin
  status: active

# =============================================================================
# OVERALL DATA QUALITY SCORE
# =============================================================================

overall_score:
  formula: |
    data_quality_score = (
      0.40 × completeness_pct
    + 0.30 × validity_pct
    + 0.30 × consistency_pct
    )
  range: [0, 100]
  rationale: |
    Completeness is heaviest weight because missing data limits what can run.
    Validity (data within expected ranges/formats) and Consistency (cross-template
    integrity) equal weight; both reflect cleanliness of what is present.

# =============================================================================
# COMPONENT METRICS
# =============================================================================

components:

  completeness_pct:
    description: "% of required fields populated across all templates"
    formula: |
      For each template:
        required_cells = #rows × #required_columns
        populated_cells = #cells where value not null
        completeness[template] = populated_cells / required_cells × 100
      Overall: weighted average across templates (PO weight = 0.40, others equal)
    weights:
      po_dump: 0.40
      vendor_master: 0.15
      material_master: 0.10
      org_structure: 0.15
      pr: 0.05
      grn: 0.05
      invoice: 0.05
      vendor_performance: 0.05

  validity_pct:
    description: "% of cell values passing validation rules (format, range, allowed values)"
    formula: |
      For each row:
        For each cell:
          If passes universal_cell_checks + template column rules → valid
        Validity[row] = valid_cells / total_cells × 100
      Validity[template] = mean(Validity[row])
      Overall: same template weights as completeness

  consistency_pct:
    description: "% of cross-template foreign keys that resolve cleanly"
    formula: |
      cross_ref_checks_passed = COUNT(rules passing in cross-template-integrity-rules.yml)
      total_cross_ref_checks = COUNT(rules applicable, given uploaded templates)
      consistency_pct = passed / total × 100

# =============================================================================
# BANDS + INTERPRETATION
# =============================================================================

bands:

  - band: HIGH
    score_range: [90, 100]
    interpretation: "Excellent data quality. All pillars run at High confidence."
    color: green

  - band: GOOD
    score_range: [75, 90]
    interpretation: "Solid data quality. All pillars run at Medium-High confidence."
    color: light_green

  - band: ACCEPTABLE
    score_range: [60, 75]
    interpretation: "Workable. Some components skip; theme verdicts may be directional."
    color: yellow

  - band: LOW
    score_range: [40, 60]
    interpretation: "Significant data gaps. Many components skip. Pillar verdicts directional only. Recommend data improvement before formal deliverable."
    color: orange

  - band: VERY_LOW
    score_range: [0, 40]
    interpretation: "Major data quality issues. Recommend data improvement workshop with client before proceeding. Pillar findings should be heavily caveated."
    color: red

# =============================================================================
# PILLAR FEASIBILITY GATES
# =============================================================================
# For each pillar, define which data conditions must be met for which confidence
# tier. Pillars degrade gracefully — if data is insufficient, fewer components
# run.

pillar_feasibility:

  op_model:
    high_confidence:
      - po_dump.completeness_pct >= 95
      - po_dump has columns: [buying_entity, category, vendor_id, po_value, plant]
      - vendor_master.completeness_pct >= 80
      - qre_completeness_pct >= 90
    medium_confidence:
      - po_dump.completeness_pct >= 80
      - buying_entity coverage >= 70% (else C1 partially skip)
    low_confidence:
      - po_dump.completeness_pct >= 60
      - QRE-only fallback for centralization (C0+C5 only)

  org_structure:
    high_confidence:
      - org_structure.completeness_pct >= 90
      - role_title coverage >= 95%
      - reports_to coverage >= 78% (post-Stage-6 lift)
    medium_confidence:
      - org_structure.completeness_pct >= 75
      - reports_to coverage >= 60% (HS1/HS2 run at reduced confidence)
    low_confidence:
      - org_structure.completeness_pct >= 50
      - Theme 4 only (hierarchy/span skipped)

  doa:
    high_confidence:
      - doa_document_parsed_confidence_pct >= 90
      - po_dump.po_approver_designation coverage >= 80%
      - po_dump.po_approver_id coverage >= 70%
      - qre completeness >= 80
    medium_confidence:
      - doa_document_parsed_confidence_pct >= 60
      - po_approver_designation coverage >= 50%
    low_confidence:
      - doa_document_parsed: false (Theme 4 QRE-only + Theme 5 PO-data-only run)

  buying_channel:
    high_confidence:
      - po_dump.completeness_pct >= 90
      - po_dump has columns: [vendor_id, category, rate_contract_flag, contract_ref]
    medium_confidence:
      - po_dump.completeness_pct >= 75
      - rate_contract_flag coverage >= 60%

  pr_to_po:
    high_confidence:
      - pr.completeness_pct >= 85 (PR template required)
      - pr.linked_to_po_pct >= 85
      - po_dump.completeness_pct >= 95
    medium_confidence:
      - pr.completeness_pct >= 60
      - pr.linked_to_po_pct >= 60 (some components skip)
    skip_pillar_if:
      - pr template not uploaded

  post_po:
    high_confidence:
      - po_dump.completeness_pct >= 95
      - grn.completeness_pct >= 80
      - invoice.completeness_pct >= 80
    medium_confidence:
      - grn OR invoice partially complete
    skip_pillar_components_if:
      - grn missing: skip GRN-related components
      - invoice missing: skip 3-way match analysis

  material_master:
    high_confidence:
      - material_master.completeness_pct >= 90
      - linked to >= 80% of PO records
    medium_confidence:
      - material_master.completeness_pct >= 75
    low_confidence:
      - material_master.completeness_pct >= 50

  supplier:
    high_confidence:
      - vendor_master.completeness_pct >= 90
      - vendor_performance present + linked
    medium_confidence:
      - vendor_master.completeness_pct >= 75 OR vendor_performance present
    low_confidence:
      - vendor_master.completeness_pct >= 60

# =============================================================================
# AUTOMATIC DEGRADATION POLICY
# =============================================================================

degradation_policy:
  rule: |
    When a pillar would otherwise run at Low confidence, the engine should:
    1. Always run QRE-driven components (these never depend on data quality)
    2. Skip data-heavy components with explicit "skipped — insufficient data" tag
    3. Cap pillar maturity verdict at "directional" (not authoritative)
    4. Deliverable explicitly flags data quality as limiting factor

  surface_to_consultant: |
    Stage 6 (User Validation) screen shows:
      - Per-template completeness/validity/consistency scores
      - Per-pillar feasibility prediction
      - "Improve data" suggested actions (specific missing fields/templates)
    Consultant decision: proceed at lower confidence OR pause for client data improvement

# =============================================================================
# CONSULTANT VALIDATION ROLE
# =============================================================================

consultant_role_in_quality:
  description: |
    Stage 6 (User Validation) is where consultant judgement upgrades raw
    quality scores. Consultant can:
      - Approve a record with low completeness (e.g., known field doesn't
        apply at this client)
      - Bulk-approve mapping decisions (e.g., 80% of plant codes auto-mapped,
        consultant approves remaining 20% in batches)
      - Override low scores with explicit reasoning logged

  impact_on_scoring:
    - Records consultant-approved (despite raw flags) count as VALID in score
    - Override reasoning logged in audit trail
    - Engagement-level data quality score adjusts upward post-Stage-6

# =============================================================================
# Editable Configuration
# Component weights (completeness 0.40, validity 0.30, consistency 0.30): HIGH risk (partner)
# Pillar feasibility thresholds: MEDIUM (per-pillar adjustments by KB lead)
# Band ranges (HIGH/GOOD/ACCEPTABLE/LOW/VERY_LOW): HIGH (changes scoring globally)
# =============================================================================
```

END OF FILE 6. (data-cleansing/data-quality-scoring.yml)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/templates/po-dump-cleansing-spec.md`**
Type: PO Dump cleansing specification
==================================================================

```markdown
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
```

END OF FILE 7. (data-cleansing/templates/po-dump-cleansing-spec.md)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/templates/vendor-master-cleansing-spec.md`**
Type: Vendor Master cleansing specification
==================================================================

```markdown
---
id: vendor-master-cleansing-spec
layer: function
function: procurement
domain: data-cleansing
template: vendor_master
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# Vendor Master — Cleansing Specification

## Why Vendor Master matters

Vendor Master is the foundation for:
- **Supplier pillar** (concentration, dependency, performance attribution)
- **Op Model Tail Spend** theme (vendor count distribution)
- **DoA** (vendor risk thresholds, MSME compliance)
- **Buying Channel** (preferred vendor status)

Poor Vendor Master quality (duplicates, stale data, missing GSTIN) cascades into bad findings.

## Required vs Optional columns

### Mandatory columns

| Column | Type | Why mandatory |
|---|---|---|
| `vendor_id` | string | Primary key for join to PO data |
| `vendor_name` | string | Human-readable identification |
| `gstin` | string | Indian context: tax compliance + dedup |
| `pan` | string | Indian: tax + dedup fallback |
| `msme_flag` | boolean | MSMED Act compliance |
| `active_flag` | boolean | Distinguish current vs deactivated |

### Optional but high-value

| Column | What it enables |
|---|---|
| `vendor_category` | Categorisation (e.g., raw material, MRO, services) |
| `country` | Foreign vendor identification |
| `city` | Geographic analysis + dedup disambiguation |
| `state` | GST state code consistency |
| `payment_terms` | DPO + working capital |
| `vendor_since_date` | Vendor age analysis |
| `last_transaction_date` | Active vs dormant determination |
| `contact_email` | Vendor onboarding workflow |
| `bank_account_no` | Payment processing |
| `tan` | TDS compliance |

## Cleansing Logic

### 1. Vendor Deduplication (Highest priority)

Indian Vendor Masters commonly have **3-5× duplicate records** before cleansing. Drivers:
- Same vendor onboarded multiple times (different name spelling)
- Same vendor across plants (separate onboarding per plant)
- M&A history (acquired entity vendor base never merged)
- Branch / division of same company onboarded separately

#### Dedup algorithm

```
For each pair of vendor records (a, b):
  # Strong match (auto-merge candidate)
  if a.gstin == b.gstin AND a.gstin valid:
    → AUTO-MERGE (same legal entity)

  # PAN-based (entity-level — different GSTIN per state may be same PAN)
  if a.pan == b.pan AND a.pan valid:
    → HITL flag — "Same PAN, different GSTIN — same entity, different state?"

  # Name-only matching (when no IDs)
  similarity = fuzzy_match_score(
    canonicalise(a.vendor_name),
    canonicalise(b.vendor_name)
  )

  if similarity >= 0.90:
    → HITL flag — "Likely duplicate — merge?"
  elif similarity >= 0.80:
    → Lower priority HITL flag

  # Address-based disambiguation
  if a.vendor_name fuzzy match b.vendor_name BUT a.city != b.city:
    → likely separate vendors (don't merge)
```

#### Canonicalisation before name comparison

```
def canonicalise(name):
    n = name.strip().lower()
    n = re.sub(r'\bprivate\s+limited\b|\bpvt\.?\s*ltd\.?\b|\blimited\b|\bltd\.?\b', '', n)
    n = re.sub(r'\bllp\b|\binc\.?\b|\bcorp\.?\b', '', n)
    n = re.sub(r'\band\b|&', ' ', n)
    n = re.sub(r'[^\w\s]', '', n)   # remove punctuation
    n = re.sub(r'\s+', ' ', n)      # collapse whitespace
    return n.strip()
```

This handles common Indian variations:
- "ABC Industries Pvt Ltd" / "ABC Industries Private Limited" / "ABC Industries Pvt. Ltd." → same canonical
- "X & Y Sons" / "X and Y Sons" / "X&Y Sons" → same canonical

### 2. GSTIN Validation

```
GSTIN format: 15 chars
  positions 1-2: state code (01-37)
  positions 3-12: PAN of entity
  position 13: entity type (1-9, A-Z)
  position 14: 'Z' fixed
  position 15: checksum
```

Validation:
- Format regex
- State code in valid list
- PAN substring matches separately-stored PAN field
- Checksum verification (algorithm in Indian GST documentation)

### 3. MSME Flag Population

If `msme_flag` is null:
- Strict mode: HITL flag → consultant confirms based on vendor industry / size / known status
- Permissive mode: default to `false` (non-MSME) with warning

If `msme_flag = true`:
- Validate MSME registration number if present (Udyam Registration: UDYAM-XX-NN-NNNNNN)
- Tag MSME size class (Micro / Small / Medium) if data available

### 4. Active vs Dormant Determination

A vendor in Master may be marked `active_flag = true` but have no recent transactions. Tag:

```
last_po_date = MAX(po.po_date WHERE po.vendor_id = vendor.vendor_id)
days_since_last = today - last_po_date

if days_since_last < 90: status = ACTIVE
elif days_since_last < 365: status = INACTIVE_RECENT
elif days_since_last < 730: status = DORMANT
else: status = OBSOLETE
```

Flag for consultant review:
- `active_flag = true` but status = OBSOLETE → "Deactivate vendor?"
- `active_flag = false` but recent POs → "Reactivate vendor?"

### 5. Country + Geography Standardisation

- ISO 3166 country codes (IN, US, DE, etc.)
- State codes within India: align to GSTIN state code
- City names: title case, common variants merged (e.g., "Bombay" → "Mumbai")

### 6. Bank Account Validation (light)

- IFSC format: 4 letters + 0 + 6 alphanumeric (e.g., HDFC0000123)
- Account number length: 9-18 digits (varies by bank)
- HITL flag for obviously malformed values

## Cross-Template Integrity Checks

| Check | What |
|---|---|
| Every PO vendor_id exists in Vendor Master | If not, either Vendor Master incomplete or stub records created |
| Every Invoice vendor_id consistent with PO vendor_id (linked records) | Mismatch = control finding |
| Vendor name in PO consistent with Vendor Master (for same vendor_id) | Drift suggests Master not updated |

## Quality Score Contribution

- 15% weight in completeness_pct
- 15% weight in validity_pct (GSTIN/PAN format checks)
- ~20% weight in consistency_pct (vendor_id links)

Net: Vendor Master drives ~17% of overall data quality score.

## Editable Configuration

```yaml
_editable_config:
  fuzzy_match_threshold_auto_merge: 0.90
  fuzzy_match_threshold_hitl_flag: 0.80
  enable_gstin_checksum_validation: true
  enable_pan_checksum_validation: true
  msme_null_handling: hitl_flag  # alternative: default_false
  dormant_days_threshold: 365
  obsolete_days_threshold: 730
```
```

END OF FILE 8. (data-cleansing/templates/vendor-master-cleansing-spec.md)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/templates/material-master-cleansing-spec.md`**
Type: Material Master cleansing specification
==================================================================

```markdown
---
id: material-master-cleansing-spec
layer: function
function: procurement
domain: data-cleansing
template: material_master
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# Material Master — Cleansing Specification

## Purpose

Material Master enables PO-level category analysis, UoM normalisation, and consistency. Indian client material masters typically have 50,000-500,000 records with significant cleansing opportunity.

## Required vs Optional columns

### Mandatory

| Column | Type |
|---|---|
| `material_code` | string |
| `material_description` | string |
| `category` | string (or null with Stage 9 reclassification) |
| `uom` | string |
| `active_flag` | boolean |

### Optional

- `sub_category`
- `material_group`
- `direct_indirect_flag` (D / I)
- `spec_details` (free text)
- `criticality` (high / medium / low)
- `strategic_or_transactional` (S / T)
- `hsn_code`
- `lead_time_days`
- `safety_stock_units`

## Cleansing Logic

### 1. Material Description Standardisation

```
def clean_description(desc):
    s = desc.strip()
    s = re.sub(r'\s+', ' ', s)              # collapse whitespace
    s = re.sub(r'<[^>]+>', '', s)            # strip HTML
    s = re.sub(r'\bmm\b|\bMM\b|millimeter', 'mm', s)   # normalise units
    s = re.sub(r'(\d+)\s*[xX*]\s*(\d+)', r'\1x\2', s)  # dimensions: 10X20 → 10x20
    return s
```

### 2. UoM Normalisation

For each material:
- Lookup `uom` in `shared-kb/references/master-data/units-of-measure.yml`
- Map to canonical UoM
- Cross-check against PO data: if PO uses different UoM than Master, flag

### 3. Category Tagging

Initial classification at Stage 5/6:
- Use existing `category` if present
- If null, trigger Stage 9 (Category Classification) downstream
- HITL: consultant validates AI classification confidence

### 4. Duplicate Detection

Material duplicates are tricky because:
- Same material may have different codes (legacy vs new code)
- Same description may be intentionally separate variants

```
For pair (a, b):
  if a.description fuzzy_match b.description >= 0.95:
    if a.uom == b.uom AND a.category == b.category:
      → HITL flag — "Possibly duplicate"
  elif a.material_code is supersede_pattern_of b.material_code:
    # e.g., a.code = "ABC123-OLD" and b.code = "ABC123"
    → HITL flag — "Supersede relationship?"
```

### 5. Direct vs Indirect Classification

If `direct_indirect_flag` not present, derive from category:

```
direct_categories = ["Raw Materials", "Iron Ore", "Coking Coal", "Ferro Alloys",
                     "Refractories", "Mill Rolls", ...]  # from category-taxonomy
indirect_categories = ["MRO", "Stationery", "IT Peripherals", "Services", ...]

for material:
  if material.category in direct_categories:
    direct_indirect_flag = D
  elif material.category in indirect_categories:
    direct_indirect_flag = I
  else:
    # HITL flag
```

### 6. Active vs Inactive

Same logic as Vendor Master:
- `active_flag = true` but no PO in last 24 months → flag for potential deactivation
- Materials in PO data but `active_flag = false` in master → flag for reactivation

## Cross-Template Integrity

| Check | What |
|---|---|
| PO.material_code exists in Material Master | Else orphan; auto-create stub if many |
| Material Master uom consistent with PO uom | Mismatch = data inconsistency flag |
| Material Master category consistent with PO-derived category (Stage 9) | Mismatch = reclassification candidate |

## Editable Configuration

```yaml
_editable_config:
  enable_description_fuzzy_dedup: true
  fuzzy_match_threshold: 0.95
  hsn_lookup_enabled: true
  auto_create_stub_for_orphan_po_materials: true
  direct_indirect_inference_from_category: true
```
```

END OF FILE 9. (data-cleansing/templates/material-master-cleansing-spec.md)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/templates/org-structure-cleansing-spec.md`**
Type: Org Structure cleansing specification
==================================================================

```markdown
---
id: org-structure-cleansing-spec
layer: function
function: procurement
domain: data-cleansing
template: org_structure
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# Org Structure — Cleansing Specification

## Why it matters

Org Structure data feeds:
- **Org Structure pillar** (all 4 themes — sizing, composition, distribution, hierarchy)
- **DoA pillar** (role mapping D2, role assignment T5)
- **PR-to-PO pillar** (approver chain analysis)

Indian large-enterprise Org Structure data is notoriously messy:
- `reports_to` typically 60% populated in raw uploads
- Designation variants ("Sr Manager" / "Senior Manager" / "Sr. Manager") commonly proliferate
- Entity coding (central vs plant) ambiguous without consultant input

## Required vs Optional columns

### Mandatory

| Column | Type | Coverage target (Bronze) |
|---|---|---|
| `employee_id` | string | 100% |
| `employee_name` | string | 100% |
| `role_title` | string | 95% |
| `designation` | string | 95% |
| `entity` | string | 95% (central / plant_X / BU_X) |
| `reports_to` | string | 60% raw → 78% post-Stage-6 (target) |
| `active_flag` | boolean | 100% |

### Optional but valuable

| Column | What it enables |
|---|---|
| `function` | Procurement vs other functions |
| `sub_function` | Cat mgr vs transactional vs SSC |
| `cost_centre` | Financial mapping |
| `location` | Geographic analysis |
| `hire_date` | Tenure analysis |
| `band_grade` | Hierarchy depth normalisation |
| `manager_employee_id` | Stronger linking than reports_to (which is often a name string) |

## Cleansing Logic

### 1. Designation Canonicalisation (Critical)

Build per-engagement designation dictionary at Stage 6:

```
Stage 6 designation review:
  Step 1: Extract all unique role_title + designation values from Org Structure
  Step 2: Group by similarity (fuzzy match)
  Step 3: Consultant + client review each group:
    "Sr Manager / Senior Manager / Sr. Manager / Sr Mgr / SrM" → canonical "Sr Manager"
    "AGM / Asst GM / AGM Procurement / Asst General Manager" → canonical "AGM"
    "CPO / Chief Procurement Officer / Head Procurement / VP Procurement" → canonical "CPO"
  Step 4: Save dictionary
  Step 5: Engine applies dictionary across all records
```

Output: every employee has canonical `designation_canonical` + `tier_level` (1-7 ladder).

### 2. Entity Canonicalisation

Same per-engagement dictionary approach:

```
Stage 6 entity review:
  Raw: "Vijaynagar / JSW-BLY / Bellary Plant / Plant 1 / Vijaynagar Steel Plant"
  Canonical: "Vijaynagar"

  Raw: "Corp HQ / Mumbai Corporate / Head Office / HO"
  Canonical: "central"
```

### 3. reports_to Repair (Stage 6 uplift to 78%)

Raw `reports_to` typically:
- 60-65% populated (rest blank or "TBD" or "Manager")
- Stored as name string (e.g., "Anil Kumar") — fragile to typos
- Sometimes lists employee_id instead

Stage 6 repair workflow:
```
For each employee with blank reports_to:
  Try inference:
    1. Same cost_centre → identify highest-band employee in cost_centre → likely manager
    2. Same entity + function + tier_level + 1 → likely manager candidate
    3. Consultant confirms inference
  If unable to infer → flag for consultant manual input

For each employee with reports_to as name string:
  Fuzzy match name to employee_name list
  If unique high-confidence match → resolve to employee_id
  If multiple matches → HITL
```

Target: raw 60% → post-Stage-6 78% populated.

### 4. Role Classification Pipeline

This is critical for Org Structure FT2-by-role analysis. Three-step pipeline:

```
Step 1: RULE-BASED (deterministic)
  Pattern matching on designation + role_title:
    /buyer|asst.?buyer|sourcing executive/i → Transactional Buyer
    /category mgr|cat mgr|category lead|category specialist/i → Category Manager
    /head proc|cpo|chief proc/i → Leadership
    /analyst|data scientist/i → Analytics Specialist
    /srm|supplier relationship/i → SRM Specialist
    /fbp|finance business partner/i → FBP Specialist
    /sustainability|esg/i → Sustainability/ESG Specialist
    /digital|tech|automation/i → Digital Specialist
    /risk|compliance/i → Risk/Compliance Specialist
    /contract mgr|contract specialist/i → Contract Management

  Output: classification + confidence_high/medium/low

Step 2: LEVEL + ENTITY TIE-BREAKER (deterministic)
  For Medium-confidence cases:
    if role_title rules return ambiguous AND tier_level + entity narrow it:
      e.g., "Sr Manager Procurement" at Plant level → likely Transactional Lead
            "Sr Manager Procurement" at Central → likely Category Manager

Step 3: AI PROMPT (LLM)
  For remaining ambiguous cases:
    Send {role_title, designation, entity, tier_level, sub_function} to LLM
    LLM returns classification + confidence + reasoning
    Threshold: only run for cases where Steps 1+2 produced Low confidence

Step 4: CONSULTANT VALIDATION (Stage 6)
  Bulk review of AI classifications
  Consultant approves/rejects/edits in batches

Target: post-pipeline, ≥80% of FTEs have High confidence classification
```

### 5. Hierarchy Depth + Span Computation (Stage 8)

Once reports_to is repaired:

```
hierarchy_depth = max chain length from CPO to bottom
span_per_manager = COUNT(direct_reports per manager)
```

Cross-check against DoA designations:
- DoA Tier 5 = CEO/Board level
- Hierarchy Level 1 = CPO direct reports
- Should align; mismatch is a finding (DoA stale OR org changed)

## Cross-Template Integrity

| Check | What |
|---|---|
| PO.buyer_id exists in Org Structure | Else orphan buyer (may be deactivated) |
| PO.po_approver_id exists in Org Structure | Else orphan approver |
| DoA designations exist in Org Structure | DoA refers to canonical designations |

## Quality Score Contribution

- 15% weight in completeness_pct (heavily influenced by reports_to %)
- 15% weight in validity_pct (designation canonicalisation success)
- ~15% weight in consistency_pct (org-to-DoA, org-to-PO links)

## Editable Configuration

```yaml
_editable_config:
  reports_to_repair_target_pct: 78
  role_classification_high_confidence_target_pct: 80
  consultant_validation_batch_size: 50
  ai_classification_temperature: 0.2
  ai_classification_max_tokens: 200
  manager_inference_methods: [cost_centre, entity_function_tier]
```
```

END OF FILE 10. (data-cleansing/templates/org-structure-cleansing-spec.md)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/data-cleansing/hitl-correction-workflow.md`**
Type: HITL — User correction workflow
==================================================================

```markdown
---
id: hitl-correction-workflow
layer: function
function: procurement
domain: data-cleansing
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# HITL — Data Correction Workflow

## Purpose

Defines how consultants interact with AI-flagged data quality issues at Stage 5 → Stage 6 transition. HITL = Human In The Loop. Pattern shared across all data cleansing decisions in the app.

## Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│ Stage 5: AI Validation                                              │
│   Engine reads raw upload                                          │
│   Runs rules from bronze-validation-rules.yml + gold-cleansing-    │
│     rules.yml + cross-template-integrity-rules.yml                 │
│   Generates flag list:                                              │
│     - Flag type (e.g., AMBIGUOUS_DATE, ORPHAN_VENDOR)              │
│     - Affected rows + cells                                         │
│     - Suggested action (e.g., MAP_TO_DDMMYYYY, AUTO_MERGE_VENDOR)  │
│     - AI confidence (0-1)                                           │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│ Stage 6: User Validation (HITL UI)                                  │
│                                                                     │
│   Top-level dashboard:                                              │
│     - Engagement-level data quality score (preview)                 │
│     - Flag count by severity (blocking / warning / info)            │
│     - "Continue to Bronze" button (blocked if any blocking flags)   │
│                                                                     │
│   Per-flag UI:                                                      │
│     - Description: what's wrong                                     │
│     - Affected records preview (table)                              │
│     - Suggested action with [Apply] button                          │
│     - [Custom action] dropdown for non-default                      │
│     - [Skip — proceed without fixing] (logs as accepted gap)        │
│                                                                     │
│   Bulk actions:                                                     │
│     - "Apply suggested action to all similar flags"                 │
│     - "Bulk approve consultant-validated set"                       │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│ Stage 7: Bronze                                                     │
│   All Stage 6 decisions applied                                     │
│   Raw data + canonical/normalised values both stored                │
│   Audit log: every decision recorded                                │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│ Stage 8: Gold                                                       │
│   Cross-template joins applied                                      │
│   Calculated fields added                                           │
│   Quality score finalised                                           │
└────────────────────────────────────────────────────────────────────┘
```

## Flag Categories

| Severity | UI treatment | Examples |
|---|---|---|
| **Blocking** | Red banner; cannot proceed to Bronze without resolution | File format invalid; mandatory column missing; >50% null in mandatory field |
| **Warning** | Yellow; can proceed with explicit "accept" | Date format ambiguous; vendor name fuzzy match; cross-template orphan |
| **Info** | Blue; no action required (informational) | Unusual but legitimate data pattern (e.g., very large PO); minor data hygiene observation |
| **Auto-fix** | Hidden — applied silently with audit log | Whitespace trim; case normalisation; thousands separator |

## Decision Types

For each flag, consultant can:

| Decision | What happens |
|---|---|
| **Apply suggested** | Default action runs; logged |
| **Apply custom** | Consultant-specified action runs; logged with custom reasoning |
| **Skip** | Flag accepted as-is; logged as "accepted gap"; affects quality score |
| **Defer** | Postpone resolution until next session; flag remains visible |
| **Bulk apply** | Same decision applied to N similar flags; one log entry per affected record |

## Audit Trail Structure

Every Stage 5 → Stage 6 decision logged:

```yaml
audit_event:
  event_id: <uuid>
  engagement_id: <id>
  user_id: <consultant_id>
  timestamp: <iso>
  stage: stage_6_user_validation
  
  flag:
    flag_id: <uuid>
    rule_id: <rule from cleansing-rules.yml>
    severity: blocking / warning / info
    affected_records: [list of (template, row_id)]
  
  decision:
    type: apply_suggested / apply_custom / skip / defer / bulk_apply
    suggested_action: <if applicable>
    custom_action: <if applicable>
    reasoning: <consultant text, optional>
  
  affected_data:
    before: <serialised raw values>
    after: <serialised post-decision values>
```

This log is preserved indefinitely; supports:
- Engagement audit
- Decision pattern analysis across engagements
- Improvement feedback to KB rules

## Examples

### Example 1 — Ambiguous date format

```
Flag: AMBIGUOUS_DATE_FORMAT
Description: "12% of PO records have dates that could be DD/MM/YYYY or MM/DD/YYYY"
Affected records: 1,235 POs
Suggested action: "Confirm as DD/MM/YYYY (Indian convention)"
Severity: warning

Consultant choices:
  [✓ Apply suggested] — Apply DD/MM/YYYY interpretation
  [Apply custom]      — "MM/DD/YYYY" (drop-down)
  [Skip]              — Accept dates as-is (will result in mixed parsing)
```

### Example 2 — Orphan vendor

```
Flag: ORPHAN_VENDOR
Description: "Vendor 'XYZ Trading' appears in 42 POs but not in Vendor Master"
Affected records: 42 POs
Suggested action: "Create stub vendor record with active_flag=unknown"
Severity: warning

Consultant choices:
  [✓ Apply suggested] — Create stub
  [Apply custom]      — Add proper details (GSTIN, address)
  [Skip]              — Continue with orphan flag (warning persists)
```

### Example 3 — Designation canonicalisation (bulk)

```
Flag: DESIGNATION_VARIANTS
Description: "Designations 'Sr Manager / Senior Manager / Sr. Mgr / Sr Mgr Procurement' all appear; suggest canonical 'Sr Manager'"
Affected records: 87 employees
Suggested action: "Map all 4 variants to canonical 'Sr Manager' → Tier 3"
Severity: warning

Consultant choices:
  [✓ Apply suggested] — Canonicalise all
  [Apply custom]      — Edit canonical (e.g., split into Sr Manager vs Senior Manager Procurement)
  [Skip]              — Keep variants as separate designations
```

## Engagement Setup — One-Time Decisions

At engagement creation (Stage 1-2), consultant configures:

```yaml
engagement.cleansing_preferences:
  default_currency: INR
  date_format: DD/MM/YYYY
  thousands_separator: indian   # 1,00,000 OR western: 1,00,000

  fuzzy_match_thresholds:
    vendor_name_auto_merge: 0.90
    vendor_name_hitl_flag: 0.80
    material_description_auto_merge: 0.95

  auto_create_stubs_for_orphans:
    vendor: true
    material: true

  hitl_session_settings:
    bulk_apply_default: true
    save_progress_per_decision: true
    show_audit_trail: true
```

These flow as defaults for all flags; consultant overrides per-flag where needed.

## Skipped Flags + Quality Score Impact

Flags that are skipped (not resolved) reduce quality score:

```
For each skipped flag:
  if severity == blocking: cannot proceed (forced resolution)
  if severity == warning:
    quality_score_penalty = +1.0% per warning skipped
  if severity == info:
    quality_score_penalty = +0.3% per info skipped

Skipped penalties accumulate into the engagement-level data quality score.
```

## Editable Configuration

```yaml
_editable_config:
  ui_show_audit_trail: true
  ui_bulk_apply_enabled: true
  flag_severity_levels: [blocking, warning, info, auto-fix]
  audit_retention_days: indefinite
  blocking_flags_can_be_overridden_by: ["partner_role", "kb_admin_role"]
  skipped_flag_penalty_pct: { warning: 1.0, info: 0.3 }
```
```

END OF FILE 11. (data-cleansing/hitl-correction-workflow.md)

---

# TRACKING TABLE — Data Cleansing Files

This bundle contains **11 of 11 files** inlined. ✅ COMPLETE.

| # | File Path | Status | Notes |
|---|---|---|---|
| 1 | `proc-app/kb/functions/procurement/data-cleansing/data-cleansing-framework.md` | ✅ INLINE | Framework overview, Bronze/Gold layers, stage flow |
| 2 | `proc-app/kb/functions/procurement/data-cleansing/bronze-validation-rules.yml` | ✅ INLINE | Structural validation rules per template |
| 3 | `proc-app/kb/functions/procurement/data-cleansing/gold-cleansing-rules.yml` | ✅ INLINE | Normalisation + enrichment rules |
| 4 | `proc-app/kb/functions/procurement/data-cleansing/cross-template-integrity-rules.yml` | ✅ INLINE | Referential integrity across templates |
| 5 | `proc-app/kb/functions/procurement/data-cleansing/indian-context-rules.yml` | ✅ INLINE | GST/HSN/MSME/INR/TDS rules |
| 6 | `proc-app/kb/functions/procurement/data-cleansing/data-quality-scoring.yml` | ✅ INLINE | Score methodology + pillar feasibility gates |
| 7 | `proc-app/kb/functions/procurement/data-cleansing/templates/po-dump-cleansing-spec.md` | ✅ INLINE | PO Dump (central artefact) |
| 8 | `proc-app/kb/functions/procurement/data-cleansing/templates/vendor-master-cleansing-spec.md` | ✅ INLINE | Vendor master (dedup, GSTIN/PAN, MSME) |
| 9 | `proc-app/kb/functions/procurement/data-cleansing/templates/material-master-cleansing-spec.md` | ✅ INLINE | Material master (dedup, UoM, classification) |
| 10 | `proc-app/kb/functions/procurement/data-cleansing/templates/org-structure-cleansing-spec.md` | ✅ INLINE | Org Structure (designation, reports_to, role classification) |
| 11 | `proc-app/kb/functions/procurement/data-cleansing/hitl-correction-workflow.md` | ✅ INLINE | User correction workflow + audit trail |

**Bundle status: 11 INLINE / 0 PENDING.** ✅

---

# Python Extraction Script

Same extractor as the other bundles. Run:

```bash
python extract_kb.py KB-PART-5-DATA-CLEANSING.md <output_root>
```

```python
#!/usr/bin/env python3
import os, re, sys

def extract(bundle_path, output_root="."):
    with open(bundle_path, "r", encoding="utf-8") as f:
        content = f.read()
    pattern = r"\*\*FILE:\s*`([^`]+)`\*\*[\s\S]*?```(?:yaml|markdown|md|yml)?\n([\s\S]*?)\n```\s*\n\s*END OF FILE \d+"
    matches = re.findall(pattern, content)
    print(f"Found {len(matches)} files to extract.")
    for path, file_content in matches:
        full_path = os.path.join(output_root, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(file_content)
        print(f"Created: {full_path}")
    print(f"\nExtracted {len(matches)} files to {os.path.abspath(output_root)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_kb.py <bundle.md> [output_dir]")
        sys.exit(1)
    extract(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ".")
```

## End of KB-PART-5 Bundle
