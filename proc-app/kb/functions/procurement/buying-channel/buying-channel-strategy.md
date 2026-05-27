---
id: buying-channel-strategy
layer: function
function: procurement
pillar: buying-channel
theme: buying-channel-strategy
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Buying Channel Strategy — Theme Deep Dive

## Purpose

The Buying Channel Strategy theme answers, for every material group in the client's portfolio:

**"Given the spend profile (frequency, value, archetype, supplier landscape), what is the right buying channel — and is the client currently using it?"**

This is the only theme in the Buying Channel pillar. It produces a per-MG recommended channel, a match-status flag against the current channel, a migration priority, and risk/aggregation flags. All outputs operational (TAT, buyer-bandwidth, contract coverage lift) — no ₹ savings (those belong to Op Model).

## Logic Embodied

13 analyses across the 4-question framework:

| ID | Analysis | Question Group | Decision-driving? |
|---|---|---|---|
| **BC1** | Portfolio Channel Mix Today | Q1 — Baseline | No |
| **BC2** | Per-MG Current Profile | Q1 — Baseline | No |
| **BC3** | Archetype × Channel Heat-Map | Q1 — Baseline | No |
| **BC4** | Recommended Channel per MG (engine core) | Q2 — Opportunity | **YES** |
| **BC5** | Match-Status per MG | Q2 — Opportunity | **YES** |
| **BC6** | Migration Opportunities by Target Channel | Q2 — Opportunity | **YES** |
| **BC7** | Cross-Plant Aggregation Opportunity | Q2 — Opportunity | **YES** |
| **BC8** | Sole-Source Risk Categories (3 sub-signals) | Q3 — Feasibility | **YES** |
| **BC9** | Project / One-Off Exclusion | Q3 — Feasibility | No |
| **BC10** | UNCLASSIFIED MGs (cross-pillar finding) | Q3 — Feasibility | No |
| **BC11** | TAT Savings from Channel Migration | Q4 — Quantification | **YES** |
| **BC12** | Buyer Bandwidth Freed | Q4 — Quantification | **YES** |
| **BC13** | Contract Coverage Lift Estimate | Q4 — Quantification | **YES** |

## Editable Configuration

Per-archetype thresholds drive the BC4 engine. All configurable via `analysis-config.yml`.

```yaml
direct.high_value_avg_po_inr:        5,000,000     # ₹50L
indirect.low_value_avg_po_inr:       50,000        # ₹50K
indirect.medium_value_avg_po_inr:    500,000       # ₹5L
service.high_value_avg_po_inr:       500,000       # ₹5L
bulk.full_ltc_threshold_total_inr_cr: 5            # ₹5 Cr/year
high_freq_po_count_6mo_threshold:    5             # > 5 POs in 6 months
strategic_attention_po_inr:          10,000,000    # ₹1 Cr (escalation flag)
transformation_ceiling_lift_pp:      25            # max contracted % lift per programme
```

Edit-risk: thresholds MEDIUM, recommendation rules HIGH, TAT benchmarks HIGH.

---

# 1. Pre-requisites

- **PO dump** (12-24 months) with mandatory fields: PO_Number, PO_Item, PO_Creation_Date, Material_Group, Material_Group_Desc, Net_Value, Vendor_ID, Plant
- **PR dump** (optional — required only for BC11 TAT computation)
- **Stage 9 reclassification complete** — `reclassified_category` per PO line + `archetype` field populated in `categories-master.yml`
  - If Stage 9 unavailable: engine falls back to keyword bank (see `analysis-config.yml` archetype_keyword_banks). MEDIUM/LOW confidence.
- **QREs Q-BC-01 through Q-BC-14** — optional for engine; required for narrative reconciliation

---

# 2. Analytical Framework

## Q1 — WHAT IS the channel state today? (Baseline)

### BC1 — Portfolio Channel Mix Today

