# KB-PART-4 — DoA Pillar (Delegation of Authority)

## Purpose

This bundle contains the **DoA Pillar** KB files for the Procurement Functional Assessment App. The pillar covers governance / compliance / control on the procurement approval matrix — what's in the DoA, how robust it is, how it plays out in PO data, system enforcement maturity, and prescriptive bucket optimisation.

DoA is a **governance pillar — no ₹ cost-out savings**. Outputs are maturity scores + structural recommendations + breach diagnostics.

## How to extract files from this bundle

1. Save this file locally
2. Save the Python extractor script (at end of file) as `extract_kb.py`
3. Run: `python extract_kb.py KB-PART-4-DOA.md <output_root>`
4. The extractor reads each `**FILE: <path>**` marker, parses the YAML/Markdown content between code fences, and recreates the folder structure at `<output_root>`.

## Pillar design summary

**5 themes mapping 1:1 to the user's 5 requirements:**

| # | Theme | Maps to user item |
|---|---|---|
| 1 | DoA Document Audit + PO Coverage Cross-Check | "Analyse DoA documents" |
| 2 | DoA Robustness vs Reference | "Robustness audit, all cases, non-ambiguity" |
| 3 | DoA-vs-PO Compliance & Distribution | "PO data analysis — 70% rule, caps, distribution" |
| 4 | DoA System Enforcement Maturity [QRE-only] | "System-driven check" |
| 5 | DoA Bucket Optimisation | "Suggest improvements to buckets" |

**Unique foundation asset:** `reference-doa-template.yml` — Best-Practice Indian DoA that Theme 2 reads against.

**File count target:** ~21 files (16 function-default + 5 Steel overlay).

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/doa/analysis-framework.md`**
Type: DoA — Pillar overview (5 themes, weights, scope boundary, scoring)
==================================================================

```markdown
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
```

END OF FILE 1. (doa/analysis-framework.md)

---

==================================================================
**FILE: `proc-app/kb/functions/procurement/doa/reference-doa-template.yml`**
Type: DoA — Best-Practice Indian DoA reference template (Theme 2 + Theme 5 read against this)
==================================================================

```yaml
# =============================================================================
# Reference DoA Template — Best-Practice Indian Procurement Delegation of Authority
# =============================================================================
# Purpose: Defines the Best-Practice DoA structure that Theme 2 (Robustness vs
#          Reference) reads against. Covers tier structure, mandatory cases,
#          Indian regulatory anchors, and robustness clauses.
#
# Logic Embodied: When client DoA is parsed at Stage 14 D1, the engine compares
#                 it against this reference to identify gaps (missing cases,
#                 absent clauses, weak edge case provisions).
#
# Inputs Used: None (this IS source content).
# Outputs Produced: Reference structure consumed by Theme 2 (R0 component) +
#                   Theme 5 T5/T6 (role assignment + special case provisions).
# How Used by App: Stage 14 — Theme 2 + Theme 5 reference baseline.
# Cross-References:
#   - doa/doa-robustness-vs-reference.md (consumes this file)
#   - doa/doa-bucket-optimisation.md (T5 + T6 reference this)
#   - Industry overlays in shared-kb/industries/<ind>/.../doa/ (may extend/adjust)
# =============================================================================

metadata:
  id: reference-doa-template
  layer: function
  function: procurement
  pillar: doa
  version: 1.0
  last_updated: 2026-05-28
  owner: kb-admin
  review_cadence: annual
  status: active
  authored_for_context: "Indian large-enterprise procurement, multi-plant / multi-BU operations"
  notes: |
    This is a normative reference template — what a robust DoA SHOULD look like
    for Indian large-enterprise procurement. It is intentionally comprehensive;
    individual client DoAs may legitimately omit cases that don't apply to their
    context (e.g., a single-plant mini-mill may not need M&A handover clauses).
    The Theme 2 engine surfaces gaps for consultant judgement, not automatic
    failures.

