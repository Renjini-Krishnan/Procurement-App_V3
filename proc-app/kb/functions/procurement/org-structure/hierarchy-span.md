---
id: org-structure-hierarchy-span
layer: function
function: procurement
pillar: org-structure
theme: hierarchy-span
version: 1.0
last_updated: 2026-05-27
status: active
---

# Hierarchy & Span Theme — Deep Dive

## Purpose

This theme answers: **"Is the procurement organisation structured with healthy spans of control + appropriate hierarchy depth?"** Produces per-manager span verdict (Healthy / Stretched / Under-leveraged), hierarchy depth verdict (Appropriate / Too flat / Too tall), and qualitative R&R/JD bullet from QRE.

This is theme 4 of 4. Final structural assessment.

**Important boundaries:**
- **FTE-level only — no ₹ cost-out savings**
- **Directional recommendations only** — narrative on span/hierarchy concerns; NOT specific "remove manager X"
- **R&R / JD assessment lightweight (qualitative bullet only)** — JDs rarely shared

## Logic Embodied

| Component | Purpose | Feasibility |
|---|---|---|
| **HS0 — Current State Capture** | Reporting structure + JD/R&R qualitative input from QRE | Reliable (QRE) |
| **HS1 — Span of Control** | Per-manager direct reports count vs healthy bands | Semi-reliable — needs `reports_to` |
| **HS2 — Hierarchy Depth** | Levels CPO → most junior vs typical | Semi-reliable — same dependency |
| **HS3 — Qualitative Reconciliation** | QRE perception vs analytical findings | Reliable |

## Editable Configuration

```yaml
span_thresholds_by_level:
  cpo: [4, 7]
  senior_mgmt: [5, 8]  # DGM / GM / VP-direct-reports / AVP
  mid_mgmt: [6, 10]    # Sr Mgr / Mgr leading other Mgrs
  first_line_lead: [8, 15] # Mgr leading buyers / Asst Mgrs

hierarchy_depth_typical_levels: [3, 5]

reports_to_population_threshold_pct: 70
  # Minimum % of FTEs with reports_to populated to run HS1+HS2
  # Below this → skip data-derived; surface QRE-based commentary

stretched_span_tolerance_pct: 20
under_leveraged_span_tolerance_pct: 30
```

---

# 2. Analytical Framework

## HS0 — Current State Capture

QRE questions:
| ID | Question | Answer type |
|---|---|---|
| Q-OS-HS-01 | "How many reporting levels from CPO to most junior?" | Count band |
| Q-OS-HS-02 | "Typical span at CPO / Sr Mgmt / Mid / First-line?" | Free-text or structured |
| Q-OS-HS-03 | "Current JDs for all roles? Known R&R overlaps/gaps?" | Free-text |
| Q-OS-HS-04 | "Team perceives hierarchy + span — appropriate / top-heavy / layered / stretched?" | Free-text |

## HS1 — Span of Control Analysis

```
GATE: reports_to ≥ 70% (post-Stage-6)
  IF below: skip data-derived; use Q-OS-HS-02 if available

# Manager identification
managers = FTEs who appear as reports_to value for ≥ 1 other FTE

For each manager M:
direct_reports_count_M = COUNT(FTEs where reports_to = M)
healthy_band = lookup by level (CPO 4-7 / Senior 5-8 / Mid 6-10 / First-line 8-15)

IF direct_reports_count_M > healthy_band.high × 1.2: verdict = "Stretched"
ELIF direct_reports_count_M < healthy_band.low × 0.7: verdict = "Under-leveraged"
ELSE: verdict = "Healthy"
```

## HS2 — Hierarchy Depth Analysis

