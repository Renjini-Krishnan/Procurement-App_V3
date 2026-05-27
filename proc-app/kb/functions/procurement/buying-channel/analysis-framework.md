---
id: buying-channel-analysis-framework
layer: function
function: procurement
pillar: buying-channel
version: 2.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Buying Channel Pillar — Analysis Framework

## Purpose

The Buying Channel pillar answers one operational question per material group:

**"Given the spend profile (frequency, value, archetype, supplier landscape), what is the right buying channel — and is the client currently using it?"**

For every reclassified category in the client's portfolio, the engine produces:
- A **recommended buying channel** (one of 6 — see §3)
- A **match-status flag** comparing current vs recommended channel
- A **migration priority** for the consultant's roadmap
- Flags for sole-source risk, cross-plant aggregation opportunities, and data-quality issues

The pillar is **operationally focused.** It does NOT quantify ₹ savings (those belong to Op Model and category-specific analyses). It DOES quantify TAT improvement, buyer-bandwidth freed, and contract coverage lift.

---

## 1. Why this pillar exists

For Indian large-enterprise procurement, the typical pattern is: ~25-45% of spend flows through contracted channels; the rest is spot / repeat-PO / single-tender. Channel mismatches surface in three places:

| Symptom | Root cause | Cost to the business |
|---|---|---|
| Recurring INDIRECT items raised as fresh POs every month | No catalogue / OLA programme | Buyer time per PO; 25-day cycle vs 1-day catalogue |
| BULK commodities bought spot-by-spot | No long-term contract; commodity exposure unhedged | Price volatility; vendor risk |
| Single-vendor critical DIRECT items with no alternate | No vendor development programme; sole-source dependency | Supply continuity risk; price leverage gone |
| 80+ vendors for routine MRO across plants | No vendor consolidation; channel discipline absent | Master-data bloat; payment fragmentation; no leverage |

The engine surfaces each of these systematically from PO data.

---

## 2. Scope — IN and OUT

**IN scope for Build 1:**
- PO-dump-based analysis (12-24 months of historical POs)
- PR dump for TAT computation (optional — TAT components skip if absent)
- All 6 channels (RC-LT, OLA, Catalogue/ROP, ASL, RFQ, Single-Tender/PAC)
- All 5 spend archetypes (BULK, DIRECT, INDIRECT, SERVICE, CAPEX) + UNCLASSIFIED fallback
- Per-archetype recommendation thresholds (configurable)
- Dual-view category presentation (original client codes + reclassified canonical categories)
- Cross-plant aggregation opportunity flagging
- Sole-source risk identification (single-vendor + concentrated + PAC-justified sub-signals)
- Cross-pillar handoffs to Supplier, Material Master, Op Model

**OUT of scope for Build 1:**
- ₹ savings quantification from channel migration (Op Model owns)
- Vendor performance / OTD / quality assessment (Supplier + Post-PO pillars)
- e-Auction setup or catalogue-platform technology recommendations (consulting deliverable, not engine-computable)
- Real-time PR routing (this is a diagnostic engine, not an operational P2P engine)
- Buyer-level performance assessment (Org Structure pillar)
- Contract negotiation strategy / commercial terms (Op Model CoE theme)

---

## 3. The 6 Buying Channels

| Channel | Description | Typical Archetype Fit | Benchmark TAT |
|---|---|---|---|
| **RC — Long-Term Contract (RC-LT)** | Multi-year volume agreement; index-linked pricing | BULK (commodity raw materials) | 3 days |
| **RC — Outline Agreement (OLA)** | Annual blanket order; pre-agreed terms; call-offs without fresh negotiation | INDIRECT (recurring MRO), SERVICE (recurring AMC) | 3 days |
| **RC — ROP / Catalogue** | Reorder-point system or internal catalogue; zero-touch ordering | INDIRECT (standard consumables) | 1 day |
| **ASL — Approved Supplier List** | Pre-qualified vendor pool; competitive among qualified suppliers | DIRECT (spec-sensitive engineered) | 25 days |
| **RFQ / Tendering** | Open or limited competitive bidding for each purchase event | SERVICE (project), CAPEX, UNCLASSIFIED | 70 days (45-90 band) |
| **Single-Tender / PAC** | Sole-source with documented justification (Proprietary / Approved / Credibility) | Any archetype with no viable alternate | Varies |