```
For all POs in scope:
  channel = derive_current_channel(PO)   # See channel_derivation in analysis-config.yml
  
  portfolio_spend_by_channel:
    rc_lt_spend       = Σ Net_Value WHERE channel = rc_long_term_contract
    ola_spend         = Σ Net_Value WHERE channel = rc_outline_agreement
    catalogue_spend   = Σ Net_Value WHERE channel = rc_rop_catalogue
    asl_spend         = Σ Net_Value WHERE channel = asl   # rare; ASL usually inferred not derived
    rfq_spend         = Σ Net_Value WHERE channel = rfq_tendering   # similar
    pac_spend         = Σ Net_Value WHERE channel = single_tender_pac
    spot_spend        = Σ Net_Value WHERE channel = spot_uncontracted
  
  total = Σ all
  channel_share_pct  = channel_spend / total × 100
```

**Output:** 7-row table + stacked bar visualization. Compare against benchmark band (default Indian large enterprise: 25-45% contracted). Flag if outside.

**Notes on derivation honesty:** ASL and RFQ classifications are typically inferred (not directly visible in PO contract reference fields), so the engine often collapses Spot/RFQ/ASL into the "Spot / Uncontracted" bucket unless additional master data is available. The narrative explicitly flags this when contract-field population is below 50%.

### BC2 — Per-MG Current Profile

```
For each MG in PO dump:
  # Quantitative signals
  total_spend             = Σ Net_Value
  spend_share_pct         = total_spend / Σ portfolio Net_Value × 100
  po_count                = COUNT(DISTINCT PO_Number || PO_Item)
  po_count_6mo            = MAX(po_count in any rolling 6-month window)   # for high_freq check
  distinct_months         = COUNT(DISTINCT YEAR-MONTH of PO_Creation_Date)
  avg_po_value            = total_spend / po_count
  median_po_value         = MEDIAN(Net_Value)   # surfaced for context; not used in routing
  vendor_count            = COUNT(DISTINCT Vendor_ID)
  top_vendor_spend_share  = MAX(Σ Net_Value per Vendor_ID) / total_spend × 100
  plant_count             = COUNT(DISTINCT Plant)
  
  # Qualitative (from Stage 9)
  reclassified_category   = Stage 9 output
  archetype               = categories-master.yml[reclassified_category].archetype
  reclassification_confidence = Stage 9 confidence (HIGH/MEDIUM/LOW/UNCLASSIFIED)
  
  # Original from client PO (dual-view)
  original_mg_code        = PO Material_Group
  original_mg_desc        = PO Material_Group_Desc
  
  # Current channel signal
  is_contracted           = derive per priority order (Contract_Number → Outline_Agreement → ...)
  contracted_pct          = Σ Net_Value WHERE is_contracted / total_spend × 100
  current_channel_label   = "Largely Contracted (>80%)" | "Partially (40-80%)" | "Minimally (<40%)" | "Spot (0%)"
  
  # PAC signal
  pac_flag_pct            = Σ POs with PAC signal / po_count × 100   # PAC_Flag OR short_text regex
```

**Output:** Per-MG table with all the above columns. Sorted by `spend_share_pct` desc. This is the foundational data structure that BC3-BC13 read from.

**Dual-view enforced:** every row carries both `original_mg_code/desc` AND `reclassified_category/archetype`.

### BC3 — Archetype × Channel Heat-Map

```
Pivot table:
  rows    = archetype (BULK, DIRECT, INDIRECT, SERVICE, CAPEX, UNCLASSIFIED)
  columns = current_channel
  cells   = Σ Net_Value (spend) AND/OR PO count
  
For each cell: cell_share_pct = cell_value / row_total × 100
```

**Output:** Heat-map. Surfaces where each archetype's spend is *actually* flowing today vs where it *should* flow:
- BULK row dominated by Spot → red flag (should be RC-LT)
- INDIRECT row dominated by Spot → red flag (should be Catalogue/OLA)
- CAPEX row in RFQ → expected
- DIRECT row in ASL/RFQ → likely fine; PAC concentration warrants flag

