---
id: function-glossary
layer: function
function: procurement
version: 1.0
updated: 2026-05-27
owner: kb-admin
---

# Procurement Function Glossary

Procurement-specific terms. **Cross-functional terms** (KPI, FTE, EBITDA, etc.) are in `shared-kb/references/glossary.md`. **Industry-specific terms** (clinker, BOF, slab) are in `shared-kb/industries/<industry>/glossary-industry.md`.

When a consultant hovers over a term in the app, the cascade looks up: industry → function → universal. Most-specific match wins.

---

## A
**Approved Supplier List (ASL)** — A pre-qualified list of vendors authorised to supply specific categories. PRs against an ASL vendor are fast-tracked. Strong ASL discipline reduces tail spend.
**ASN (Advanced Shipping Notice)** — Electronic notification from supplier indicating shipment dispatch, quantity, expected delivery. Helps receiving prepare. Low ASN adoption = poor demand-supply coordination.
**AP (Accounts Payable)** — Finance sub-function that processes invoices and releases payments to suppliers. Procurement provides AP with PO + GRN; AP matches and pays.
**AR (Accounts Receivable)** — Finance sub-function for incoming customer payments. Mentioned for contrast.
**Auction (Reverse e-Auction)** — Online competitive bidding where suppliers bid down a price. Common for high-volume, commoditised categories. Distinct from forward auction (selling).

## B
**Backward Integration** — A company taking ownership of upstream supply (e.g., a cement company buying limestone mines). Affects sourcing strategy.
**Bid Sheet** — Tabulated commercial comparison of multiple supplier quotes for a sourcing event. Standardised format simplifies awarding.
**Buying Channel** — The route through which spend flows to a supplier. Standard channels: Rate Contract (RC), Catalog, Approved Supplier, Spot Buy, P-card, VMI, e-Auction. See Buying Channel pillar.

## C
**Catalog (Procurement Catalog)** — A pre-loaded list of approved items at agreed prices in the ERP. User selects from catalog → auto PO. Reduces buying cycle time. Distinct from supplier's own catalog.
**Category Management** — Treating each spend category as a portfolio: dedicated category manager, strategy, supplier base optimisation, demand consolidation. Hallmark of mature procurement.
**Category Tree / Category Taxonomy** — Hierarchical classification of spend (e.g., Direct → Raw Materials → Iron Ore). Standard taxonomies: UNSPSC (global), client-specific custom. See `category-taxonomy.md`.
**Centralisation %** — % of spend processed through central procurement (vs plant-level / BU-level). Key Op Model metric.
**CoE (Center of Excellence)** — A central team owning strategic categories (high-value, high-complexity) while transactional buying is decentralised to plants/BUs. Hybrid Op Model.
**Contract Coverage %** — % of spend conducted under valid contracts (vs spot/ad-hoc). Higher = better governance.
**Contract Repository** — A central searchable system for active contracts. Should track expiry, auto-renewal, value, supplier.

## D
**DoA (Delegation of Authority)** — A formal matrix specifying who can approve what spend (CEO above ₹X Cr, CFO between ₹Y-X Cr, etc.). Critical internal control.
**DoA Breach** — A PO approved by someone with lower authority than DoA requires. Compliance violation; flagged in audit.

## E
**e-Sourcing / e-Procurement** — Use of digital tools for sourcing (RFx, auction, vendor evaluation) and procurement transactions. Platforms: Coupa, Ivalua, Ariba, Jaggaer, GEP.
**EPCM (Engineering, Procurement, Construction Management)** — Capital project model where one contractor handles all three. Common in cement plant builds, steel plants, refineries.

## F
**FOB (Free On Board)** — Incoterm: supplier delivers to port of shipment; buyer responsible from there. Affects total landed cost calculation.
**Framework Agreement** — A long-term agreement with a supplier defining terms; specific orders called off against it. Useful for predictable repeating spend.

## G
**GRN (Goods Receipt Note)** — System entry confirming receipt of materials against a PO. Triggers 3-way match. Slow / inaccurate GRN = downstream invoice + payment delays.

