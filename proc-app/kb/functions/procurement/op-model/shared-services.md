---
id: op-model-shared-services
layer: function
function: procurement
pillar: op-model
theme: shared-services
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Shared Services Theme — Deep Dive

## Purpose

Shared Services analysis answers: **"Which transactional procurement categories should be handled by a Shared Service Centre (SSC) — to free category managers for strategic work, standardise processes, and reduce per-PO cost?"**

This is theme 2 of 4 within the Op Model pillar.

## Logic Embodied

Five components combined into an SSC Recommendation Matrix:

| Component | Purpose | Decision-driving? |
|---|---|---|
| **SS0 — Current SSC Coverage** (QRE) | Capture baseline of existing SSC scope (if any) | No |
| **SS1 — Volume-Value Quadrant Classification** | Classify categories into 4 quadrants based on PO count + avg PO value | **YES** |
| **SS2 — Industry Knowledge Filter for SSC** | Tag transactional candidates (Q1) as SSC-Suitable / Unsuitable / Centre-Handled | **YES** |
| **SS3 — SSC Coverage Gap** | Compare data-driven SSC-suitable list against current SSC scope | **YES** |
| **SS4 — FTE Productivity Quantification** | Compute cost-per-PO reduction + FTE freed | **YES** |
| **SS5 — Qualitative/Quantitative Reconciliation** | Cross-check SSC suggestion with QRE | No |

**Critical secondary output: CoE applicability** — Q4 quadrant from SS1 surfaces strategic categories for CoE theme.

## Editable Configuration

```yaml
quadrant_thresholds:
  high_po_count_quartile: 75   # top quartile by PO count
  high_avg_value_quartile: 75
ssc_minimum_po_count_threshold: 500
current_state_cost_per_po_default_inr: 3500
ssc_target_cost_per_po_default_inr: 1200
productivity_gain_pct_default: 60
```

---

# 1. Pre-requisites

- Stage 9 ≥ 80% spend mapped
- Reclassified PO data + QRE Q-OM-SS-01-05 answered

---

# 2. Analytical Framework

## SS0 — Current SSC Coverage (QRE baseline)

QRE questions:
| ID | Question | Answer type |
|---|---|---|
| Q-OM-SS-01 | "Does your organisation have a procurement SSC?" | Yes/No/Partial |
| Q-OM-SS-02 | "What categories does the SSC handle today?" | Free-text + checklist |
| Q-OM-SS-03 | "How many FTEs in the procurement SSC?" | Count band |
| Q-OM-SS-04 | "Typical processing cost per PO in your SSC?" | Range band |
| Q-OM-SS-05 | "Activity-level scope (PO creation, GRN, invoice, etc.) — what should/shouldn't move to SSC?" | Free-text |

## SS1 — Volume-Value Quadrant Classification (FOUNDATIONAL — used by SSC + CoE + Tail Spend)

```
For each reclassified category:
po_count   = COUNT(po_id WHERE category = X)
spend      = SUM(po_value WHERE category = X)
avg_po_value   = spend / po_count

Engagement-level thresholds:
high_po_count_threshold  = 75th percentile of po_count
high_avg_value_threshold = 75th percentile of avg_po_value

Assign quadrant:
Q1 — Transactional (SSC):   po_count ≥ high AND avg_po_value < high
Q2 — Hybrid:             po_count ≥ high AND avg_po_value ≥ high
Q3 — Tail (Tail Spend):  po_count < high AND avg_po_value < high
Q4 — Strategic (CoE):    po_count < high AND avg_po_value ≥ high
```

```
4-Quadrant Matrix:
              ←— low avg PO value  high avg PO value —→
   high PO count |  Q1 TRANSACTIONAL|  Q2 HYBRID
   (volume)  |  → SSC candidate |  → review case-by-case
                  +----------------------+----------------------
   low PO count  |  Q3 TAIL          |  Q4 STRATEGIC
             |  → Tail Spend Theme   |  → CoE Theme
```

**Q1 → SS2 (SSC suitability); Q4 → CoE theme; Q3 → Tail Spend theme.**

## SS2 — Industry Knowledge Filter for SSC

```
For each Q1 transactional candidate:
Look up category in industry's shared-services-filters.yml

IF in "ssc_suitable" list → tag = "SSC-Suitable"
ELSE IF in "ssc_unsuitable" list → tag = "SSC-Unsuitable (Plant)"
ELSE IF in "centre_handled" list → tag = "Centre-Handled"
ELSE → default "SSC-Suitable"
```