---

## Q2 — WHERE COULD we route differently? (Opportunity)

### BC4 — Recommended Channel per MG (THE ENGINE CORE)

For each MG, evaluate 13 IF-THEN rules in priority order. First matching rule wins. Full rules in `analysis-config.yml` recommendation_rules; summarised here:

| Rule | Archetype | Condition | Recommended Channel |
|---|---|---|---|
| R1 | any | pac_pct ≥ 50% | Single-Tender / PAC + vendor-dev flag |
| R2 | CAPEX | always | RFQ |
| R3 | BULK | total_spend ≥ ₹5 Cr/year AND high_freq | RC-LT |
| R4 | BULK | else | OLA |
| R5 | INDIRECT | avg_po ≤ ₹50K AND high_freq | Catalogue / ROP |
| R6 | INDIRECT | avg_po ≤ ₹5L AND po_count_6mo ≥ 3 | OLA |
| R7 | INDIRECT | avg_po > ₹5L | ASL |
| R8 | SERVICE | high_freq | OLA (annual contract / call-offs) |
| R9 | SERVICE | low_freq AND avg_po ≥ ₹5L | RFQ (project tender) |
| R10 | DIRECT | vendor_count ≥ 3 AND avg_po < ₹50L | ASL |
| R11 | DIRECT | avg_po ≥ ₹50L | ASL + flag top vendor for RC-LT |
| R12 | DIRECT | vendor_count ≤ 2 AND pac_pct < 50% | ASL + vendor-dev flag |
| R13 | UNCLASSIFIED | fallback | RFQ + Material Master finding |

**Decision matrix (visual summary — same logic as rules):**

| Archetype | High value (≥₹threshold) + High freq | High value + Low freq | Low value + High freq | Low value + Low freq |
|---|---|---|---|---|
| **BULK** | RC-LT (≥₹5 Cr/yr) | RC-LT (review) | (rare) | OLA |
| **DIRECT** | ASL + RC-LT flag (≥₹50L) | ASL | (rare) | ASL |
| **INDIRECT** | OLA (≤₹5L) or ASL (>₹5L) | RFQ / ASL (engineered) | Catalogue (≤₹50K) | OLA (light) |
| **SERVICE** | OLA (recurring AMC / labour) | RFQ (project, ≥₹5L) | OLA (call-off) | RFQ |
| **CAPEX** | (rare) | RFQ | (rare) | RFQ |

**Output:** Per-MG `recommended_channel` + `recommendation_confidence` (inherited from archetype confidence × rule confidence) + any flags from the rule.

### BC5 — Match Status per MG

```
For each MG:
  match_status = compare(current_channel, recommended_channel)
  
  IF current_channel = recommended_channel       → "✅ Already Right"
  ELIF current_channel is contracted AND
       recommended_channel is contracted AND
       current ≠ recommended                       → "⚠️ Over-Engineered" 
                                                     (e.g., RC-LT used where OLA fits)
  ELIF current_channel = spot_uncontracted AND
       recommended_channel ≠ spot_uncontracted     → "❌ Misrouted (Spot → Should Be Contracted)"
  ELIF current_channel ≠ recommended_channel      → "❌ Misrouted"
  ELIF archetype = UNCLASSIFIED                   → "🚫 Unrecoverable (Material Master issue)"
```

**Output:** Per-MG `match_status`. Portfolio rollup: count + spend % across the 4 buckets.

**The "Misrouted" bucket is the migration roadmap.**

### BC6 — Migration Opportunities by Target Channel

```
For each target channel C in [RC-LT, OLA, Catalogue, ASL]:
  candidates = filter MGs where recommended_channel = C AND current_channel ≠ C
  
  For each candidate:
    migration_priority = HIGH if spend_share_pct > 1.0%
                         MEDIUM if spend_share_pct > 0.1%
                         LOW otherwise
  
  Sort by spend desc, capped at top 50 per channel.
```

