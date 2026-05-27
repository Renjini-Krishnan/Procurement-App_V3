---
id: org-structure-cross-theme-synthesis
layer: function
function: procurement
pillar: org-structure
theme: cross-theme-synthesis
version: 1.0
last_updated: 2026-05-27
status: active
---

# Org Structure — Cross-Theme Synthesis

## Purpose

Cross-theme synthesis answers: **"What does Org Structure say overall — across all four themes — and what's the dominant Strategic Imperative?"** Produces:
1. Per-theme decision summary
2. Strategic Imperative pattern
3. Consolidated recommendations
4. Pillar maturity score

Runs AFTER all 4 themes complete. **Boundary:** No ₹ savings produced (pillar boundary). Roll-up is structural + FTE-level.

## Logic Embodied

| Component | Purpose | Decision-driving? |
|---|---|---|
| **X1 — Per-Theme Decision Summary** | Compile each theme's verdict + key finding | **YES** |
| **X2 — Strategic Imperative Pattern Detection** | Identify dominant cross-theme storyline | **YES** |
| **X3 — Consolidated Recommendations** | Roll up theme-level recommendations | **YES** |
| **X4 — Pillar Maturity Score** | Weighted average of theme scores | **YES** |

## Editable Configuration

```yaml
strategic_imperative_threshold_pct: 70
show_top_actions_count: 6
pillar_score_rounding: 1
```

---

# 2. Analytical Framework

## X1 — Per-Theme Decision Summary

ABC Steel sample matrix:
| Theme | Headline Verdict | Key Finding | Recommendation | Confidence |
|---|---|---|---|---|
| **1. Posture & Reporting** | Aligned-with-Tension; CFO Appropriate | Hybrid biz + Central proc; sits in 25% Steel pattern | No change for current mandate | High |
| **2. FTE Sizing & Composition** | Right-sized aggregate; skewed composition | 80 FTE within band; 62% Transactional; 5 critical specialist gaps | Add 5 specialists; redirect 4-5 trans via SSC | High |
| **3. Spend-FTE Distribution** | Plants systemically under-productive | Central 50%FTE/70%spend; plants ₹35-42 Cr/FTE (below band) | No theme-3 re-allocation; SSC rebalances | High |
| **4. Hierarchy & Span** | Plant Sr Mgrs stretched; DGM Plant Coord under-leveraged | All 3 Plant Sr Mgrs: 13-14 reports; DGM-PC: 3 reports | Plant layer redesign + question DGM-PC role | Medium |

## X2 — Strategic Imperative Pattern Detection

**5 patterns:**

| Pattern ID | Detection | Narrative |
|---|---|---|
| **SI-OS-01: Under-resourced central capability** | T1 misaligned + T2≤2 + T3 plants over-allocated + T4 stretched | "Procurement under-built across multiple dimensions. Phased build: structural realignment + specialist hires + SSC implementation." |
| **SI-OS-02: Strategic mandate-structure mismatch** | T1 strategic mandate stated but CFO/Plant reporting + T2 specialist gaps | "Asked to deliver strategic value but structurally positioned for cost control. Reporting line elevation + specialist hires needed." |
| **SI-OS-03: Operational shape healthy with capability gaps** | T1+T3+T4 Healthy + T2 specialist gaps | "Structural shape works; gap is capability. 4-6 specialist hires uplift function without structural overhaul." |
| **SI-OS-04: Composition-led rebalance needed** | T2 transactional >55% + T2 specialist gaps + T3 plant FTE over-allocation | "Aggregate sizing fine but composition skewed. Op Model SSC creates redirect opportunity — composition rebalance through redeployment, not net headcount addition." |
| **SI-OS-05: Already-balanced** | All themes score ≥ 4 | "Mature across all 4 dimensions. Selective refinement only. Focus shifts to Capability / Tech & Digital pillars." |

Detection: pattern surfaces at ≥ 70% fit; multiple patterns can surface.

## X3 — Consolidated Recommendations

ABC Steel:
| # | Action | Type | Priority | Owner |
|---|---|---|---|---|
| 1 | Add 5 specialist FTE: Analytics + SRM + FBP + Sustainability/ESG + Commodity Analyst | FTE Add (Capability) | High | CPO + CFO |
| 2 | Plant layer redesign — intermediate Mgr OR redistribute via Op Model SSC | Structural | High | CPO + Plant Heads |
| 3 | Question DGM Plant Coordination role — possibly redundant | Structural | Medium | CPO + CFO |
| 4 | R&R refresh — Sr Buyer / Asst Mgr boundary | Capability | Medium | CPO + HR |
| 5 | Revisit CPO reporting line IF mandate evolves to strategic value | Structural (contingent) | Low | CEO + CFO + CPO |
| 6 | Cross-link to Op Model SSC roadmap | Crosslink | High | Op Model |

## X4 — Pillar Maturity Score

```
pillar_score = 0.20 × posture + 0.35 × sizing + 0.20 × distribution + 0.25 × hierarchy_span
```

ABC Steel:
| Theme | Score | Weight | Contribution |
|---|---|---|---|
| Posture | 3.5 | 0.20 | 0.70 |
| Sizing | 2.5 | 0.35 | 0.875 |
| Distribution | 3.0 | 0.20 | 0.60 |
| Hierarchy/Span | 2.5 | 0.25 | 0.625 |
| **PILLAR** | | | **2.8 / 5** (Defined) |

---

# 3. ABC Steel Strategic Imperative

**Detected pattern:** SI-OS-04 (Composition-led rebalance) — fit 78%.
**Secondary:** SI-OS-03 (Operational shape healthy, capability gaps) — fit 65%.

**Headline:** *"ABC Steel's procurement structure is shape-healthy but capability-gapped + composition-skewed."*

**Narrative:** ABC sits in 'Composition-led rebalance' pattern. Posture (Aligned-with-Tension), reporting (CFO Appropriate), distribution (Central productive; plants systemically under-productive), hierarchy (5 levels appropriate) all working. Issue is composition + specialists — 62% Transactional vs 35-50%; 5 critical specialist roles missing; plant Sr Mgrs stretched.

Path forward leverages Op Model SSC implementation: SSC absorbs plant transactional → frees 4-5 plant FTE → redirect into specialist roles at Central. Net headcount unchanged; stronger strategic posture. Plus plant layer redesign.

**Op Model crosswalk:** Pattern dovetails with Op Model SSC theme. Combined Op Model + Org Structure execution materially more impactful than either alone.

**Pillar maturity: 2.8/5 (Defined).**

---

# 4. Boundaries

| Out of scope | Where it goes |
|---|---|
| ₹ savings roll-up | Op Model pillar |
| Implementation sequencing | Stage 28 Findings + roadmap workstream |
| Cost of structural change | Business case (Build 2) |

# 5. Confidence

Synthesis confidence = MIN(theme confidences). Strategic Imperative pattern detection always runs; confidence affects narrative emphasis.
