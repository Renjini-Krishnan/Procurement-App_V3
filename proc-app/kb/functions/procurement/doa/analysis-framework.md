---
id: doa-analysis-framework
layer: function
function: procurement
pillar: doa
version: 1.0
last_updated: 2026-05-28
owner: kb-admin
---

# DoA (Delegation of Authority) — Analysis Framework

## Pillar Purpose

The DoA pillar assesses the **maturity, robustness, and operational compliance** of the client's Delegation of Authority — both as a written policy AND as it actually plays out in PO approval data.

Specifically:
- **What's IN the DoA** — coverage of categories, tier structure, special clauses
- **How WELL it's designed** — robustness vs reference template, ambiguity, edge cases
- **Whether it's FOLLOWED** — PO data vs DoA matrix, breach patterns, distribution
- **Whether it's ENFORCED** — system-driven via ERP workflow vs paper-only
- **What it SHOULD be** — recommended bucket structure given spend distribution

DoA is fundamentally a **governance, control, and compliance** pillar — distinct from Op Model (architecture of buying responsibility) and Org Structure (shape of procurement team).

**Pillar boundaries:**
- **No ₹ cost-out savings** produced — outputs are governance maturity scores + structural recommendations + control gap diagnostics
- **Process efficiency gains** may be claimed (faster cycle time from cleaner thresholds) but not quantified in ₹
- **Risk mitigation** acknowledged but not ₹-quantified (matches CFO-conversation territory)
- **Indian regulatory context** woven throughout — Companies Act 2013, SEBI Listing Obligations, MSME Act, NFA conventions, PAC

---

## Five Themes Within DoA

| # | Theme | What it answers | Deep-dive file |
|---|---|---|---|
| 1 | **DoA Document Audit + PO Coverage Cross-Check** | What's in the DoA? Does it cover what's actually procured? | `doa-document-audit.md` |
| 2 | **DoA Robustness vs Reference** | Is the DoA structurally well-designed and unambiguous? | `doa-robustness-vs-reference.md` |
| 3 | **DoA-vs-PO Compliance & Distribution** | Does PO data show compliance? What's the spend distribution? | `doa-po-compliance-distribution.md` |
| 4 | **DoA System Enforcement Maturity** [QRE-only] | Is the DoA wired into ERP workflow or paper-only? | `doa-system-enforcement.md` |
| 5 | **DoA Bucket Optimisation** | What SHOULD the buckets be given client spend pattern? | `doa-bucket-optimisation.md` |

The five themes are analysed sequentially at Stage 14 (DoA). Themes 1-4 are diagnostic; Theme 5 is prescriptive (synthesises Themes 1-4 outputs + client spend distribution into specific bucket recommendations).

Cross-theme synthesis happens at the end (see `cross-theme-synthesis.md`).

---

## Theme-Level Summary

### Theme 1 — DoA Document Audit + PO Coverage Cross-Check
- **Question:** What's in the DoA? Does it cover what the client actually procures?
- **Components:** D0 Current state → D1 Document content extraction → D2 Role mapping → D3 DoA scope vs PO dump cross-check → D4 Refresh cadence → D5 Reconciliation
- **Output:** Coverage gap list + refresh-staleness verdict + role-mapping discrepancy list + maturity score
- **Feasibility:** D1 requires DoA document; D3 requires PO Gold data; D2 requires Org Structure data
- **Boundary:** No ₹ savings; output is structural verdict + gap list

### Theme 2 — DoA Robustness vs Reference
- **Question:** Is the DoA structurally well-designed, comprehensive, and unambiguous?
- **Components:** R0 Load reference template → R1 Coverage gap (cases checklist) → R2 Non-ambiguity check → R3 Edge case provisions → R4 Reconciliation
- **Output:** Robustness scorecard + ambiguity flag list + edge case gap list + maturity score
- **Feasibility:** R0-R3 require D1 output (parsed client DoA); R4 QRE-driven
- **Boundary:** Reference template is the function-default benchmark; industry overlays may adjust

