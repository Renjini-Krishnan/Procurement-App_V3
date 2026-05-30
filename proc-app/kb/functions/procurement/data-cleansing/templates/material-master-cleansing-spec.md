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