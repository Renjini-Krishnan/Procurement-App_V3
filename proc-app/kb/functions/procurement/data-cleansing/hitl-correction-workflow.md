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