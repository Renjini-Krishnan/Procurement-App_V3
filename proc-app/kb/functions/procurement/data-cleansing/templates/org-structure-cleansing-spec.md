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