## H
**HSN (Harmonised System of Nomenclature)** — Tax classification code for goods (Indian context, GST-mandated). Captured on invoices and POs.

## I
**Incoterms** — International commercial terms (FOB, CIF, EXW, DDP, etc.) defining buyer/seller responsibilities. Critical for cross-border and high-value purchases.
**Indirect Procurement** — Sourcing of non-product-input goods/services (see Direct vs Indirect in `shared-kb/references/glossary.md`). Heavy area for tail-spend mgmt.
**Invoice (Tax Invoice)** — Supplier's bill. In India, GST-compliant invoices required for input credit. Subject to 3-way match.

## L
**Long-Term Agreement (LTA)** — Multi-year framework with a supplier, typically with annual price negotiation. Common in raw materials, services.
**LPO (Last Purchase Order)** — The most recent PO price for an item. Used as the benchmark for "Savings vs LPO" KPI.

## M
**Make-vs-Buy** — Decision whether to produce in-house or procure externally. Strategic Op Model question.
**Material Master** — Database of all material codes the company buys, with descriptions, units, classifications, specifications. Foundation for clean procurement.
**Maverick Spend** — Spend that bypasses formal procurement channels (e.g., off-contract buying when a contract exists). Indicator of process / discipline weakness.
**MOQ (Minimum Order Quantity)** — Smallest order a supplier accepts. Drives some packaging and consolidation decisions.
**MRO (Maintenance, Repair, Operations)** — Indirect category covering spare parts, consumables, plant maintenance items. Highly fragmented.
**MSME (Micro, Small, Medium Enterprise — India)** — A regulatory class. Indian law mandates payment to MSMEs within 45 days. Procurement assessment often checks MSME share of vendor base.

## N
**NFA (Note for Approval)** — Formal document seeking approval for spend, particularly capex / strategic / one-off purchases. Indian Government and corporate context.
**Negotiation Coverage %** — % of spend / sourcing events where formal negotiation occurred (vs accept-first-quote).

## O
**OEM (Original Equipment Manufacturer)** — Supplier of original (vs aftermarket) parts. Often single-source for proprietary items → PAC justification.
**On-Time Delivery (OTD) %** — % of deliveries received on or before promised date. Post-PO KPI.
**Outsourcing (Procurement Outsourcing)** — Hiring an external provider to handle some procurement (tail spend, RFx execution, vendor management). Common for indirect / tail.

## P
**P-card (Procurement Card)** — Corporate credit card for low-value, high-frequency purchases. Faster than PR-PO for sub-threshold spend. Underused in Indian context.
**PAC (Proprietary Article Certificate)** — Indian practice: justification for single-source procurement (no competition). Frequent PAC use = sourcing discipline issue.
**Payment Terms** — Agreed time between invoice and payment (e.g., Net 30, Net 60). Affects DPO + working capital.
**PO (Purchase Order)** — Legal document instructing supplier to deliver. Central artefact of procurement.
**PR (Purchase Requisition)** — Request from a user function asking procurement to buy. Triggers the operational P2P cycle.
**Preferred Vendor** — A vendor with strategic relationship, often with negotiated terms, given preference in sourcing.
**P2P (Procure-to-Pay)** — The operational procurement cycle: PR → PO → GRN → Invoice → Payment. Distinct from upstream Strategic Sourcing.

## R
**Rate Contract (RC) / OLA (Outline Agreement)** — Pre-negotiated agreement on prices/terms for a category; individual POs called off against the RC. Indian ERP term "OLA" is common (SAP-derived).
**Receivables vs Payables** — Procurement focuses on payables side. Working capital impact via DPO.
**Reverse Auction** — See "Auction".
**RFI (Request For Information)** — Pre-sourcing information gathering from candidate suppliers. No price yet.
**RFP (Request For Proposal)** — Detailed sourcing event asking suppliers for technical + commercial proposal. Used for complex/strategic categories.
**RFQ (Request For Quotation)** — Quick price-focused sourcing event for defined items.
**RFx** — Umbrella term covering RFI + RFQ + RFP + RFP.

