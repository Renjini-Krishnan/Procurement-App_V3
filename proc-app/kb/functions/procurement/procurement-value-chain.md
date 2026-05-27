---
id: procurement-value-chain
layer: function
function: procurement
version: 1.0
updated: 2026-05-27
owner: kb-admin
---

# Procurement Value Chain (Source-to-Pay)

This document describes the procurement value chain in depth — every step, who owns it, what data is generated, where it intersects other functions, and which assessment pillars touch it.

---

## End-to-End View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STRATEGIC SOURCING (S2P upstream)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Demand→  Sourcing  →  Supplier  →  Negotiation  →  Contracting      │
│  ID     Strategy Selection                                            │
└────────────────────────────────────────┬────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              OPERATIONAL PROCUREMENT (P2P downstream)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Purchase   →  Purchase  →  Goods/Service  →  Invoice  →  Payment        │
│  Requisition   Order        Receipt (GRN)  Receipt                   │
│  (PR)      (PO)                        + 3-Way                   │
│                                                  Match                   │
└─────────────────────────────────────────────────────────────────────────────┘
              ↑                                        ↑
              └──────── Supplier Performance Mgmt ─────────┘
                        (ongoing, parallel)
```

---

## Strategic Sourcing — Step Details

### Step 1: Demand Identification
**What happens:** The business identifies a need (new product launch, replenishment, contract renewal, capex project).
**Who owns:**
- Direct categories: Production / Manufacturing teams trigger via planning systems
- Indirect categories: Business users (IT, HR, Facilities, Marketing) trigger via requisitions
- Capital: Project sponsors via AFE / Note for Approval (NFA)
**Typical issues found in assessments:**
- Demand not aggregated across BUs (each plant orders separately)
- Late demand signals (firefighting buying)
- Specification ambiguity (over-specification driving cost)
**Touches pillars:** Op Model (centralisation analysis), Buying Channel (repeatability)

### Step 2: Sourcing Strategy
**What happens:** Procurement decides HOW to buy this category — single source, dual source, multi-source, captive, spot, contract, e-auction, RFQ, etc.
**Who owns:** Category managers in procurement; for strategic categories, often with business sponsor sign-off.
**Typical issues:**
- No formal category strategy documents
- Strategy not refreshed (years-old strategy in volatile market)
- Make-vs-Buy decisions not periodically revisited
**Touches pillars:** Op Model, Buying Channel, Category Classification

### Step 3: Supplier Selection / RFx
**What happens:** Identify candidate suppliers, send RFI (info), RFQ (quote), or RFP (proposal). Receive bids, evaluate technically + commercially, shortlist.
**Who owns:** Category managers; for high-value, with cross-functional evaluation committee.
**Typical issues:**
- Limited bidder pool (always-same vendors)
- Vendor evaluation criteria not standardised
- Single-source PRs / PAC abuse (Proprietary Article Certificate — Indian practice of justifying single-vendor purchase)
**Touches pillars:** PR-to-PO, Buying Channel, Supplier Mgmt

### Step 4: Negotiation
**What happens:** Commercial discussions on price, payment terms, delivery, warranty, penalties. Can be single-round, multi-round, e-auction, or final-best-offer.
**Who owns:** Procurement (lead); often with technical input from user functions.
**Typical issues:**
- Negotiation not done for sub-threshold spend (small-value purchases skip negotiation, accumulate as tail)
- E-auction underused
- "Anchor" pricing not researched (negotiator doesn't know fair market price)
**Touches pillars:** PR-to-PO (savings vs LPO, negotiation coverage)

### Step 5: Contracting
**What happens:** Draft contract, vet clauses (Legal), sign, store in repository.
**Who owns:** Procurement + Legal jointly. Some companies have a Contract Mgmt CoE.
**Typical issues:**
- Contracts in folders rather than searchable repository
- Auto-renewal causing rate creep
- Outdated standard clauses (no force majeure, weak indemnity, no ESG clauses)
- Limited clause library
**Touches pillars:** Contract Mgmt (Build 2)

---

## Operational Procurement — Step Details

### Step 6: Purchase Requisition (PR)
**What happens:** A user creates a PR in the ERP specifying what's needed, when, why, and the (estimated) value. Goes through approval workflow.
**Who owns:** Requesting user; approval per DoA.
**Data produced:** PR record with PR ID, requester, category, item, quantity, estimated value, justification, approval chain.
**Typical issues:**
- Manual PR creation (Excel-based, not in ERP)
- Approval bottlenecks (one person approves too much)
- PRs rejected for incomplete info, repeated rework
- Missing PR for buying — "PO without PR" anti-pattern
**Touches pillars:** PR-to-PO

### Step 7: Purchase Order (PO)
**What happens:** Approved PR converts to PO. PO is the legal document instructing the supplier to deliver. Sent to supplier.
**Who owns:** Procurement buyer (operationally) or auto-generated (if RC / catalog exists).
**Data produced:** PO record with PO ID, PR ID, supplier ID, item, quantity, unit price, total value, delivery terms, payment terms, contract reference (if applicable).
**Typical issues:**
- Long PR → PO TAT (days/weeks)
- Frequent PO amendments (poor up-front specification)
- POs against contracts not flagged with RC reference (analytical visibility lost)
**Touches pillars:** PR-to-PO, Buying Channel (channel flag on PO), Op Model (buying entity)

### Step 8: Goods / Services Receipt (GRN)
**What happens:** Supplier delivers; receiving team validates quantity + quality and creates GRN in ERP.
**Who owns:** Receiving team / Stores / requesting function.
**Data produced:** GRN with PO ID, delivery date, quantity received, quantity accepted, quantity rejected (and reason), inspector, ASN reference.
**Typical issues:**
- GRN backlog (deliveries received but not entered into system for days)
- Quality rejections not captured systematically (rejected via WhatsApp/email)
- ASN (Advanced Shipping Notice) not used → no pre-arrival prep
- 3-way mismatch (PO vs GRN vs Invoice) → invoice posting delays
**Touches pillars:** Post-PO

### Step 9: Invoice Receipt + 3-Way Match
**What happens:** Supplier submits invoice. ERP attempts to match PO + GRN + Invoice (quantity, price, vendor). Match → auto-posting. Mismatch → exception queue for AP team.
**Who owns:** AP (Finance), with procurement input for exception resolution.
**Data produced:** Invoice record with vendor, PO reference, value, tax breakup, payment terms, match status.
**Typical issues:**
- Low 3-way match success rate → manual reconciliation → late payment
- Tax discrepancies (GST input credit blocked)
- Duplicate invoices accidentally paid
**Touches pillars:** Post-PO

### Step 10: Payment
**What happens:** AP releases payment per contracted terms. Confirmed in ERP.
**Who owns:** Treasury / AP.
**Data produced:** Payment record with vendor, invoice ref, value, payment date, payment mode.
**Typical issues:**
- DPO actual vs terms variance (paying too early loses working capital; paying too late hurts supplier relationship)
- Manual payment processing (no scheduler / payment run)
- Supplier portal not used (queries handled by email)
**Touches pillars:** Post-PO (DPO), Working Capital (cross-functional)

### Parallel: Supplier Performance Management
**What happens (ongoing):** Track supplier OTD, quality, responsiveness, innovation, ESG, compliance. Periodic scorecards. Performance reviews. Improvement plans for laggards.
**Who owns:** Procurement (category managers) + receiving / quality teams as input.
**Touches pillars:** Supplier Mgmt

---

## Cross-Cutting Themes

### Compliance Throughout the Chain

| Stage | Compliance check |
|---|---|
| Sourcing | Sanctions screening, RBI prohibited list, ESG criteria |
| Supplier onboarding | GSTIN, PAN, MSME certificate, bank verification |
| PR approval | DoA enforcement (correct approver for spend bucket) |
| PO issuance | Tax classification, HSN code, contract reference |
| Invoice | GST input credit eligibility, TDS deduction |
| Payment | TDS deposit, foreign exchange compliance (RBI / FEMA) |

### Data Trail Across the Chain

| Step | Data file in app's data templates |
|---|---|
| PR | PR template |
| PO | PO template (most important — central artefact) |
| GRN | GRN template (part of Master Data / Post-PO) |
| Invoice | Invoice template |
| Master Data | Material Master + Vendor Master templates |
| Supplier Performance | Vendor Performance template |
| Org Structure | Org Structure template |

### Indian-context nuances

| Element | Indian-specific |
|---|---|
| GST + Input Credit | Critical PO/Invoice data field; mismatches block credit |
| MSME compliance | TReDS, payment-within-45-days mandate |
| PAC (Proprietary Article Certificate) | Indian practice of justifying single-source PR; abuse common |
| HSN / SAC codes | Mandatory on every invoice |
| TDS (Tax Deducted at Source) | Deducted at payment; needs vendor PAN |
| Make in India / PLI | Local content requirements for certain categories |
| Captive procurement | Common in conglomerates (intra-group buying) |
| Sub-threshold buying | Often outside formal procurement; large tail spend driver |

---

## How This Value Chain Maps to Assessment Pillars

| Value chain step | Primary pillar(s) | Secondary touchpoints |
|---|---|---|
| Demand ID | Op Model | Org Structure |
| Sourcing Strategy | Op Model, Buying Channel | Category Classification |
| Supplier Selection | PR-to-PO, Supplier | Buying Channel |
| Negotiation | PR-to-PO | Capability |
| Contracting | Contract Mgmt (B2) | Process Design overall |
| PR | PR-to-PO | DoA (B2) |
| PO | PR-to-PO | Buying Channel, Op Model |
| GRN | Post-PO | Supplier |
| Invoice | Post-PO | Tech & Digital (3-way match auto) |
| Payment | Post-PO | (Working Capital — cross-fn) |
| Supplier Perf Mgmt | Supplier | Governance (B2) |

---

## Notes
- This value chain is an idealised flow. Real client implementations vary — captive intra-group buying, project-based capex, services contracts, framework agreements, etc., all have variations on this base.
- The app's data ingestion (Stages 4-8) maps client data into this canonical view.
- For services-heavy industries (cement transport, contract labour), the value chain has additional service-specific steps (SoW, milestone-based payment, SLA tracking) — covered by the Service Master Data sub-pillar (Build 2).