**Output:** Per-target-channel migration list. The top-priority items become the consultant's roadmap slides.

### BC7 — Cross-Plant Aggregation Opportunity

```
For each MG with plant_count ≥ 2:
  vendor_overlap_pct = % of plants whose top vendor matches the cross-plant top vendor
  
  IF vendor_overlap_pct < 50%:
    flag: "Cross-plant fragmentation — vendor consolidation precondition for contract channels"
    handoff to: op-model.centralisation (BC7 + Op Model C2 vendor pattern feed each other)
```

**Output:** Cross-plant aggregation candidate list. Cross-pillar handoff to Op Model centralisation theme.

**Why this matters:** an MG can't move to a contracted channel until its supplier base is consolidated. BC7 surfaces these as preconditions, not as channel decisions per se.

---

## Q3 — WHICH MGs won't move? (Feasibility filter)

### BC8 — Sole-Source Risk Categories (3 sub-signals combined)

Real PO dumps rarely have a clean `PAC_Flag` column. So sole-source risk is detected from three sub-signals (any one triggers the flag; combinations escalate it):

| Sub-signal | Detection logic | Confidence | Column / source |
|---|---|---|---|
| **BC8a — Single-Vendor** | `distinct_vendor_count = 1` for the MG | HIGH | Always computable from Vendor_ID |
| **BC8b — Concentrated** | `top_vendor_spend_share ≥ 80%` (single vendor commands ≥80% even if 2+ vendors exist) | HIGH | Always computable |
| **BC8c — PAC-Justified** | Any of: PAC_Flag column non-blank, short_text regex match (`/proprietary\|OEM\|sole.?source\|PAC\|single.?source/i`), QRE Q-BC-12 confirmation | LOW–MEDIUM (heuristic); HIGH if QRE confirms | PAC_Flag (rare), Short_Text (sometimes), QRE (optional) |

**Combined logic per MG:**

```
sole_source_risk = NONE
IF bc8a_fired: sole_source_risk = "Single-Vendor"
ELIF bc8b_fired: sole_source_risk = "Concentrated"
IF bc8c_fired: sole_source_risk += " + PAC-Justified"

# Recommendations:
- "Single-Vendor + no PAC" → "Develop alternates (vendor development action)"
- "Concentrated + no PAC" → "Diversify supplier base"
- "PAC-Justified" alone → "Sustain + monitor; periodic PAC review"
- "Single-Vendor + PAC-Justified" → "Critical risk — structured vendor development programme"
```

**Output:** Sole-source risk register per MG. Cross-pillar handoff to Supplier pillar for SRM analysis.

### BC9 — Project / One-Off Exclusion

```
For each MG:
  is_project_one_off = (archetype = CAPEX) OR (distinct_months < 3) OR (po_count < 5)
  
  IF is_project_one_off:
    exclude from BC4-BC7 migration roadmap
    annotate: "Project / one-off — not contract candidate"
```

**Output:** Exclusion list. Surfaces in the report as a non-actionable category but maintains transparency about what wasn't recommended for migration.

### BC10 — UNCLASSIFIED MGs (cross-pillar Material Master finding)

```
unclassified_mgs = MGs where archetype = UNCLASSIFIED (Stage 9 couldn't classify)

unclassified_count        = len(unclassified_mgs)
unclassified_spend_inr    = Σ total_spend across unclassified_mgs
unclassified_spend_pct    = unclassified_spend_inr / portfolio_spend × 100

IF unclassified_spend_pct > 5%:
  flag: "Material master data quality issue — high UNCLASSIFIED %"
  cross_pillar_handoff to: material-master
```

**Output:** UNCLASSIFIED MG count + spend impact. This is NOT a Buying Channel finding — it's a Material Master MG-description-quality issue surfaced by this pillar. The handoff package gives Material Master pillar the list to investigate.

---

## Q4 — HOW MUCH at stake? (Quantification)

