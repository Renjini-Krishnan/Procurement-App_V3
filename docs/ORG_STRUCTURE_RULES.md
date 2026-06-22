# Org Structure — Functional Rules

> **Tool-independent ruleset.** Evaluates the procurement organisation — how it's structured (centralised vs federated), how it's sized vs spend, how spend is distributed across plants/business units, and how deep / wide the hierarchy is.

**Scope:** V1 evaluation runs primarily on QRE survey responses + engagement-level metadata (FTE count, annual spend). V2 will add Employee Master + Org Chart uploads for quantitative span-of-control and role-composition analysis.

**Inputs required:**

- **Engagement metadata** — `annual_spend_inr_cr`, `fte_count` (procurement FTEs only — not enterprise headcount)
- **PO data** (post-cleansing) — for plant-level spend distribution
- **QRE responses** — 7 questions (D2.1, D2.2, D2.3, D2.4, D2.5, D10.1, D10.2, D11.1, D11.4); see Part 6

---

## Part 1 — Themes

### Theme 1 — Organisation Posture *(weight 0.20)*

**Question:** is procurement centralised, hybrid, or federated?

**Inputs:** QRE D2.1, D2.4.

**Logic:**
```
posture_inferred =
  "Centralised" if D2.1 >= 3
  "Hybrid"      if D2.1 >= 2
  "Federated"   otherwise
avg_qre_score = (D2.1 + D2.4) / 2
```

**Verdict:** standard QRE-based maturity scale (see Part 3).

### Theme 2 — FTE Sizing & Role Composition *(weight 0.35)*

**Question:** is the procurement function sized appropriately for the spend it manages, and does it have specialist roles?

**Inputs:**
- Engagement: `annual_spend_inr_cr`, `fte_count`
- QRE: D2.2 (R&R clarity), D11.1 (skill matrices), D11.4 (specialist roles)

**Logic:**
```
spend_per_fte_inr_cr = annual_spend_inr_cr / fte_count
benchmark_band = [40, 80] ₹ Cr per FTE  (Indian large-enterprise norm)
in_band = 40 <= spend_per_fte <= 80
```

**Verdict:**
- in_band AND avg_qre_score ≥ 3 → Managed (4/5)
- in_band only → Defined (3/5)
- Outside band → Developing (2/5)
- QRE missing → standard QRE-based maturity scale

**If `fte_count` or `annual_spend_inr_cr` is missing** → "data not available". These are client-specific inputs the engine should not invent.

### Theme 3 — Spend-FTE Distribution *(weight 0.20)*

**Question:** how is spend distributed across plants / business units? Is one plant carrying a disproportionate share?

**Inputs:**
- QRE: D2.3 (RACI / governance), D2.5 (spend distribution maturity)
- PO data: `plant`, `net_value_inr`

**Logic:**
```
plant_count = nunique(plant) in PO data
plant_spend = groupby(plant) sum(net_value_inr)
top_plant_share_pct = max(plant_spend) / total_spend × 100
per_plant_spend_share_pct = each plant's % of total
```

**Output:** plant-level distribution table + headline like *"5 plants in PO data · top plant 38% of spend · governance D2.3=3/4"*.

**Verdict:** QRE-based maturity scale (see Part 3). Plant distribution data is auxiliary — doesn't rescue a low QRE score.

### Theme 4 — Hierarchy & Span of Control *(weight 0.25)*

**Question:** how deep and wide is the procurement hierarchy?

**Inputs:** QRE D10.1 (policy governance committee), D10.2 (Indian regulatory cases).

**V1 limitation:** Without an Employee Master upload (manager IDs / reports_to chain), this theme is QRE-only — actual span-of-control and hierarchy depth need org-chart data.

**Logic:**
```
avg_qre_score = (D10.1 + D10.2) / 2
```

**Verdict:** standard QRE-based maturity scale.

---

## Part 2 — Pillar Score Combination

Weighted average over **available** themes only. Missing themes drop from the denominator; `coverage_pct` reports what % of the pillar was scored.

| Theme | Weight |
|---|---|
| Organisation Posture | 0.20 |
| FTE Sizing & Role Composition | 0.35 |
| Spend-FTE Distribution | 0.20 |
| Hierarchy & Span | 0.25 |

---

## Part 3 — Standard QRE-based maturity scale

When the only signal is the average QRE score for a theme:

| avg_qre_score | Verdict |
|---|---|
| < 1.5 | Initial |
| < 2.5 | Developing |
| < 3.0 | Defined |
| < 3.5 | Managed |
| ≥ 3.5 | Optimised |

QRE responses are 0-4 maturity ratings the consultant assigns from a structured survey.

---

## Part 4 — RCA Rules

Each theme produces an RCA card *only when scored* (no firing against "data not available"):

| Trigger | Card |
|---|---|
| organisation-posture score ≤ 2 | Organisation posture: low maturity per QRE |
| fte-sizing-role-composition score ≤ 2 | Spend/FTE outside band; specialisation gap |
| spend-fte-distribution score ≤ 2 | Spend governance / RACI gap |
| hierarchy-span score ≤ 2 | Hierarchy / governance gap (org chart needed for full analysis) |

---

## Part 5 — Numeric Benchmarks

### Theme 2 — Spend per FTE
- **Indian large-enterprise norm:** ₹40-80 Cr per procurement FTE per year
- **Source:** Industry benchmark database (steel-specific overlay may shift band)

### Spend distribution
- **Plant top-share warning threshold:** > 50% (one plant dominant) → flag for review
- **Plant top-share critical threshold:** > 70% → near-single-plant operation

(These aren't auto-applied to scoring in V1; they're displayed for consultant interpretation.)

---

## Part 6 — Question Reference

| QRE ID | Question | Scoring | Theme |
|---|---|---|---|
| **D2.1** | Procurement organisation structure (centralised/hybrid/federated) defined? | 0-4 | Posture (T1) |
| **D2.2** | R&R documented per role? | 0-4 | FTE Sizing (T2) |
| **D2.3** | Documented governance / RACI for category management? | 0-4 | Distribution (T3) |
| **D2.4** | Formal DoA document maturity? | 0-4 | Posture (T1) |
| **D2.5** | Procurement spend distributed across BUs in a defined way? | 0-4 | Distribution (T3) |
| **D10.1** | Formal procurement-policy governance committee? | 0-4 | Hierarchy (T4) |
| **D10.2** | Policy covers Indian regulatory cases? | 0-4 | Hierarchy (T4) |
| **D11.1** | Role-specific skill matrices? | 0-4 | FTE Sizing (T2) |
| **D11.4** | Specialist roles (Category Mgr, Contracts, Vendor Perf)? | 0-4 | FTE Sizing (T2) |

---

## Appendix — How to apply without the tool

1. Confirm engagement metadata: annual_spend_inr_cr, fte_count.
2. Complete the 9-question QRE survey (see Part 6).
3. Theme 1: compute `(D2.1 + D2.4) / 2`, look up posture.
4. Theme 2: compute spend / FTE, check band, factor in (D2.2 + D11.1 + D11.4) / 3.
5. Theme 3: bucket PO data by plant, get top plant share. Read D2.3 + D2.5.
6. Theme 4: average D10.1 + D10.2.
7. Score each theme; combine weighted; produce pillar verdict.

Total effort: ~30 minutes given a completed QRE + a 500-row PO dump.

---

## V2 roadmap items (NOT covered by these rules)

These need additional uploads to compute:

| Item | Requires |
|---|---|
| Actual span of control per layer | Employee Master with `manager_id` / `reports_to` |
| Hierarchy depth (levels from CPO to junior buyer) | Employee Master |
| Role composition mix (% Strategic vs Tactical vs Transactional FTEs) | Employee Master with `role_category` |
| Central vs Plant FTE split | Employee Master + plant attribution |
| Per-business-unit spend efficiency | Org Master mapping cost centre → BU |

When these are available, the QRE-only themes can be replaced with quantitative computations.

---

## Appendix — Difference between V1 (this doc) and V2 (planned)

V1 is QRE-heavy because Employee Master isn't a routinely-uploaded file in Indian large-enterprise procurement engagements. V2 will introduce:

1. An Employee Master upload (CSV/Excel) with `employee_id`, `name`, `designation`, `manager_id`, `role_category`, `plant_attribution`.
2. An Org Master upload mapping cost centres → BUs → entities.
3. Quantitative replacements for D11.1, D11.4, D10.1, D10.2.

Until then, treat this pillar as a *qualitative* assessment grounded in the consultant's interview-based QRE responses + the spend / FTE band check.
