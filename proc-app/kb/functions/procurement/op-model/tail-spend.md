---
id: op-model-tail-spend
layer: function
function: procurement
pillar: op-model
theme: tail-spend
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
status: active
---

# Tail Spend Theme — Deep Dive

## Purpose

Tail Spend analysis answers: **"Which categories and POs constitute our 'tail' — and which should be outsourced to a managed-procurement aggregator (Moglix, Bizongo, Industrybuying, Power2SME, OfBusiness) to reduce price and cost-to-serve?"**

This is theme 4 of 4 within the Op Model pillar.

## Logic Embodied

| Component | Purpose | Decision-driving? |
|---|---|---|
| **TS0 — Current Tail Management** (QRE) | Aggregator usage baseline | No |
| **TS1 — Tail Spend Quantification** | 2 methods: PO-based threshold + category-based (from SS1 Q3) | **YES** |
| **TS2 — Tail Vendor Footprint** | Vendor pareto in the tail | No — insight |
| **TS3 — Industry Filter (Aggregator Suitability)** | Tag as Aggregator-Suitable / Consolidate-Internally / Not-Addressable | **YES** |
| **TS4 — Outsourcing Savings** | Apply aggregator savings rate | **YES** |
| **TS5 — Reconciliation** | QRE cross-check | No |

## Editable Configuration

```yaml
tail_po_threshold_inr_lakh: 1
tail_spend_share_threshold_pct: 5
min_aggregator_addressable_spend_inr_cr: 0.5
default_outsourcing_savings_rate_pct_range: [3, 8]
```

---

# 2. Analytical Framework

## TS0 — QRE baseline

| ID | Question |
|---|---|
| Q-OM-TS-01 | Does your org use any managed-procurement aggregator? (Yes / No / Partial) |
| Q-OM-TS-02 | Which aggregator(s)? Which categories? Annual spend? |
| Q-OM-TS-03 | Approx % indirect spend you classify as "tail"? |
| Q-OM-TS-04 | Reasons aggregator use is restricted (policy, IT, contracts)? |

## TS1 — Tail Quantification (2 methods)

**Method A — PO-based threshold:**
```
For each PO: IF po_value < ₹1 lakh THEN flag = tail
tail_po_count_method_A = COUNT(flagged POs)
tail_spend_method_A = SUM(flagged PO values)
```

**Method B — Category-based (from SS1 Q3):**
```
Q3 categories from SS1 = low PO count AND low avg PO value
tail_categories_method_B = Q3 list
tail_po_count_method_B = SUM(po_count of Q3)
tail_spend_method_B = SUM(spend of Q3)
```

Combined: `tail_universe = union(Method A POs, Method B POs)`

Two methods because:
- Method A catches low-value POs even within strategic categories
- Method B catches systematically low-value/low-frequency categories
- TS3 (aggregator routing) acts on Method B (category-level)

## TS2 — Vendor Footprint

```
Pareto analysis in tail universe:
Sort vendors by tail_spend descending
Find vendor count covering 50%, 80% cumulative
Long-tail vendors = single PO/year (typically 30-50% of vendor base)
```

Insight only: "*<V3> vendors engaged for single PO per year — significant overhead for negligible spend.*"

## TS3 — Industry Filter

```
For each Q3 tail category:
IF in "aggregator_suitable" list AND tail spend ≥ min_addressable:
    tag = "Aggregator-Suitable"
ELSE IF in "consolidate_internally" list:
    tag = "Consolidate-Internally"
ELSE IF in "not_addressable" list:
    tag = "Not-Addressable"
ELSE → default "Consolidate-Internally"
```

## TS4 — Outsourcing Savings

```
aggregator_addressable_spend = SUM(spend across "Aggregator-Suitable" categories)
outsourcing_rate = industry overlay OR function default 3-8% (Steel 4-7%)
savings_range = aggregator_addressable_spend × [low, high]
```

**Single rolled-up rate** drivers:
- Price savings via aggregator volume aggregation (30-50%)
- Cost-to-serve reduction — aggregator handles transactions (40-50%)
- Supplier management overhead reduction (10-20%)

## TS5 — Reconciliation

