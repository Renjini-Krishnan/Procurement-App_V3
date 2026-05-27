# Session Context — Procvault

> **Purpose:** Brief a fresh Claude session so it can contribute productively from minute one. Read this first, then the files listed under "Read after this brief."

**Last updated:** 2026-05-27
**Branch:** `claude/busy-lamport-LDhro`

---

## 1. What this project is

**Procvault** is an AI-driven procurement maturity assessment app for consultants. The primary user is the consultant; certain sections are used by the end client. Build 1 covers the Procurement function for Steel industry. The app produces: Findings deck, Exec Summary, KPI Dashboard, Early Transformation Roadmap.

**Three principles that shape everything:**
1. **Grounded in benchmarks + uploaded data + client inputs** — no vague consulting-speak; everything traceable to a source
2. **Multi-industry, multi-function** — Procurement v1; Steel only (Cement deferred to Build 2)
3. **Maintainable by a non-technical functional consultant** — KB editable through a UI (Git-via-UI), not just code

---

## 2. Architecture (locked)

**3-layer model:**
- **L1 Code** — app source (Python / TypeScript) — developer-edited, redeploy
- **L2 Design** — UI components, screen flows — developer/designer-edited
- **L3 KB** — all MD + YAML content (analyses, benchmarks, prompts, recommendations) — **functional-consultant-editable via in-app KB Editor that commits to Git via PRs**

**KB cascade (function default → industry overlay → engagement override):**
- Engine reads all three layers, applies overrides, appends additions → effective value
- Citation in deliverables shows the winning layer + lower layers (audit transparency)

**Two-repo target:**
- `proc-app/` — app code + procurement function defaults
- `shared-kb/` — industry-specific + cross-functional + universal content

Currently both live as folders inside this single repo (`Procurement-App_V3`); split to separate repos planned at Build 2.

**Target hosting stack (Build 2+):**
- Cloud Run (app) + Cloud SQL for PostgreSQL with **pgvector** (engagement data + vectors) + Cloud Storage (uploads/outputs) + Vertex AI Gemini (LLM) + GitHub + Cloud Build (CI/CD) + Identity Platform (auth) + Secret Manager

**NOTE:** App code does NOT exist yet. Only KB has been authored.

---

## 3. 30-stage workflow (key gates only)

| Stage | Name | Purpose |
|---|---|---|
| 1-3 | Client / Scope / Guidelines | Engagement setup |
| 4 | Data Upload | Client uploads PO, Org Structure, contracts |
| 5 | AI Validation | AI parses + flags issues |
| **6** | **User Validation** | **Consultant validates AI interpretation. Critical — closes gaps (e.g., reports_to lifted from ~60% → ~78% post-Stage-6).** |
| 7-8 | Bronze / Gold Data | Cleansed → validated |
| **9** | **Category Classification** | **Reclassifies PO categories using industry taxonomy. Critical prerequisite for most pillar analyses (see `category_classification_required: true` gates in tracker).** |
| 10 | KPI Calculation | KPI computation with engagement overrides |
| 11 | Primer | Engagement primer (weights, cascade resolution) |
| 12+ | Pillar analyses | Op Model, Org Structure, Buying Channel, etc. |
| 28-30 | Findings / Exec Summary / KPI Dashboard | Output |

---

## 4. Pillar status (Build 1 = 7 pillars, Steel industry)

| # | Pillar | Status |
|---|---|---|
| 1 | Op Model | ✅ Complete (4 themes + cross-theme synthesis) |
| 2 | Org Structure | ✅ Complete (4 themes + synthesis) |
| 3 | Buying Channel | ⏳ Title only |
| 4 | PR-to-PO | ⏳ Title only |
| 5 | Post-PO | ⏳ Title only |
| 6 | Material Master | ⏳ Title only |
| 7 | Supplier | ⏳ Title only |

Build 2 pillars (out of scope now): DoA, Governance, Service Master Data, Contract Mgmt, Capability, Tech & Digital.

---

## 5. What's on disk in this repo right now

49 KB files were planned; **46 are committed**:

- **Foundation** (11/13): 4 universal standards, 2 of 4 references (`glossary.md`, `master-data/currencies.yml`; `sources-library.yml` and `units-of-measure.yml` deferred per V6 regeneration prompts), 4 of 5 procurement function-level files (tracker is in `.broken.yml` form)
- **Op Model pillar** (18/18): 13 function-default + 5 Steel overlay
- **Org Structure pillar** (18/18): 13 function-default + 5 Steel overlay

**Pending — see `PENDING.md` at repo root for the live tracker:**
- 3 foundation files (2 to regenerate, 1 broken tracker)
- 6 Steel industry-wide foundation files (referenced by every Steel overlay but never authored: `industry-context.md`, `value-chain.md`, `regulatory.md`, `categories-master.yml`, `glossary-industry.md`, `financial-snapshot.md`)
- 5 Build-1 pillars (Buying Channel onwards)
- Cross-cutting: `qre/qre-bank.yml`, `data-templates/`
- App code (everything)