## S
**SAC (Service Accounting Code — India)** — Tax classification for services (GST equivalent of HSN for goods).
**Service Master** — Catalog of services the company buys (analogous to Material Master, but for services). Critical for services-heavy industries.
**Single Source / Sole Source** — Buying from one vendor, either because only one is available (sole source) or by company choice (single source for strategic reasons).
**SLA (Service Level Agreement)** — Contractual commitments on service quality (response time, uptime, etc.). Tracked for service contracts.
**Sourcing Strategy** — Plan for HOW to buy a category (multi-source vs single-source, captive vs open market, e-auction vs negotiation, etc.).
**Sourcing Event** — A specific instance of sourcing (e.g., "2026 Cement Bag Procurement RFP"). Has bidders, evaluation, awarding.
**Spend Cube** — Multi-dimensional analysis view of spend (by category × supplier × BU × time). Foundation for spend analytics.
**SoW (Statement of Work)** — Detailed scope document for service contracts. Quality of SoW directly affects deliverable quality.
**SS (Shared Services)** — A central operational hub handling transactional procurement (PR processing, supplier onboarding, MM creation) for multiple BUs. Hybrid Op Model element.
**Stage Gate** — Approval checkpoint in a procurement workflow (DoA approval, contract sign-off, supplier qualification).
**Strategic Sourcing** — Upstream procurement: category strategy, supplier selection, negotiation, contracting. Distinct from operational P2P.
**Supplier Onboarding** — End-to-end process of registering a new supplier: KYC, bank, financials, ESG, capability assessment. Should be efficient (days) not painful (weeks/months).
**Supplier Performance Mgmt (SPM)** — Ongoing tracking + management of supplier OTD, quality, responsiveness, innovation, ESG.
**Supplier Scorecard** — Periodic (monthly/quarterly) rating of supplier performance against defined KPIs. Should drive corrective action conversations.

## T
**Tail Spend** — The "long tail" of low-value, high-volume, fragmented purchases. Often 20-40% of suppliers handle 5-10% of spend. Key target for Op Model recommendations.
**TAT (Turnaround Time)** — Time from one milestone to another (PR-to-PO TAT, PO-to-GRN TAT, etc.). Process efficiency KPI.
**3-Way Match** — Verification that PO + GRN + Invoice match (vendor, quantity, price). Auto-match = clean process; manual exception handling = friction.
**TReDS (Trade Receivables Discounting System — India)** — Platform mandated for MSME invoices. Some Indian companies must use TReDS to ensure on-time payment to MSMEs.

## U
**UoM (Unit of Measure)** — How quantity is measured (kg, MT, L, each). Inconsistency = data quality issue. See `shared-kb/references/master-data/units-of-measure.yml`.

## V
**Value Engineering (VE)** — Re-engineering specifications to reduce cost without compromising function. Cross-functional with engineering / design.
**Vendor (= Supplier)** — Used interchangeably. See `shared-kb/references/glossary.md` for nuance.
**Vendor Master** — Database of all suppliers registered with company; includes KYC, bank details, contact info, status.
**Vendor Onboarding TAT** — Days from new supplier registration request to active status.
**Vendor Performance Data** — Operational metrics on supplier performance: OTD, defect rate, responsiveness, scorecard rating.
**VMI (Vendor Managed Inventory)** — Supplier manages buyer's inventory at buyer's site. Replenishment automated based on consumption. Common for high-volume consumables (MRO, packaging).

## W
**Working Capital Impact (of Procurement)** — Procurement payment-terms decisions directly affect DPO and hence company's working capital. Often discussed jointly with Finance.

---

## Conventions for adding terms here
- **Add** terms specific to the procurement function
- **Don't add** generic business/finance terms — those go in cross-functional glossary
- **Don't add** industry-specific procurement terms (e.g., "captive limestone mine" = Cement context) — those go in industry glossary
- **Note Indian-context nuances** where relevant (GST, MSME, PAC, NFA)
- **Cross-reference pillars** where the term is heavily used

## v1 term count: ~70 procurement-specific terms
Grows over time as engagements surface terms worth adding.
