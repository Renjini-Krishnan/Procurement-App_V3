# Buying Channel — Functional Rules

> **Tool-independent ruleset.** Determines the *right way to buy* each material group (long-term contract, framework agreement, catalogue, panel, RFQ, single-tender) based on archetype, value, frequency, and vendor base.

**Scope:** assesses the client's current channel mix against a normative recommendation per category, surfaces misrouted spend, and quantifies the lift from migrating to the right channel.

**Inputs required:**

- **Per-MG aggregate** (from Op Model Part 1-2 cleansing + Stage 10 aggregation): one row per canonical category with
  `archetype`, `total_spend_inr`, `po_count`, `po_count_6mo`, `avg_po_value`, `vendor_count`, `top_vendor_share_pct`, `pac_pct`, `contracted_pct`, `plant_count`, `distinct_months`, `material_group_desc`
- **Raw PO data** (for current channel derivation) — must carry `contract_number`, `outline_agreement`, `scheduling_agreement`, `short_text`

No QRE responses needed. Single-theme pillar.

---

## Part 1 — The 6 Channels

| Channel | When to use |
|---|---|
| **rc_long_term_contract** (RC-LTC) | Bulk RM, multi-year, high volume + high spend |
| **rc_outline_agreement** (OLA) | Recurring annual buy, multi-vendor framework |
| **rc_rop_catalogue** (Catalogue / ROP) | High-frequency low-value indirect — auto-replenishment |
| **asl** (Approved Supplier List) | Panel of 3-5 qualified vendors, RFQ within panel |
| **rfq_tendering** | One-off / project / unclassified — full tender |
| **single_tender_pac** | OEM lock / PAC / sole source justified |

---

## Part 2 — Channel Recommendation Engine (13 rules)

Each canonical category gets one recommendation. **First matching rule wins** — apply in order.

### Rule 1 — PAC override (highest priority)
```
IF pac_pct >= 50% → single_tender_pac
```
Half-plus the spend already PAC-flagged = treat as legitimate single-source.

### Rule 2 — CAPEX always RFQ
```
IF archetype = CAPEX → rfq_tendering
```
Project-driven, one-off, never templated.

### Rule 3 — BULK with full LTC profile
```
IF archetype = BULK
   AND total_spend_inr_cr >= 5 Cr
   AND po_count_6mo > 5
→ rc_long_term_contract
```
Big-volume + steady frequency = long-term contract worth the negotiation effort.

