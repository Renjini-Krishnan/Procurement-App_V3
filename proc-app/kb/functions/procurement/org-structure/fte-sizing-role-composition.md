---
id: org-structure-fte-sizing-role-composition
layer: function
function: procurement
pillar: org-structure
theme: fte-sizing-role-composition
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# FTE Sizing & Role Composition Theme — Deep Dive

## Purpose

This theme answers: **"Is the procurement team appropriately sized for the spend it manages and the transactions it processes, AND does it have the right mix of role types and specialist capabilities?"** It produces a sizing verdict (Under-staffed / Right-sized / Over-staffed), per-role productivity verdicts, a role composition assessment, and a missing-specialist-roles list.

This is theme 2 of 4 within the Org Structure pillar. Theme 1 (Posture & Reporting) sets the structural lens; this theme assesses team sizing + composition within that posture.

**Important boundary:** This theme quantifies team gaps in **FTE counts only** — surplus or deficiency expressed as # FTEs. **No ₹ cost-out savings are produced.** Translating FTE delta to ₹ touches HR/transition assumptions outside Op Model and is intentionally out of scope. Quantified ₹ savings from operational redesign (e.g., SSC) sit with the Op Model pillar.

## Logic Embodied

Six components combined into a Sizing & Composition verdict:

| Component | Purpose | Decision-driving? |
|---|---|---|
| **FT0 — Current State Capture** (QRE + Org excel) | Capture FTE counts by role / level / entity; loaded cost optional | No — baseline |
| **FT1 — Spend/FTE Productivity** | Spend per FTE vs industry benchmark → sizing verdict + # FTE delta | **YES** |
| **FT2 — POs/FTE Productivity (by role type)** | Split POs/FTE by Category Mgr / Transactional / SSC; role-specific productivity gaps | **YES** |
| **FT3 — Role Composition Mix** | Cat Mgr / Transactional / Specialist / Leadership share vs benchmark mix | **YES** |
| **FT4 — Specialist Roles Audit** | Check for Analytics, Contract Mgmt, SRM, FBP, Risk, Sustainability/ESG, Digital — industry-filtered | **YES** |
| **FT5 — Qualitative Reconciliation** | QRE structural concerns vs data assessment | No |

## Inputs Used

| Input | Source | Feasibility |
|---|---|---|
| **Org Structure / Employee Master** (one of two acceptable formats) | Client upload | Usually available |
| Total annual POs | PO data (Stage 9 reclassified) | Reliable |
| Total annual spend | PO data | Reliable |
| QRE on team adequacy + composition | Q-OS-FT-01 through Q-OS-FT-05 | Reliable (self-report) |
| PO-to-FTE attribution (buyer_id / cost_centre) | PO data joined with Org data | **Often unreliable** |
| Industry typical role list + role-mix benchmarks | `industries/<ind>/.../fte-sizing-role-composition-filters.yml` | Authored |
| Spend/FTE + POs/FTE + role-mix benchmarks | `org-structure/benchmarks.yml` + industry overlay | Authored |

### Acceptable formats for Org Structure / Employee Master

**Format A — Org Structure (hierarchy view):** PowerPoint / PDF / structured Excel with reports_to linking. App parses hierarchy + extracts named persons + roles + reporting relationships.

**Format B — Employee Master (list view):** Excel/CSV with one row per employee. Common columns: employee_name, role_title, level/grade, entity/location, function, reports_to (optional).

Both formats give the same downstream inputs after Stage 5 (AI parsing) + Stage 6 (consultant validation).

### Role titles will be generic — intelligent classification required

Clients typically share **generic role titles** like "Manager - Procurement," "Sr Manager - Procurement," "Asst Manager - Purchase," "Purchase Officer." They will NOT pre-classify roles as "Category Manager" vs "Transactional Buyer" vs "Specialist" for us.

The app handles this through a 3-step classification pipeline (Section 2.5). If classification confidence is low after all 3 steps, the relevant analysis component is **skipped** rather than fabricated.

## Outputs Produced

| Output | Format |
|---|---|
| Sizing verdict | Under-staffed / Right-sized / Over-staffed |
| FTE delta | # FTEs surplus or deficiency (NOT ₹) |
| Per-role productivity verdict | Below / At / Above benchmark per role type |
| Composition verdict | Appropriate / Skewed (which direction) |
| Missing specialist roles list | Role names + criticality (high / medium / emerging) |
| Reconciliation narrative | 1-2 sentence consistency check |

## Editable Configuration