---

## 6. Locked design decisions (do NOT change without explicit user consent)

- **Indian large-enterprise context** — ₹ Cr / lakh; Indian companies as references
- **Steel only for Build 1** — Cement deferred
- **Cascade order** — function default → industry overlay → engagement override
- **Cascade citation** shows winning layer + lower layers
- **Org Structure produces NO ₹ savings** — explicit boundary (FTE delta → ₹ touches HR territory)
- **DS and HS recommendations are directional only** — never "move 5 FTE from Plant J"
- **OP3 (Industry Typical Patterns) is descriptive, not prescriptive**
- **3-step role classification pipeline** + Stage 6 consultant validation — not bypassable
- **Feasibility lens** — every analysis has explicit skip-if-data-missing logic
- **Themes 2+3 of Org Structure are MERGED** into `fte-sizing-role-composition.md`
- **Op Model excludes Captive** — corporate strategy, not procurement function design
- **Worked example: ABC Steel** — 3-plant integrated steel producer, ₹5,000 Cr spend, 80 procurement FTE (40 Central + 14/13/13 across Jamshedpur/Kalinganagar/Vijayanagar). Use this consistently in any new pillar.
- **Component naming**: `<prefix><N>_<short-name>` (e.g. `c1_multi_plant_detection`, `ft2_role_composition`)
- **QRE naming**: `Q-<PILLAR-ABBR>-<THEME-ABBR>-<NUM>` (e.g. `Q-OM-SS-02`, `Q-OS-FT-05`)
- **Benchmark IDs**: `<pillar>.<theme>.<metric>` (e.g. `opmodel.centralisation.savings_rate`)

---

## 7. Standard MD file structure (every theme deep-dive)

```yaml
---
id: <kebab-case-id>
layer: universal | function | industry | engagement
function: procurement
pillar: <pillar-id>
theme: <theme-id>
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly | annual
status: active
---
```

Then sections in order:
1. Title (H1) — `# <Theme Name> Theme — Deep Dive`
2. Purpose
3. Logic Embodied (components table)
4. Inputs Used (data + feasibility)
5. Outputs Produced
6. How Used by App (which stage + tab)
7. Editable Configuration (`_editable_config` YAML block + risk levels)
8. Cross-References
9. Change History
10. Numbered sections:
   1. Pre-requisites
   2. Analytical Framework (components detailed)
   3. The Output (visual mockup of deliverable)
   4. Worked Example — ABC Steel
   5. Source Selection (cascade)
   6. Boundaries (out of scope)
   7. RCA Patterns Referenced
   8. Confidence Indicators

**Best exemplar to study:** `proc-app/kb/functions/procurement/op-model/centralization.md`
**Best feasibility-lens exemplar:** `proc-app/kb/functions/procurement/org-structure/fte-sizing-role-composition.md`

---

## 8. Working pattern (HONOUR THIS)

The user is a **functional procurement consultant with minimal technical knowledge**. They want functional clarity over technical depth.

### Critical preferences:
- **Part-by-part deliberation** — small chunks, propose → confirm → author. No "build large piece, present finished thing"
- **No fanciful ₹ savings** — defensible recommendations only. ₹ only where there's real engagement data + benchmark
- **Don't reference an Assessment App v2** — clean standalone build, no legacy carry-over
- **Practical feasibility focus** — what data CAN we get from real clients? Don't design analyses that need data clients rarely share
- **Indian large-enterprise default** — ₹ Cr, lakh, Indian companies

### Established interaction loop:
1. **Propose design** (components, data inputs, outputs)
2. **Ask 2-3 focused multiple-choice questions** for decisions (the user RESPONDS WELL to this — avoid open-ended questions when a concrete choice can be presented)
3. **User selects or refines**
4. **Author 5 files for the theme** (or chunk):
   - Theme deep-dive MD
   - Append entries to `<pillar>/benchmarks.yml`
   - Industry filter YAML (e.g., `industries/steel/.../<theme>-filters.yml`)
   - Append industry benchmark overrides
   - Append entries to `_meta/analysis-requirements-tracker.yml` (currently `.broken.yml`)
5. **Summarise** what was built + review checklist
6. **User confirms** before next theme

### Things NOT to do:
- ❌ Don't propose 6+ themes per pillar — keep 4-5
- ❌ Don't fabricate ₹ savings without engagement data + benchmark
- ❌ Don't assume data we don't have — apply feasibility lens
- ❌ Don't break the ABC Steel worked example consistency
- ❌ Don't author the actual app code unless asked — KB is the priority

---

## 9. Today's task — Stage 9: Category Re-classification

### What Stage 9 is
Per the 30-stage workflow, Stage 9 takes the cleansed Gold Data (from Stage 8) and **reclassifies PO categories using an industry taxonomy**. It's the gate for most pillar analyses — the tracker explicitly marks ~30 components as `category_classification_required: true`.

