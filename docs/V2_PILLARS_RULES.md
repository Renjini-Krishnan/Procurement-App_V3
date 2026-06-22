# V2 Pillars — Functional Rules
## Material Master · PR-to-PO · Post-PO · Supplier

> **Tool-independent ruleset** for the four "operational excellence" pillars. Each evaluates a different slice of the procurement process from cleansed transaction data.

**Common conventions across all 4 pillars:**

- Each pillar has 3 themes
- Each theme returns either a score (0.5-5.0) + band OR "data not available" with the missing input listed
- Pillar score = weighted average over **available** themes only; `coverage_pct` reported separately
- Score bands: Initial / Developing / Defined / Managed / Optimised
- Cutoffs (used to translate metric % to score): default thresholds **30 / 60 / 85**, mapped to score **1.5 / 2.5 / 3.5 / 4.5** respectively (some themes override these)

---

# Pillar 1 — Material Master

**Goal:** assess the quality + coverage of the client's material master data — the foundation that determines whether any other analysis is reliable.

**Inputs:**
- PO data (cleansed)
- Material Master file (optional — `material_description`, `active_flag`, etc.)
- Canonical classification stats from Stage 9

## Theme MM1 — PO coverage of material_number *(weight 0.40)*

**Logic:**
```
n_with = count(po_rows where material_number is populated)
coverage_pct = n_with / total_rows × 100
```

**Score:** standard 0-100% → score curve (Part 5).

**RCA fires when** coverage < 60%:
- Cause: free-text purchases bypass the material master; cataloguing discipline gap
- Recommendation: enforce ≥80% material_number coverage as a P-card / e-procurement gate

## Theme MM2 — Master quality *(weight 0.30)*

**Logic:**
```
duplicates = count(rows where material_description is duplicated)
duplicate_rate_pct = duplicates / total × 100
score = 5.0 - min(4.0, duplicate_rate_pct / 5)    # 5% dup rate → -1 score, 25%+ → score of 1
```

If `active_flag` column present, also compute `active_pct` (informational).

**RCA fires when** duplicate_rate > 5%:
- Cause: material onboarding lacks dedup check; same item enters under multiple codes
- Recommendation: quarterly dedup sweep + fuzzy-match gate at material creation

**If Material Master file missing** → "data not available".

## Theme MM3 — Canonical classification rate *(weight 0.30)*

**Logic:**
```
assigned_pct = 100 - unclassified_pct (from Stage 9 output)
```

**Score:** standard 0-100% → score curve.

**RCA fires when** unclassified > 15%:
- Cause: missing material descriptors or non-standard text patterns; taxonomy keywords don't cover the long tail
- Recommendation: add engagement-specific synonyms to the canonical taxonomy

---

# Pillar 2 — PR-to-PO

**Goal:** measure how requisitions translate into purchase orders — the leading indicator of approval discipline + planning quality.

**Inputs:**
- PO data with `pr_reference` column
- PR file with `pr_number`, `pr_creation_date`, and optionally `pr_total_value`

## Theme PR1 — PR-to-PO Conversion Rate *(weight 0.40)*

**Logic:**
```
pr_keys = set(pr_df.pr_number)
po_refs = set(po_df.pr_reference)
linked = pr_keys ∩ po_refs
conversion_pct = |linked| / |pr_keys| × 100
```

**Score:** standard 0-100% curve. Note: conversion of 100% would actually be implausible (some PRs legitimately get cancelled), so 70-90% is healthy.

**RCA fires when** conversion < 70%:
- Cause: approval bottleneck or rejected requirements not closed out; PR creates noise
- Recommendation: 30-day auto-close on unactioned PRs + monthly aging review

## Theme PR2 — Mean PR-to-PO TAT *(weight 0.40)*

**Logic:**
For each PO with a matched PR:
```
tat_days = po_creation_date - pr_creation_date
```
Drop tat < 0 (date entry errors) and tat > 365 (likely legacy / re-opened PRs).
```
mean_tat = mean(valid_tats)
```

**Score (lower TAT = better):**
| Mean TAT | Score |
|---|---|
| ≤ 7 days | 5.0 (Optimised) |
| ≤ 14 days | 4.0 (Managed) |
| ≤ 21 days | 3.0 (Defined) |
| ≤ 30 days | 2.0 (Developing) |
| > 30 days | 1.0 (Initial) |

**RCA fires when** TAT > 14 days:
- Cause: multi-tier sequential approval + paper / email back-and-forth
- Recommendation: parallelise tier 1+2 approvals; introduce 48h SLA per tier with auto-escalation

## Theme PR3 — PR-Estimate vs PO-Actual Value Consistency *(weight 0.20)*

**Logic:**
For each linked PR-PO pair where both `pr_total_value` and `net_value` are populated:
```
deviation_pct = |pr_total_value - po_net_value| / |po_net_value| × 100
deviating = count where deviation_pct > 20%
deviation_rate = deviating / checked × 100
```

