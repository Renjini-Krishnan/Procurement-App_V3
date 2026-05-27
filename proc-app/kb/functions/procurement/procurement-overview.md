---
id: procurement-function-overview
layer: function
function: procurement
version: 1.0
updated: 2026-05-27
owner: kb-admin
---

# Procurement Function — Overview

This document is the orientation for everything in the Procurement Function KB. Every pillar file, every benchmark, every prompt sits underneath this frame.

---

## 1. What is Procurement?

**Procurement** is the function responsible for **sourcing and buying goods and services** that an organisation needs to operate. It covers the full lifecycle from "what do we need" to "how was the supplier paid".

### What's INSIDE procurement's scope:
- **Strategic Sourcing** — category strategy, supplier selection, contracting, negotiation
- **Operational Procurement / P2P** — purchase requisitions, purchase orders, receiving, invoicing, payment processing
- **Supplier Management** — onboarding, performance management, risk monitoring, supplier development
- **Contract Management** — drafting, renewal, repository, compliance tracking
- **Spend Analytics** — visibility, classification, opportunity identification
- **Procurement Operations** — buying channel design, catalog management, e-auction
- **Compliance** — DoA enforcement, regulatory compliance (GST, sanctions, ESG)

### Direct vs Indirect Spend

| Type | Definition | Examples (Indian large enterprise) |
|---|---|---|
| **Direct Spend** | Materials and services that go INTO the product | Steel raw materials, Cement raw materials, packaging, contract manufacturing, key components |
| **Indirect Spend** | Materials and services that SUPPORT the business but don't go into the product | IT, Facilities, Professional Services, Marketing, Travel, MRO, Capital Equipment |

### Strategic vs Operational Procurement

| Strategic Sourcing (upstream) | Operational P2P (downstream) |
|---|---|
| What to buy, from whom, on what terms | Execute the buying: PR → PO → GRN → Invoice → Payment |
| Frequency: project-based; annual / multi-year | Frequency: daily / transactional |
| Skills: category expertise, market intelligence, negotiation | Skills: process discipline, accuracy, ERP fluency |
| KPIs: savings, contract coverage, supplier consolidation | KPIs: cycle time, defect rate, on-time delivery, 3-way match % |

---

## 2. The Procurement Value Chain (Source-to-Pay / S2P)

```
[Demand Identification]
↓
[Sourcing Strategy]  ← Strategic Sourcing starts here
↓
[Supplier Selection]
↓
[Negotiation]
↓
[Contracting]
↓
[Purchase Requisition (PR)]  ← Operational P2P starts here
↓
[Purchase Order (PO)]
↓
[Goods/Services Receipt (GRN)]
↓
[Invoice Receipt + 3-Way Match]
↓
[Payment]
↓
[Supplier Performance Tracking]  ← ongoing alongside operations
```

Detailed value chain in `procurement-value-chain.md`.

---

## 3. Why Procurement Matters

| Metric | Indian Large Enterprise Range |
|---|---|
| Procurement spend as % of revenue | 40-70% (varies by industry) |
| Savings opportunity from a competent procurement function | 2-10% of addressable spend annually |
| EBITDA impact of a 5% procurement saving | Often 30-50% increase in EBITDA |

---

## 4. What this App Assesses — 13 Pillars

### Build 1 Pillars (7) — DATA-DRIVEN

| Pillar | What it assesses | Primary data source |
|---|---|---|
| **Op Model** | Centralisation, shared services, CoE strategy, tail spend approach | PO dump + Org Structure + QRE |
| **Org Structure** | Spend/FTE, txn/FTE, R&R clarity, reporting line, category specialists % | Org file + PO dump |
| **Buying Channel** | Rate contract adoption, catalog, e-auction, maverick spend, VMI | PO dump (with channel flags) |
| **PR-to-PO** | TAT, automation, RFQ process, negotiation, PAC, savings vs LPO | PR + PO dumps |
| **Post-PO** | OTD, defect rate, GRN TAT, 3-way match, invoice TAT, DPO variance | PO + GRN + Invoice dumps |
| **Material Master** | MM size, duplicates, classification accuracy, code creation process | Material Master file |
| **Supplier** | Onboarding TAT, vendor master quality, supplier performance | Vendor Master + Vendor Perf + PO data |

### Build 2 Pillars (6)

DoA, Governance, Service Master Data, Contract Mgmt, Capability, Tech & Digital

### Cross-cutting capabilities

- **Cost / EBITDA Quantification** — every pillar finding includes a savings range (where applicable; Org Structure excludes)
- **RCA (Root Cause Analysis)** — every finding has root cause logic (rule-based + AI)
- **Cascade** — function defaults overridden by industry overlays overridden by engagement-specific overrides

---

## 5. How We Assess

### The 3-Bucket Knowledge Loading Model

1. **Universal Bucket** — `shared-kb/standards/` + `shared-kb/references/`
2. **Function Bucket** — `proc-app/kb/functions/procurement/`
3. **Industry Bucket** — `shared-kb/industries/<industry>/`

### The Cascade — most-specific wins

```
Engagement Override (most specific)
↓ falls back to
Industry Overlay
↓ falls back to
Function Default
```

### Maturity Scoring

1-5 scale (defined in `shared-kb/standards/scoring-scale.yml`):
- **1 — Ad-hoc** / **2 — Defined** / **3 — Managed** / **4 — Optimised** / **5 — Leading**

### Inputs

| Input | Source | Used by |
|---|---|---|
| Client data (PR, PO, Invoice, Master Data) | Client upload, Stages 4-8 | All Analyze pillars |
| QRE responses | Client-completed questionnaire | Qualitative pillars + augments quantitative |
| Industry context | shared-kb/industries/ | All stages |
| Function defaults | This KB | All stages |

---

## 6. What We Deliver

| Deliverable | Format | Source |
|---|---|---|
| Findings deck | PPT | Aggregated from all Analyze pillars |
| Exec Summary deck | PPT | Narrative synthesis of findings + recommendations + roadmap |
| KPI Dashboard | Interactive (in-app) + PDF/PNG export | KPI values from Stage 10 |
| Transformation Roadmap | PPT + Excel (timeline) | Recommendations sequenced into phases |

All available via the **Export Center** with email distribution.

---

## 7. Version & Maintenance

| | |
|---|---|
| Version | 1.0 |
| Last updated | 2026-05-27 |
| Owner | KB admin |
| Review cadence | Quarterly |
| Editing | Via in-app KB Editor UI |
