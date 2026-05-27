---
id: hitl-rules
layer: universal
applies_to: all-functions-all-industries
version: 1.0
updated: 2026-05-27
owner: kb-admin
---

# Human-In-The-Loop (HITL) Rules — Universal Standard

## What HITL is + why it exists

HITL = a point in the workflow where the app **pauses** for the consultant to:
1. **Review** the evidence the system has gathered or produced
2. **Edit** the output if needed (correct AI mistakes, override defaults, add context)
3. **Approve & Proceed** — explicitly confirm before the engagement continues

Every HITL checkpoint is **logged in the audit trail** with: who approved, when, what was approved, any edits made, any reason given.

**Why HITL is non-negotiable:**
- Procurement assessments inform real client decisions worth crores — every analytical claim must have a human-validated foundation
- AI can mis-classify, mis-categorise, or hallucinate — consultant judgement is the final filter
- Clients challenge findings; the audit log shows that every step had explicit consultant sign-off
- Reviewers (partners) need a clear chain of accountability per engagement

## When HITL checkpoints appear

A HITL checkpoint is **required** when ALL of the following are true:

1. **Output of the step is referenced downstream** — a wrong output here propagates errors
2. **AI or computation has surfaced a result** that involves judgement, classification, or interpretation
3. **The result is not trivially obvious** — there's something a consultant should look at

HITL is **NOT required** for purely mechanical steps with no judgement.

## Stage-by-stage HITL catalog (Build 1)

| Stage | HITL? | What the consultant approves |
|---|---|---|
| 1 — Client / Industry | **Yes** | Industry pack load is correct; financial snapshot is the right entity / period |
| 2 — Scope | **Yes** | Selected pillars match engagement scope |
| 3 — Guidelines | No | Information-only |
| 4 — Data Upload | No | File upload itself mechanical |
| 5 — AI Data Validation | No | Read-only assessment |
| 6 — User Validation (Column Mapping) | **Yes** | Column-to-field mappings AI proposed |
| 7 — Bronze Data Set | **Yes** | Bronze cleaning decisions |
| 8 — Gold Data Set | **Yes** | Functional flag results; spend reconciliation |
| 9 — Category Classification | **Yes** | New category taxonomy mapping per source category |
| 10 — KPI Calculation | **Yes** | Computed KPI values + engagement-level overrides |
| 11 — Primer | **Yes** | Scoring framework + pillar weight choices |
| 12-22 — Each Analyze pillar | **Yes** | Findings + recommendations + savings ranges |
| 26-28 — Outputs | **Yes** | Final outputs before they go to Export Center |

## Standard checkpoint UI pattern

| UI element | Behaviour |
|---|---|
| **Evidence panel** | Shows what the system produced + sources/grounding. Drill-down to underlying data. |
| **Edit affordances** | Inline edit, dropdown overrides, value editors |
| **Reason field** | Free-text where consultant captures why an edit was made. Mandatory for high-risk overrides. |
| **"Approve & Proceed" button** | Primary action. Disabled until all required validations pass. |
| **"Save Draft, Decide Later"** | Secondary action. |
| **"Request Review" button** | Routes to peer or partner |

## Approval audit — what's captured per HITL event

| Field | Example |
|---|---|
| `event_type` | `hitl_approval` |
| `engagement_id` | E001 |
| `stage` | stage-12 (Op Model) |
| `consultant_id` | renjini.krishnan |
| `timestamp` | 2026-05-27T14:33:12Z |
| `approved_object` | finding-op-model-centralisation, etc. |
| `edits_made` | JSONB list of fields edited |
| `reason` | "Adjusted centralisation benchmark to 75% — client is single-plant" |
| `time_on_stage_seconds` | 1812 |

## High-risk overrides require mandatory reason

| Override type | Why mandatory reason |
|---|---|
| Engagement-level benchmark override (Layer 4 cascade) | Cascade visibility; future audit |
| Scoring weight change at Stage 11 Primer | Affects all downstream maturity scores |
| Outlier-method change at Stage 10 KPI Config | Affects all computed KPIs |
| Re-classification of >5% of source categories at Stage 9 | Materially changes category mapping |
| Override of AI-flagged duplicate | Forces conscious decision |
| Editing a finding's savings range by > ±30% from AI-computed | Material change to client deliverable |

## Skip rules — when HITL can be auto-passed

A HITL checkpoint can be **auto-approved** only if ALL of:

1. The system has **high confidence** in its output (≥ 0.85 default)
2. **No anomalies flagged**
3. The consultant has explicitly enabled "Auto-proceed on high confidence"
4. The stage is NOT in the mandatory-HITL list

**Default: auto-approve is OFF.**

## Bypass authority

| Action | Who can authorise |
|---|---|
| Auto-approve a single non-mandatory checkpoint | Consultant themselves (logged) |
| Bypass a mandatory-HITL checkpoint | Engagement Lead or Partner role |
| Bulk auto-approve multiple stages | Partner only |

## Universal rules

| Rule | Statement |
|---|---|
| R1 | Every analytical claim shown to a client must trace back through a HITL approval log |
| R2 | Auto-approvals must be visually distinguishable from manual approvals |
| R3 | The `reason` field is the consultant's voice — it appears in the deliverable citation chain |
| R4 | HITL checkpoints must not delay > 7 days |
| R5 | A consultant may not approve their own bypass of a mandatory checkpoint |
| R6 | Output stages (Findings, Exec Summary, Dashboard) require explicit HITL — no auto-approve permitted |
