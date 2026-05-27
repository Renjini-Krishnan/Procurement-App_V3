# Buying Channel — Analysis Framework

## 1. What this pillar assesses

The Buying Channel pillar evaluates **how spend flows from PR to PO** — i.e., the contracting + sourcing route chosen for each category of purchase. For each material group, it answers two questions:

1. **What channel is the client using today?** (Rate Contract, Outline Agreement, Catalogue, ASL, RFQ, Single Tender)
2. **What channel should they be using?** (Based on the archetype of the spend — BULK / DIRECT / INDIRECT / SERVICE / CAPEX)

The gap between current and recommended channels translates into quantifiable improvements in **cycle time (PR-to-PO TAT)**, **buyer bandwidth**, **process compliance**, and **sole-source risk reduction**.

This pillar is operationally focused. It does NOT quantify ₹ savings (those are owned by Op Model + Category-specific analyses). It DOES produce a directional process-improvement roadmap.

---

## 2. The Six Buying Channels

| Channel | Description | Applicable Archetype | Benchmark TAT |
|---|---|---|---|
| **RC — Long-Term Contract** | Multi-year volume agreement with index-linked pricing | BULK | 1–3 days |
| **RC — Outline Agreement (OLA)** | Annual blanket order; pre-agreed terms; call-offs without fresh negotiation | INDIRECT, SERVICE (recurring) | 3 days |
| **RC — ROP / Catalogue** | Reorder-point system or internal catalogue; zero-touch ordering | INDIRECT (stores consumables) | 1 day |
| **ASL — Approved Supplier List** | Pre-qualified vendor pool; competitive among qualified suppliers | DIRECT | 15–25 days |
| **RFQ / Tendering** | Open or limited competitive bidding for each purchase event | SERVICE (project), CAPEX, UNCLASSIFIED | 45–90 days |
| **Single Tender / PAC** | Sole-source with documented justification (Proprietary / Approved / Credibility) | Any archetype with no alternate | Varies |

The first three (RC variants) are collectively the "contracted" channels — the discipline target for most categories. ASL is competitive-but-curated. RFQ is open-market. Single Tender is the exception-management channel.

---

## 3. The Five Spend Archetypes

Every material group falls into one of five archetypes. The archetype determines the recommended channel.

| Archetype | Defining characteristics | Examples |
|---|---|---|
| **BULK** | High-volume commodity raw materials; continuous demand; price driven by market indices | Coal, Iron Ore, Limestone, Scrap, Diesel, Industrial Gases, DRI, Pellets |
| **DIRECT** | Production-critical materials; technically specified; limited alternate sources | Refractories, Ferro Alloys, Work Rolls, Electrodes, Graphite, Alloy additions |
| **INDIRECT** | MRO spares, consumables, utilities; recurring demand; wide supply market | Bearings, Pumps, Valves, PPE, Cables, Instrumentation, Lubricants, Stationery |
| **SERVICE** | Labour, civil, maintenance, logistics, professional services | Contract Labour, Civil Works, Transport, AMC, Housekeeping, Consultancy |
| **CAPEX** | Capital investment items; project-specific, non-recurring, high value | Power Plant equipment, Furnaces, Rolling Mills, Construction Equipment |

A sixth implicit bucket — **UNCLASSIFIED** — is used when no archetype signal is detectable. UNCLASSIFIED items default to RFQ pending manual review.

---

## 4. Themes (3)

The pillar is decomposed into three themes that follow the natural analytical flow: describe what is → recommend what should be → quantify the gap.

### Theme 1 — Current Channel State (Descriptive)

**Purpose:** Establish the baseline. What does spend look like today, channel by channel, material group by material group?

**Inputs (PO dump):** `Material_Group`, `Material_Group_Desc`, `Net_Value`, `Vendor_Number`, `PO_Creation_Date`, `Contract_Number`, `Outline_Agreement`, `Scheduling_Agreement`.

**Computations:**
- Per MG: total spend, spend share, PO count, distinct purchase months, vendor count
- Per MG: contracted % (POs referencing any of the three RC fields / total POs)
- Per MG: current channel label — `Largely Contracted (≥80%)` / `Partially Contracted (40–80%)` / `Minimally Contracted (<40%)` / `Spot / Uncontracted (0%)`
- Portfolio rollup: channel mix by spend, channel mix by PO volume

**Decision-driving:** No. This is descriptive baseline; produces no recommendations on its own.