# =============================================================================
# 1. STANDARD TIER STRUCTURE
# =============================================================================
# Default 5-tier structure for Indian large-enterprise procurement.
# Industry overlays may adjust (mini-mills 3-4 tiers; conglomerates 5-6).
# Capex thresholds higher than opex by convention.
# =============================================================================

standard_tier_structure:
  default_tier_count: 5
  rationale: |
    5 tiers is the Indian large-enterprise norm — covers Officer → Asst Mgr →
    Sr Mgr/DGM → CPO/CFO → CEO/Board. Provides clear escalation without
    bureaucratic over-layering. Aligned with World Steel Association + APQC
    cross-industry observations.

  tiers:
    - tier: 1
      label: "Buyer / Sr Officer"
      typical_roles: ["Buyer", "Sr Officer", "Procurement Executive"]
      opex_threshold_inr:
        from: 0
        to: 200000   # ₹2 lakh
      capex_threshold_inr:
        from: 0
        to: 500000   # ₹5 lakh
      special_provisions: |
        - Catalog purchases without further approval if pre-approved vendor
        - P-card purchases up to tier limit
      notes: |
        First-line execution tier. Typically handles routine MRO + consumables.
        For services, lower thresholds applied (often 50% of opex).

    - tier: 2
      label: "Asst Mgr / Mgr"
      typical_roles: ["Asst Manager", "Manager", "Buyer Lead"]
      opex_threshold_inr:
        from: 200001
        to: 2000000   # ₹2 lakh - ₹20 lakh
      capex_threshold_inr:
        from: 500001
        to: 5000000   # ₹5 lakh - ₹50 lakh
      special_provisions: |
        - Spot buy authorisation
        - Vendor onboarding for catalog (under threshold)
      notes: |
        Tactical buying tier. Multi-quote evaluation required above ₹5 lakh.

    - tier: 3
      label: "Sr Mgr / DGM"
      typical_roles: ["Sr Manager", "Deputy General Manager", "AGM", "Category Lead"]
      opex_threshold_inr:
        from: 2000001
        to: 20000000   # ₹20 lakh - ₹2 Cr
      capex_threshold_inr:
        from: 5000001
        to: 50000000   # ₹50 lakh - ₹5 Cr
      special_provisions: |
        - Category strategy sign-off
        - Vendor consolidation decisions
        - Local PAC justification (with technical Head)
      notes: |
        Strategic execution tier. Category-level decision authority.
        Negotiation cap typically sits here.

    - tier: 4
      label: "CPO / CFO"
      typical_roles: ["Chief Procurement Officer", "Chief Financial Officer", "VP Procurement"]
      opex_threshold_inr:
        from: 20000001
        to: 500000000   # ₹2 Cr - ₹50 Cr
      capex_threshold_inr:
        from: 50000001
        to: 1000000000   # ₹5 Cr - ₹100 Cr
      special_provisions: |
        - Strategic supplier contracts
        - Multi-year framework agreements
        - Capex AFE approval (within tier)
        - FX above ₹X Cr equivalent requires CFO joint approval
      notes: |
        Executive tier. Joint CPO + CFO approval often required for capex.

    - tier: 5
      label: "CEO / Board"
      typical_roles: ["Chief Executive Officer", "Managing Director", "Board"]
      opex_threshold_inr:
        from: 500000001   # > ₹50 Cr
        to: null
      capex_threshold_inr:
        from: 1000000001   # > ₹100 Cr
        to: null   # Board approval typically required > ₹200 Cr for listed cos
      special_provisions: |
        - Board approval mandatory for capex > ₹200 Cr (listed cos, per SEBI)
        - Material contract disclosure (SEBI Listing Obligations)
        - Strategic acquisitions / divestments
      notes: |
        Top tier. Board involvement above defined material thresholds per
        Companies Act 2013 + SEBI Listing Obligations.