```
IF QRE "No aggregator" AND ts4 large opportunity → "Greenfield aggregator opportunity"
IF QRE "Partial" AND ts4 similar scope → "Existing scope capturing most of opportunity"
IF QRE "Partial" AND ts4 much larger opportunity → "Existing scope materially undersized"
IF QRE restrictions surfaced → "Note restriction: <text> — may constrain roadmap"
```

---

# 3. ABC Steel Worked Example

Setup: ₹5,000 Cr / 3 plants / ~30K POs.

TS0: Client uses Moglix for stationery (~₹1.5 Cr/year). 10-20% perceived tail share.

TS1 Quantification:
- Method A (PO < ₹1 lakh): ~9,200 POs | ₹38 Cr | ~350 vendors
- Method B (Q3 categories): 4 categories (Misc indirects 12, Local AMC consumables 8, Subscription 5, Misc plant supplies 15) | ₹40 Cr | ~190 vendors
- Combined: **~₹58 Cr | ~10,500 POs | ~410 vendors** (1.2% of total spend; ~50% of annual PO count)

TS2 Vendor Footprint:
- 410 total tail vendors
- 35 vendors cover 50% of tail spend (8.5% of base)
- 95 vendors cover 80% (23%)
- **160 long-tail vendors (1 PO/year — 39% of base)**

TS3 Steel Filter:
- Aggregator-Suitable: Misc indirects, Subscription, Misc plant supplies (~₹32 Cr)
- Consolidate-Internally: Local AMC consumables (~₹8 Cr)
- Not-Addressable: 0 (Steel)
- **Net Aggregator-Addressable: ~₹30 Cr** (after deducting existing Moglix scope ₹1.5 Cr)

TS4 Savings (Steel rate 4-7%):
- **Outsourcing savings: ₹1.2-2.1 Cr/year**

TS5: "Existing aggregator scope materially undersized vs data-suggested potential. Client has demonstrated aggregator-model tolerance — expansion roadmap operationally low-risk."

Final: **Expand Moglix scope ₹1.5 Cr → ₹30 Cr. Outsourcing savings ₹1.2-2.1 Cr/year. Plus operational simplification — reduce direct-managed vendor count by ~250.**

---

# 4. Boundaries

| Out of scope | Where it goes |
|---|---|
| P-card / micro-purchase policy design | P2P theme (future) |
| Catalog enablement implementation | Tech & Digital / Buying Channel |
| Specific aggregator contract design | Implementation roadmap |
| Aggregator commercial RFP | Sourcing project (downstream) |
| Vendor master cleanup project sizing | Supplier pillar |
| SME / supplier diversity considerations | Org / DEI policy |
| Aggregator integration to ERP (PunchOut etc.) | Tech & Digital |

# 5. RCA Patterns

| Finding | Typical root causes |
|---|---|
| Large unaddressed tail despite Indian aggregator availability | Procurement team unaware of catalogue depth; "we manage it ourselves" mindset |
| Long-tail vendor fragmentation | Plant-level buying autonomy; no vendor consolidation mandate |
| Aggregator restricted to one category | Initial pilot success not scaled; integration friction |
| Tail share > 10% indirect spend | Weak rate contract coverage; absent catalog buying; PR-to-PO issues |

# 6. Confidence Indicators

| Confidence | When |
|---|---|
| **High** | Stage 9 ≥ 90%; PO data complete; SS1 quadrant computed; QRE Q-OM-TS-01-04 answered |
| **Medium** | Stage 9 80-90%; QRE gaps; vendor master not fully deduped |
| **Low** | Stage 9 < 80%; vendor data unreliable; no QRE |

---

# 7. Indian Managed-Procurement Aggregator Landscape (Reference)

| Aggregator | Primary scope | Steel relevance |
|---|---|---|
| **Moglix** | Industrial MRO + B2B e-commerce | **Strong** — fasteners, safety, electrical, abrasives |
| **Bizongo** | Packaging + custom B2B | Lower for Steel direct |
| **Industrybuying** | Industrial MRO; smaller catalogue | Moderate — overlap with Moglix |
| **Power2SME** | SME-focused; raw materials capable | Limited |
| **OfBusiness** | Credit + commerce for SMEs (Steel, agro, chemicals) | Moderate |

(Note: File truncated to the most critical sections.)