**Pillar weight:** 0.20

### Theme 2 — Archetype & Recommended Channel (Decision-Driving Core)

**Purpose:** The analytical core. Classify each MG into a spend archetype and apply per-archetype channel-recommendation rules.

**Inputs:** Theme 1 output + `Material_Type` (MTART), `Item_Category` (PSTYP), `Account_Assignment_Category` (KNTTP), `Short_Text`.

**Archetype classification** — priority order (highest signal wins):

| Priority | Signal | Archetype assigned | Confidence |
|---|---|---|---|
| **P0** | MG Code is literally "CAPEX" / "SERVICE" / "BULK" / "INDIRECT" / "MRO" | As coded | HIGH |
| **P1** | `Item_Category` = A (Asset) | CAPEX | HIGH |
| **P1** | `Item_Category` = D (Service) | SERVICE | HIGH |
| **P2** | `Material_Type` = DIEN | SERVICE | HIGH |
| **P2** | `Material_Type` = ANLZ / FHMI | CAPEX | HIGH |
| **P2** | `Material_Type` = ERSA / ERSZ / NLAG | INDIRECT | HIGH |
| **P3** | Purchased in ≥ 3 distinct calendar months | INDIRECT | MEDIUM |
| **P4** | Keyword match in `Material_Group_Desc` (see keyword banks in `analysis-config.yml`) | BULK / DIRECT / SERVICE / INDIRECT / CAPEX as matched | MEDIUM |
| **P4-fallback** | No signal found | UNCLASSIFIED | LOW |

**Channel recommendation rules** (applied to each MG after archetype is assigned):

```
ARCHETYPE = CAPEX
  → Channel: RFQ / Open Tender

ARCHETYPE = SERVICE
  → IF MG description contains AMC/ANNUAL MAINTENANCE/CONTRACT LABOUR/HOUSEKEEPING:
       → Channel: Outline Agreement (OLA)
  → ELSE:
       → Channel: RFQ / Limited Tender

ARCHETYPE = BULK
  → Channel: RC — Long-Term Contract (index-linked)

ARCHETYPE = DIRECT
  → IF PAC% > 50% for this MG:
       → Channel: Single Tender (PAC justified)
       → Flag: "PAC — assess vendor development; build alternate source"
  → ELSE:
       → Channel: ASL

ARCHETYPE = INDIRECT
  → IF PAC% > 50%:
       → Channel: Single Tender (PAC justified)
  → ELIF MG description contains PPE/GREASE/LUBR/OIL/TONER/STATIONERY/PACKAGING/WELDING/CONSUMABLE:
       → Channel: RC — ROP / Catalogue
  → ELIF vendor_count == 1:
       → Channel: RC — Outline Agreement
       → Flag: "SRM: single vendor — develop alternatives"
  → ELSE:
       → Channel: RC — Outline Agreement

ARCHETYPE = UNCLASSIFIED
  → Channel: RFQ (pending manual review)
  → Flag: "Unclassified — verify material group description"
```

**Output:** Per MG, the recommended channel + confidence (inherited from archetype confidence) + any flags.

**Decision-driving:** Yes. This is the pillar's main recommendation engine.

**Pillar weight:** 0.50

### Theme 3 — Gap, PAC & TAT Impact (Quantification)

**Purpose:** Quantify the gap between current and recommended state. Surface compliance / risk flags.

**Inputs:** Theme 1 + Theme 2 outputs + PR dump (for PR-to-PO TAT) + PAC flags.

**Computations:**

1. **Portfolio TAT impact:**
   ```
   As-Is Weighted TAT  = Σ (Channel_share_i × Channel_TAT_i)  -- using actual current channel mix
   To-Be Weighted TAT  = Σ (Channel_share_i × Channel_TAT_i)  -- using Theme 2 recommended channels
   TAT Improvement     = As-Is - To-Be
   ```
   *Transformation ceiling: To-Be RC % is capped at As-Is RC % + 25 percentage points to reflect realistic ramp-up.*

2. **PAC analysis:**
   - PAC % per MG
   - High-PAC categories flagged (PAC% > 50%)
   - Common PAC reason categorisation from short-text keywords (OEM / proprietary / urgency / unique spec)

3. **Leakage analysis:**
   - Contracted-but-leaking: MGs where Contract # exists but Contracted% < 40% → contract bypass
   - Single-vendor lock-in: INDIRECT MGs with vendor_count = 1 and no PAC justification
   - High-frequency spot: Distinct months ≥ 6 AND contracted% = 0%