```yaml
sizing_band_tolerance_pct: 20

productivity_role_classification_method: "title_keyword_match"

specialist_roles_to_audit:
  - id: analytics
label: "Procurement Analytics"
criticality: high
  - id: contract_mgmt
label: "Contract Management"
criticality: high
  - id: srm
label: "Supplier Relationship Management"
criticality: high
  - id: fbp
label: "Finance Business Partner"
criticality: high
  - id: risk
label: "Procurement Risk & Compliance"
criticality: medium
  - id: sustainability_esg
label: "Sustainability / ESG"
criticality: high
  - id: digital_tech
label: "Procurement Digital / Tech"
criticality: medium

missing_role_criticality_thresholds:
  high: "Critical gap"
  medium: "Notable gap"
  emerging: "Consider"
```

## Tunable values not in this file

| Item | Where | Risk |
|---|---|---|
| Industry-specific spend/FTE band | `industries/<ind>/.../org-structure/benchmarks.yml` | High (Partner) |
| Industry-specific POs/FTE bands by role | Same | High (Partner) |
| Industry-specific role-mix bands | Same | High (Partner) |
| Industry-specific specialist roles list | `industries/<ind>/.../org-structure/fte-sizing-role-composition-filters.yml` | High (Partner) |

---

# 1. Pre-requisites

### Minimum to run ANY part of this theme
- QRE Q-OS-FT-01 (total FTE count) answered — OR — Org Structure / Employee Master uploaded
- Theme 1 (Posture) verdict available — informs interpretation

### Per-component data requirements (skip-if-missing logic)

| Component | Minimum required to run | If missing → |
|---|---|---|
| **FT1 Spend/FTE** | Total spend (PO data) + Total FTE (Org excel OR Q-OS-FT-01) | Skip |
| **FT2 (overall) Total POs/FTE** | Total POs (Stage 9) + Total FTE | Skip if both missing |
| **FT2 (advanced) POs/FTE by role type** | Above + role classification (≥ Medium confidence) + buyer_id/cost_centre on POs joinable to Org excel | Skip per-role view; keep overall total |
| **FT3 Role composition mix** | Org excel with role titles + role classification (≥ Medium confidence) — OR — Q-OS-FT-02 (client estimate) | Skip data-derived view; rely on QRE-only if Q-OS-FT-02 answered |
| **FT4 Specialist roles audit** | Q-OS-FT-03 (multi-select) — OR — Org excel with role titles | Skip if both missing |
| **FT5 Reconciliation** | Any of FT1-FT4 completed + Q-OS-FT-05 answered | Skip if no upstream components ran |

The output deliverable always shows WHICH components ran and which were skipped, with the reason.

---

# 2. Analytical Framework

## FT0 — Current State Capture

QRE questions:
| ID | Question | Answer type |
|---|---|---|
| Q-OS-FT-01 | "Approximately how many FTEs are in the procurement function?" | Count band |
| Q-OS-FT-02 | "Approximate split — Category Manager / Transactional / Specialist / Leadership?" | Percentage breakdown |
| Q-OS-FT-03 | "Which specialist roles are present in your procurement function?" | Multi-select |
| Q-OS-FT-04 | "Where are your FTEs located?" | Central / Plant / BU split |
| Q-OS-FT-05 | "How do you describe your team sizing today?" | Adequate / Stretched / Over-staffed / Mixed |

## 2.5 — Role Classification Approach (Intelligent Mapping)

**Purpose:** Map client's generic role titles to canonical role types using intelligence — DO NOT assume clients give clean role classifications.

### 3-step classification pipeline

**Step 1 — Rule-based title keyword match:**

| Role type | Title keyword patterns |
|---|---|
| **Category Manager** | "Category Manager", "Category Lead", "Sourcing Manager", "Strategic Sourcing" |
| **Transactional Buyer** | "Buyer", "Sr Buyer", "Procurement Officer", "Procurement Executive", "Purchase Officer" |
| **Specialist** | "Analyst", "Analytics", "Contract Manager", "SRM", "FBP", "Risk", "Sustainability", "ESG", "Digital", "Compliance" |
| **Leadership** | "Head", "Director", "VP", "CPO", "Chief Procurement", "GM Procurement", "AVP" |

Returns confidence: High / Medium / Low.

**Step 2 — Level + entity tie-breaker** for Medium/Low cases:

| Title pattern | Level | Entity | Likely role type |
|---|---|---|---|
| "Manager - Procurement" | VP / AVP / Sr GM | Central | Leadership |
| "Manager - Procurement" | M3 / M4 (mid-level) | Central | Category Manager |
| "Manager - Procurement" | M3 / M4 | Plant | Transactional Buyer |
| "Officer / Executive - Procurement" | any | Plant | Transactional Buyer |
| "Manager - <Analytics/Contracts/SRM>" | any | Central | Specialist |

**Step 3 — AI prompt** for residual ambiguity:

AI receives: raw title + level + entity + industry context + other titles at same level. Returns role classification + confidence score (0.0-1.0).

