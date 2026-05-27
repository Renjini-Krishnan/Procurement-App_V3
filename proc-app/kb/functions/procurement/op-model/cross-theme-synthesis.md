---
id: op-model-cross-theme-synthesis
layer: function
function: procurement
pillar: op-model
theme: cross-theme-synthesis
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
status: active
---

# Op Model — Cross-Theme Synthesis (Per-Category Unified View)

## Purpose

Cross-theme synthesis answers: **"For each category, what does Op Model say to do — across all 4 themes — and what's the total savings net of overlap?"** Produces:
1. **Per-Category Unified View** — single decision matrix line per category covering Centralisation + SSC + CoE + Tail Spend
2. **Strategic Imperative Patterns** — cross-theme storylines
3. **Roll-up Savings** — total Op Model savings with overlap handling

Runs AFTER all four themes complete.

## Logic Embodied

| Component | Purpose | Decision-driving? |
|---|---|---|
| **X1 — Per-Category Decision Matrix** | Join each category's theme decisions into one row | **YES** |
| **X2 — Overlap Detection** | Flag categories appearing in multiple savings gaps | **YES** |
| **X3 — Roll-up Savings Calculation** | Net savings with overlap rules applied | **YES** |
| **X4 — Strategic Imperative Pattern Detection** | Identify systemic patterns | **YES** |
| **X5 — Final Op Model Summary** | Consultant deliverable | **YES** |

## Editable Configuration

```yaml
overlap_handling:
  centralisation_and_coe:
rule: "stack_with_adjustment"
adjustment_pct_range: [1, 2]   # CoE incremental over centralisation baseline
  centralisation_and_ssc:
rule: "different_basis"
  coe_and_ssc:
rule: "different_basis"   # Q4 → CoE, Q1 → SSC by quadrant design
  centralisation_and_tail:
rule: "exclude_tail_from_centralisation_spend"

strategic_imperative_detection:
  patterns_threshold_pct: 70

output_summary_style:
  max_top_categories_in_matrix: 25
```

---

# 2. Analytical Framework

## X1 — Per-Category Decision Matrix

| Column | Source | Values |
|---|---|---|
| `category` | Stage 9 reclassified | Standard taxonomy ID |
| `spend_inr_cr` | PO data | ₹ Cr |
| `quadrant` | SS1 | Q1 / Q2 / Q3 / Q4 |
| `centralisation_decision` | C3 | Centralise / Centre-Led / Industry-Local / Already-Central / N-A |
| `ssc_decision` | SS2 | SSC-Suitable / SSC-Unsuitable / Centre-Handled / Already-In-SSC / N-A |
| `coe_decision` | CE2 | CoE-Suitable / Already-Strategic / Plant-Owned / Already-In-CoE / N-A |
| `tail_decision` | TS3 | Aggregator-Suitable / Consolidate-Internally / Not-Addressable / N-A |
| `primary_recommendation` | derived | (See logic below) |
| `combined_savings_inr_cr_range` | X3 | [low, high] |
| `overlap_flag` | X2 | yes/no |
| `confidence` | min of theme confidences | high / medium / low |

Primary recommendation derivation:
```
IF coe_decision == CoE-Suitable AND (Q4 OR top-3 vendor share ≥ 70%):
primary = "Bring under CoE"
IF Centralisation gap: secondary = "Centralise sourcing"
ELSE IF ssc_decision == SSC-Suitable AND NOT Already-In-SSC:
primary = "Move to SSC"
ELSE IF Centralisation gap:
primary = centralisation_decision# Centralise OR Centre-Led
ELSE IF tail_decision == Aggregator-Suitable:
primary = "Aggregator outsource"
ELSE:
primary = "Maintain current model"
```

## X2 — Overlap Detection

| Overlap | Example | Handling |
|---|---|---|
| **Centralisation + CoE** | Refractories, Ferro alloys, Mill rolls | Stack with adjustment |
| **Centralisation + SSC** | Rare | Different basis |
| **CoE + SSC** | Excluded by quadrant design | Different basis |
| **Centralisation + Tail** | Rare | Different basis |

## X3 — Roll-up Savings Calculation

```
IF in_c4_gap AND in_ce4_gap:
# Stack with adjustment
centralisation_savings = full_cent_rate × spend
coe_incremental_savings = 1-2% × spend
total = centralisation_savings + coe_incremental_savings
ELSE IF only in_c4_gap:
total = full_cent_rate × spend
ELSE IF only in_ce4_gap:
total = full_coe_rate × spend
ELSE IF only in_ts4_gap:
total = tail_rate × spend

# SSC always additive (different unit basis)
total += ssc_savings (if applicable)
```