# =============================================================================
# 2. MANDATORY CASES COVERED
# =============================================================================
# Cases the reference DoA addresses explicitly. Theme 2 R1 component checks
# whether client DoA covers each. Gaps flagged for consultant.
# =============================================================================

mandatory_cases:

  - case_id: direct_materials
    label: "Direct Materials Procurement"
    description: "Repeating raw material POs (e.g., iron ore, coking coal for Steel; limestone for Cement)"
    typical_rule: |
      Standard tier thresholds apply. Tier 3+ for spot purchases above ₹50 lakh.
      Long-term offtake contracts → Tier 4 minimum.
    indian_context_notes: |
      Captive supply (mines / power) typically pre-approved at Board level
      separately; ongoing offtake handled per tier.
    edit_risk: low

  - case_id: indirect_materials
    label: "Indirect Materials Procurement"
    description: "MRO consumables, plant maintenance, packaging, IT peripherals"
    typical_rule: |
      Standard tier thresholds apply. Tail spend (typically Tier 1-2) often
      under catalog / P-card discipline.
    edit_risk: low

  - case_id: services
    label: "Services Procurement"
    description: "Professional services, contract labour, consulting, AMCs"
    typical_rule: |
      Often SEPARATE tier thresholds (typically 50-80% of opex thresholds)
      due to harder-to-validate scope. Statement of Work + SoW sign-off
      requirement.
    indian_context_notes: |
      Services contracts often require SAC (Service Accounting Code) tagging
      + TDS deduction. Multi-year service contracts require Tier 4 minimum.
    edit_risk: medium

  - case_id: capex
    label: "Capital Expenditure"
    description: "Plant expansion, new equipment, ASU, captive power"
    typical_rule: |
      Higher thresholds than opex. NFA (Note for Approval) required at all
      tiers. AFE-linkage mandatory. Board approval > ₹200 Cr (listed cos).
    indian_context_notes: |
      Capex typically requires:
      - NFA with technical justification
      - Tendering compliance (CVC guidelines for PSUs)
      - Board approval above material threshold (SEBI Listing Obligations)
      - Capitalisation date sign-off (Income Tax linkage)
    edit_risk: high

  - case_id: opex
    label: "Operating Expenditure"
    description: "Recurring operational spend — utilities, services AMCs, supplies"
    typical_rule: |
      Standard tier thresholds. Annual budget reference often required at
      Tier 3+.
    edit_risk: low

  - case_id: emergency_procurement
    label: "Emergency Procurement"
    description: "Plant breakdown spares, urgent operational continuity needs"
    typical_rule: |
      Senior-most AVAILABLE approver may approve, with post-facto
      regularisation within 7-14 days. Documentation required:
      - Emergency justification (signed by Plant Head)
      - Normal-channel-bypass reason
      - Vendor selection rationale (1-2 quotes acceptable vs normal 3)
    indian_context_notes: |
      Emergency POs are a common audit finding source. Robust DoAs cap
      emergency POs at 5% of total PO count + require monthly review by CPO.
    edit_risk: medium

  - case_id: pac_proprietary_article_certificate
    label: "Proprietary Article Certificate (PAC)"
    description: "Single-source procurement justified by proprietary technical specs"
    typical_rule: |
      Joint approval required:
      - Technical Head (justifies proprietary specification)
      - Procurement Head / CPO (justifies single-source procurement)
      - Business sponsor (justifies need)
      PAC validity typically 12-24 months; renewal requires re-justification.
    indian_context_notes: |
      PAC is uniquely Indian — frequently abused. Robust DoAs require:
      - PAC % cap (target < 10% of total PO value)
      - Annual PAC review by procurement governance committee
      - Public listing of PAC-approved vendors (transparency)
      - Specific justification language (not generic "technical compatibility")
    edit_risk: high

  - case_id: ma_handover_period
    label: "M&A Handover Period DoA"
    description: "Transitional DoA during post-acquisition integration"
    typical_rule: |
      Parent company DoA applies for X months post-acquisition (typically 6-12
      months). Transition committee (Parent CFO + Acquired CFO + integration
      lead) approves boundary cases.
    indian_context_notes: |
      Often missing in DoAs of acquisitive companies (Steel + Cement
      consolidation common in India). Surfaces as a gap when client has M&A
      history but no transitional provisions.
    edit_risk: medium

  - case_id: foreign_currency
    label: "Foreign Currency Procurement"
    description: "Imports, foreign services, FX-denominated contracts"
    typical_rule: |
      FX rate fixing at PO date (per RBI guidelines). CFO joint approval
      above ₹X Cr INR-equivalent (typically Tier 4 threshold in INR + 10%
      FX volatility buffer).
    indian_context_notes: |
      RBI/FEMA compliance required. Importer Exporter Code (IEC) check.
      Bank guarantee requirements for high-value imports.
    edit_risk: medium

  - case_id: multi_signature
    label: "Multi-Signature Requirements"
    description: "Two-approver requirements for high-risk or above-threshold categories"
    typical_rule: |
      Two-approver requirement triggered by:
      - Spend above ₹X Cr (typically Tier 4 threshold)
      - High-risk categories (financial services, legal, M&A advisory)
      - Single-source / PAC cases (joint technical + procurement)
      - Capex with environmental impact
    edit_risk: medium

  - case_id: substitute_approval
    label: "Substitute Approver Provisions"
    description: "Designated deputy when primary approver unavailable"
    typical_rule: |
      Documented delegation chain. Substitute approver must be:
      - At same or higher organisational tier
      - Pre-designated (not ad-hoc)
      - Activity logged in audit trail
    indian_context_notes: |
      Often missing — leads to delays during senior absence. Robust DoAs
      designate substitutes formally with HR record.
    edit_risk: low

