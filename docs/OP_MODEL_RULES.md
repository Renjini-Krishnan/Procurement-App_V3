# Procurement Op Model Assessment — Functional Rules

> **Tool-independent ruleset.** Written so anyone with a PO dump (Excel/CSV) can apply the same analysis manually or implement it in any tool, without access to the Procvault application or its Knowledge Base files.

**Scope of this document:** the analytical rules + benchmarks + category taxonomy used to assess a procurement function's operating model (centralisation, shared services, CoE, tail spend) from raw PO data.

**Industry coverage:** Steel (large Indian enterprises). The taxonomy in Part 4 is steel-specific; the rules in Parts 1-3 are industry-agnostic.

---

## Part 1 — Data Cleansing

Apply in order on a raw PO dump:

### 1. Column mapping
Match the client's column headers to a standard internal vocabulary. Required minimum:

- `po_number`, `po_item` (line ID)
- `po_creation_date`
- `plant` (where the material is consumed)
- `vendor_id`, `vendor_name`
- `material_group` (MATKL — the client's internal category code), `material_group_desc`
- `net_value`, `currency`
- `purchase_group` (buyer team)

Useful extras: `hsn_code`, `material_master_desc` (long description), `external_material_group` (EXTWG), `material_long_text`, `old_material_number` (BISMT), `item_category` (PSTYP), `material_type` (MTART).

### 2. Multi-sheet collation
If the workbook has multiple tabs (one per FY), combine vertically. Add a `source_sheet` column tagging each row with its sheet name. Skip cover pages and empty tabs.

### 3. Type coercion
- Dates: parse from DD-MM-YYYY, DD.MM.YYYY, ISO, or Excel serial. Bad dates become null and are flagged, not dropped.
- Numbers: coerce; bad values become null.
- Text: strip whitespace.

### 4. Currency normalisation
For every row, compute `net_value_inr`. If currency ≠ INR, convert at a published rate (or a year-end average for the period). Store the rate used on the row for audit.

### 5. PO status inference
Flag each row as **active / cancelled / reversed**:

- Explicit status column wins if present
- Negative `net_value` → reversal
- Zero value AND zero quantity → cancelled

**Only active rows feed positive-spend rollups.** Cancelled rows surface in audit reports but don't inflate spend.

### 6. Vendor normalisation
Build a `canonical_vendor_name` for every row by lowercasing, stripping suffixes ("Ltd", "Pvt", "Limited", "Private"), and collapsing whitespace. So "Linde India Ltd", "LINDE INDIA", and "linde india pvt ltd" all roll up as one vendor.

### 7. Lookback filter
Drop rows older than the engagement's scope window (default: last 18 months). Log the cutoff date and drop count.

### 8. Derived flags
- **`is_capex`** = true if PSTYP=A OR MTART=ANLZ OR GL account matches CAPEX prefix
- **`po_type_inferred`** = NB (standard) / FO (framework) / UB (transfer) from doc_type or heuristic on value+vendor
- **`is_pac`** (Proprietary Article Certificate) = true if any description text contains "PAC", "proprietary", "OEM", "sole source", "single source"
- **`approver_tier`** = looked up from `po_approver_designation` (e.g. Manager=2, GM=4, MD=5) — used by DoA pillar

### 9. Completeness check
For every row, flag which required fields are missing. Surface as a data-quality summary before running analysis.

**Output:** a clean dataset, one row per active PO line, ready for category classification.

---

## Part 2 — Category Classification

**Goal:** assign every PO line to a canonical category (a standard procurement category like "Iron Ore", "Bearings", "AMC Services") regardless of how the client's MATKL system is organised.

### Why this matters
A client might call iron ore "RAW_FE_001" in one plant and "10010" in another. Category classification reduces both to `iron_ore` so downstream analyses see one consistent unit.

### Classification cascade
Apply in order — first confident hit wins; multiple hits corroborate.

**A. Manual override (highest priority)**
If the consultant has assigned MATKL X → canonical Y for this engagement, use it.

**B. HSN code lookup**
HSN is the government-mandated 8-digit tax code. Most reliable single signal. Match longest first (8 → 6 → 4 digit).

Example: HSN `7204*` → `scrap_steel`. HSN `2601*` → `iron_ore`.

**C. Clean rollup (95% rule)**
For each MATKL value in the dataset, count what canonicals the keyword scan assigned. If ≥95% of rows in MATKL X agree on canonical Y, treat ALL rows in MATKL X as Y. Apply same rule independently for EXTWG (external material group) and BISMT (legacy material code prefix).

**D. Weighted text scan**
Search 8 text columns for keyword/synonym hits, weighted by reliability:

| Column | Weight |
|---|---|
| material_long_text | 1.5 |
| material_master_desc | 1.2 |
| material_group_desc | 1.0 |
| external_material_group_desc | 1.0 |
| short_text (line description) | 1.0 |
| item_note | 0.8 |
| material_number (code prefix) | 0.6 |
| old_material_number (BISMT) | 0.5 |

For each canonical, score = sum of weights across columns where its keywords match. Highest score wins.

**E. Vendor anchor**
If vendor_name matches a known "specialist" vendor for canonical Y (e.g. NMDC → iron_ore, Glencore → ferro_alloys), add that as corroboration. Never wins alone — only strengthens an existing keyword hit.

**F. Buyer-group anchor (learned)**
If ≥85% of confidently-classified rows from buyer group P10 map to canonical Y, then any *unclassified* row from P10 inherits Y as low-confidence corroboration.

**G. Archetype hint from PSTYP/MTART**
| Signal | Archetype |
|---|---|
| PSTYP=A | CAPEX |
| PSTYP=D | SERVICE |
| MTART=DIEN | SERVICE |
| MTART=ANLZ | CAPEX |
| MTART=ROH | DIRECT / raw |
| MTART=ERSA | INDIRECT / spare |

Narrows the candidate pool — if MTART says SERVICE, suppress non-service canonicals from text-scan winners.

### Confidence levels
- **HIGH**: HSN matched, OR manual override, OR ≥2 of {MATKL/EXTWG/BISMT clean rollups} agree, OR (text scan with ≥3 keyword hits AND vendor anchor)
- **MEDIUM**: Single clean rollup, OR text scan alone, OR vendor anchor alone, OR text + buyer-group
- **LOW**: Only buyer-group corroborates, OR only LLM-derived (when used)
- **UNCLASSIFIED**: Nothing fires

**Unclassified handling:** surface as a separate bucket with the MATKL list + spend. Consultant reviews and assigns manually — those assignments become permanent overrides for this engagement.

---

## Part 3 — Operating Model Analysis (4 themes)

Unit of analysis throughout: **the canonical category from Part 2**, not raw MATKLs.

### Theme 1 — Centralisation

**Question:** should this category be bought by one team for all plants, or left local?

1. **Filter to multi-plant candidates**: canonicals where `plant_count ≥ 2` AND `total_spend ≥ ₹3 Cr`. Anything smaller isn't worth centralising; anything single-plant isn't a centralisation question.

2. **Vendor overlap per candidate**: what % of plants buy from the same top vendor. High overlap (>60%) = already informally centralised, low gain. Low overlap (<40%) = fragmented = real opportunity.

3. **Tag each candidate** Centralise / Centre-Led / Keep-Local / Review using the Category Reference (Part 4).

4. **Savings estimate**:
   - Centralise spend × **3-7%** (industry benchmark for full central category management)
   - Centre-Led spend × **1-3%** (lighter governance, less benefit)
   - Keep-Local + Review → no savings claimed

### Theme 2 — Shared Services

**Question:** which transactional buying can a shared service centre absorb?

1. **Volume-Value Quadrant**: for every canonical, compute its position vs the dataset's 75th-percentile thresholds on (PO count, average PO value):
   - **Q1** high count + low value → Transactional → **SSC candidate**
   - **Q2** high count + high value → Hybrid
   - **Q3** low count + low value → Tail
   - **Q4** low count + high value → Strategic → CoE candidate

2. **Tag Q1 canonicals**: SSC-Suitable / Unsuitable / Centre-Handled using the Category Reference.

3. **Addressable** = sum of spend + PO count across all (Q1 ∩ SSC-Suitable) canonicals.

4. **Savings**:
   - Operational savings = (**₹3,250** current cost-per-PO − **₹1,400** SSC target) × addressable PO count
   - FTE-equivalent freed = addressable PO count / **9,500** (typical SSC productivity, range 4,000-15,000)

### Theme 3 — Centre of Excellence

**Question:** which categories deserve dedicated strategic sourcing attention?

1. **Strategic candidates** = Q4 canonicals from Theme 2 **PLUS** "strategic-by-nature" categories from the Category Reference (refractories, mill rolls, ferro alloys — strategic regardless of where the data places them).

2. **High-concentration flag**: any category where top vendor has >**70%** share is also a CoE candidate regardless of size (single-point-of-failure risk).

3. **Tag**: CoE-Suitable / Already-Strategic / Plant-Owned per Category Reference.

4. **Savings** = addressable CoE-suitable spend × **2-5%** (incremental over Centralisation savings — there is some double-count in both estimates).

### Theme 4 — Tail Spend

**Question:** how much spend leaks through low-value transactions?

1. **Quantify tail two ways, take max**:
   - **Method A — transaction-based**: sum of POs with value < **₹1 Lakh** each (catches one-off small buys)
   - **Method B — category-based**: sum of spend in Q3 canonicals from Theme 2 (catches small categories with many low-value POs)

2. **Vendor footprint**: long-tail vendor share = % of vendors holding the bottom 80% of spend. Pareto check: top 20% of vendors should hold ≥**75%** of spend. If not, vendor base is too fragmented.

3. **Tag Q3 canonicals**: Aggregator-Suitable / Consolidate-Internally / Not-Addressable per Category Reference. Addressable = sum of Aggregator-Suitable spend.

4. **Savings** = addressable × **3-8%** (typical tail-aggregator commercial benefit).

---

## Part 4 — Category Reference (Steel Industry, 34 canonicals)

This table is the actual ruleset. Every category carries its archetype + per-theme tag.

**Archetype legend:** BULK (large-tonnage raw material) · DIRECT (into product, not bulk) · INDIRECT (supports operations, not in product) · SERVICE (labour/expertise) · CAPEX (one-time asset)

### Bulk raw materials
| Category | Archetype | Centralisation | SSC | CoE | Tail |
|---|---|---|---|---|---|
| Iron Ore | BULK | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Coking Coal & Met Coke | BULK | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Thermal Coal | BULK | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Limestone, Dolomite, Flux | BULK | Centralise | Unsuitable | Plant-Owned | Not-Addressable |
| Steel Scrap (MS + SS grades) | BULK | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |

### Direct materials
| Category | Archetype | Centralisation | SSC | CoE | Tail |
|---|---|---|---|---|---|
| Ferro Alloys (FeMn, FeSi, FeCr, FeNi, FeMo) | DIRECT | Centralise | Unsuitable | **CoE-Suitable** *(strategic-by-nature)* | Not-Addressable |
| Hot-Rolled Flat Products (HR Coil, Slab, Plate) | DIRECT | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Acids & Process Chemicals (HNO₃ / H₂SO₄ / HCl / HF / NaOH) | DIRECT | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Basic Refractories (MgO-C, Dolomite-based) | DIRECT | Centralise | Unsuitable | **CoE-Suitable** *(strategic-by-nature)* | Not-Addressable |
| Alumina Refractories (Castable, Mortar, Bricks) | DIRECT | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Refractory Consumables (SEN, Slide Gates, Tundish) | DIRECT | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Graphite Electrodes | DIRECT | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Mill Rolls (Work / Backup / Intermediate) | DIRECT | Centralise | Unsuitable | **CoE-Suitable** *(strategic-by-nature)* | Not-Addressable |

### Indirect materials
| Category | Archetype | Centralisation | SSC | CoE | Tail |
|---|---|---|---|---|---|
| Welding Consumables | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Bearings (Anti-Friction) | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Mechanical Spares (Pumps, Motors, Valves, Hoses) | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Hydraulic & Pneumatic Components | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Electrical Spares & Instrumentation | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Lubricants & Industrial Oils | INDIRECT | Centralise | Suitable | Plant-Owned | Consolidate-Internally |
| Industrial Gases (O₂, N₂, Ar, H₂) | INDIRECT | Centralise | Unsuitable | Plant-Owned | Not-Addressable |
| PPE & Safety Equipment | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Stationery & Office Supplies | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| IT Hardware & Software | INDIRECT | Centre-Led | Centre-Handled | Already-Strategic | Consolidate-Internally |
| Packaging Materials (Strapping, Pallets, Stretch Film) | INDIRECT | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |

### Capex
| Category | Archetype | Centralisation | SSC | CoE | Tail |
|---|---|---|---|---|---|
| Capex — Rolling Mill Equipment | CAPEX | Review | Centre-Handled | CoE-Suitable | Not-Addressable |
| Capex — DRI / Blast Furnace Equipment | CAPEX | Review | Centre-Handled | CoE-Suitable | Not-Addressable |
| Capex — Power Plant & Turbine Equipment | CAPEX | Review | Centre-Handled | CoE-Suitable | Not-Addressable |
| Capex — Cranes & Material Handling | CAPEX | Review | Centre-Handled | CoE-Suitable | Not-Addressable |
| Capex — Civil Construction & Project Works | CAPEX | Review | Centre-Handled | CoE-Suitable | Not-Addressable |

### Services
| Category | Archetype | Centralisation | SSC | CoE | Tail |
|---|---|---|---|---|---|
| AMC & Maintenance Contracts | SERVICE | Centre-Led | Suitable | Plant-Owned | Consolidate-Internally |
| Contract Labour & Manpower | SERVICE | Centre-Led | Suitable | Plant-Owned | Consolidate-Internally |
| Housekeeping & Security | SERVICE | Centre-Led | Suitable | Plant-Owned | Aggregator-Suitable |
| Inplant Transport & Logistics | SERVICE | Centralise | Unsuitable | CoE-Suitable | Not-Addressable |
| Consultancy & Engineering Services | SERVICE | Review | Centre-Handled | CoE-Suitable | Not-Addressable |

### How to read this table

For any new category not in the list, derive defaults from archetype:

- **BULK or DIRECT** → Centralise · Unsuitable for SSC · CoE-Suitable · Not-Addressable for tail
- **INDIRECT (MRO-like)** → Centre-Led · SSC-Suitable · Plant-Owned for CoE · Aggregator-Suitable for tail
- **SERVICE** → Centre-Led · SSC-Suitable · Plant-Owned · Consolidate-Internally
- **CAPEX** → Review · Centre-Handled (consultant manages directly) · CoE-Suitable · Not-Addressable

Override the default whenever the category has unusual properties:

- **Hazmat** → SSC-Unsuitable (specialist handling)
- **Vendor-locked OEM** → CoE-Suitable (concentration risk)
- **Plant-specific** (perishables, captive mines, local logistics) → Plant-Owned for CoE
- **High-volume commodities** (IT, paper, MRO) → Aggregator-Suitable for tail

### Strategic-by-nature shortlist (CoE candidates regardless of quadrant)

Always treat these as strategic CoE candidates even if they don't land in Q4:

> **Refractories · Mill Rolls · Ferro Alloys**

The justification: supply complexity, qualification cycles, low vendor count, and operational impact of failure outweigh the quadrant signal.

---

## Part 5 — Numeric Benchmarks (all thresholds in one place)

### Classification thresholds
- Clean-MATKL / EXTWG rollup threshold: **95%** agreement
- Clean-BISMT-prefix lookup: longest-prefix match
- Buyer-group anchor threshold: **85%** agreement, minimum **5** confident rows

### Theme 1 — Centralisation
- Multi-plant filter: plants ≥ **2** AND spend ≥ **₹3 Cr**
- Vendor-overlap thresholds: high ≥ **60%**, low < **40%**
- Savings rate: Centralise **3-7%** · Centre-Led **1-3%**

### Theme 2 — Shared Services
- Quadrant cutoffs: **75th percentile** on PO count + avg value
- Current cost per PO: **₹2,500-4,000** (typical decentralised)
- SSC target cost per PO: **₹1,000-1,800**
- FTE productivity (SSC): **9,500** POs/FTE/year (range 4,000-15,000)

### Theme 3 — CoE
- High concentration trigger: top vendor share > **70%**
- Strategic min spend for high-concentration flag: **₹5 Cr**
- Savings rate: **2-5%** (incremental over Centralisation)

### Theme 4 — Tail Spend
- Method A threshold: PO value < **₹1 Lakh**
- Pareto health: top 20% vendors should hold ≥ **75%** of spend
- Savings rate: **3-8%** on aggregator-addressable

### Pillar combination
Weighted average of available themes:

| Theme | Weight |
|---|---|
| Centralisation | 0.35 |
| Shared Services | 0.25 |
| CoE | 0.20 |
| Tail Spend | 0.20 |

If a theme couldn't compute (missing inputs), drop it from the denominator and report `coverage_pct` separately so the consumer knows what fraction of the score is grounded.

---

## Appendix A — How to apply these rules without the tool

1. Run Part 1 (cleansing) on the raw PO Excel in any spreadsheet or pandas notebook.
2. Manually assign each MATKL to a canonical from Part 4. Where it's ambiguous, use the cascade in Part 2.
3. For each canonical, compute: total spend, PO count, plant count, vendor count, top-vendor share, avg PO value, contracted %.
4. For each theme in Part 3, apply the filter + tag step using Part 4 lookups + the benchmarks in Part 5.
5. Sum savings, weight per Part 5, and report.

Total effort for a 500-row PO dump: about 4 hours manually, 30 seconds in a tool.

## Appendix B — What this document does NOT cover

- DoA (Delegation of Authority) pillar — separate ruleset
- Buying Channel pillar — separate ruleset
- Org Structure pillar — separate ruleset
- KPI dashboard — derives from these themes' outputs
- RCA (Root-Cause Analysis) rules — separate `rca-rules.yml` per pillar
- AI narrative generation — uses these rule outputs as grounded facts

These are documented separately or live in the Procvault application's KB.