### BC11 — TAT Savings from Channel Migration

```
Pre-condition: PR dump available AND PR-PO join coverage ≥ 70%
  (If not met, BC11 skips with "TAT impact not computed — PR dump required" note.)

For each MG in the migration list (BC6):
  current_channel_tat   = lookup in tat_benchmarks[current_channel]
  target_channel_tat    = lookup in tat_benchmarks[recommended_channel]
  per_po_tat_saving     = current_channel_tat - target_channel_tat
  mg_tat_saving_days    = po_count_annualized × per_po_tat_saving

# Transformation ceiling cap (realistic ramp-up)
migrated_spend_lift_pp  = Σ migrated_spend / total_spend × 100
IF migrated_spend_lift_pp > transformation_ceiling_lift_pp (default 25):
  scale back migrations proportionally to cap at 25 pp lift
  flag: "Transformation ceiling applied — phased migration assumed"

portfolio_tat_saving_days_per_year = Σ mg_tat_saving_days (after ceiling)
weighted_avg_tat_reduction_days    = portfolio_tat_saving_days / total_po_count
```

**Output:** Portfolio TAT savings in days/year + per-MG breakdown.

### BC12 — Buyer Bandwidth Freed

```
For each MG in the migration list:
  current_touch_hours_per_po  = lookup table per channel
                                 (Spot: 4h, RFQ: 6h, OLA call-off: 0.5h, Catalogue: 0.1h)
  target_touch_hours_per_po   = same lookup, for recommended channel
  per_po_hours_saved          = current_touch_hours - target_touch_hours
  mg_hours_saved_per_year     = po_count_annualized × per_po_hours_saved

portfolio_hours_saved_per_year = Σ mg_hours_saved
fte_equivalent_freed           = portfolio_hours_saved / annual_buyer_hours (default 1,800)
```

**Output:** FTE-equivalent freed. **Framed as productivity, not cost-out** — these FTEs can be redeployed (to category management, strategic sourcing, SRM) rather than removed from headcount. This boundary is enforced by the AI prompts and recommendation library.

### BC13 — Contract Coverage Lift Estimate

```
current_contracted_pct = Σ contracted_spend / total_spend × 100   # from BC2

migration_contracted_spend = Σ migrated_spend WHERE recommended_channel is contracted (RC-LT, OLA, Catalogue)
target_contracted_pct      = current_contracted_pct + (migration_contracted_spend / total_spend × 100)

# Apply transformation ceiling
target_contracted_pct      = MIN(target_contracted_pct, current_contracted_pct + 25)   # 25 pp cap

gap_to_benchmark_low       = MAX(0, typical_low - current_contracted_pct)
gap_to_benchmark_bic       = MAX(0, bic_low - current_contracted_pct)
benchmark_gap_closure_pct  = (target_contracted_pct - current_contracted_pct) / 
                              (bic_low - current_contracted_pct) × 100
```

**Output:** As-is contracted %, To-be (post-migration capped) contracted %, % point lift, gap closure vs benchmark.

---

# 3. ABC Steel Worked Example

Setup: Integrated steel mill / 3 plants / ₹5,000 Cr annual procurement / 18-month PO dump / ~45,000 PO lines / Stage 9 classification 92% complete.

**BC1 portfolio mix today (output):**

| Channel | Spend (₹ Cr) | Spend % | PO % |
|---|---|---|---|
| RC-LT (derived from Contract_Number) | 1,500 | 30% | 12% |
| OLA (derived from Outline_Agreement) | 350 | 7% | 7% |
| Catalogue/Scheduling | 70 | 1.4% | 4% |
| Spot / Uncontracted | 3,080 | 61.6% | 77% |
| **Total** | **5,000** | **100%** | **100%** |

Benchmark Indian large enterprise: 25-45% contracted. ABC Steel at **38.4% contracted** — within band but at the lower edge.

**BC2-BC5 per-MG output (illustrative subset):**