**Score (lower deviation rate = better):** standard 0-100% inverted (higher is worse), thresholds 10 / 25 / 50.

---

# Pillar 3 — Post-PO

**Goal:** evaluate execution discipline after PO release — receipt confirmation, three-way match, on-time delivery.

**Inputs:**
- PO data with `delivery_date`, `gr_date`
- GRN file (optional — `po_number`)
- Invoice file (optional — `po_number`)

## Theme PP1 — PO → GRN Coverage *(weight 0.35)*

**Logic:**
```
po_keys = set(po_df.po_number)
grn_pos = set(grn_df.po_number)
covered = po_keys ∩ grn_pos
coverage_pct = |covered| / |po_keys| × 100
```

**Score:** standard 0-100% curve.

**RCA fires when** coverage < 80%:
- Cause: services / catalogue POs may not require GRN; or delayed GRN posting
- Recommendation: tag GRN-required POs explicitly; enforce 7-day GRN SLA post receipt

**If GRN file missing** → "data not available".

## Theme PP2 — Three-way Match Rate (PO ↔ GRN ↔ Invoice) *(weight 0.35)*

**Logic:**
```
grn_pos = set(grn_df.po_number)
inv_pos = set(inv_df.po_number)
matched = grn_pos ∩ inv_pos       # POs that have BOTH a GRN and an Invoice
gap = (grn_pos ∪ inv_pos) - matched
match_pct = |matched| / |grn_pos ∪ inv_pos| × 100
```

**Score:** standard 0-100% curve.

**RCA fires when** match_pct < 75%:
- Cause: receipt or invoice not aligned with PO — risk of duplicate / unsupported payments
- Recommendation: enforce 3-way match before payment release; investigate top vendors with mismatches

**If GRN or Invoice file missing** → "data not available".

## Theme PP3 — On-Time Delivery % *(weight 0.30)*

**Logic:**
For rows where both `delivery_date` (promised) and `gr_date` (actual receipt) are populated:
```
on_time = count(gr_date <= delivery_date)
otd_pct = on_time / total × 100
```

**Score:** custom thresholds for OTD (stricter than the default curve):
| OTD % | Score |
|---|---|
| ≥ 92% | 4.5 (Managed) |
| ≥ 75% | 3.5 (Defined) |
| ≥ 50% | 2.5 (Developing) |
| > 0% | 1.5 (Initial) |
| 0 | 0.5 |

**RCA fires when** OTD < 75%:
- Cause: supplier reliability gap; possible aggressive promised dates
- Recommendation: vendor scorecard with OTD penalty clauses; review top 10 worst-performing vendors

---

# Pillar 4 — Supplier

**Goal:** assess the health of the vendor portfolio — concentration risk, master cleanliness, MSME compliance.

**Inputs:**
- PO data with `vendor_id`, `net_value`
- Vendor Master file (optional — `vendor_id`, `msme_flag`)

## Theme SUP1 — Vendor Concentration *(weight 0.45)*

**Logic:**
```
spend_by_vendor = groupby(vendor_id) sum(net_value)
shares = spend_by_vendor / total_spend

top_vendor_share_pct = max(shares) × 100
top_10_share_pct = sum(top 10 shares) × 100

# Herfindahl-Hirschman Index (concentration measure, 0-10000 scale)
hhi = sum(share^2) × 10000
```

**Score starting from 4.5:**
| Penalty | Triggers |
|---|---|
| -1.5 | top1 > 30% |
| -0.5 | top1 > 20% (and ≤ 30%) |
| -1.0 | HHI > 2500 |
| -0.5 | HHI > 1500 (and ≤ 2500) |

Score is `max(1.0, 4.5 - total_penalty)`.

**RCA fires when** top1 > 30% OR HHI > 2500:
- Cause: single-vendor dependency; switching cost or PAC-locked specifications
- Recommendation: develop alternate vendor for top-3 categories; build dual-source RFP plan

### HHI interpretation
| HHI | Concentration |
|---|---|
| < 1500 | Diversified / competitive |
| 1500-2500 | Moderately concentrated |
| > 2500 | Highly concentrated |

## Theme SUP2 — Vendor Master Utilisation *(weight 0.30)*

**Logic:**
```
master_total = len(vm_df)
used = nunique(vendor_id in PO data)
utilization_pct = used / master_total × 100
```

**Score (healthy band is 30-70%):**
| Utilisation | Score |
|---|---|
| 30-70% | 4.5 (Managed) |
| 20-85% | 3.5 (Defined) |
| else | 2.0 (Developing) |

Why band-shaped: < 20% means master is bloated with dormant vendors. > 85% means master is too thin / vendor master is being created on demand without governance.

**RCA fires when** utilisation < 20%:
- Cause: vendor master overpopulated with historical / one-off vendors
- Recommendation: annual dormancy purge for vendors with no PO in 24 months

**If Vendor Master file missing** → "data not available".

## Theme SUP3 — MSME Spend Share *(weight 0.25)*

