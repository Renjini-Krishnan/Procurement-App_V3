---
id: org-structure-analysis-framework
layer: function
function: procurement
pillar: org-structure
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
---

# Org Structure — Analysis Framework

## Pillar Purpose

The Org Structure pillar assesses **WHAT shape the procurement team takes** — specifically:
- **Where** procurement sits in the broader business org + reports to
- **How big** the team is for the spend it manages
- **What mix** of role types and specialist capabilities the team has
- **How** the team is distributed across central + plants/BUs
- **How** the team is layered (hierarchy depth + span of control)

Org Structure is distinct from Op Model:
- **Op Model** assesses the **architecture of buying responsibility** (which categories central vs plant, SSC, CoE, tail outsourcing)
- **Org Structure** assesses the **shape of the procurement team itself** (size, composition, distribution, hierarchy)

Both interact — Op Model SSC implementation reshapes transactional FTE distribution; Org Structure findings inform Op Model implementation feasibility.

**Pillar-wide boundaries:**
- **No ₹ cost-out savings produced** — Org Structure outputs structural verdicts + FTE-level recommendations only. Translating FTE delta to ₹ touches HR/transition territory and is intentionally out of scope. ₹ savings sit with Op Model.
- **Directional recommendations** — narrative on structural concerns + FTE re-balancing; not specific "remove role X" or "move N FTE from A to B" prescriptions.
- **Data feasibility honesty** — components skip when underlying data is missing rather than fabricate. The deliverable surfaces which components ran + which were skipped + why.

---

## Four Themes Within Org Structure

| # | Theme | What it answers | Deep-dive file |
|---|---|---|---|
| 1 | **Organisation Posture & Reporting** | Is procurement aligned with business posture? Is CPO reporting line right for the mandate? | `organisation-posture.md` |
| 2 | **FTE Sizing & Role Composition** | Right team size for spend? Right mix Cat Mgr/Trans/Specialist/Leadership? Specialists missing? | `fte-sizing-role-composition.md` |
| 3 | **Spend-FTE Distribution** | Is FTE allocation across entities aligned with spend? | `spend-fte-distribution.md` |
| 4 | **Hierarchy & Span** | Healthy spans of control + appropriate hierarchy depth? | `hierarchy-span.md` |

Four themes analysed sequentially at Stage 13. Theme 1 sets structural lens; Themes 2-4 fill in sizing, distribution, hierarchy detail. Cross-theme synthesis at end (see `cross-theme-synthesis.md`).

---

## Theme-Level Summary

### Theme 1 — Organisation Posture & Reporting
- **Question:** Where does procurement sit structurally?
- **Components:** OP0 Current State → OP1 Alignment → OP2 Reporting line diagnostic → OP3 Industry typical patterns → OP4 Reconciliation
- **Output:** Alignment verdict + reporting-line diagnostic + descriptive industry positioning
- **Feasibility:** All QRE-driven; reliable
- **Boundary:** No ₹ savings; no working-capital quantification; descriptive (not prescriptive) industry context

### Theme 2 — FTE Sizing & Role Composition (merged)
- **Question:** Right size? Right mix?
- **Components:** FT0 Current State (with intelligent role classification pipeline) → FT1 Spend/FTE → FT2 POs/FTE (overall + by-role conditional) → FT3 Composition mix (cascade) → FT4 Specialist roles audit → FT5 Reconciliation
- **Output:** Sizing verdict + FTE delta range + per-role productivity + composition verdict + missing-specialist-roles list
- **Feasibility:** Mixed — FT1 reliable; FT2-by-role often skipped (generic buyer_id); FT3 cascade (data primary, QRE fallback); FT4 dual-source resilience
- **Boundary:** FTE counts only — no ₹ cost-out savings

### Theme 3 — Spend-FTE Distribution
- **Question:** Is FTE allocation aligned with spend distribution?
- **Components:** DS0 Current State → DS1 B/W Mapping → DS2 Per-Entity Productivity → DS3 Reconciliation
- **Output:** B/W mapping matrix + per-entity productivity verdict + directional re-allocation guidance
- **Feasibility:** Reliable at plant level; Central-vs-Plant attribution opportunistic (~35% feasibility in Indian Steel SAP)
- **Boundary:** Directional only — no specific FTE-count moves; no ₹ cost-out

### Theme 4 — Hierarchy & Span
- **Question:** Healthy spans + appropriate depth?
- **Components:** HS0 Current State (incl. JD/R&R qualitative bullet) → HS1 Span of Control → HS2 Hierarchy Depth → HS3 Reconciliation
- **Output:** Per-manager span verdict + hierarchy depth verdict + directional structural recommendations
- **Feasibility:** Semi-reliable — needs `reports_to` ≥ 70% populated (typical ~60% raw, ~78% post-Stage-6)
- **Boundary:** Directional only; R&R/JD captured qualitatively (no standalone audit component)