### Rule 4 — BULK smaller / less frequent
```
IF archetype = BULK
→ rc_outline_agreement
```
(After Rule 3 didn't fire.) Smaller bulk = framework instead of multi-year LTC.

### Rule 5 — INDIRECT low-value high-frequency
```
IF archetype = INDIRECT
   AND avg_po_value <= ₹50,000
   AND po_count_6mo > 5
→ rc_rop_catalogue
```
Low-value transactional = punch-out catalogue with auto-replenishment.

### Rule 6 — INDIRECT mid-value recurring
```
IF archetype = INDIRECT
   AND avg_po_value <= ₹5,00,000
   AND po_count_6mo >= 3
→ rc_outline_agreement
```
Mid-value MRO = framework with call-offs.

### Rule 7 — INDIRECT high-value engineered
```
IF archetype = INDIRECT
   AND avg_po_value > ₹5,00,000
→ asl (approved supplier list)
```
Bigger-ticket spares need vendor qualification, not catalogue.

### Rule 8 — SERVICE high-frequency
```
IF archetype = SERVICE
   AND po_count_6mo > 5
→ rc_outline_agreement
```
Recurring services (AMC, housekeeping, transport) = framework.

### Rule 9 — SERVICE project / one-off
```
IF archetype = SERVICE
   AND po_count_6mo <= 2
   AND avg_po_value >= ₹5,00,000
→ rfq_tendering
```
Big one-off service engagements = full tender.

### Rule 10 — DIRECT panel buy
```
IF archetype = DIRECT
   AND vendor_count >= 3
   AND avg_po_value < ₹50,00,000
→ asl
```
Multiple qualified vendors, mid-value direct material = panel approach.

### Rule 11 — DIRECT high-value
```
IF archetype = DIRECT
   AND avg_po_value >= ₹50,00,000
→ asl (plus consider RC-LTC for top vendors in panel)
```
High-value direct = panel + LTC on the most-used vendors.

### Rule 12 — DIRECT narrow vendor base
```
IF archetype = DIRECT
   AND vendor_count <= 2
→ asl (and develop alternates)
```
Concentrated supply base = panel + dual-source development plan.

### Rule 13 — Unclassified fallback
```
IF none of the above → rfq_tendering
```
When archetype is UNKNOWN, default to formal tender (safest).

---

## Part 3 — Current Channel Derivation (per row)

For each PO line, classify the *current* channel from the contract reference fields:

```
IF contract_number is populated      → rc_long_term_contract
ELSE IF outline_agreement populated  → rc_outline_agreement
ELSE IF scheduling_agreement populated → rc_rop_catalogue
ELSE IF short_text contains any of {"PAC","PROPRIETARY","OEM","SOLE SOURCE","SINGLE SOURCE"}
                                      → single_tender_pac
ELSE                                  → spot_uncontracted
```

Per material-group level approximation (when row-level is too noisy):
```
contracted_pct >= 80% → rc_long_term_contract
contracted_pct >= 40% → rc_outline_agreement
contracted_pct >= 1%  → rc_rop_catalogue
else                  → spot_uncontracted
```

---

## Part 4 — Match Status (current vs recommended)

For each canonical category compare current to recommended:

| Status | Meaning |
|---|---|
| **already_right** | current == recommended ✓ |
| **over_engineered** | both contracted, but recommendation is a lighter channel (e.g. on a heavy LTC for catalogue-suitable items) |
| **misrouted** | current ≠ recommended AND one of them is spot/uncontracted |
| **unrecoverable** | archetype = UNCLASSIFIED → no recommendation possible |

The `misrouted` count + spend is the headline number — categories where switching channel would deliver real value.

---

## Part 5 — Aggregations / Components

### BC1 — Portfolio channel mix
% of total spend in each of the 6 channels (current state). Headline KPI: `contracted_spend_pct` = sum of {RC-LTC + OLA + Catalogue} share.

### BC3 — Archetype × Channel heatmap
For each archetype (BULK / DIRECT / INDIRECT / SERVICE / CAPEX) show the current channel mix in %. Surfaces obvious mismatches (e.g. BULK with 70% spot = problem).

### BC5 — Match status counts
Counts + spend per match status (already_right / over_engineered / misrouted / unrecoverable).

### BC6 — Migration opportunities
Of the `misrouted` set, group by *target* channel:
- catalogue_count — MGs that should move to catalogue
- ola_count — should move to OLA
- rc_lt_count — should move to LTC
- asl_count — should move to ASL
- rfq_count — should move to RFQ
- single_tender_count — should be reclassified as PAC

Plus a top-20 candidates table sorted by spend (the conversation-starter list).

### BC7 — Cross-plant aggregation
Categories bought by ≥2 plants. Pure spend visibility, no scoring.

### BC8 — Sole-source risk
- `single_vendor_count` — categories where `vendor_count = 1`
- `concentrated_count` — categories where `top_vendor_share_pct >= 80%`
- `pac_justified_count` — categories where `pac_pct >= 50%`
- `sole_source_count` = union of single_vendor + pac_justified (unique categories)
- Top-10 single-vendor categories by spend

### BC9 — Project / one-off (exempted)
- `archetype = CAPEX`
- OR `distinct_months < 3`
- OR `po_count < 5`

These get exempted from migration analysis — they're inherently project-shaped.

### BC10 — Unclassified MGs (cross-pillar signal)
- `unclassified_count` — MGs with archetype = UNCLASSIFIED
- `unclassified_pct` — share of MGs
- `unclassified_spend_pct` — share of spend
This is the bridge to the Material Master pillar — unclassified spend can't be channel-routed reliably.

### BC13 — Contract coverage lift estimate
```
contracted_now_pct = current contracted spend %
migration_spend = spend in misrouted MGs whose recommendation is a contracted channel
lift_pp = migration_spend / total_spend × 100
lift_pp_capped = min(lift_pp, 25)    # transformation ceiling
to_be_contracted_pct = contracted_now_pct + lift_pp_capped
```
The 25 percentage-point cap models transformation realism — no client moves from 20% to 70% contracted in one year.

---

## Part 6 — Verdict thresholds (single theme)

| Score | Trigger |
|---|---|
| Initial | contracted_pct < 25% OR sole_source_count > 15 |
| Developing | contracted_pct < 40% OR sole_source_count > 10 |
| Defined | contracted_pct < 55% |
| Managed | contracted_pct < 70% |
| Optimised | contracted_pct ≥ 70% |

---

## Part 7 — RCA Rules

| Rule ID | Triggers when | Card |
|---|---|---|
| `r01_very_low_contracted_pct` | BC1 contracted_spend_pct < 25% | Channel programme absent or vestigial |
| `r05_catalogue_opportunity_unrealised` | BC5 misrouted_count ≥ 10 | Many MGs routed to wrong channel |
| `r09_high_pac_concentration` | BC8 sole_source_count ≥ 5 | Excessive PAC justifications; vendor lock-in risk |
| `r11_high_unclassified_master_data` | BC10 unclassified_pct > 15% | Material master quality blocks channel routing |

---

## Part 8 — Numeric Benchmarks

### Per-archetype value thresholds
| Threshold | Value | Used by |
|---|---|---|
| `high_value_direct_avg_po_inr` | ₹50,00,000 | Rules 10, 11 (DIRECT) |
| `low_value_indirect_avg_po_inr` | ₹50,000 | Rule 5 (INDIRECT catalogue) |
| `medium_value_indirect_avg_po_inr` | ₹5,00,000 | Rules 6, 7 (INDIRECT) |
| `high_value_service_avg_po_inr` | ₹5,00,000 | Rule 9 (SERVICE) |
| `bulk_full_ltc_threshold_total_spend_inr_cr` | ₹5 Cr | Rule 3 (BULK LTC) |

### Frequency thresholds
| Threshold | Value | Used by |
|---|---|---|
| `high_freq_po_count_6mo_threshold` | > 5 POs in 6 months | Rules 3, 5, 8 |
| `low_freq_po_count_6mo_threshold` | ≤ 2 POs in 6 months | Rule 9 |

### Sole-source detection
| Threshold | Value |
|---|---|
| PAC override trigger | pac_pct ≥ 50% |
| Vendor concentration flag | top_vendor_share_pct ≥ 80% |
| Single-vendor flag | vendor_count = 1 |

### Contract lift ceiling
| Constraint | Value |
|---|---|
| Maximum realistic lift in one transformation year | 25 percentage points |

---

## Appendix — How to apply without the tool

1. Run cleansing + per-MG aggregation per `OP_MODEL_RULES.md`.
2. For each canonical category, walk through the 13 rules in order — assign `recommended_channel` from the first match.
3. Derive `current_channel` per row (Part 3), aggregate to per-MG.
4. Match-status per MG (Part 4).
5. Roll up counts + spend (Parts 5).
6. Estimate `lift_pp` (Part 5 BC13, capped at 25).
7. Score per Part 6 thresholds.

Total effort for a 500-PO / ~30-MG dataset: ~1.5 hours manually in Excel.

---

## Appendix — Channel cheat-sheet (when in doubt)

| Buy pattern | Channel |
|---|---|
| Same vendor every month, big spend | LTC |
| Multiple qualified vendors, recurring | OLA (framework) |
| Indirect, every week, small ticket | Catalogue |
| Engineered indirect, qualifier-driven | ASL |
| Strategic / capex / one-off | RFQ |
| OEM-locked, spec-justified | PAC |
