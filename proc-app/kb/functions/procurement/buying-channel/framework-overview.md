---
id: buying-channel-framework-overview
layer: function
function: procurement
pillar: buying-channel
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
audience: client_and_consultant
render_position: before_results   # App renders this BEFORE per-client outputs
status: active
---

# Buying Channel Strategy — How We Assess

*This document explains the analytical methodology behind the buying channel recommendations. It is rendered before the client-specific results so you understand the engine's logic before reading its outputs.*

---

# 1. Why this matters

A buying channel is the route through which a purchase flows from need to supplier. The right channel for each category turns hours of buyer effort into minutes (catalogue), captures negotiated volume pricing (long-term contracts), or maintains supplier discipline through pre-qualified panels (ASL).

For Indian large-enterprise procurement, the typical channel mix is 25-45% spend on contracted channels and the rest on spot / repeat-PO / single-tender. Best-in-class hits 70-85% contracted. The gap translates directly into:

| Cost dimension | Typical impact of wrong channel |
|---|---|
| **Cycle time** | Spot PO: 25-70 days end-to-end vs Catalogue: 1 day, OLA call-off: 3 days |
| **Buyer bandwidth** | 4-6 hours per spot PO of buyer touch-time vs 0.1-0.5 hours for catalogue / OLA |
| **Pricing leverage** | Spot pricing fluctuates with each PO; contracted prices captured via volume + duration commitments |
| **Supply continuity risk** | Single-source dependency without development plan = critical fragility |
| **Master-data discipline** | Hundreds of one-off vendors create payment + governance + onboarding overhead |

The Buying Channel pillar systematically identifies, for every category in your portfolio, what the right channel is and where the gaps are.

---

# 2. The 6 buying channels

We route to one of six channels per category. Each suits a different combination of value, frequency, and supplier landscape.

| Channel | What it is | Best for | Typical cycle time |
|---|---|---|---|
| **RC — Long-Term Contract (RC-LT)** | Multi-year volume agreement with index-linked pricing | Commodity raw materials at scale (BULK archetype) | 3 days from PR to PO |
| **RC — Outline Agreement (OLA)** | Annual blanket order with pre-agreed terms; call-offs without fresh negotiation | Recurring MRO / spares / annual services | 3 days |
| **RC — ROP / Catalogue** | Reorder-point system or internal catalogue; zero-touch ordering | Standard low-value high-frequency consumables | 1 day |
| **ASL — Approved Supplier List** | Pre-qualified vendor pool; competitive among qualified suppliers | Spec-sensitive engineered direct materials | 25 days |
| **RFQ / Tendering** | Open or limited competitive bidding for each purchase event | Project-specific services + CAPEX + truly one-off purchases | 45-90 days |
| **Single-Tender / PAC** | Sole-source with documented justification (Proprietary / Approved / Credibility) | Categories with no viable alternate supplier, formally justified | Varies |

**The first three (RC-LT, OLA, Catalogue) are collectively "contracted channels."** ASL is competitive-but-curated. RFQ is open-market. Single-Tender is the exception-management channel.

---

# 3. The 5 spend archetypes

Every category is one of five archetypes. The archetype is the primary signal that drives channel recommendation.

| Archetype | Defining characteristics | Typical examples |
|---|---|---|
| **BULK** | High-volume commodity raw materials with continuous demand; pricing driven by market indices | Iron Ore, Coking Coal, Limestone, Scrap, Industrial Gases, Pellets, Naphtha |
| **DIRECT** | Production-critical materials; technically specified; limited alternates | Refractories, Ferro Alloys, Work Rolls, Electrodes, Alloy additions, Tundish materials |
| **INDIRECT** | MRO spares, consumables, utilities; recurring demand; wide supply market | Bearings, Pumps, Valves, PPE, Lubricants, Stationery, IT consumables |
| **SERVICE** | Labour, civil, maintenance, logistics, professional services | Contract Labour, Civil Works, AMC, Housekeeping, Transport, Consulting |
| **CAPEX** | Capital investment items; project-specific, non-recurring, high value | Power Plant equipment, Furnaces, Rolling Mills, Construction equipment |

Categories that don't classify cleanly into one of the five archetypes are marked **UNCLASSIFIED** and default to RFQ. These also surface as a Material Master finding — typically caused by overly-generic material group descriptions.