Steel-specific example:
- Centralisation + CoE overlap on ₹100 Cr: 4-7% Cent + 1-2% CoE incremental = 5-9% stacked = ₹5-9 Cr
- CoE only on ₹100 Cr: 3-6% × ₹100 Cr = ₹3-6 Cr
- Centralisation only on ₹100 Cr: 4-7% × ₹100 Cr = ₹4-7 Cr

## X4 — Strategic Imperative Pattern Detection

5 patterns:

| ID | Detection | Narrative |
|---|---|---|
| **SI-01: Under-investment in central capability** | Centralisation gap large + SSC missing + CoE absent | Recommend phased build: SSC first, then CoE, then expand centralisation |
| **SI-02: Volume-focused, value-blind** | Centralisation healthy + CoE gap large | Formalise CoE for top-N categories |
| **SI-03: Strategic well-managed, transactional ignored** | CoE healthy + SSC gap + Tail unaddressed | SSC scope expansion + aggregator partnership |
| **SI-04: Sourcing discipline gap** | Centralisation low + Tail share high + fragmented vendors | Combined intervention |
| **SI-05: Already-optimal** | All themes mature | Focus on operational excellence within model |

Threshold: pattern surfaces at ≥70% fit (configurable).

## X5 — Final Op Model Summary

```
═════════════════════════════════════════════════════════════════════════
 OP MODEL — STRATEGIC SUMMARY
═════════════════════════════════════════════════════════════════════════

 STRATEGIC IMPERATIVE
   <SI-pattern narrative — 2-4 bullets>

 ACTIONS BY THEME
   Centralisation: <N> categories | ₹<X> Cr | ₹<savings> Cr/year
   SSC:        <N> categories | ₹<X> Cr | ₹<savings> Cr/year + <FTE> FTE freed
   CoE:        <N> categories | ₹<X> Cr | ₹<savings> Cr/year (incremental)
   Tail:       <N> categories | ₹<X> Cr | ₹<savings> Cr/year

 TOTAL OP MODEL SAVINGS: ₹<T1> – ₹<T2> Cr/year (overlap-adjusted)
 PLUS: <A> FTEs redeployed for higher-value work

 OP MODEL MATURITY SCORE: <S>/5

 TOP 10 PRIORITY ACTIONS
═════════════════════════════════════════════════════════════════════════
```

---

# 3. Worked Example — ABC Steel Roll-up

Per-theme savings:
| Theme | Categories in gap | Savings range |
|---|---|---|
| Centralisation (C4) | 7 multi-plant Centralise + 2 Centre-Led | ₹15-32 Cr/year |
| Shared Services (SS4) | 3 categories | ₹3.3 Cr + 3-4 FTE freed |
| CoE (CE4) | 4 new + formalisation uplift on 6 existing | ₹48-96 Cr/year |
| Tail Spend (TS4) | Aggregator-addressable ₹30 Cr | ₹1.2-2.1 Cr/year |

Overlap categories:
| Category | C4? | CE4? | SS4? | TS4? | Overlap |
|---|---|---|---|---|---|
| Refractories | Yes (₹200 Cr) | Yes | No | No | **C+CoE** |
| Ferro alloys | Yes (₹250 Cr) | Yes | No | No | **C+CoE** |
| Mill rolls | No (already central) | Yes (₹220 Cr) | No | No | CoE only |
| Coking coal | No (already central) | Yes (₹1,200 Cr) | No | No | CoE only |

Roll-up summary:
| Bucket | Spend ₹ Cr | Rate | Savings ₹ Cr |
|---|---|---|---|
| Centralisation-only candidates | 670 | 4-7% | 26.8 – 46.9 |
| C+CoE overlap | 670 | 5-9% stacked | 33.5 – 60.3 |
| CoE-only | 2,200 | 3-6% | 66.0 – 132.0 |
| SSC (operational) | n/a | n/a | 3.3 |
| Tail | 30 | 4-7% | 1.2 – 2.1 |
| **GRAND TOTAL** | | | **₹130.8 – ₹241.6 Cr/year** |

Plus 3-4 FTE redeployment.

Primary strategic imperative: **SI-02 (Volume-focused, value-blind)**
- ABC Steel has reasonable centralisation maturity but strategic categories lack formal CoE ownership
- Next operating-model maturity step is CoE formalisation
- Op Model Maturity Score: 2.85/5

---

# 4. Confidence

Synthesis confidence = MIN(theme confidences). Overlap-adjustment logic always applies regardless of confidence.