4. **Migration roadmap (top 20 by spend):** Priority-ranked list of MGs to migrate, with target channel + indicative timeline (Q1-Q4).

**Decision-driving:** Yes. Produces the priority list + risk flags.

**Pillar weight:** 0.30

---

## 5. Pillar-level scoring

The pillar produces a 1-5 maturity score using the same conventions as other pillars. Score = weighted average of theme scores using the pillar weights above.

| Score | Label | Typical state |
|---|---|---|
| 1.0–1.5 | Initial | <20% contracted; no formal channel strategy; high PAC%; long PR-to-PO TAT |
| 1.5–2.5 | Developing | 20–40% contracted; emerging strategy; PAC% concentrated in critical categories |
| 2.5–3.5 | Defined | 40–60% contracted; documented channel matrix; PAC reviewed periodically |
| 3.5–4.5 | Managed | 60–80% contracted; catalogue/ROP adoption growing; PAC <15%; TAT improving |
| 4.5–5.0 | Optimised | >80% contracted; catalogue mature; PAC <5%; PR-to-PO TAT at benchmark |

Maturity descriptors per theme are in `scoring-descriptors.yml`.

---

## 6. Data requirements (summary)

**Primary — PO dump:** PO Number, PO Item, PO Creation Date, Material Group, Material Group Description, Net Value, Vendor Number, Vendor Name, Short Text, Contract Number, Outline Agreement, Scheduling Agreement, Item Category, Material Type, Plant, Purchase Group, PR Reference.

**Secondary — PR dump (for TAT):** PR Number, PR Item, PR Creation Date, PR Release Date, Plant, Material Group, PR Total Value, PAC Flag, Emergency Flag.

**Context — engagement setup:** Annual procurement spend, FTE count, industry, plant list.

Full field schema and SAP column mapping is in the data templates catalog (`data-templates/`).

---

## 7. QREs consumed

This pillar consumes **14 QRE questions** in four sections: Current Landscape (Q-BC-01 to Q-BC-07), Contract Management (Q-BC-08 to Q-BC-10), PAC & Compliance (Q-BC-11 to Q-BC-12), Governance (Q-BC-13 to Q-BC-14). Full definitions are in `qre/qre-bank.yml`.

QREs feed:
- Theme 1 reconciliation (does client's perception of channel mix match data?)
- Theme 3 PAC & governance context (PAC reasons, DoA structure)
- The AI-generated narrative (channel strategy maturity, contract management practices)

---

## 8. Industry overlay

Industry overlays for Buying Channel live at:
- `industries/<ind>/by-function/procurement/buying-channel/benchmarks.yml` — industry-specific channel mix benchmarks (e.g., Steel typical RC% 35-55% vs cross-industry 30-50%)
- `industries/<ind>/by-function/procurement/buying-channel/archetype-overrides.yml` — industry-specific keyword banks (e.g., Steel-specific BULK keywords: COAL, IRON ORE, COKING, FERRO, DRI)

Steel overlay is part of Build 1; other industries come in Build 2+.

---

## 9. Cross-pillar interactions

| Other pillar | Interaction |
|---|---|
| **PR-to-PO** | Shares PR dump; TAT computation is duplicate-prevented via dependency on PR-to-PO outputs |
| **Op Model — Tail Spend** | Maverick spend findings here align with tail-spend channel discipline gap |
| **Supplier** | Single-vendor flags here feed Supplier pillar vendor-concentration analysis |
| **Material Master** | UNCLASSIFIED MG count is a Material Master finding (MG description quality); count surfaced here |
| **Category Classification (Stage 9)** | Archetype classification reads post-Stage-9 categories where available; falls back to raw MG if Stage 9 not complete |

---

## 10. Scope boundaries

**IN scope for Build 1:**
- PO-dump-based analysis (1-2 years of historical POs)
- PR dump for TAT computation (optional — TAT skipped if absent)
- All 6 channels listed in §2
- All 5 archetypes + UNCLASSIFIED
- Cross-pillar flags (single-vendor, leakage)

**OUT of scope for Build 1:**
- ₹ savings quantification from channel migration (Op Model owns)
- Vendor performance / OTD / quality (Supplier + Post-PO pillars)
- e-Auction setup / catalogue platform recommendations (consulting deliverable, not engine-computable)
- Real-time PR routing (this is a diagnostic engine, not an operational P2P engine)