---

## 4. The 5 Spend Archetypes

Every material group is classified into one of five archetypes. The classification is owned by **Stage 9 (Category Classification)** — Buying Channel reads the archetype from `categories-master.yml`.

| Archetype | Defining characteristics | Examples |
|---|---|---|
| **BULK** | High-volume commodity raw materials; continuous demand; market-index pricing | Coal, Iron Ore, Limestone, Scrap, Industrial Gases, Pellets |
| **DIRECT** | Production-critical materials; technically specified; limited alternates | Refractories, Ferro Alloys, Work Rolls, Electrodes, Alloy additions |
| **INDIRECT** | MRO spares, consumables, utilities; recurring demand; wide supply market | Bearings, Pumps, Valves, PPE, Lubricants, Stationery |
| **SERVICE** | Labour, civil, maintenance, logistics, professional services | Contract Labour, Civil Works, AMC, Housekeeping, Transport |
| **CAPEX** | Capital investment; project-specific, non-recurring, high value | Power Plant equipment, Furnaces, Rolling Mills |

When Stage 9 cannot classify an MG (insufficient signal in client's raw data + Stage 9 keyword bank misses), the archetype is marked **UNCLASSIFIED**. These MGs route to RFQ by default and are surfaced as a Material Master data-quality finding.

---

## 5. Theme structure — single theme

Unlike Op Model and Org Structure which decompose into 4 strategic-lever themes, Buying Channel is fundamentally **one analytical engine** answering one question (right channel per MG) through 13 analyses. Forcing a 4-theme decomposition would split the analytical pipeline artificially.

**Pillar = 1 theme = 13 analyses.**

The theme is **Buying Channel Strategy** (`buying-channel-strategy.md`). It is decomposed into 13 analyses (BC1-BC13) using the standard 4-question framework:

| Question group | # analyses | What it computes |
|---|---|---|
| **Q1 — WHAT IS the channel state today?** (Baseline) | BC1-BC3 | Current channel mix; per-MG channel + profile; archetype × channel heat-map |
| **Q2 — WHERE COULD we route differently?** (Opportunity) | BC4-BC7 | Apply recommendation engine; surface misrouted MGs; migration targets; cross-plant aggregation opportunities |
| **Q3 — WHICH MGs won't move?** (Feasibility filter) | BC8-BC10 | Sole-source risk; project/one-off exemptions; UNCLASSIFIED MGs (cross-pillar finding) |
| **Q4 — HOW MUCH at stake?** (Quantification) | BC11-BC13 | TAT savings; buyer bandwidth freed; contract coverage lift estimate |

Full per-analysis specification (formulas, thresholds, edge cases, examples) is in `buying-channel-strategy.md`.

---

## 6. Pillar-wide design principles

### 6.1 No ₹ cost-out

Buying Channel does NOT produce ₹ savings figures. It produces TAT savings (days/year), buyer-bandwidth (FTE-equivalent freed), and contract-coverage lift (% points). Channel migration ₹ value is owned by Op Model (centralisation, SSC, CoE savings rates).

**Where this surfaces:**
- Theme outputs report process + cycle-time impact, not currency
- AI prompts (`prompts.md`) validate output for ₹ leakage — if a draft narrative claims "₹X Cr savings from catalogue migration", regenerate without the ₹ claim
- Recommendations (`recommendations.md`) are FTE / TAT / process-discipline framed

### 6.2 Stage 9 leverage (no archetype duplication)

Archetype classification is owned by Stage 9. Buying Channel reads it via:
```
For each MG → categories-master.yml[reclassified_category].archetype
```
For MGs marked UNCLASSIFIED by Stage 9, the engine falls back to a keyword bank (P0-P4 priority — see `analysis-config.yml`).

### 6.3 Dual-view categories — original + reclassified

Every per-MG output row carries BOTH the client's raw data AND the post-Stage-9 classification:

| Field | Source | Purpose |
|---|---|---|
| `original_mg_code` | Client PO dump | Client recognises their own data |
| `original_mg_desc` | Client PO dump | Familiar terminology |
| `reclassified_category` | Stage 9 → categories-master.yml | Canonical industry taxonomy (analytical key) |
| `archetype` | categories-master.yml | BULK / DIRECT / INDIRECT / SERVICE / CAPEX |
| `reclassification_confidence` | Stage 9 output | HIGH / MEDIUM / LOW / UNCLASSIFIED |
| (analysis outputs) | BC1-BC13 | Quant + qual analysis |

This applies to every PPT slide, dashboard table, drill-down, and export. The client should never see ONLY a canonical category they don't recognise.

### 6.4 Framework transparency (methodology explained BEFORE results)

The app surfaces the analytical methodology BEFORE the client-specific outputs. The lead-in is `framework-overview.md`:
- Why right buying channel matters
- The 6 channels we route to
- The 5 spend archetypes
- The decision matrix (archetype × frequency × value → channel)
- The 10 decision rules
- How we read the client's data (field-availability + derivation methods)

Consultants and clients see the engine logic FIRST so they understand why each MG got the recommendation it did. The KB content for this lead-in lives in `framework-overview.md`.

### 6.5 Per-archetype thresholds (not universal)

The engine uses **per-archetype value thresholds** rather than universal ones, reflecting real Indian large-enterprise PO distributions. Configurable defaults:

| Archetype | Threshold | Default |
|---|---|---|
| DIRECT | `high_value_direct_avg_po_inr` | ₹50,00,000 (₹50L) |
| INDIRECT | `low_value_indirect_avg_po_inr` | ₹50,000 |
| INDIRECT | `medium_value_indirect_avg_po_inr` | ₹5,00,000 (₹5L) |
| SERVICE | `high_value_service_avg_po_inr` | ₹5,00,000 (₹5L) |
| BULK | `bulk_full_ltc_threshold_total_spend_inr_cr` | ₹5 Cr/year (on total spend, not avg PO) |
| (universal) | `high_freq_po_count_6mo_threshold` | 5 (POs in any 6-month window) |
| (universal) | `strategic_attention_po_inr` | ₹1,00,00,000 (₹1 Cr — single-PO escalation flag) |

All in `analysis-config.yml` with `edit_risk` tags.

### 6.6 Feasibility honesty (skip-if-data-missing)

Analyses skip cleanly when input data is missing rather than producing dubious outputs:
- BC11 (TAT savings) skips if PR dump unavailable or PR-PO join < 70%
- BC8 (sole-source) downgrades confidence if PAC-flag column missing (falls back to vendor-count signal)
- BC10 (unclassified) surfaces % UNCLASSIFIED as a Material Master finding; doesn't try to "fix" it within Buying Channel

Skip-logic is documented per component in `analysis-config.yml`.

### 6.7 No pillar maturity rollup

Themes are scored individually 1-5 (see `scoring-descriptors.yml`). There is NO overall pillar maturity score — the pillar's value is in per-MG recommendations + migration roadmap, not a single rollup number. (This differs from Op Model and Org Structure, which DO produce rollup scores.)

---

## 7. Data dependencies

### Primary — PO dump

Mandatory fields:
- `PO_Number`, `PO_Item`, `PO_Creation_Date`
- `Material_Group`, `Material_Group_Desc`
- `Net_Value`, `Currency`
- `Vendor_ID`, `Vendor_Name`
- `Plant`

Strongly recommended (drives confidence):
- `Contract_Number` / `Outline_Agreement` / `Scheduling_Agreement` — for current channel derivation
- `Item_Category` (PSTYP) — Stage 9 archetype signal
- `Material_Type` (MTART) — Stage 9 archetype signal
- `Account_Assignment_Category` (KNTTP) — Stage 9 archetype signal
- `Short_Text` — Stage 9 keyword fallback + sole-source heuristics
- `Purchase_Group` — buyer-level analysis

Sometimes-present (lifts BC8 to HIGH confidence):
- `PAC_Flag` / `Single_Source_Flag`
- `Justification` / `Approval_Note` text

### Secondary — PR dump (for TAT computation)

- `PR_Number`, `PR_Item`, `PR_Creation_Date`, `PR_Release_Date`
- `PR_Total_Value`, `Plant`, `Material_Group`
- `Emergency_Flag`, `PAC_Flag`

If PR dump unavailable, BC11 (TAT impact) skips and the pillar narrative explicitly states "TAT impact not computed — PR dump required".

### Stage 9 output (HARD dependency for primary path)

- `reclassified_category` per PO line
- `categories-master.yml` with `archetype` field populated per canonical category

Without Stage 9 output, every MG falls to the UNCLASSIFIED fallback path (keyword bank P0-P4 priority logic in `analysis-config.yml`). Pillar still runs but confidence drops materially.

### QREs (14 total — see `qre/qre-bank.yml`)

Q-BC-01 through Q-BC-14 across 4 sections (Current Landscape / Contract Mgmt / PAC / Governance). Engine uses QREs for:
- Reconciliation with data findings (does client's perception match the data?)
- Confidence lift (QRE Q-BC-12 confirms PAC reasoning → BC8 confidence HIGH)
- Narrative context (AI prompts pull QRE responses for the report)

QREs don't gate analyses — every analysis runs with whatever PO+PR data is available; QRE adds qualitative colour.

---

## 8. Industry overlay structure

For each industry that the pillar serves:

```
shared-kb/industries/<industry>/by-function/procurement/buying-channel/
├── benchmarks.yml             — industry-specific channel mix + TAT overrides
├── archetype-overrides.yml    — industry-specific keyword banks + archetype hints
└── (rule-overrides.yml)       — industry-specific channel routing rules (Build 2 if needed)
```

Steel overlay (Build 1):
- `benchmarks.yml` — Steel typical channel mix (e.g., BULK 70-90% RC-LT vs cross-industry 60-80%)
- `archetype-overrides.yml` — Steel-specific BULK keywords (COKING COAL, IRON ORE, FERRO ALLOY...)

Industry overlays follow the cascade: **Engagement Override > Industry Overlay > Function Default**.

---

## 9. Outputs (what the pillar produces)

### MG-level table (the main analytical output)

One row per MG with these columns (full schema in `buying-channel-strategy.md` §3):

| Column | Source |
|---|---|
| original_mg_code, original_mg_desc | PO dump |
| reclassified_category, archetype, reclassification_confidence | Stage 9 |
| total_spend, spend_share_pct, po_count, distinct_months_6mo, avg_po_value, vendor_count | BC2 |
| current_channel, contracted_pct | BC2 |
| recommended_channel | BC4 |
| match_status (Already Right / Misrouted / Over-Engineered / Unrecoverable) | BC5 |
| migration_priority (HIGH / MEDIUM / LOW) | BC6 |
| flags (PAC / single-vendor / unclassified / cross-plant-aggregation) | BC7, BC8, BC10 |

### Portfolio rollups

- Channel mix today vs target (BC1, BC4 → BC6 aggregated)
- Match-status distribution (BC5 aggregated)
- TAT impact (BC11)
- Contract coverage lift estimate (BC13)
- Cross-plant aggregation opportunities (BC7)
- Sole-source risk register (BC8)

### Cross-pillar handoffs

| Handoff | Goes to | Used by |
|---|---|---|
| Single-vendor MGs (BC8) | Supplier pillar | Vendor concentration analysis |
| UNCLASSIFIED MGs (BC10) | Material Master pillar | MG description quality finding |
| Cross-plant aggregation opportunities (BC7) | Op Model — Centralisation theme | Validates centralisation opportunity from a complementary angle |

---

## 10. Files in this pillar

| File | Purpose |
|---|---|
| `analysis-framework.md` | (This file) Pillar overview, scope, design principles, dependencies |
| `framework-overview.md` | Consultant-facing methodology explainer (renders FIRST in the app) |
| `buying-channel-strategy.md` | Theme deep-dive: 13 analyses (BC1-BC13) with formulas + examples |
| `analysis-config.yml` | Engine config: thresholds, rules, channel definitions, archetype keyword banks |
| `benchmarks.yml` | Function-default channel mix benchmarks + TAT benchmarks |
| `scoring-descriptors.yml` | 1-5 maturity descriptors per theme (single theme) |
| `rca-rules.yml` | Deterministic IF-THEN RCA rules |
| `rca-patterns.md` | Narrative RCA patterns (AI side) |
| `recommendations.md` | Recommendation library (per finding) |
| `prompts.md` | LLM prompts the engine uses for AI-generated narrative |

Plus Steel overlay (`shared-kb/industries/steel/by-function/procurement/buying-channel/`):
- `benchmarks.yml`
- `archetype-overrides.yml`