# =============================================================================
# 3. INDIAN REGULATORY ANCHORS
# =============================================================================
# Regulatory frameworks the reference DoA aligns with. Theme 2 R3 checks
# whether client DoA references / complies with these.
# =============================================================================

regulatory_anchors:

  - anchor_id: companies_act_2013
    label: "Companies Act 2013"
    relevant_sections:
      - "Schedule V — managerial authority limits"
      - "Section 188 — related party transactions (RPT) approval"
      - "Section 197 — managerial remuneration"
    procurement_relevance: |
      Defines Board-level approval thresholds for material contracts.
      Related party transactions (e.g., captive intra-group procurement)
      require Board / shareholder approval above defined limits.

  - anchor_id: sebi_listing_obligations
    label: "SEBI Listing Obligations & Disclosure Requirements (LODR)"
    relevant_sections:
      - "Regulation 17 — Board composition + Audit Committee"
      - "Regulation 23 — Related Party Transactions"
      - "Regulation 30 — Material event disclosure"
    procurement_relevance: |
      Listed companies must disclose material procurement contracts (typically
      > 10% of turnover or > ₹100 Cr). RPT disclosure mandatory.

  - anchor_id: msme_act
    label: "Micro, Small & Medium Enterprises Development Act 2006"
    relevant_sections:
      - "Section 15 — payment within 45 days mandate"
      - "Section 16 — interest on delayed payment"
    procurement_relevance: |
      45-day payment to MSME vendors. DoA approval workflows must support
      timely payment release. TReDS platform discipline.

  - anchor_id: income_tax_act
    label: "Income Tax Act 1961"
    relevant_sections:
      - "Section 194Q — TDS on purchase of goods (> ₹50 lakh per vendor)"
      - "Section 206C(1H) — TCS on sale of goods"
      - "Various TDS sections — services, professional fees, contracts"
    procurement_relevance: |
      TDS / TCS compliance affects PO approval workflow. DoA should reference
      tax officer / CFO joint approval for above-threshold tax events.

  - anchor_id: gst_act
    label: "Central Goods & Services Tax Act 2017"
    relevant_sections:
      - "Input Tax Credit (ITC) compliance"
      - "HSN / SAC classification accuracy"
    procurement_relevance: |
      PO + Invoice GST compliance affects approval workflow.

  - anchor_id: cvc_guidelines
    label: "Central Vigilance Commission (CVC) Guidelines"
    relevant_sections:
      - "Tendering procedures"
      - "Single-tender justification"
    procurement_relevance: |
      Applies to PSU / government entities + private cos with significant
      government business. Tendering thresholds + transparency requirements.
    applies_to: ["psu", "government", "public_sector_partner"]

  - anchor_id: rbi_fema
    label: "RBI / FEMA Foreign Exchange Regulations"
    relevant_sections:
      - "Import/export FX compliance"
      - "External Commercial Borrowing (ECB) thresholds"
    procurement_relevance: |
      Foreign currency PO approvals must reference FX-fixing date + IEC
      compliance. ECB-funded capex requires RBI clearance.