```
GATE: reports_to ≥ 70%
  IF below: skip; use Q-OS-HS-01 if available

# Build reporting chain
For each FTE F:
chain_length_F = length from F up to CPO

max_depth = MAX(chain_length_F)

benchmark_band = hierarchy_depth_typical_levels [3-5]
sub_segment_band = industry overlay (Steel integrated mill 4-5)

IF max_depth > benchmark_band.high: verdict = "Too tall"
ELIF max_depth < benchmark_band.low: verdict = "Too flat"
ELSE: verdict = "Appropriate"
```

## HS3 — Qualitative Reconciliation

```
IF HS1 surfaces stretched AND Q-OS-HS-04 mentions "stretched" → "Alignment confirmed"
IF HS2 = Too tall AND Q-OS-HS-04 mentions "layered" → "Alignment confirmed"
IF both Healthy AND Q-OS-HS-04 mentions "stretched" → "Perception–data mismatch — workload not structural"
IF Q-OS-HS-03 surfaces R&R overlap/gap → "Recommend R&R clarification exercise"
```

---

# 3. ABC Steel Worked Example

Setup: 80 FTE; reports_to 65% populated raw → 78% post-Stage-6 (clears 70% threshold).

QRE responses:
- Q-OS-HS-01: "5 levels CPO → DGM → Sr Mgr → Mgr → Officer"
- Q-OS-HS-02: "CPO ~4; DGM 5-7; Sr Mgr 6-10; Mgr 5-12 by plant"
- Q-OS-HS-03: "JDs current. Known overlap: Sr Buyers + Asst Mgrs at plants on day-to-day execution"
- Q-OS-HS-04: "Slightly top-heavy at corporate; plant teams stretched"

HS1 Span findings:
| Manager | Reports | Healthy Band | Verdict |
|---|---|---|---|
| CPO | 4 (2 DGMs + 1 Spec Lead + 1 EA) | 4-7 | **Healthy** |
| DGM-Central-Categories | 7 (5 Sr Mgrs + 2 Specialists) | 5-8 | **Healthy** |
| DGM-Plant-Coordination | 3 (3 plant Sr Mgrs) | 5-8 | **Under-leveraged** |
| Sr-Mgr-Plant-J | 14 | 6-10 | **Stretched** |
| Sr-Mgr-Plant-K | 13 | 6-10 | **Stretched** |
| Sr-Mgr-Plant-V | 13 | 6-10 | **Stretched** |

HS2 Hierarchy: 5 levels → **Appropriate** (at upper edge of Steel 4-5 band). But DGM Plant Coord layer adds depth without value.

HS3 Reconciliation: Data + perception fully align — plants stretched + top-heavy corporate. Sr Buyer/Asst Mgr R&R overlap reinforces plant layering issue.

**Recommendation:** Plant layer redesign (intermediate Mgr OR redistribute via Op Model SSC). Question DGM Plant Coord role. R&R refresh on Sr Buyer/Asst Mgr boundary.

---

# 4. Boundaries

| Out of scope | Where it goes |
|---|---|
| ₹ cost-out from de-layering | NOT produced |
| Specific "remove role X" recommendations | NOT produced — directional only |
| Detailed JD content rewrite | HR pillar (Build 2) |
| Compensation banding changes | HR pillar |

# 5. Steel Sub-Segment Patterns

| Sub-segment | Typical depth | Typical span pattern |
|---|---|---|
| Integrated steel mill (multi-plant) | 4-5 levels | Plant Sr Mgr often 10-15 reports (60% prevalence) |
| Mini-mill | 3-4 levels | Wider spans due to flatter structure |
| Specialty / electrical | 4-5 levels | Similar to integrated |
| Conglomerate | 5-6 levels | Adds Group CPO + BU layer |

# 6. Confidence Indicators

| Confidence | When |
|---|---|
| **High** | reports_to ≥ 80% (post-Stage-6) + all 4 QRE answered |
| **Medium** | reports_to 70-80% OR some QRE gaps |
| **Low** | reports_to < 70% AND Q-OS-HS-01/02 unanswered — HS1/HS2 skipped |

(File abridged.)
