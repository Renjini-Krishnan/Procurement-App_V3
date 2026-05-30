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