---

## Cross-Theme Synthesis (See `cross-theme-synthesis.md`)

After all four themes complete, engine produces:
1. **Per-theme decision summary** — one row per theme with verdict + key finding
2. **Strategic Imperative patterns** — cross-theme storylines
3. **Roll-up recommendations** — FTE-level + structural recommendations consolidated

---

## Op Model — Org Structure Crosswalk

These two pillars interact in well-defined ways. Each respects the other's scope:

| Op Model finding | Org Structure implication |
|---|---|
| SSC implementation recommended | Theme 2 FT2 (transactional productivity gap) + Theme 3 DS1 (plant FTE over-allocation) inform SSC scope rationale |
| Centralisation gap | Theme 1 alignment verdict interprets the gap; Theme 3 informs which entities currently hold central spend |
| CoE establishment | Theme 2 FT4 (Specialist gaps — analytics, SRM, FBP, market intel) clarifies CoE FTE requirements |
| Tail outsourcing | Theme 2 FT2 (transactional volume) interpretation; Theme 4 span (transactional team layers) |

**Key principle:** ₹ savings always sit with Op Model. Org Structure produces structural recommendations that EXECUTE operating-model intent.

---

## Org Structure Maturity Score (1-5)

Pillar maturity = weighted average of theme scores:
```
org_structure_score = 0.20 × posture_reporting_score
                + 0.35 × fte_sizing_role_composition_score
                + 0.20 × spend_fte_distribution_score
                + 0.25 × hierarchy_span_score
```

Weight rationale:
- **Theme 2 (0.35)** — most actionable + comprehensive; productivity + role mix + specialist gaps
- **Theme 4 (0.25)** — structural shape + management depth
- **Themes 1 + 3 (0.20 each)** — foundational structural signals

Weights tunable at Stage 11 (Engagement Primer). Theme scores defined in `scoring-descriptors.yml`.

---

## Output Per Engagement (Stage 13)

For each Org Structure engagement run, consultant gets:
1. **4 theme findings cards** — verdict per theme + confidence per component
2. **Specific actionable items** — missing specialist roles (Theme 2), stretched managers (Theme 4), under-productive entities (Theme 3), mandate-misalignment (Theme 1)
3. **Strategic Imperative narrative** — cross-theme storyline
4. **Maturity score** 1-5 with descriptors
5. **Drill-down** to Org excel rows + role classification confidence + reports_to coverage
6. **RCA per finding** (rules + AI narrative)
7. **Industry positioning** — sub-segment context per Theme 1 OP3
8. **Cross-link to Op Model** where relevant

All editable by consultant via HITL pattern.

---

## Data Dependencies — Critical Reminder

| Critical input | Why critical |
|---|---|
| Org Structure / Employee Master | Foundation for Themes 2-4. Without this, only Theme 1 (QRE-only) runs |
| `role_title` / `job_title` | Required for intelligent classification → enables FT2-by-role, FT3, FT4, HS1 |
| `entity` / `location` per FTE | Theme 3 distribution analysis |
| `reports_to` (manager) | Theme 4 hierarchy + span (~60% raw → ~78% post-Stage-6) |
| PO data | Themes 2 (POs/FTE) + 3 (spend per entity) |
| QRE responses | Themes 1 (entirely) + Themes 2-4 reconciliations + R&R signals |

If any critical input is missing, affected components are SKIPPED — not fabricated. Deliverable surfaces what ran + what didn't + why.

---

## Required Companion Files

| File | What it provides |
|---|---|
| `org-structure/benchmarks.yml` | Function-default benchmark values |
| `org-structure/analysis-config.yml` | Theme components + benchmark wiring + scoring weights |
| `org-structure/scoring-descriptors.yml` | 1-5 maturity descriptors per theme |
| `org-structure/cross-theme-synthesis.md` | Pillar-level synthesis logic |
| `org-structure/prompts.md` | AI prompts |
| `org-structure/recommendations.md` | Recommendation library |
| `org-structure/rca-patterns.md` | Narrative RCA patterns |
| `org-structure/rca-rules.yml` | Deterministic RCA rules |
| Industry overlays in `shared-kb/industries/<industry>/by-function/procurement/org-structure/` | Industry-specific patterns + benchmarks |

---

## Confidence Indicators

Pillar confidence = MIN(theme confidences) — driven by data availability + role classification confidence + reports_to coverage.

| Confidence | Typical drivers |
|---|---|
| **High** | All themes run + good data coverage + industry overlay loaded |
| **Medium** | One or two themes have skipped components |
| **Low** | Multiple components skipped; mostly QRE-driven; verdicts directional only |

---

## Versioning Notes
- v1.0 — Initial framework (2026-05-27). 4 themes. Feasibility lens applied. No ₹ cost-out boundary pillar-wide.