---

# 4. The decision matrix — how archetype × value × frequency maps to channel

Each archetype has a different "right answer" depending on the value and frequency profile of purchases.

| Archetype | High value + High frequency | High value + Low frequency | Low value + High frequency | Low value + Low frequency |
|---|---|---|---|---|
| **BULK** | RC-LT (multi-year, index-linked) | RC-LT (review case-by-case) | (rare combination) | OLA (annual) |
| **DIRECT** | ASL + RC-LT for top vendor | ASL | (rare) | ASL |
| **INDIRECT** | OLA (≤₹5L) or ASL (>₹5L) | RFQ or ASL (engineered one-offs) | Catalogue / ROP (standardised stores) | OLA (light call-off) |
| **SERVICE** | OLA (annual AMC / labour contract) | RFQ (project tender) | OLA (call-off scheme) | RFQ |
| **CAPEX** | (rare combination) | RFQ | (rare) | RFQ |

**Thresholds differ by archetype** because purchase economics differ:

| Archetype | "High value" defined as | "High frequency" defined as |
|---|---|---|
| DIRECT | avg PO ≥ ₹50 Lakhs | > 5 POs in any 6-month window |
| INDIRECT | avg PO ≥ ₹5 Lakhs (medium); ≤ ₹50K (low/catalogue threshold) | > 5 POs in any 6-month window |
| SERVICE | avg PO ≥ ₹5 Lakhs | > 5 POs in any 6-month window |
| BULK | total category spend ≥ ₹5 Cr/year (drives full LTC vs annual OLA) | > 5 POs in any 6-month window |
| CAPEX | (no value threshold — archetype overrides) | (no threshold — always RFQ) |

These thresholds are configurable. Your specific defaults appear in the appendix of this report.

---

# 5. The recommendation rules

We apply 13 IF-THEN rules in priority order. The first matching rule wins. Two principles drive the rule order:

1. **PAC override (Rule 1) takes precedence** because operationally, PAC justifies single-tender regardless of archetype.
2. **Archetype rules** (Rules 2-13) then apply per-archetype logic.

| Rule | Archetype | When it fires | Recommendation |
|---|---|---|---|
| R1 | any | More than 50% of POs PAC-justified | Single-Tender / PAC + vendor-development flag |
| R2 | CAPEX | always | RFQ |
| R3 | BULK | Total category spend ≥ ₹5 Cr/year AND high frequency | RC — Long-Term Contract (index-linked) |
| R4 | BULK | Below ₹5 Cr/year threshold | RC — Outline Agreement (annual) |
| R5 | INDIRECT | Low value (≤₹50K avg PO) AND high frequency | RC — ROP / Catalogue |
| R6 | INDIRECT | Medium value (≤₹5L avg PO) AND ≥3 POs in 6 months | RC — Outline Agreement |
| R7 | INDIRECT | Above ₹5L avg PO | ASL (engineered one-offs) |
| R8 | SERVICE | High frequency (recurring) | RC — Outline Agreement (annual + call-offs) |
| R9 | SERVICE | Low frequency AND avg PO ≥ ₹5L | RFQ (project tender) |
| R10 | DIRECT | 3+ vendors AND avg PO < ₹50L | ASL panel |
| R11 | DIRECT | avg PO ≥ ₹50L | ASL + flag top vendor for potential RC-LT |
| R12 | DIRECT | 1-2 vendors AND not PAC-justified | ASL + vendor-development action plan |
| R13 | UNCLASSIFIED | fallback | RFQ + Material Master finding (verify MG description) |

**Why does Rule 1 (PAC) override everything else?** Because if a category is genuinely sole-source-only, the analysis "what channel should this be on" misses the real question, which is "how do we manage the sole-source risk." Recommendation: maintain Single-Tender + structured PAC review + vendor development programme.

---

# 6. How we read your data

A real PO dump from an Indian large enterprise (SAP, Oracle EBS, or equivalent) typically contains the following fields. The engine reads them with the priority-order logic shown below.

## 6.1 Field availability (typical Indian large enterprise PO dump)