**Step 4 — Stage 6 consultant validation:**

Consultant reviews all Low-confidence + sample of Medium. Confirms or corrects. Corrected classifications become High confidence.

### Skip-if-confidence-low logic

- **FT2 by role** runs only if ≥ 80% of FTEs are High confidence
- **FT3 composition mix** runs only if ≥ 70% are High or Medium
- **FT4 specialist audit** dual-source: Q-OS-FT-03 primary + Org excel cross-check

---

## FT1 — Spend/FTE Productivity

**Feasibility: Reliable.** Does NOT depend on role classification — uses headcount + total spend only.

```
spend_per_fte_inr_cr = total_annual_spend / total_procurement_fte

IF spend_per_fte > benchmark_high × 1.2:
verdict = "Under-staffed"
ELIF spend_per_fte < benchmark_low × 0.8:
verdict = "Over-staffed"
ELSE:
verdict = "Right-sized"

# FTE delta range (NOT ₹)
implied_fte_at_low = total_spend / benchmark_low
implied_fte_at_high = total_spend / benchmark_high
fte_delta_range = current_fte - [implied_fte_at_high, implied_fte_at_low]
```

Note: FTE delta in # FTEs only. No ₹ cost-out savings. Operational redesign opportunities sit with Op Model SSC theme.

## FT2 — POs/FTE Productivity

**FT2-overall: Reliable** — total POs / total FTE.

**FT2-by-role-type: Semi-reliable.** Requires:
- Role classification ≥ 80% High confidence
- buyer_id / cost_centre on POs joinable to Org excel

In typical Indian Steel engagements, FT2-by-role is OFTEN skipped because SAP buyer_id is generic (e.g., "PR_DEPT") rather than individual.

Cross-link to Op Model SSC theme in commentary only — no quantified linkage.

## FT3 — Role Composition Mix

Cascade: Data-derived (if classification ≥ 70% Medium+ confidence) → QRE Q-OS-FT-02 fallback → skip if neither.

Compute share per role type vs benchmark mix:
- Cat Mgr: 25-40% (Steel 25-35%)
- Transactional: 30-50% (Steel 35-50%)
- Specialist: 10-20% (Steel 10-15% — typically observed lower)
- Leadership: 5-10%

## FT4 — Specialist Roles Audit

Dual-source resilience:
- Q-OS-FT-03 primary
- Org excel cross-check

Function default specialist roles: Analytics, Contract Mgmt, SRM, FBP, Risk, Sustainability/ESG, Digital.

Steel overlay adds: Commodity Analyst (Iron Ore + Coking Coal + Ferro Alloys), Logistics Specialist (rail/sea freight), Refractories/Mill Rolls Specialist, Captive Asset Liaison, Decarbonisation Sourcing Specialist (emerging).

## FT5 — Qualitative Reconciliation

Cross-check FT1-FT4 outputs against QRE perception (Q-OS-FT-05).

---

# 3. Worked Example — ABC Steel

Setup: 80 procurement FTE; ₹5,000 Cr spend; multi-plant integrated steel.

## FT0 — Current State Capture

Client shared Employee Master Excel with 80 rows. Generic titles: "Sr Manager - Procurement" (8), "Manager - Procurement" (12), "Asst Manager - Procurement" (15), "Sr Buyer" (10), "Buyer" (20), "Procurement Officer" (5), "Manager - Contracts" (2), "Category Manager - Refractories" (1 — only explicit), "Head - Procurement" (1 — CPO), "DGM - Procurement" (2), "Procurement Analyst" (1), etc.

Role classification pipeline:
- Step 1 (rule-based): High-confidence ~52 (CPO + DGMs + Cat Mgr Refractories + Analyst + Contract Mgrs + plant-level Buyers)
- Step 2 (level + entity): Medium-confidence ~25 (Sr Mgr at Central → Cat Mgr Medium; Manager at Plant → Transactional Medium)
- Step 3 (AI): ~3 residual cases
- Step 4 (consultant validation): Confirmed High; corrected 2 misclassifications

Final: **~70% High confidence, ~28% Medium, ~2% Low** — sufficient for FT3 (≥70%) but borderline for FT2-by-role (80% threshold not reached)

Validated composition:
| Role type | Count | % |
|---|---|---|
| Category Manager | 20 | 25% |
| Transactional Buyer | 50 | 62.5% |
| Specialist | 2 (1 Analytics + 1 Contract Mgmt) | 2.5% |
| Leadership | 8 (1 CPO + 2 DGM + 5 Sr Mgr at Central) | 10% |

Distribution: 40 central, 40 plant-distributed.

**Feasibility recap for ABC Steel:**

