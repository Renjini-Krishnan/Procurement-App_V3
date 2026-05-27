---
id: rca-conventions
layer: function
function: procurement
version: 1.0
updated: 2026-05-27
owner: kb-admin
---

# RCA (Root Cause Analysis) Conventions — Procurement Function

Defines HOW Root Cause Analysis is approached, output, and displayed for procurement findings. Conventions apply uniformly across all pillars + industries.

**Per-pillar RCA content** lives in each pillar's `rca-patterns.md` + `rca-rules.yml`.

---

## What RCA is

RCA = identifying the **underlying causes** of a finding, not just the symptoms.

- **Finding** = "Centralisation is 60% (gap to industry benchmark 82%)"
- **Root causes** (RCA output) = "Likely caused by: (1) M&A heritage; (2) Weak central mandate; (3) Plant autonomy culture"
- **Recommendation** = addresses the actual root cause, not just the symptom

---

## The 3-engine model — Code + Rules + AI

| Engine | What it does | When |
|---|---|---|
| **Code (deterministic)** | Computes data realities — variance, concentration, outliers, ratios | Always — first pass |
| **Rules (deterministic)** | Applies IF-THEN rules from `<pillar>/rca-rules.yml` | When data + QRE trigger conditions match |
| **AI (LLM synthesis)** | Synthesises narrative RCA from patterns in `<pillar>/rca-patterns.md` | When ambiguity exists, narrative needed |

**Default precedence:** Rules first (deterministic, defensible). AI fills gaps + adds narrative.

---

## RCA output format

```
┌──────────────────────────────────────────────────────────────┐
│ FINDING:                                                     │
│   <name of the finding>                                  │
│   <current value> vs <benchmark> (gap: <delta>)          │
│                                                              │
│ POTENTIAL ROOT CAUSES (ranked by confidence):            │
│                                                              │
│  1. <Root cause label>                                   │
│ Evidence: <what in client data + QRE supports this>  │
│ Source: <rule_id OR AI_synthesis>                        │
│ Confidence: <high | medium | low>                    │
│                                                              │
│  2. ... up to 5 root causes                              │
│                                                              │
│ [Edit / Override] [Add custom] [Approve & Proceed]       │
└──────────────────────────────────────────────────────────────┘
```

Consultant can edit, re-rank, add, or remove. Edits are logged.

---

## Confidence levels

| Level | When applied |
|---|---|
| **High** | Rule-matched (deterministic) AND multiple evidence points |
| **Medium** | Rule-matched single evidence, OR AI-synthesised with strong pattern support |
| **Low** | AI-synthesised weak signal, OR rule-matched with disputed evidence |

**Display rule:** Low-confidence root causes are visually de-emphasised and marked "directional — needs validation".

---

## RCA depth

Default: **3 root causes per finding**, ranked by confidence. Up to 5 for complex findings.

---

## When AI is used vs Rules-only

| Scenario | Approach |
|---|---|
| Pattern well-known + rule fires high confidence | Rules-only sufficient |
| Rule fires but narrative needed for client deliverable | Rules + AI synthesis |
| No pre-defined rule matches; novel pattern | AI synthesis primary |

**Default:** AI synthesises narrative on top of rule output for defensibility + readability.

---

## Evidence requirements per root cause

Every root cause must have **at least one evidence statement** linking it to client data or QRE.

| Evidence type | Examples |
|---|---|
| Data finding | "Plant supplier overlap < 50% across 5 plants" |
| KPI gap | "Spend per FTE = ₹8 Cr vs industry ₹15 Cr" |
| QRE response | "QRE Q-32 confirms plant CFOs approve PRs up to ₹50 lakh" |
| Pattern match | "Vendor list variance matches 'M&A heritage' archetype" |
| Cross-pillar correlation | "Org Structure indicates weak central CoE" |

A root cause without evidence is rejected.

---

## Cross-pillar RCA

Some findings have causes that span pillars. Cross-pillar root causes are tagged with pillars they span. Findings deck surfaces these as "Cross-cutting themes".

---

## Industry-overlay RCA

Industry-specific root causes override or supplement function-level RCA via the cascade. When an industry RCA pattern matches, it appears alongside function-level causes with the layer indicator.

---

## RCA in client deliverables

**Default:** Show only **high + medium** confidence root causes. Low-confidence flagged for consultant judgement.

Standard slide pattern per finding:
```
[Finding statement]
[Current state vs benchmark]
[Top 3 root causes — bulleted]
[Recommendation aligned to each root cause]
[Savings range]
[Sources cited at footer]
```

---

## Edit / override behaviour

Consultant can:
- Edit a root cause text
- Re-rank
- Remove
- Add custom (with own evidence)
- Mark as "high impact"

All edits logged with reason (mandatory for rule-fired cause removal).

---

## Recommendation linkage

Each root cause should have at least one matched recommendation from the library. Recommendation matching is via vector similarity over `recommendations.md` + root cause text.

---

## Quality checks (engine-side)

- Every root cause has at least one evidence statement
- Confidence level matches engine output
- Root causes are distinct (deduplicated)
- AI-cited sources exist in sources-library
- Industry-overlay cause references valid industry pattern_id

---

## Build 1 RCA inventory

Target: ~28 RCA files (14 function-level + 14 industry overlay).