**Logic:**
```
msme_vendors = set(vendor_id where msme_flag = true)
msme_spend = sum(net_value where vendor_id in msme_vendors)
msme_pct = msme_spend / total_spend × 100
```

**Score:**
| MSME % | Score |
|---|---|
| ≥ 25% | 5.0 (Optimised — meets GoI PSU mandate) |
| ≥ 15% | 4.0 (Managed) |
| ≥ 5% | 3.0 (Defined) |
| else | 2.0 (Developing) |

**Context:**
- **GoI PSU mandate: 25%** of total procurement value must come from MSEs (Micro & Small Enterprises). Private sector aspirational.
- **Private-sector directional benchmark:** 5-15% is normal; >15% reflects active vendor-development programme.

**RCA fires when** MSME < 5%:
- Cause: limited MSME vendor base or selection bias toward larger suppliers
- Recommendation: MSME vendor development programme; aggregator partnerships for indirect categories

**If Vendor Master or `msme_flag` missing** → "data not available".

---

## Part 5 — Standard 0-100% Score Curve

Used by themes where the metric is a simple % "higher is better".

| Metric % | Score | Band |
|---|---|---|
| ≥ 85% | 4.5 | Managed |
| ≥ 60% | 3.5 | Defined |
| ≥ 30% | 2.5 | Developing |
| > 0% | 1.5 | Initial (some signal) |
| 0% | 0.5 | Initial (nothing) |

For "lower is better" metrics (e.g. PR-PO value deviation %), invert: `effective_pct = 100 - metric_pct`, then apply the same curve. Some themes override the cutoffs (e.g. Post-PO OTD uses 50/75/92).

---

## Part 6 — All Pillar Weight Tables

### Material Master
| Theme | Weight |
|---|---|
| MM1 PO coverage of material_number | 0.40 |
| MM2 Master quality (duplicates) | 0.30 |
| MM3 Canonical classification rate | 0.30 |

### PR-to-PO
| Theme | Weight |
|---|---|
| PR1 Conversion rate | 0.40 |
| PR2 Mean TAT | 0.40 |
| PR3 Value consistency | 0.20 |

### Post-PO
| Theme | Weight |
|---|---|
| PP1 GRN coverage | 0.35 |
| PP2 Three-way match | 0.35 |
| PP3 OTD % | 0.30 |

### Supplier
| Theme | Weight |
|---|---|
| SUP1 Vendor concentration | 0.45 |
| SUP2 Vendor master utilisation | 0.30 |
| SUP3 MSME spend share | 0.25 |

---

## Part 7 — Numeric Benchmarks Reference

### Material Master
- **MM1 coverage target:** ≥80% of PO rows with `material_number` populated
- **MM2 duplicate rate target:** <5%
- **MM3 unclassified threshold for RCA:** >15% triggers a finding

### PR-to-PO
- **PR1 conversion target:** ≥70% (RCA below this)
- **PR2 TAT band cutoffs:** ≤7 / 14 / 21 / 30 days
- **PR3 deviation threshold:** >20% PR-vs-PO delta is "deviating"
- **PR3 dataset filter:** drop pairs with tat < 0 or tat > 365 days

### Post-PO
- **PP1 GRN coverage target:** ≥80%
- **PP2 three-way match target:** ≥75% (RCA below this)
- **PP3 OTD bands:** 92 / 75 / 50% on-time

### Supplier
- **SUP1 healthy concentration:** top1 < 20% · top10 < 70% · HHI < 1500
- **SUP1 risk thresholds:** top1 > 30% OR HHI > 2500 → RCA fires
- **SUP2 healthy utilisation band:** 30-70%
- **SUP3 GoI PSU mandate:** 25% · private-sector aspirational: 5-15%

---

## Appendix — How to apply without the tool

For each pillar:

1. Confirm the required files are present (see Inputs at top of each pillar).
2. Run cleansing per `OP_MODEL_RULES.md` Part 1.
3. Compute the per-theme metric.
4. Map metric → score using either the standard curve (Part 5) or the theme's custom thresholds.
5. Combine weighted; report coverage_pct if any theme was unavailable.
6. Fire RCA cards where triggers met (always check theme is "available" first — never fire on missing data).

Total effort for all 4 pillars on a single engagement: ~2 hours given all 4 files (PO, PR, GRN, Invoice, Vendor Master, Material Master).

---

## Appendix — What "data not available" looks like

For every theme, when a required input is missing the theme returns:
```json
{
  "label": "Theme name",
  "score": null,
  "band": "Data not available",
  "available": false,
  "missing_inputs": ["PR file", "pr_reference column"],
  "missing_reason": "file",        // or "columns" or "rows"
  "note": "Required file(s) not uploaded: PR file"
}
```

The pillar score then drops this theme from the weighted average and reports `coverage_pct` so the consumer knows the score's basis.

**Never fabricate a score** when inputs are missing — that's the core integrity rule across all pillars.
