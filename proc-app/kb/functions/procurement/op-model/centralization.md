---
id: op-model-centralization
layer: function
function: procurement
pillar: op-model
theme: centralisation
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Centralisation Theme — Deep Dive

## Purpose

Centralisation analysis answers: **"For each procurement category, where SHOULD the buying decision sit — central, plant, or hybrid — given the client's spend pattern and industry context?"** It produces a per-category recommendation matrix with quantified savings.

This is theme 1 of 4 within the Op Model pillar.

## Logic Embodied

| Component | Purpose | Decision-driving? |
|---|---|---|
| **C0 — Optional Baseline** | Compute current spend_central_pct if PO data has classifying field; else use QRE estimate | No — narrative only |
| **C1 — Multi-Plant Detection** | Identify categories bought by ≥ 2 plants with material spend | **YES** |
| **C2 — Vendor Pattern Insight** | Describe current vendor concentration per category | No — insight only |
| **C3 — Industry Knowledge Filter** | Tag candidates as Centralise / Centre-Led / Industry-Local using industry overlay | **YES** |
| **C4 — Savings Quantification** | Compute ₹ Cr savings range on tagged candidates using industry rate | **YES** |
| **C5 — Qualitative/Quantitative Reconciliation** | Cross-check data-driven findings against QRE perception | No — narrative bullet |

## Inputs Used

| Input | Source |
|---|---|
| Reclassified PO data | Stage 9 output |
| Material threshold (per industry) | `industries/<ind>/.../centralisation-filters.yml` |
| Naturally-local / Naturally-central / Centre-led tagging | Industry overlay |
| Centralisation savings rate | `op-model/benchmarks.yml` + industry overlay |
| Optional EKORG-mapped classification | Stage 6 user validation output |
| QRE Q-OM-01, Q-OM-02, Q-OM-EXC | QRE bank |

## Outputs Produced

- Centralisation Suggestions Matrix per engagement
- C0 baseline narrative bullet (if available)
- Vendor pattern insight per centralised candidate
- Aggregate savings range (₹ low – high)
- Source citations

## How Used by App

Stage 12 (Op Model Analysis) — Centralisation tab.

## Editable Configuration

```yaml
deviation_flag_threshold_pp: 10
stage9_minimum_classification_pct: 80
stage6_critical_flag: true
candidates_to_surface_max: 10
```

Tunable values not in this file:

| Tunable | Where | Risk |
|---|---|---|
| Material threshold (per industry) | `industries/<ind>/.../centralisation-filters.yml` | Medium |
| Centralisation savings rate (function default) | `op-model/benchmarks.yml` | High (Partner) |
| Centralisation savings rate (industry overlay) | `industries/<ind>/.../op-model/benchmarks.yml` | High (Partner) |
| Naturally-local / Naturally-central / Centre-led category lists | `industries/<ind>/.../centralisation-filters.yml` | High (Partner) |

---

# 1. Pre-requisites — Stage 9 reclassification

Operates on **post-Stage-9 standard categories**, NOT raw client labels. Pre-conditions:
1. Stage 9 Category Classification complete
2. At least **80% of spend** mapped to standard categories
3. Reclassification mapping table persisted in engagement DB

---

# 2. Analytical Framework — Four Components + Optional Baseline + Reconciliation

## C0 — Optional Baseline (current state diagnostic)

Narrative bullet — "What % of spend is centralised today?"

Two paths:
- **Path A (Data-driven):** spend_central_pct = Σ(po_value WHERE entity_classification = central) / Σ(po_value across all POs) × 100
- **Path B (QRE-only):** Use Q-OM-01 + Q-OM-02

Combination logic:
| Both available | Display |
|---|---|
| Deviation ≤ 10 pp | "PO-computed: X%; client estimate: Y%" — both shown; PO primary |
| Deviation > 10 pp | "**Flag — material deviation between data and client estimate.**" |

## C1 — Multi-Plant Detection