# =============================================================================
# 4. ROBUSTNESS CLAUSES
# =============================================================================
# Quality clauses that distinguish a robust DoA from a basic one. Theme 2 R2
# (non-ambiguity) + R3 (edge cases) check these.
# =============================================================================

robustness_clauses:

  - clause_id: refresh_cadence
    label: "Refresh Cadence"
    typical_rule: |
      Minimum every 2 years; annual review for high-growth / multi-acquisition
      companies. Triggers for ad-hoc refresh:
      - M&A event
      - CEO / CPO / CFO change
      - Major organisational restructure
      - New regulatory requirement (e.g., BRSR, GST amendment)
    quality_indicator: "Last refresh date documented; cadence clause present"

  - clause_id: version_control
    label: "Version Control"
    typical_rule: |
      Versioning convention (e.g., DoA-v3.2-2026). Sign-off by Board / CEO
      on each version. Change log maintained. Distribution list documented.
    quality_indicator: "Version number + sign-off + change log present"

  - clause_id: escalation_path
    label: "Escalation Path for Boundary Cases"
    typical_rule: |
      Explicit rule for what happens at exactly-at-threshold cases (e.g., PO
      value = ₹2,00,000 — does Tier 1 or Tier 2 approve?). Convention:
      "less than or equal to" / "greater than or equal to" defined.
    quality_indicator: "Boundary case rule explicit"

  - clause_id: signoff_matrix_for_matrix_org
    label: "Sign-off Matrix for Matrix Organisations"
    typical_rule: |
      For BU + function matrix organisations: defines whether BU Head OR
      Function Head OR both required at each tier. Conflict resolution
      escalation path documented.
    quality_indicator: "Matrix org provisions explicit"
    applies_to: ["matrix_org", "multi_bu"]

  - clause_id: temporary_delegation
    label: "Temporary Delegation Provisions"
    typical_rule: |
      Beyond substitute-approval — covers planned leaves, training periods,
      sabbaticals. Maximum delegation period (typically 90 days). Documented
      delegation memo signed by primary + delegate + HR.
    quality_indicator: "Temporary delegation explicitly addressed"

  - clause_id: split_purchasing_anti_avoidance
    label: "Split-Purchasing Anti-Avoidance"
    typical_rule: |
      Explicit prohibition against splitting POs to circumvent higher tier
      approval. Detection rule: same vendor + same category + within X days
      + aggregate > Tier threshold = treated as single PO.
    quality_indicator: "Anti-avoidance clause present + detection rule documented"

  - clause_id: post_facto_approval_provisions
    label: "Post-Facto Approval Provisions"
    typical_rule: |
      Cases where post-facto approval is acceptable (emergency, system
      failure, time-bound regulatory requirement). Documentation + review
      cadence. Cap on post-facto approvals (typically < 2% of total PO count).
    quality_indicator: "Post-facto provisions bounded + monitored"