| MG | Original code | Original desc | Reclassified category | Archetype | Total spend | po_count | po_count_6mo | avg_po | Vendors | top_vendor_share | pac_pct | Current channel | Recommended (rule fired) | Match status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MG001 | 1010100023 | "COAL THERMAL GR-A 5K" | Steel — Thermal Coal | BULK | ₹412 Cr | 1840 | 880 | ₹22 L | 6 | 40% | 0% | RC-LT (72%) | **RC-LT (R3)** | ✅ Already Right |
| MG002 | 1010100107 | "IRON ORE FINES OPEN MKT" | Steel — Iron Ore Open Market | BULK | ₹380 Cr | 2150 | 1100 | ₹17 L | 4 | 55% | 0% | RC-LT (91%) | **RC-LT (R3)** | ✅ Already Right |
| MG003 | 2020300045 | "REFRACTORY BRICK MAG-C" | Steel — Refractory Brick | DIRECT | ₹285 Cr | 920 | 480 | ₹31 L | 12 | 25% | 5% | Partially (25%) | **ASL (R10)** | ❌ Misrouted |
| MG017 | 3030400218 | "BEARING MECH SPARE" | MRO — Bearings | INDIRECT | ₹39 Cr | 2940 | 1500 | ₹1.3 L | 84 | 8% | 4% | Spot (0%) | **OLA (R6)** | ❌ Misrouted (Spot → Should Be Contracted) |
| MG044 | 3030400089 | "LUBRICATION OIL HYDRAULIC" | MRO — Lubricants | INDIRECT | ₹8 Cr | 380 | 200 | ₹2.2 L | 5 | 35% | 0% | RC-LT (85%) | **OLA (R6)** | ⚠️ Over-Engineered |
| MG055 | 4040500011 | "CRANE EOT 50T NEW PLANT-2" | CAPEX — Material Handling Eqpt | CAPEX | ₹6 Cr | 4 | 2 | ₹1.5 Cr | 3 | 50% | 25% | Spot (0%) | **RFQ (R2)** | ✅ Already Right |
| MG999 | 2020300089 | "REFRACTORY SPECIALTY CASTABLE" | Steel — Refractory Specialty | DIRECT | ₹15 Cr | 60 | 35 | ₹25 L | 1 | 100% | 80% | Single-tender (80%) | **PAC (R1)** | ✅ Already Right + Flag |

**Key reads from the example:**

- **MG017 Bearings** is the headline finding: ₹39 Cr in 2,940 spot POs across 84 vendors. Recommended OLA migration → also triggers BC7 (cross-plant aggregation needed — 84 vendors means consolidation must precede contract).
- **MG044 Lubricants** is "Over-Engineered": already contracted (85%) but on RC-LT when OLA fits. Likely worth conversion to OLA to simplify management — but lower priority than spot-to-contracted migrations.
- **MG999 Refractory Specialty** correctly flagged PAC + Single-Vendor (BC8a + BC8c both fire). Recommendation: SRM monitoring + periodic PAC review; vendor development action.
- **MG003 Refractories — Brick** has 12 vendors, low PAC — clean ASL candidate. Currently partially contracted (25%); migrating to ASL formalises the panel.

**BC6 migration opportunities (top 5 by spend):**

| Target Channel | MGs flagged for migration | Spend addressable (₹ Cr) | Priority |
|---|---|---|---|
| OLA (from Spot/Catalogue) | MG017 + 23 other INDIRECT MGs | 145 | HIGH (12 MGs > ₹1 Cr each) |
| ASL (from Spot/Single-tender) | MG003 + 8 other DIRECT MGs | 580 | HIGH |
| Catalogue (from Spot) | 18 small INDIRECT MGs (consumables) | 12 | MEDIUM (low value individually but high PO count) |
| OLA (from RC-LT — Over-Engineered) | MG044 + 4 others | 18 | LOW |

**BC11 TAT impact (PR dump available, 78% join coverage):**