| Field | Almost always present | Sometimes present | Rarely present |
|---|---|---|---|
| PO Number, PO Date, Vendor, Material Group + description, Net Value | ✓ | | |
| Contract Number (`KONNR`) / Outline Agreement / Scheduling Agreement | | ✓ | |
| Item Category (`PSTYP`) | | ✓ | |
| Material Type (`MTART`) | | ✓ | |
| Short Text / Item Description | | ✓ | |
| Account Assignment Category (`KNTTP`) | | ✓ | |
| Plant Code, Purchase Group | ✓ | | |
| PAC Flag column | | | ✓ |
| Justification / Approval Note text | | ✓ | |

## 6.2 Current channel derivation (priority order)

We don't usually find a clean "channel = catalogue" column. We derive it:

```
1. IF Contract_Number is non-blank → CONTRACTED (default RC-LT; refined if contract master available)
2. ELIF Outline_Agreement is non-blank → OLA
3. ELIF Scheduling_Agreement is non-blank → CATALOGUE-EQUIVALENT (Scheduling Agreement)
4. ELIF Short_Text matches /ARC|agreement|contract|reference/i → CONTRACTED (heuristic, flagged for review)
5. ELSE → SPOT / UNCONTRACTED
```

If fewer than 50% of POs have any of the three contract-reference fields populated, we flag the current contracted % as a lower bound — your actual contract coverage may be higher if contracts exist outside the ERP.

## 6.3 Spend archetype classification

Owned by **Stage 9 (Category Classification)**. The engine reads the archetype directly from the canonical category mapping (`categories-master.yml`) — no duplication of classification logic.

For categories where Stage 9 cannot classify, we fall back to a keyword bank on the material group description. This fallback is MEDIUM/LOW confidence and the recommendation is flagged for manual review.

## 6.4 Sole-source detection — three sub-signals

Because PAC isn't usually a clean column, we look at three signals (any of them triggers the flag; combinations escalate the risk level):

| Signal | What we look for | Always computable? |
|---|---|---|
| Single-vendor | Material group bought from exactly 1 vendor over the data window | Yes |
| Concentrated | Top vendor commands ≥ 80% of category spend even if 2+ vendors exist | Yes |
| PAC-justified | PAC_Flag column, OR Short_Text mentions PAC / proprietary / OEM / sole-source, OR QRE response confirms | No — depends on data |

A category with Single-Vendor + PAC-Justified = critical sole-source risk and warrants structured vendor development.

## 6.5 Dual-view of categories

Every per-category output you'll see in this report shows both:

- **The original category code and description** from your PO dump — so you recognise your own data
- **The reclassified canonical category** from our industry taxonomy — which is what the engine analyses

For example:
```
MG-Code: 1010100023  |  Original: "COAL THERMAL GR-A 5K"
                      ↓ Stage 9 reclassified to:
Canonical Category: Steel — Thermal Coal
Archetype: BULK
[then all analysis outputs]
```

You'll never see only a canonical category we made up — your own terminology is always visible alongside.

---

# 7. What you get from the engine

For each material group:

1. **Current channel** (derived from your PO dump)
2. **Recommended channel** (from the 13-rule engine above)
3. **Match status** — ✅ Already Right / ❌ Misrouted / ⚠️ Over-Engineered / 🚫 Unrecoverable (Material Master issue)
4. **Migration priority** — HIGH / MEDIUM / LOW based on spend share + match status
5. **Risk flags** — sole-source, cross-plant fragmentation, unclassified, etc.

Portfolio-level rollups:
- Current channel mix vs benchmark band
- Misrouted spend by target channel (the migration roadmap)
- TAT savings potential (if PR dump provided)
- Buyer bandwidth freed (FTE-equivalent)
- Contract coverage lift estimate (with transformation ceiling applied)

---

# 8. What this pillar does NOT produce

To be explicit about scope:

| Not in scope here | Where it goes |
|---|---|
| ₹ savings from channel migration | Op Model pillar (Centralisation / SSC / CoE savings rates) |
| Vendor performance, OTD, defect rate | Supplier + Post-PO pillars |
| e-Auction platform / catalogue technology recommendations | Consulting deliverable, not engine output |
| Real-time PR routing | This is a diagnostic engine, not a P2P engine |
| Contract negotiation strategy / commercial terms | Op Model — CoE theme |
| Buyer-level performance assessment | Org Structure pillar |

---

*Now that you understand the methodology, the next sections of this report show how it applies to your specific portfolio.*