# =============================================================================
# 5. QUALITY INDICATORS — DoA Robustness Scoring
# =============================================================================
# Used by Theme 2 to score robustness 1-5. Each indicator maps to "present /
# partial / absent" → contributes to maturity score.
# =============================================================================

quality_indicators:

  - indicator_id: comprehensive_case_coverage
    weight: 0.20
    measure: |
      Of 11 mandatory cases above, how many are explicitly addressed in client DoA?
      9-11 cases = 5; 7-8 = 4; 5-6 = 3; 3-4 = 2; 0-2 = 1.

  - indicator_id: tier_structure_clarity
    weight: 0.15
    measure: |
      Clear tier-by-tier ₹ thresholds with no overlaps or gaps. Capex/opex
      distinction explicit. Roles per tier unambiguous.

  - indicator_id: refresh_recency
    weight: 0.10
    measure: |
      Time since last refresh: < 1 year = 5; 1-2 years = 4; 2-3 years = 3;
      3-4 years = 2; > 4 years = 1.

  - indicator_id: regulatory_alignment
    weight: 0.15
    measure: |
      References to Companies Act + SEBI + MSME + tax provisions. Anti-money
      laundering provisions if applicable.

  - indicator_id: robustness_clauses_present
    weight: 0.15
    measure: |
      Of 7 robustness clauses above, how many present? 6-7 = 5; 4-5 = 4;
      2-3 = 3; 1 = 2; 0 = 1.

  - indicator_id: ambiguity_score
    weight: 0.15
    measure: |
      Count of ambiguous clauses identified (overlapping thresholds, undefined
      roles, missing boundary rules). 0 = 5; 1-2 = 4; 3-5 = 3; 6-10 = 2;
      > 10 = 1.

  - indicator_id: edge_case_provisions
    weight: 0.10
    measure: |
      Emergency + PAC + M&A + FX + multi-signature + substitute approval —
      all addressed = 5; 5/6 = 4; 3-4 = 3; 1-2 = 2; 0 = 1.