| Component | Will it run? | Why |
|---|---|---|
| FT1 Spend/FTE | ✓ Runs | Both data sources reliable |
| FT2 overall | ✓ Runs | Total POs + total FTE both reliable |
| FT2 by role | ⚠ Skipped | Classification 70% High — below 80%; `buyer_id` generic "PR_DEPT" |
| FT3 composition | ✓ Runs | Classification 98% Medium+ — above 70% |
| FT4 specialist | ✓ Runs | Q-OS-FT-03 + Org excel cross-check |
| FT5 reconciliation | ✓ Runs | Multiple upstream + Q-OS-FT-05 answered |

## FT1 — Spend/FTE

₹5,000 / 80 = **₹62.5 Cr/FTE** → Within Steel benchmark [40-80] → **Right-sized** by spend measure.

FTE delta: within ±20% tolerance → Right-sized verdict.

## FT2 — POs/FTE

Total: 30,000 POs / 80 FTE = **375 POs/FTE** — below composite band (1,000-2,000 typical for plant-distributed Steel).

By role: SKIPPED (buyer_id generic). Op Model SSC theme handles operational redesign quantification.

## FT3 — Role Composition Mix

| Role | ABC % | Steel benchmark | Verdict |
|---|---|---|---|
| Category Manager | 25% | 25-35% | Within band (low end) |
| Transactional | 62% | 35-50% | **Over-represented** |
| Specialist | 2.5% | 10-15% | **Significantly under-represented** |
| Leadership | 10% | 5-10% | Within band (high end) |

Overall: **Skewed — over-indexed on transactional, materially under-invested in specialist roles.**

## FT4 — Specialist Roles Audit

| Role | Status | Criticality | Flag |
|---|---|---|---|
| Procurement Analytics | **Missing** | High | Critical gap |
| Contract Management | Present (2 FTE) | High | ✓ |
| Supplier Relationship Mgmt | **Missing** | High | Critical gap |
| Finance Business Partner | **Missing** | High | Critical gap |
| Risk & Compliance | **Missing** | Medium | Notable gap |
| Sustainability / ESG | **Missing** | High (Steel-emerging-critical) | Critical gap |
| Digital / Tech | **Missing** | Medium | Notable gap |
| Commodity Analyst (Steel) | **Missing** | High | Critical gap |
| Logistics Specialist (Steel) | Present (within Cat Mgr team) | Medium | ✓ |

**5 critical gaps + 2 notable gaps. Indicative addition: 5 specialist FTE.**

## FT5 — Reconciliation

QRE Q-OS-FT-05: "stretched on strategic, adequate on transactional."

Data shows: aggregate sizing right; transactional over-staffed; specialists materially missing.

Reconciliation: *"Client perception of 'stretched on strategic' is consistent with data — 0 dedicated specialist roles for analytics/SRM/FBP forces strategic work onto Cat Mgrs. The 'adequate on transactional' perception masks low productivity (375 vs 1,000-2,000 benchmark) — Op Model SSC theme addresses. Net: composition rebalance is the priority, not headcount reduction."*

## Final ABC Steel Recommendation

> **Aggregate sizing is right; rebalance composition.** Add 5 specialist FTE (1 Analytics + 1 SRM + 1 FBP + 1 Sustainability/ESG + 1 Commodity Analyst) — critical for strategic depth. Redirect 4-5 transactional FTE through redeployment (or via Op Model SSC implementation which would absorb the volume gap). Net headcount approximately unchanged; significantly stronger strategic posture.
>
> Op Model SSC theme separately quantifies the operational redesign ₹ prize. This theme's recommendation is composition-rebalance, not cost-out.

---

# 5. Boundaries

| Out of scope | Where it goes |
|---|---|
| ₹ cost-out savings from rightsizing | NOT produced — explicit out-of-scope |
| Operational redesign options (SSC, automation) | Op Model SSC theme |
| Specific JD content per role | Theme 4 (Hierarchy & Span) |
| Central vs Local FTE distribution | Theme 3 (Spend-FTE Distribution) |
| Compensation benchmarking | HR pillar (Build 2) |

---

# 6. Confidence Indicators

Per-component (not theme-wide):

| Component | High | Medium | Low / Skipped |
|---|---|---|---|
| FT1 Spend/FTE | Both sources reliable | One approximate | Either missing → skip |
| FT2 overall | Reliable | Stage 9 80-90% | < 80% or FTE uncertain |
| FT2 by role | Classification ≥ 80% High + join feasible | 70-80% High | < 70% OR join not feasible → skip |
| FT3 composition | Data + QRE both | One source | Neither → skip |
| FT4 specialist | Q-OS-FT-03 + Org excel both | Single source | Neither answered → skip |
| FT5 reconciliation | At least 2 upstream + QRE | Only 1 component | None → skip |

The output deliverable surfaces each component's confidence + reason for any skipped components.