Migrations modelled with 25 pp ceiling: as-is 38.4% contracted → to-be 58% contracted (19.6 pp lift, within ceiling).
- Weighted avg TAT today: ~32 days/PO
- Weighted avg TAT post-migration: ~14 days/PO
- **TAT reduction: ~18 days/PO weighted average**
- Portfolio TAT savings: ~145,000 days/year (across migrated PO volume)

**BC12 buyer bandwidth:**
- Migrated spot/RFQ POs → catalogue/OLA: ~22,000 POs moved to lighter channels
- Touch-time reduction: ~75,000 hours/year
- **FTE-equivalent freed: ~42 FTEs** (for redeployment to category mgmt + strategic sourcing)

**BC13 contract coverage lift:**
- As-is: 38.4% → To-be: 58% (capped at ceiling)
- Benchmark gap closure: 58% vs Indian large enterprise typical_high 45% — now at BIC band lower edge (BIC_low: 70%)
- Gap closure: 56% of the way to BIC

---

# 4. Boundaries

| Out of scope for this theme | Where it goes |
|---|---|
| ₹ savings from channel migration | Op Model — Centralisation / SSC / CoE savings rates |
| Vendor performance, OTD, quality, defect rate | Supplier + Post-PO pillars |
| e-Auction setup, catalogue platform technology | Consulting deliverable, not engine-computable |
| Real-time PR routing (operational P2P) | This is diagnostic engine, not P2P engine |
| Contract negotiation strategy, commercial terms | Op Model — CoE theme |
| Buyer-level performance | Org Structure pillar |
| Sub-bucketing "Contracted" into RC-LT vs OLA vs Catalogue beyond what contract reference fields indicate | Build 2 enhancement (requires contract master join) |

---

# 5. RCA Patterns Referenced

| Finding | Typical root causes (narrative — see `rca-patterns.md` for full library) |
|---|---|
| Many INDIRECT MGs recommended for catalogue but currently Spot | No catalogue / ROP programme; or catalogue exists but maintenance lapsed (out-of-date items); buyer behaviour bypasses catalogue |
| Many DIRECT MGs flagged Single-Vendor / Concentrated | Strategic supplier consolidation never undertaken; vendor development programme absent; spec-protectionism (engineering-led sole-source preferences) |
| BULK MGs not on long-term contracts | Strategic sourcing programme absent OR contracts lapsed without renewal; commodity-pricing exposure unhedged |
| SERVICE MGs without OLA | Service procurement treated as transactional / project-by-project despite recurring nature; framework agreement programme missing |
| High UNCLASSIFIED MG count (>15% of MGs) | Material master MG descriptions too generic / cryptic to parse; MM data-quality issue; cross-pillar handoff |
| High portfolio contracted % but high portfolio TAT | "Paper contracts" — contracts exist but bypassed; contract leakage; PO process doesn't enforce contract reference |
| High cross-plant fragmentation (BC7) | Plant-level autonomy without cross-plant procurement governance; M&A heritage with no PMI on procurement; missed centralisation |

Deterministic RCA rules in `rca-rules.yml`; narrative RCA patterns in `rca-patterns.md`.

---

# 6. Confidence Indicators

| Confidence level | When |
|---|---|
| **High** | PO dump ≥ 12 months; Stage 9 classification ≥ 90%; contract-reference fields populated ≥ 90%; PR dump available with ≥ 80% join coverage |
| **Medium** | PO dump ≥ 12 months; Stage 9 ≥ 80%; contract-reference fields populated 70-90% OR PR dump unavailable (BC11 skipped) |
| **Low** | Stage 9 < 80% (many MGs fall to UNCLASSIFIED); contract-reference fields populated < 70% (current contracted % a lower bound) |

When confidence is Low, the theme narrative explicitly states the limitation and surfaces it as a data-quality finding (Material Master pillar handoff for MG description quality; ERP master-data discipline review for contract-field population).
