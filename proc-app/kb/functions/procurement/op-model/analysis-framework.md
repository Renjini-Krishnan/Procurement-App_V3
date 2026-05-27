---
id: op-model-analysis-framework
layer: function
function: procurement
pillar: op-model
version: 1.1
updated: 2026-05-27
owner: kb-admin
---

# Op Model — Analysis Framework

## Pillar Purpose

The Op Model pillar assesses **HOW procurement is organised to BUY** — specifically:
- **Where** buying decisions are made (central vs plant vs BU)
- **Who** handles transactional vs strategic work
- **What** sits in a Center of Excellence
- **How** low-value, fragmented spend (tail) is managed

Op Model is not about org structure (Stage 13 — that's spend/FTE, reporting line, role definitions). Op Model is about the **architecture of buying responsibility** across the procurement function.

The output is a clear, defensible answer to: *"For each category, where SHOULD the buying decision sit, and how SHOULD execution be handled, given the client's spend pattern, industry context, and current state?"*

**Note on Captive supply:** Captive sourcing (e.g., iron ore captives for integrated steel, limestone mines for cement) is a CORPORATE STRATEGY decision — owned by Strategy / CFO / Operations, not the procurement function. It therefore sits OUTSIDE the Op Model pillar. Captive context surfaces in: (a) `industries/<ind>/industry-context.md` as industry backdrop, (b) industry centralisation-filter `naturally_local` tagging (captive vendor flows local), (c) industry QRE noting captive footprint, and (d) savings exclusion (we never apply savings rates to captive flows).

---

## Four Themes Within Op Model

| # | Theme | What it answers | Deep-dive file |
|---|---|---|---|
| 1 | **Centralisation** | Which categories should be procured centrally vs at plant/BU level? What's the savings? | `centralization.md` |
| 2 | **Shared Services (SSC)** | Which transactional categories should be handled by a Shared Service Centre? What's the productivity gain? | `shared-services.md` |
| 3 | **Centre of Excellence (CoE)** | Which strategic / high-value categories warrant dedicated CoE attention? | `coe.md` |
| 4 | **Tail Spend Outsourcing** | Which low-value fragmented categories should be outsourced to managed-procurement aggregators? | `tail-spend.md` |

The four themes are analysed sequentially in the app (Stage 12). Each theme produces:
- Computed analyses (data-driven)
- Industry-filtered tagging (per-theme overlay)
- Quantified savings range
- Qualitative reconciliation against QRE

**Shared analysis foundation:** The **Volume-Value Quadrant** (computed in SS1 from `shared-services.md`) feeds three themes — SSC (Q1), CoE (Q4), and Tail Spend (Q3). One computation, three downstream decisions.

Cross-theme synthesis happens at the end (e.g., "Centralisation gap large AND SSC missing AND CoE absent → systemic under-investment in central capability").

---

## Theme 1 — Centralisation Strategy

### Question
What % of spend should flow through a central procurement entity, vs plant-level or BU-level buying? Which specific categories should be centralised?

### Data Inputs
| # | Input | Source template | Required fields | Why needed |
|---|---|---|---|---|
| 1 | **PO Dump (Gold)** | PO template (Stage 8 output) | `po_id`, `po_date`, `category`, `vendor_id`, `buying_entity` (central/plant/BU), `plant`, `bu`, `po_value`, `po_currency` | Measure where spend actually flows |
| 2 | **Org Structure** | Org Structure template | Buying entity hierarchy | Establish what entities exist |
| 3 | **Categories Master** | shared-kb/industries/<industry>/categories-master.yml | Industry list with `typical_centralisation` | Reference for typical central categories |
| 4 | **QRE responses** | qre-bank.yml | Q-OM-01 to Q-OM-08 — centralisation policy, M&A history, plant autonomy | Qualitative context |

### Computation — 4 metrics

**Metric 1.1 — `opmodel.centralization.spend_central_pct`** — % of total spend through central. SUM(central) / SUM(total) × 100.

**Metric 1.2 — `opmodel.centralization.category_central_pct`** — For each category compute central_pct; classify Fully central (≥95%) / Mostly central (70-95%) / Hybrid (30-70%) / Mostly local (5-30%) / Fully local (<5%). Final metric = % of categories that are Fully central.

**Metric 1.3 — `opmodel.centralization.high_value_central_pct`** — top 20% categories by spend; what % of their spend is centralised? (Strategic centrality)

**Metric 1.4 — `opmodel.centralization.plant_supplier_overlap`** — For each multi-plant category, % of vendors common to all plants. High overlap (>70%) → centralisation easy. Low (<30%) → consolidation needed.

### Finding Generation
Compare each metric vs benchmark cascade (Function default → Industry overlay).

| Metric | Function default | Cement | Steel |
|---|---|---|---|
| spend_central_pct | 70% | 82% | 78% |
| category_central_pct | 55% | 75% | 65% |
| high_value_central_pct | 85% | 92% | 90% |
| plant_supplier_overlap | 55% | 70% | 60% |

**Candidate categories for centralisation** = categories with central_pct<70% AND multi_plant=true AND overlap≥50% AND spend≥₹5 Cr, sorted by spend.

### Recommendation Pathway
- Big spend_central_pct gap + 5+ candidates → centralise specific categories (1-3 year transition)
- high_value_central_pct gap → strengthen oversight (CoE path)
- Low overlap across many categories → supplier consolidation roadmap (pre-cursor)
- No gap → mature, no recommendation

### Savings Quantification
Bottom-up grounded in client spend:
- candidate_spend = SUM(spend on candidates)
- Industry rate: Cement 2-5%, Steel 3-6%, General 2-4%
- savings_low = candidate_spend × low_pct ; savings_high = candidate_spend × high_pct
- Display range with midpoint + reasoning trail

---

## Theme 2 — Shared Services Strategy

### Question
Which transactional categories should be in a Shared Service Centre — standardise process, reduce per-PO cost, free category managers?

### Computation
**Metric 2.1 — transactional_category_pct:** avg_po_value <₹10 lakh → transactional (SSC candidate). ≥₹10 lakh → strategic.

**Metric 2.2 — Volume-Value Quadrant (SHARED with CoE + Tail Spend):**
- Q1 (high volume, low value) = TRANSACTIONAL — SSC candidates
- Q2 (high volume, high value) = STRATEGIC + TRANSACTIONAL hybrid
- Q3 (low volume, low value) = TAIL — drives Theme 4
- Q4 (low volume, high value) = STRATEGIC — CoE candidates (Theme 3)

**Metric 2.3 — current SSC coverage** from QRE.

### Benchmarks
| Metric | Default | Cement | Steel |
|---|---|---|---|
| ssc_current_pct typical | 40% | 50% | 45% |
| transactional category pct | 60-70% | 65-75% | 60-70% |

### Recommendation + Savings
Expand SSC scope. Productivity gain from per-PO cost reduction (30-50%). FTE redeployment > direct savings. 1-2% of addressable transactional spend in OPEX.

---

## Theme 3 — Center of Excellence (CoE) Strategy

### Question
Which strategic high-value high-complexity categories warrant a dedicated CoE — small expert team owning category strategy enterprise-wide?

### Computation
**Metric 3.1 — strategic_category_share:** Q4 of volume-value matrix + single-source + critical specs + YoY price volatility ≥15%. Strategic spend share.

**Metric 3.2 — strategic_in_coe_pct:** From QRE — what % of strategic spend is currently CoE-managed.

### Benchmarks
| Metric | Default | Cement | Steel |
|---|---|---|---|
| strategic_share_pct | 25-35% | 35-45% | 40-50% |
| strategic_in_coe_pct (mature) | 70-80% | 75-85% | 80-90% |

### Recommendation + Savings
Establish CoE for specific strategic categories (3-5 FTE covering 8-15 categories). 2-5% on strategic category spend (better negotiation, supplier consolidation, risk mitigation).

---

## Theme 4 — Tail Spend Approach

### Question
How is low-value fragmented "tail" spend managed? Outsource / consolidate / P-card / RC?

### Computation
**Metric 4.1 — tail_spend_pct** (both methods):
- Method A (category-based): categories with <1% spend share = tail
- Method B (PO-based): POs <₹50,000 = tail

**Metric 4.2 — tail_vendor_count** — vendors with total spend <₹10 lakh. Typically 60-80% of vendors handle <5% of spend.

**Metric 4.3 — coverage_methods** from QRE — current mgmt (P-card / outsourcing / RC / catalog / spot).

### Benchmarks
| Metric | Default | Cement | Steel |
|---|---|---|---|
| tail_spend_pct typical | 10-15% | 5-10% | 12-18% |
| Outsourced tail share (mature) | 60-80% | 60-80% | 60-80% |

### Recommendation + Savings — 3 pathways
1. Service-heavy → Outsource to TSM provider. 3-7% savings on outsourced tail + freed capacity.
2. Repeatable goods → Rate contracts + catalog. 2-5% on consolidated spend.
3. One-off purchases → P-card. 1-3% via process cost reduction.

---

## (Captive Removed — See Pillar Purpose Note Above)

Captive sourcing is a corporate strategy decision, not a procurement function-design decision. It surfaces in industry context, centralisation filter tagging (`naturally_local`), QRE backdrop, and savings exclusion logic — but is NOT an Op Model theme.

---

## Cross-Theme Synthesis

After 4 themes analysed, engine looks for cross-theme patterns:

| Pattern | Synthesis |
|---|---|
| Low central + missing SSC + scattered strategic | Under-investment in central capability — phased build (SSC → CoE → centralisation) |
| High central + low CoE | Volume-based centralisation, value-strategic gap — establish CoE |
| Low central + high tail + fragmented vendors | Sourcing discipline problem — tail outsourcing + centralisation roadmap together |
| SSC gap + Tail outsourcing gap | Transactional efficiency under-built — sequence SSC first then aggregator |

Appears in Op Model findings deck as "Strategic Op Model Imperative" slide.

---

## Op Model Maturity Score (1-5)
```
op_model_score = 0.35 × centralisation
           + 0.25 × shared_services
           + 0.20 × coe
           + 0.20 × tail_spend
```
Weights tunable in Stage 11 — Primer. Theme scoring detail in `scoring-descriptors.yml`.

---

## Output Per Engagement (Stage 12)
1. 4 theme findings cards
2. Specific category lists per recommendation
3. Quantified savings range tied to client data
4. Cross-theme synthesis (Strategic Imperative)
5. Maturity score 1-5 with band descriptor
6. Drill-down to underlying data
7. RCA per finding
8. Source citations

All editable via HITL. Audit log captures approval + edit.

---

## Data Dependencies — Critical Reminder

Op Model analysis cannot run effectively if missing:
| Critical input | Why critical |
|---|---|
| PO `category` (post-Stage-9) | All 4 themes |
| PO `po_value` currency-normalised | Quantification |
| PO `plant` canonical | Centralisation (multi-plant) |
| PO `vendor_id` deduped | Tail vendor footprint + central vendor pattern |
| PO `po_id` + `po_date` | Volume-Value Quadrant + Tail PO sizing |
| QRE Q-OM-01-02, OM-EXC, SS-01-05, SS-EXC, TS-01-04, TS-EXC | Qualitative reconciliation |

If <80% complete, findings flagged "data-limited — directional only".

---

## Required Companion Files
| File | Provides |
|---|---|
| `benchmarks.yml` | Specific benchmark values (function defaults) |
| `analysis-config.yml` | Theme → benchmark wiring + scoring weights |
| `prompts.md` | AI prompts for synthesis + RCA + narrative |
| `recommendations.md` | Recommendation library + savings formulas |
| `scoring-descriptors.yml` | 1-5 means for each theme |
| `rca-patterns.md` | Narrative RCA patterns for AI |
| `rca-rules.yml` | Deterministic RCA rules |
| Industry overlays | `shared-kb/industries/<industry>/by-function/procurement/op-model/` |

---

## Confidence Indicators
- **High** — All critical inputs + AI/rule convergent + high-confidence benchmarks
- **Medium** — One partial OR moderate benchmark confidence
- **Low** — Multiple gaps OR conflicting signals; flagged "directional"

## Versioning
- v1.0 — Initial framework (2026-05-27)