### Theme 3 — DoA-vs-PO Compliance & Distribution
- **Question:** Does the PO data show the DoA being followed? What's the spend distribution across tiers?
- **Components:** C0 Current state → C1 Breach detection → C2 Distribution analysis → C3 Concentration / workload → C4 Tier-jumping → C5 Reconciliation
- **Output:** Breach % + breach value % + distribution chart + concentration alerts + top breaching approvers/plants/categories + tier-jump rate + maturity score
- **Feasibility:** Requires PO data with po_approver_id + po_approver_designation; if missing, theme runs at reduced confidence
- **Boundary:** No ₹ savings; control gap quantification only

### Theme 4 — DoA System Enforcement Maturity [QRE-ONLY]
- **Question:** Is the DoA wired into the ERP workflow, or only on paper?
- **Components:** E0 Current state → E1 System enforcement maturity → E2 Override patterns → E3 Audit trail discipline → E4 Reconciliation (cross-pillar with Theme 3)
- **Output:** System enforcement maturity score + override pattern flags + audit-trail completeness verdict
- **Feasibility:** Always runs (QRE-mandatory at Stage 3)
- **Boundary:** Purely qualitative; corroborated against Theme 3 data findings

### Theme 5 — DoA Bucket Optimisation
- **Question:** Given the spend pattern, what should the DoA buckets actually look like?
- **Components:** T0 Baseline → T1 Value distribution → T2 Volume distribution → T3 Optimal tier count → T4 Threshold ₹ per tier → T5 Role-assignment optimisation → T6 Special case provisions → T7 Refresh roadmap
- **Output:** Recommended tier count + recommended ₹ thresholds + role assignments + special case provisions + delta-vs-current report
- **Feasibility:** T1/T2/T3 require only po_value (always feasible if PO data exists); T5 requires Org Structure data
- **Boundary:** Prescriptive only — recommendations are directional bands, not specific implementation prescriptions

---

## Diagnostic → Prescriptive Flow

```
                          (always runs — QRE mandatory)
                         ┌───────────────────────────┐
                         │  T4 — System Enforcement  │
                         └───────────────────────────┘
                                       │
                                       │ (cross-pillar reconciliation)
                                       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐
│ T1 — Document│ →  │ T2 — Robust- │    │ T3 — PO Compliance + │
│   Audit + PO │    │  ness vs Ref │    │   Distribution       │
│   Coverage   │    │              │    │  (uses T1 output)    │
└──────────────┘    └──────────────┘    └──────────────────────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  T5 — Bucket Optimisation    │
              │  (prescriptive: combines     │
              │   findings + spend data)     │
              └──────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  Cross-Theme Synthesis       │
              │  Strategic Imperative        │
              └──────────────────────────────┘
```

---

## DoA Maturity Score (1-5)

Pillar maturity = weighted average of theme scores:

```
doa_score = 0.15 × document_audit_score
          + 0.25 × robustness_vs_reference_score
          + 0.30 × compliance_distribution_score
          + 0.15 × system_enforcement_score
          + 0.15 × bucket_optimisation_score
```

Weight rationale:
- **Theme 3 (0.30)** — heaviest weight; operational reality (PO data shows what actually happens)
- **Theme 2 (0.25)** — quality of policy design; high differentiator across clients
- **Theme 1, 4, 5 (0.15 each)** — foundational / maturity dimensions; equal weight

Weights tunable at Stage 11 (Engagement Primer). Theme scores defined in `scoring-descriptors.yml`.

---

## Output Per Engagement (Stage 14)

For each DoA engagement run, the consultant gets:

1. **5 theme findings cards** — verdict per theme + confidence per component
2. **Specific actionable items**:
   - Coverage gaps (Theme 1)
   - Ambiguity flags + missing reference cases (Theme 2)
   - Top breaching approvers / plants / categories (Theme 3)
   - Workflow uplift opportunities (Theme 4)
   - Recommended bucket structure with specific ₹ thresholds (Theme 5)
3. **Strategic Imperative narrative** — cross-theme storyline
4. **Maturity score 1-5** with band descriptors
5. **Drill-down** to specific PO records that breached + approver lists + category gaps
6. **RCA per finding** (rules + AI narrative)
7. **Cross-link to PR-to-PO** where PR approval workflow is affected
8. **Reference DoA delta report** — what's missing vs best-practice template

All editable by consultant via HITL pattern. Audit log captures approval + edit.

---

## Data Dependencies — Critical Reminder

| Critical input | Why critical |
|---|---|
| DoA document (PDF / Word / Excel) | Foundation for Themes 1, 2 — without this, only Theme 4 (QRE-only) + parts of Theme 5 (PO-data-only) run |
| PO Gold data with `po_value`, `po_approver_id`, `po_approver_designation`, `po_date` | Theme 3 requires all four; Theme 5 (T1/T2/T3) requires only po_value |
| Org Structure data | D2 (role mapping) + T5 (role-assignment optimisation) |
| QRE responses (Q-DOA-D, Q-DOA-R, Q-DOA-C, Q-DOA-SE) | Theme 4 entirely + reconciliations for Themes 1-3 |

**Feasibility honesty:** If DoA document not provided + PO approver data missing → pillar runs at QRE-only confidence + Theme 5 T1/T2/T3 still run on PO ₹ values. Deliverable explicitly flags what ran and what didn't.

---

## Required Companion Files

| File | What it provides |
|---|---|
| `doa/reference-doa-template.yml` | **Unique foundation asset** — Best-Practice Indian DoA template. Theme 2 + Theme 5 reference it |
| `doa/analysis-config.yml` | Engine config — themes, weights, components, skip logic, benchmark wiring |
| `doa/benchmarks.yml` | Distribution norms, breach rate norms, tier count norms |
| `doa/scoring-descriptors.yml` | 1-5 maturity descriptors per theme |
| `doa/cross-theme-synthesis.md` | 4-5 Strategic Imperative patterns |
| `doa/prompts.md` | 5 AI prompts |
| `doa/recommendations.md` | ~20 recommendation cards |
| `doa/rca-patterns.md` | ~18 narrative RCA patterns |
| `doa/rca-rules.yml` | ~20 deterministic RCA rules |
| Industry overlays in `shared-kb/industries/<industry>/by-function/procurement/doa/` | Industry-specific tier patterns + benchmarks + filters |

---

## Confidence Indicators

Pillar confidence = MIN(theme confidences) — driven by data availability + DoA document presence + PO approver data quality.

| Confidence | Typical drivers |
|---|---|
| **High** | DoA document provided + parsed; PO approver data complete; QRE complete; industry overlay loaded |
| **Medium** | One or two themes have skipped components; PO approver data partial OR DoA document partial |
| **Low** | DoA document absent OR PO approver data missing; mostly QRE-driven; pillar runs at directional confidence |

---

## Cross-Pillar Links

| Pillar | Linkage |
|---|---|
| **PR-to-PO** | DoA drives PR approval workflow. Theme 3 breach patterns inform PR-to-PO findings |
| **Op Model (Centralisation)** | If buying is decentralised, plant-level DoA may differ from corporate; surface inconsistency |
| **Org Structure** | DoA role mapping (D2) consumes Org Structure data; designations should align |
| **Future Compliance / Governance pillar (Build 2)** | DoA is foundational — deeper governance audit consumes DoA outputs |

---

## Versioning Notes

- v1.0 — Initial framework (2026-05-28). 5 themes. Feasibility lens applied. No ₹ cost-out boundary pillar-wide. Reference DoA template introduced as unique foundation asset.