# =============================================================================
# 6. EDITABLE CONFIGURATION
# =============================================================================
#
# Editing this reference template carries HIGH risk because it changes the
# baseline every Theme 2 + Theme 5 client comparison runs against.
#
# Per-section approval matrix:
#   standard_tier_structure: HIGH (partner) — changes default tier count + bands
#   mandatory_cases (add/remove): HIGH (partner)
#   mandatory_cases (edit typical_rule text): MEDIUM (peer KB lead)
#   regulatory_anchors (add/remove): HIGH (partner)
#   robustness_clauses (add/remove): HIGH (partner)
#   quality_indicators (weights): HIGH (partner)
#   indian_context_notes text: LOW (self)
#
# Annual review recommended. Update triggers:
#   - New Indian regulatory requirement (e.g., new SEBI mandate)
#   - Engagement feedback on missing edge cases
#   - Industry overlay surfaces persistent pattern worth adding to function default
# =============================================================================
```

END OF FILE 2. (doa/reference-doa-template.yml)

---

# TRACKING TABLE — DoA Files (continuously updated)

This bundle contains **2 of ~21 DoA files** inlined so far. More files will be added as the pillar is built out.

## DoA Pillar — Function Defaults (16 target — 2 INLINE / 14 PENDING)

| # | File Path | Status | Notes |
|---|---|---|---|
| 1 | `proc-app/kb/functions/procurement/doa/analysis-framework.md` | ✅ INLINE | File 1 above — Pillar overview, 5 themes, weights, scope boundary |
| 2 | `proc-app/kb/functions/procurement/doa/reference-doa-template.yml` | ✅ **INLINE** | **File 2 above** — Best-Practice Indian DoA (5 tiers + 11 mandatory cases + 7 regulatory anchors + 7 robustness clauses + 7 quality indicators) |
| 3 | `proc-app/kb/functions/procurement/doa/doa-document-audit.md` | PENDING | Theme 1 deep-dive |
| 4 | `proc-app/kb/functions/procurement/doa/doa-robustness-vs-reference.md` | PENDING | Theme 2 deep-dive |
| 5 | `proc-app/kb/functions/procurement/doa/doa-po-compliance-distribution.md` | PENDING | Theme 3 deep-dive |
| 6 | `proc-app/kb/functions/procurement/doa/doa-system-enforcement.md` | PENDING | Theme 4 deep-dive (QRE-only, lighter) |
| 7 | `proc-app/kb/functions/procurement/doa/doa-bucket-optimisation.md` | PENDING | Theme 5 deep-dive |
| 8 | `proc-app/kb/functions/procurement/doa/cross-theme-synthesis.md` | PENDING | 4-5 Strategic Imperative patterns |
| 9 | `proc-app/kb/functions/procurement/doa/analysis-config.yml` | PENDING | Engine config |
| 10 | `proc-app/kb/functions/procurement/doa/benchmarks.yml` | PENDING | Distribution + breach norms |
| 11 | `proc-app/kb/functions/procurement/doa/scoring-descriptors.yml` | PENDING | 1-5 descriptors per theme |
| 12 | `proc-app/kb/functions/procurement/doa/rca-rules.yml` | PENDING | ~20 deterministic RCA rules |
| 13 | `proc-app/kb/functions/procurement/doa/rca-patterns.md` | PENDING | ~18 narrative RCA patterns |
| 14 | `proc-app/kb/functions/procurement/doa/prompts.md` | PENDING | 5 AI prompts |
| 15 | `proc-app/kb/functions/procurement/doa/recommendations.md` | PENDING | ~20 recommendation cards |

## DoA Pillar — Steel Overlay (5 target — 0 INLINE / 5 PENDING)

| # | File Path | Status |
|---|---|---|
| 16 | `shared-kb/industries/steel/by-function/procurement/doa/benchmarks.yml` | PENDING |
| 17 | `shared-kb/industries/steel/by-function/procurement/doa/doa-document-audit-filters.yml` | PENDING |
| 18 | `shared-kb/industries/steel/by-function/procurement/doa/doa-robustness-filters.yml` | PENDING |
| 19 | `shared-kb/industries/steel/by-function/procurement/doa/doa-po-compliance-filters.yml` | PENDING |
| 20 | `shared-kb/industries/steel/by-function/procurement/doa/doa-bucket-optimisation-filters.yml` | PENDING |

**Bundle status: 2 INLINE / 18 PENDING in this Part 4.**

---

# Python Extraction Script (for colleague)

Save as `extract_kb.py` and run: `python extract_kb.py KB-PART-4-DOA.md <output_root>`

```python
#!/usr/bin/env python3
"""KB Bundle Extractor — reads markdown bundle file with FILE: delimiters and recreates folder structure."""
import os
import re
import sys

def extract(bundle_path, output_root="."):
    with open(bundle_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Match: **FILE: `path`** ... ```...```...END OF FILE
    pattern = r"\*\*FILE:\s*`([^`]+)`\*\*[\s\S]*?```(?:yaml|markdown|md|yml)?\n([\s\S]*?)\n```\s*\n\s*END OF FILE \d+"
    
    matches = re.findall(pattern, content)
    print(f"Found {len(matches)} files to extract.")
    
    for path, file_content in matches:
        full_path = os.path.join(output_root, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(file_content)
        print(f"Created: {full_path}")
    
    print(f"\nExtracted {len(matches)} files to {os.path.abspath(output_root)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_kb.py <bundle.md> [output_dir]")
        sys.exit(1)
    bundle = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else "."
    extract(bundle, output)
```

---

## End of KB-PART-4 Bundle (live — files added as authored)