```
For each reclassified category:
plants_buying = COUNT(DISTINCT plant WHERE category = X)
category_spend = SUM(po_value WHERE category = X)

multi_plant_candidates = categories WHERE:
plants_buying >= 2
AND category_spend >= material_threshold

material_threshold = read from industry overlay
                (Steel: 3, Cement: 5, generic: 2)
```

## C2 — Vendor Pattern Insight (Descriptive Only)

```
For each multi-plant candidate:
unique_vendors = COUNT(DISTINCT vendor_id WHERE category = X)
top_1_share = MAX(vendor_spend_in_category) / category_spend × 100
top_3_share = SUM(top-3 vendor spend) / category_spend × 100

vendor_base_shape:
Concentrated:top_1 > 50% OR (top_1 > 30% AND top_3 > 80%)
Oligopoly:   top_3 > 70% AND top_1 < 50%
Fragmented:  top_3 < 40%
Mid-fragmented:  in between
```

**NOT used to gate centralisation decision** — that lives in Supplier pillar.

## C3 — Industry Knowledge Filter

```
For each multi-plant candidate from C1:
Look up category in industry's centralisation-filters.yml

IF category matches "naturally_local" list:
    tag = "Industry-Local" → skip
ELSE IF category matches "naturally_central" list:
    tag = "Suggest Centralise"
ELSE IF category matches "centre_led" list:
    tag = "Suggest Centre-Led"
ELSE:
    tag = "Suggest Centralise"  # default for unlisted multi-plant categories
```

Safety net: Q-OM-EXC free-text question captures edge cases.

## C4 — Savings Quantification

```
For each "Suggest Centralise" candidate:
candidate_spend = SUM(category_spend)
rate = opmodel.centralisation.savings_rate (cascade applied)
savings_low = candidate_spend × rate.value_range[low]
savings_high = candidate_spend × rate.value_range[high]

For each "Suggest Centre-Led" candidate:
Same with opmodel.centralisation.centre_led_savings_rate
```

Rate is single rolled-up % including all drivers (volume aggregation, spec standardisation, negotiation leverage, process efficiency).

Steel rates: Centralise 4-7%; Centre-Led 2-4%.
Cement rates: Centralise 3-5%.
Function default: 2-4%.

## C5 — Qualitative/Quantitative Reconciliation

Cross-checks data-driven candidate list against client's qualitative perception. Buckets:

| Bucket | Meaning |
|---|---|
| Aligned | Data + QRE consistent |
| Under-perceived | Data shows opportunity not reflected in QRE |
| Over-perceived | QRE says decentralised but data shows few candidates |

---

# 3. The Output — Centralisation Suggestions Matrix

```
═════════════════════════════════════════════════════════════════════════
 CENTRALISATION SUGGESTIONS MATRIX
═════════════════════════════════════════════════════════════════════════

 SUGGEST CENTRALISE:
   Refractories                      ₹200 Cr  →  Savings ₹8 – 14 Cr
 • Originally labelled: REFR-MAIN (Plant J), Refr-Bricks (Plant K), REFR-CAT-1 (Plant V)
 • Current vendor base: 3 vendors (Concentrated)
 • Industry reasoning: Engineered category, common specs across plants
 • Rate source: WSA-2024 (4-7%)

 SUGGEST CENTRE-LED:
   MRO Consumables                   ₹150 Cr  →  Savings ₹3 – 6 Cr
 • Originally labelled: MRO-Plt-J, MRO-Plt-K, MRO-Plt-V (~165 vendors)
 • Current vendor base: 165 vendors (Highly fragmented)
 • Industry reasoning: Common items, but local fulfilment needs
 • Rate source: ACN-Proc-Benchmark-DB (2-4%)
  
   Lab Chemicals                     ₹50 Cr   →  Savings ₹1 – 2 Cr

 INDUSTRY-LOCAL (no centralisation opportunity):
   Iron ore (captive), Steel scrap (regional), Plant maintenance, Power & utilities

 ALREADY CENTRAL OR SINGLE-BUYER (no further opportunity):
   Coking coal, Ferro alloys, Industrial gases, Mill rolls, Outbound logistics rail,
   IT corporate, Insurance, Professional services

═════════════════════════════════════════════════════════════════════════

 TOTAL CENTRALISATION SAVINGS:  ₹12 – 22 Cr/year
   = 0.24 – 0.44% of ABC Steel's ₹5,000 Cr total procurement spend

═════════════════════════════════════════════════════════════════════════
```