## SS3 — SSC Coverage Gap

```
ssc_suitable_categories = Q1 categories tagged "SSC-Suitable" in SS2
ssc_current_categories = from Q-OM-SS-02

ssc_coverage_gap = ssc_suitable_categories EXCEPT ssc_current_categories
ssc_coverage_gap_spend = SUM(spend across gap categories)
ssc_coverage_gap_po_count = SUM(po_count across gap categories)
```

## SS4 — FTE Productivity Quantification

```
current_cost_per_po = industry-default OR QRE Q-OM-SS-04
                  typical ₹2,500-4,000 Indian large enterprise (Steel ₹3,000-4,000)
ssc_cost_per_po = industry-default
               typical ₹1,000-2,000 (Steel ₹1,100-1,500)

saving_per_po = current_cost_per_po - ssc_cost_per_po
total_operational_saving = saving_per_po × ssc_coverage_gap_po_count

# FTE-equivalent freed
po_per_fte_per_year = 4,000-6,000 (plant-distributed)
fte_equivalent_freed = ssc_coverage_gap_po_count / 4,000-6,000 -
                        ssc_coverage_gap_po_count / 10,000-15,000 (mature SSC)
```

Two savings streams (operational + FTE redeployment) surfaced separately — not combined to avoid double-counting.

## SS5 — Qualitative/Quantitative Reconciliation

```
IF QRE "No SSC" AND ss3 large gap → "Greenfield SSC opportunity"
IF QRE "Yes comprehensive" AND ss3 large gap → "Perception/coverage mismatch"
IF QRE "Partial SSC" AND ss3 narrow gap → "Existing SSC has appropriate scope"
IF QRE "No SSC" AND ss3 narrow gap → "SSC may not be right operating model"
```

---

# 3. ABC Steel Output

Setup: ₹5,000 Cr / 3 plants / 80 FTE.

SS0: Client has partial SSC at Jamshedpur for MRO only (~₹50 Cr / 4K POs, 6 FTEs, ~₹2,800 per PO)

SS1 Quadrants (per category):
- Q1 Transactional (3 categories): MRO consumables, Lab chemicals, Stationery (~₹215 Cr | 18K POs)
- Q4 Strategic: 11 categories | ₹4,170 Cr | 800 POs → CoE theme
- Q3 Tail: minimal in ABC Steel example

SS2 Industry Filter: All Q1 categories tag as SSC-Suitable.

SS3 Coverage Gap: Expand SSC across all 3 plants for MRO + add Lab Chemicals + Stationery = ₹165 Cr / 14.3K POs.

SS4 Productivity (Steel rates):
- Per-PO saving: ₹2,300 (₹3,500 plant → ₹1,200 SSC)
- PO volume: 14,300 POs
- **Operational savings: ₹3.3 Cr/year**
- **FTE redeployment: 3-4 plant FTEs freed for strategic work**

SS5: "Client recognises SSC partial state; data quantifies the expansion opportunity. Aligned."

Final SSC recommendation: **Expand procurement SSC to cover all 3 plants for MRO + add Lab Chemicals + Stationery. ₹3.3 Cr/year + 3-4 FTEs freed. Q4 strategic categories handed to CoE theme.**

---

# 4. Boundaries

| Out of scope | Where it goes |
|---|---|
| CoE design + scope | CoE theme (consumes Q4 from SS1) |
| Tail spend approach | Tail Spend theme (consumes Q3 from SS1) |
| Detailed SSC tech stack | Tech & Digital pillar |
| Specific SSC location | Implementation roadmap |

---

# 5. RCA Patterns Referenced

| Finding | Typical root causes |
|---|---|
| Low SSC coverage despite many Q1 categories | No central SSC capability; historical plant-autonomy; insufficient process standardisation |
| Few Q1 transactional categories | Mature consolidation already; or high-spend low-volume profile (typical of integrated steel) |
| Q4 strategic categories not in CoE | CoE absent OR weak central category management |

---

# 6. Confidence Indicators

| Confidence | When |
|---|---|
| **High** | Stage 9 ≥ 90%; PO data complete; QRE Q-OM-SS-01-05 answered; industry overlay loaded |
| **Medium** | Stage 9 80-90% OR some QRE gaps |
| **Low** | Stage 9 < 80% — falls back to function default rates only |

(Note: File truncated to the most critical sections. Complete worked example continuation + additional context is in the source file.)