### Why Stage 9 matters
Client PO data arrives with **client-specific category labels** (often inconsistent, sometimes hierarchical, sometimes flat). Examples from Steel clients:
- One plant codes "Mill Rolls" as `MR-001`, another as `Spares-Rolling`
- Tail spend categories often labelled `Misc-Others`, `General-Stationery`, etc.
- Strategic categories like `Iron Ore` may sit under generic `Raw Materials`

Without re-classification to a canonical industry taxonomy, every downstream pillar would produce inconsistent results.

### What needs designing
The design conversation with the user should cover (propose 2-3 multi-choice questions per topic, don't open-end):

1. **The industry taxonomy itself** — structure of `shared-kb/industries/steel/categories-master.yml`
   - Hierarchy depth? (Steel typically: Top-level Direct/Indirect → 2nd-level commodity group → 3rd-level category)
   - Naming convention?
   - Coverage of Direct vs Indirect categories
   - Special handling for captive supply (iron ore, power)?

2. **The re-classification mechanism**
   - Rule-based first (client_label → canonical via map)?
   - AI fallback for unmapped categories?
   - Stage 6-style consultant review of mappings?
   - Confidence scoring per mapped row?

3. **The Stage 9 UI / consultant interaction**
   - What does the consultant see? A diff view (client label → AI-proposed canonical)?
   - Bulk-edit affordance?
   - "Approve and Proceed" gate before downstream pillars unlock?

4. **Data outputs**
   - New columns added to Gold Data? (e.g., `category_canonical`, `category_l1`, `category_l2`, `category_confidence`)
   - Audit trail (what mapped how, why)?

5. **Feasibility / failure modes**
   - What if a category is truly novel and not in taxonomy → add to taxonomy, or flag as "Unclassified"?
   - What if client uses sub-plant cost codes as "categories"?

### Boundaries
- This is **Stage 9 design only**. Do not design Stages 4-8 or 10+ in this conversation
- Stage 9 produces **canonical category labels**. It does NOT decide which categories are strategic / tail / centralisation-suitable — those decisions live in pillar themes' filter files (e.g., `op-model/centralisation-filters.yml`)
- The taxonomy file `categories-master.yml` is **THE output artefact** of this design work — design the taxonomy structure too, but the actual content authoring can happen in a follow-up chunk

### Output of this design session
1. `categories-master.yml` schema + initial Steel content (or schema + 10-20 example entries; full population in a follow-up)
2. Stage 9 design doc (probably as `proc-app/stages/stage-9-category-classification.md` or similar — discuss naming with user)
3. Updates to `_meta/analysis-requirements-tracker.broken.yml` reflecting Stage 9 as the dependency (it's already implicitly there via `category_classification_required: true`)

---

## 10. Read after this brief (in order, only what's needed)

1. **`PENDING.md`** (repo root) — current state of deferred work
2. **`proc-app/kb/functions/procurement/op-model/analysis-framework.md`** — pillar pattern
3. **`proc-app/kb/functions/procurement/op-model/centralization.md`** — best theme deep-dive exemplar
4. **`proc-app/kb/functions/procurement/org-structure/fte-sizing-role-composition.md`** — feasibility-lens exemplar
5. **`shared-kb/industries/steel/by-function/procurement/op-model/centralisation-filters.yml`** — example of how a theme's industry filter uses categories (this is where category taxonomy gets consumed)
6. **Skim `proc-app/kb/functions/procurement/_meta/analysis-requirements-tracker.broken.yml`** — search for `category_classification_required` to see all the analyses gated on Stage 9 (YAML is broken but the text is readable)

DO NOT read all 46 files — pick the ones above and use them as patterns.

---

## 11. Coordination with the parallel session

A second Claude session (the original one) is working in **parallel** in this same repo, on this same branch (`claude/busy-lamport-LDhro`).

That session is authoring **5 of 6 Steel industry-wide foundation files** (skipping `categories-master.yml` because YOU are designing it). The files it's working on:
- `shared-kb/industries/steel/industry-context.md`
- `shared-kb/industries/steel/value-chain.md`
- `shared-kb/industries/steel/regulatory.md`
- `shared-kb/industries/steel/glossary-industry.md`
- `shared-kb/industries/steel/financial-snapshot.md`

**Conflict avoidance:**
- Do NOT touch any of those 5 files
- DO own `shared-kb/industries/steel/categories-master.yml` (your output)
- Both sessions push to the same branch — pull before pushing to avoid merge conflicts
- If you see uncommitted changes in those 5 files, they're from the other session — leave them alone

---

## 12. First action for this fresh session

After reading this brief + the 6 files listed in §10:

1. Confirm understanding of the design space (1 paragraph back to the user)
2. Propose Stage 9 design framework — likely 4-5 components covering: (a) taxonomy structure, (b) mapping mechanism, (c) AI fallback, (d) consultant review UI, (e) audit/output
3. Ask 2-3 multiple-choice questions on the highest-stakes choices first
4. Wait for user confirmation before authoring any files

**Critical:** Do not produce `categories-master.yml` content in the first response. First decide the schema + structure with the user.

---

## End of brief