---

# 4. Worked Example — ABC Steel (₹5,000 Cr, 3 plants)

Setup: 3 plants (Jamshedpur, Kalinganagar, Vijayanagar).

| Category | ₹ Cr | Plants buying | Industry tag |
|---|---|---|---|
| Iron ore (captive) | 1,200 | 3 | Naturally local |
| Iron ore (market) | 300 | 3 | Naturally central |
| Coking coal | 1,200 | 3 | Naturally central |
| Steel scrap (regional) | 400 | 3 | Naturally local |
| Outbound logistics (rail) | 400 | 3 | Naturally central |
| Power & utilities | 300 | 3 | Naturally local |
| Ferro alloys | 250 | 3 | Naturally central |
| Mill rolls | 220 | 3 | Naturally central |
| Refractories | 200 | 3 | Naturally central |
| Plant maintenance | 200 | 3 | Naturally local |
| Industrial gases | 180 | 3 | Naturally central |
| MRO consumables | 150 | 3 | Centre-led |
| Lab chemicals | 50 | 3 | Centre-led |

Multi-plant candidates split:
| Tag | Categories |
|---|---|
| Naturally Central → check if already central | Iron ore (market), Coking coal, Ferro alloys, Mill rolls, Refractories, Industrial gases, Outbound logistics |
| Naturally Local → skip | Iron ore (captive), Steel scrap, Power & utilities, Plant maintenance |
| Centre-Led → suggest | MRO consumables, Lab chemicals |

If Refractories currently fragmented → surfaces as `Suggest Centralise`.

Steel rates: Centralise 4-7%; Centre-Led 2-4%.

| Recommendation | Category | Spend ₹ Cr | Rate | Savings ₹ Cr |
|---|---|---|---|---|
| Centralise | Refractories | 200 | 4-7% | ₹8 – 14 |
| Centre-Led | MRO consumables | 150 | 2-4% | ₹3 – 6 |
| Centre-Led | Lab chemicals | 50 | 2-4% | ₹1 – 2 |
| **TOTAL** | | **400** | | **₹12 – 22** |

---

# 5. Source Selection

Cascade: Engagement override → Industry overlay → Function default. Within selected layer, primary source used; consultant can swap with reason logged.

---

# 6. Boundaries

| Out of scope | Where it goes |
|---|---|
| Vendor consolidation decisions | Supplier Mgmt pillar |
| Shared Services Strategy | Op Model — SSC theme |
| CoE design | Op Model — CoE theme |
| Tail Spend approach | Op Model — Tail Spend theme |
| Recommendation prioritisation | Cross-pillar Recommendations Engine |
| Roadmap sequencing | Cross-pillar Roadmap Generator |

---

# 7. RCA Patterns Referenced

| Finding | Typical root causes |
|---|---|
| Low spend centralisation overall | M&A heritage; weak central mandate; plant autonomy culture |
| Naturally-central category bought locally | Historical inertia; weak central category management |
| High candidate count surviving feasibility | Centralisation maturity gap |
| Few candidates (most already central) | Mature centralisation |

---

# 8. Confidence Indicators

| Confidence | When |
|---|---|
| **High** | Stage 9 ≥ 90%; industry overlay loaded; multi-plant pattern clear |
| **Medium** | Stage 9 80-90%; some industry overlay gaps |
| **Low** | Stage 9 < 80% OR significant data gaps |
