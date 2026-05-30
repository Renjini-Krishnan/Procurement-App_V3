# Category Taxonomy — `categories-master.yml` Schema

**Purpose.** Defines the schema for the canonical category taxonomy used by Stage 9 (Category Classification). Every PO row is classified to one of the canonicals defined in this file.

**Layer.** Industry — the primary source. Function layer empty (Build 2+). Engagement layer adds overrides + learned entries during the engagement.

**Consumed by.** Stage 9 engine (`backend/engine/stage9_canonical_classify.py`) and every downstream pillar that slices by canonical category.

---

## File layout

```yaml
metadata:
  id: <industry>-categories-master
  industry: <steel | cement | ...>
  version: 1.0
  source: "..."
  last_updated: YYYY-MM-DD

canonicals:
  - id: <canonical_id>           # snake_case primary key
    label: "Human-readable"
    archetype: BULK | DIRECT | INDIRECT | SERVICE | CAPEX
    direct_indirect: D | I       # D = direct (goes into product); I = indirect
    parent_id: <optional>        # for hierarchical canonicals
    keywords: [list of substrings to match — case-insensitive]
    synonyms: [abbreviations + alternate forms]
    hsn_codes: ["4-digit", "6-digit", "8-digit"]   # Tier A external anchor
    vendor_specialisation_examples: [vendor names containing these substrings → Tier D anchor]
    sap_signals:
      mtart: [ROH | HALB | FERT | ERSA | HIBE | DIEN | ANLA | VERP]   # MTART partition
      pstyp_allowed: [D | L | "..."]      # taxonomical PSTYPs
      gl_patterns: ["5101%", "62%"]       # Tier E G/L prefix matches
    typical_spend_share_pct: [low, high]  # informational — not used by classifier
    typical_kpis: [...]                    # informational — used by primer
    notes: "free text"
```

## Merge semantics across cascade

| Field type | Function default | Industry overlay | Engagement override | Resolution |
|---|---|---|---|---|
| Identifier `id` | join key | join key | join key | must match across layers |
| Scalar (`label`, `archetype`, `direct_indirect`, `notes`) | base | overrides | overrides | **higher layer wins**; lower layers preserved for citation trace |
| List (`keywords`, `synonyms`, `hsn_codes`, `vendor_specialisation_examples`, `sap_signals.*`) | base | adds | adds | **union across layers** |
| New canonical (id only at higher layer) | n/a | adds | adds | visible from that layer downward |

## Engine consumption (Tier-by-tier)

| Tier | Reads | Match logic |
|---|---|---|
| A — HSN | `hsn_codes` | Exact match on PO `hsn_code` (4/6/8 digit), longest prefix wins |
| B — Clean-MG | engagement-learned MG→canonical map | Direct lookup on `material_group` |
| C — Text | `keywords` + `synonyms` | Lower-cased substring match against `material_description + material_long_text + po_short_text` + `material_group_desc` |
| D — Vendor | `vendor_specialisation_examples` + engagement-learned vendor→canonical map | Substring match on `vendor_name` |
| E — G/L | `sap_signals.gl_patterns` | SQL LIKE-style prefix match on `gl_account` |
| F — LLM | top-3 candidates carrying `label + keywords + synonyms + notes` | Out of scope for V1 core |

## Confidence assignment per row

| Tier(s) fired | Confidence |
|---|---|
| Tier A alone or with corroboration | HIGH |
| Tier C + (D or E) corroborating on same canonical | HIGH |
| Tier C alone or D alone or E alone | MEDIUM |
| Only Tier B (inherited from MG map) | HIGH (inherited) |
| Tier F (LLM) alone | LOW (V2) |
| No tier fires | UNCLASSIFIED |

## Confidence on conflict

When two canonicals are tied within the confidence threshold:
- Tier weights: A=3, B=3, C=2, D=2, E=2, F=1
- Aggregate weight per candidate; highest wins
- If still tied → MEDIUM with both candidates surfaced for consultant review

## What this schema does NOT carry

These belong elsewhere — never in `categories-master.yml`:
- Frequency / value distribution per category (Buying Channel Strategy pillar)
- Should-cost models (Should-Cost pillar)
- Vendor performance per category (Vendor 360)
- Lead times / payment terms (channel)
- Number of vendors per category (channel)

The framework principle: classifier reads **WHAT-signals** only; **HOW-signals** are consumed downstream once classification is locked.
