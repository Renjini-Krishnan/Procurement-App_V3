---
id: org-structure-spend-fte-distribution
layer: function
function: procurement
pillar: org-structure
theme: spend-fte-distribution
version: 1.0
last_updated: 2026-05-27
status: active
---

# Spend-FTE Distribution Theme — Deep Dive

## Purpose

This theme answers: **"Is the procurement team's FTE distributed across entities (Central / Plant 1 / Plant 2 / ...) in a way that's aligned with where the spend sits? Which entities are over-staffed for their spend share, and which are under-staffed?"** Produces B/W mapping matrix, per-entity productivity verdicts, and **directional re-allocation guidance** (no specific FTE counts).

This is theme 3 of 4 within the Org Structure pillar.

**Important boundaries:**
- **FTE-level only — no ₹ cost-out savings**
- **Directional recommendations only** — narrative; NOT specific "move N FTE from X to Y"
- **Central-vs-Plant spend attribution is opportunistic** — runs only if Stage 6 mapping feasible

## Logic Embodied

| Component | Purpose | Feasibility |
|---|---|---|
| **DS0 — Current State Capture** | FTE per entity + Spend per entity | Mixed |
| **DS1 — B/W Mapping Matrix** | % Spend × % FTE per entity; surface imbalances | Reliable at plant level |
| **DS2 — Per-Entity Productivity** | Spend/FTE per entity; identify over/under-productive | Reliable |
| **DS3 — Reconciliation** | Cross-check QRE perception | Reliable |

## Editable Configuration

```yaml
productivity_outlier_threshold_pct: 30
  # Entity flagged as outlier if spend/FTE deviates ≥ 30% from multi-entity avg

central_plant_attribution_method: "stage6_mapping"
  # Alternative: "qre_estimate" — use Q-OS-DS-02 client estimate

bw_mapping_imbalance_threshold_pct: 10
  # Entity flagged "imbalanced" if FTE share differs from spend share ≥ 10 pp
```

---

# 2. Analytical Framework

## DS0 — Current State Capture

QRE questions:
| ID | Question |
|---|---|
| Q-OS-DS-01 | "Approximate FTE split across Central / Plants / BUs?" |
| Q-OS-DS-02 | "Approximate spend split — Central vs Plant procurement?" |
| Q-OS-DS-03 | "Team perception of FTE distribution — appropriate / top-heavy / plant-heavy / imbalanced?" |

## DS1 — B/W Mapping Matrix

```
For each entity E:
fte_share_E_pct = fte_count_E / total_fte × 100
spend_share_E_pct = spend_E / total_spend × 100
imbalance_E = spend_share_E_pct - fte_share_E_pct

IF abs(imbalance_E) >= 10 pp:
    flag = "Imbalanced — high spend/low FTE OR low spend/high FTE"
```

## DS2 — Per-Entity Productivity

```
For each entity E:
spend_per_fte_E = spend_E / fte_count_E
deviation_pct = (spend_per_fte_E - multi_entity_avg) / multi_entity_avg × 100

IF deviation_pct >= 30%: "Over-productive"
ELIF deviation_pct <= -30%: "Under-productive"
ELSE: "Within range"

# Also compare to Steel benchmark band (₹40-80 Cr/FTE)
```

## DS3 — Qualitative Reconciliation

```
IF DS1 imbalance AND QRE "appropriate" → "Discuss with client"
IF DS2 under-productive entity AND QRE "stretched at that entity" → "Productivity issue (process/tooling/role mix), not headcount issue"
IF Central high spend/FTE AND QRE "top-heavy" → "Possible misperception — Central is high-productive, not top-heavy"
```

---

# 3. ABC Steel Worked Example

DS0: 40 Central + 13-14 per plant; Central manages ₹3,500 Cr (Stage 6 mapping feasible).

DS1 B/W Mapping:
| Entity | FTE % | Spend % | Imbalance | Flag |
|---|---|---|---|---|
| Central | 50% | 70% | +20 pp | **Imbalanced** — high spend / lean team (strategic-mandate consistent) |
| Plant Jamshedpur | 17.5% | 10% | -7.5 pp | Slight FTE over-allocation |
| Plant Kalinganagar | 16.25% | 9% | -7.25 pp | Slight FTE over-allocation |
| Plant Vijayanagar | 16.25% | 11% | -5.25 pp | Within tolerance |

DS2 Per-Entity Productivity:
| Entity | Spend ₹ Cr | FTE | Spend/FTE | Verdict |
|---|---|---|---|---|
| Central | 3,500 | 40 | ₹87.5 Cr | **Over-productive** (Above Steel band) |
| Plant Jamshedpur | 500 | 14 | ₹35.7 Cr | **Under-productive** (Below Steel band) |
| Plant Kalinganagar | 450 | 13 | ₹34.6 Cr | **Under-productive** |
| Plant Vijayanagar | 550 | 13 | ₹42.3 Cr | Lower-edge of Steel band |

DS3: Systemic pattern across all 3 plants — not plant-specific. Addressable via SSC implementation (Op Model theme), not direct theme-3 re-allocation.

**Final: Directional verdict — Plant FTE allocation appears high for spend managed locally. Op Model SSC roadmap naturally rebalances.**

---

# 4. Boundaries

| Out of scope | Where it goes |
|---|---|
| ₹ cost-out from rebalancing | NOT produced |
| Specific "move N FTE from X to Y" recommendations | NOT produced — directional only |
| SSC implementation design | Op Model SSC theme |
| Role-specific moves | Op Model centralisation + Theme 4 |

# 5. Steel Sub-Segment Distribution Expectations

| Sub-segment | Central FTE share | Central spend share | Imbalance |
|---|---|---|---|
| Integrated steel mill (multi-plant) | 30-50% | 55-75% | +15-25 pp (HEALTHY for strategic mandate) |
| Mini-mill | 0-30% | 0-30% | 0-10 pp (single-plant; concept doesn't strongly apply) |
| Specialty / electrical | 40-60% | 60-80% | +15-25 pp |
| Conglomerate | 25-45% | 40-65% | +10-20 pp |
| Foreign-owned | 25-50% | 50-80% | +20-35 pp (lean local Central) |

Note: Central-vs-Plant attribution feasibility ~35% of Indian Steel engagements. Common blockers: generic SAP Purchaser IDs ("PROC_DEPT"); cost centres mixed Central+Plant; vendor master assigned Central but PO executed by plant.

# 6. Confidence Indicators

| Confidence | When |
|---|---|
| **High** | Org excel entity column complete + PO plant column complete + Stage 6 entity mapping done + Central-vs-Plant attribution feasible |
| **Medium** | Plant-level data clean but Central-vs-Plant attribution not feasible |
| **Low** | Either FTE-per-entity or Spend-per-plant data significantly gappy |

(File abridged.)
