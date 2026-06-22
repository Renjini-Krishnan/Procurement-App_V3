# Delegation of Authority (DoA) — Functional Rules

> **Tool-independent ruleset.** Apply to a client's DoA matrix + PO data + QRE survey responses to produce a DoA maturity verdict, without needing the Procvault app.

**Scope:** how the client's approval-authority structure is designed, documented, enforced, and matched to actual transaction patterns.

**Inputs required:**

- **PO dump** (post-cleansing per `OP_MODEL_RULES.md` Part 1) — at minimum: `po_number`, `net_value_inr`, optionally `po_approver_designation`, `po_approver_id`
- **Engagement override** — `doa.tier_thresholds_inr` (the client's actual DoA matrix). Without it, Theme 3 returns "data not available" — **do not fall back to illustrative numbers**, those would be fabricated.
- **QRE responses** — survey answers for 6 DoA-related questions (see Question Reference below). Without these, Themes 1, 2, 4 return "data not available".

---

## Part 1 — Themes

### Theme 1 — Document Audit & Coverage *(weight 0.20)*

**Question:** does the client have a formal DoA document, how comprehensively does it cover transaction types, and does it address Indian-regulatory-required cases?

**Inputs:** QRE D2.4 (DoA document maturity, scored 0-4), D9.2 (audit coverage, 0-4), D10.2 (policy coverage, 0-4).

**Logic:**
- `doa_present` = D2.4 ≥ 2
- `coverage_pct` = D2.4 / 4 × 100
- `indian_cases_covered_pct` = (D9.2 + D10.2) / 2 / 4 × 100

**Output verdict:**
- DoA absent → Initial verdict
- coverage < 30% → Initial
- 30-60% → Developing
- 60-80% → Defined
- 80-95% → Managed
- ≥95% → Optimised

### Theme 2 — Robustness vs Reference *(weight 0.25)*

**Question:** does the DoA structure cover the mandatory case types a best-practice Indian DoA must address (PAC, MSME, CAPEX, emergency, advance payment, GST adjustments, etc.)?

**Inputs:** QRE D2.4, D9.2, D10.2 (same as Theme 1).

**Logic:**
- `mandatory_covered_pct` = (audit_score + policy_score + doa_score) / 12 × 100
- `ambiguity_rate` = 100 − mandatory_covered_pct

**Best-practice reference:** the **Best-Practice Indian DoA Template** (described in Part 4) lists ~20 mandatory cases. A complete DoA must address each.

### Theme 3 — PO Compliance & Distribution *(weight 0.25)*

**Question:** does the actual PO data show that approvals happen at the right tier (most transactions at operational levels, only strategic spend at the top)?

**Inputs:** PO data with `net_value_inr` + the client's actual DoA tier matrix (engagement override).

**Tier matrix shape:**
```yaml
doa.tier_thresholds_inr:
  - { label: "Tier 1 — Manager",     max_inr: 500000 }
  - { label: "Tier 2 — Sr Mgr",      max_inr: 5000000 }
  - { label: "Tier 3 — GM",          max_inr: 25000000 }
  - { label: "Tier 4 — Director",    max_inr: 100000000 }
  - { label: "Tier 5 — Board",       max_inr: null }   # null = no cap
```

Each tier's lower bound = previous tier's `max_inr`. First tier starts at 0.

**Logic:**

1. **Distribute every PO into a tier** by `net_value_inr`.

2. **Seventy-rule (volume-based)**: % of POs falling into Tier 1 + Tier 2 + Tier 3 (operational tiers).
   ```
   seventy_rule_pct = count(POs at Tier 1-3) / total_PO_count × 100
   ```
   Healthy = high. The design principle: routine work should be delegated to lower tiers so senior management focuses on strategy.

3. **Cap-breach (spend-based)**: % of total spend that lands at the top tier (board / CXO level).
   ```
   cap_breach_pct = spend_at_top_tier / total_spend × 100
   ```
   Healthy = low. High cap-breach means too much value flowing to the most senior approval.

4. **Operational spend share** (audit metric, not scored): % of *spend* at Tier 1-3. Kept separate from the volume-based seventy-rule because spend-weighted is misleading — a few large POs at senior tiers will always make a spend-weighted measure look bad even when 95% of transactions are correctly delegated.

**Verdict thresholds:**
| Score | Trigger |
|---|---|
| Initial | volume_pct < 40% OR cap_breach > 20% |
| Developing | volume_pct < 60% OR cap_breach > 10% |
| Defined | volume_pct < 75% OR cap_breach > 5% |
| Managed | volume_pct < 90% OR cap_breach > 2% |
| Optimised | volume_pct ≥ 90% AND cap_breach ≤ 2% |

**If `doa.tier_thresholds_inr` is missing** → return "data not available". Tier thresholds are a client-specific input, not an engine default.

### Theme 4 — System Enforcement *(weight 0.15)*

**Question:** is the DoA enforced through an ERP workflow (digital approval), or is it paper / email / Excel-based?

**Inputs:** QRE D5.2 (system compliance, 0-4), D12.1 (application landscape, 0-4).

**Logic:**
- `erp_workflow_present` = D5.2 ≥ 2 OR D12.1 ≥ 2
- `automation_pct` = D5.2 / 4 × 100
- `paper_pct` = 100 − automation_pct

**Verdict:** no ERP workflow → Initial. Automation < 50% → Developing. 50-75% → Defined. 75-95% → Managed. ≥95% → Optimised.

### Theme 5 — Bucket Optimisation *(weight 0.15)*

**Question:** are the DoA tier thresholds set at the right *values* given the client's actual spend distribution?

**Inputs:** PO data (`net_value_inr` for all active POs).

**Logic:**

1. Compute spend percentiles: p50, p75, p90, p95, p99.
2. Treat p75, p90, p95, p99 as the **recommended tier boundaries**.
3. Compare current tier thresholds to recommended:
   ```
   relative_error[i] = |current_threshold[i] − recommended[i]| / recommended[i]
   avg_error = mean(relative_error)
   ```
4. **Fit verdict:**
   - avg_error < 0.2 → Optimised (5/5)
   - 0.2-0.5 → Managed (4/5)
   - 0.5-1.0 → Defined (3/5)
   - 1.0-2.0 → Developing (2/5)
   - > 2.0 → Initial (1/5)

Headline: shows recommended thresholds at each percentile + the fit score.

---

## Part 2 — Pillar Score Combination

Weighted average over **available** themes only. Missing themes drop from the denominator; `coverage_pct` reports what % of the pillar was scored.

| Theme | Weight |
|---|---|
| Document Audit & Coverage | 0.20 |
| Robustness vs Reference | 0.25 |
| PO Compliance & Distribution | 0.25 |
| System Enforcement | 0.15 |
| Bucket Optimisation | 0.15 |

---

## Part 3 — RCA rules (root-cause cards that fire on weak signals)

Each rule fires only when its dependent theme produced a real metric — never fabricates a card from a theme that was "data not available".

| Rule ID | Triggers when | Card |
|---|---|---|
| `r01_no_formal_doa` | T1 doa_document_present = false | No formal DoA in place |
| `r02_partial_coverage` | T1 coverage_pct < 60% | DoA exists but spotty coverage |
| `r03_indian_cases_missing` | T1 indian_cases_covered_pct < 70% | Indian-regulatory cases not addressed |
| `r04_high_breach_rate` | T3 cap_breach_pct > 10% | Top-tier handling too much value |
| `r05_paper_only` | T4 erp_workflow_present = false | No ERP enforcement; paper trail |
| `r06_low_seventy_rule` | T3 seventy_rule_pct < 60% | Operational tiers under-utilised |
| `r07_bucket_misfit` | T5 bucket_fit_score < 2 | Tier thresholds out of sync with spend |

---

## Part 4 — Best-Practice Indian DoA Reference (mandatory cases)

A complete DoA must explicitly address each of these cases. Coverage of these is what Theme 2 evaluates.

**Routine financial:**
1. Material PO approval (by value band)
2. Service PO approval (by value band)
3. CAPEX PO approval (by value band)
4. Advance payment authorisation (% threshold + cap)
5. Invoice payment release (3-way match required?)

**Risk / Compliance:**
6. PAC (Proprietary Article Certificate) / Single-source justification approval
7. Emergency / urgent procurement (deviation from RFQ rules)
8. MSME mandatory share verification (≥25% GoI mandate for PSUs)
9. Vendor empanelment / blacklisting
10. Vendor advance recovery / write-off

**Contractual:**
11. Contract execution (RC / LTA) — separate from PO release
12. Contract variation / amendment
13. Performance guarantee waiver
14. Liquidated-damages waiver

**Special situations:**
15. GST adjustment / credit reversal
16. Customs duty / clearing agent authorisation
17. Foreign exchange forward-cover hedging
18. Inter-company / inter-plant transfer pricing
19. Capital write-off / scrap disposal
20. Statutory / regulatory body interaction (CWC, Pollution Board, etc.)

---

## Part 5 — Numeric Benchmarks (all thresholds in one place)

### Theme 1 — Document Audit
- DoA-present threshold: QRE D2.4 ≥ **2**
- Coverage bands: <30% Initial · 30-60% Developing · 60-80% Defined · 80-95% Managed · ≥95% Optimised

### Theme 2 — Robustness
- Reference cases: ~**20** mandatory cases (see Part 4)
- Coverage bands: same scale as Theme 1

### Theme 3 — PO Compliance
- Seventy-rule (volume-based, % of POs at operational tiers): <40 Initial · <60 Developing · <75 Defined · <90 Managed · ≥90 Optimised
- Cap-breach (spend-based, % at top tier): >20 Initial · >10 Developing · >5 Defined · >2 Managed · ≤2 Optimised

### Theme 4 — System Enforcement
- ERP-present threshold: QRE D5.2 ≥ 2 OR D12.1 ≥ 2
- Automation bands: <50 Developing · <75 Defined · <95 Managed · ≥95 Optimised

### Theme 5 — Bucket Optimisation
- Spend distribution percentiles for recommended thresholds: **p75 · p90 · p95 · p99**
- Fit error bands: <0.2 Optimised · <0.5 Managed · <1.0 Defined · <2.0 Developing · ≥2.0 Initial

---

## Part 6 — Question Reference (QRE D-series questions used)

These are answered by the consultant on Stage 15 of the engagement (or in a separate survey if running standalone).

| QRE ID | Question | Scoring | Used by |
|---|---|---|---|
| **D2.1** | Is there a defined procurement organisation structure (centralised / hybrid / federated)? | 0=none, 4=clearly defined | Org Posture (Org pillar) |
| **D2.2** | Are roles & responsibilities documented per role? | 0-4 maturity | FTE Sizing (Org pillar) |
| **D2.3** | Is there a documented governance / RACI for category management? | 0-4 | Distribution (Org pillar) |
| **D2.4** | Does a formal DoA document exist and how comprehensively does it define authorities? | 0=none, 4=comprehensive matrix with all cases | **DoA T1 + T2** |
| **D2.5** | Is procurement spend distributed across business units in a defined way? | 0-4 | Distribution (Org pillar) |
| **D5.2** | Is the DoA enforced through an ERP workflow? | 0=paper, 4=fully digital | **DoA T4** |
| **D9.2** | Is there an independent audit of DoA compliance? | 0=none, 4=quarterly with corrective actions | **DoA T1 + T2** |
| **D10.1** | Is there a formal procurement policy governance committee? | 0-4 | Hierarchy (Org pillar) |
| **D10.2** | Does the policy explicitly cover Indian regulatory cases (PAC, MSME, GST, CAPEX, etc.)? | 0=none, 4=all 20 cases | **DoA T1 + T2** · Hierarchy (Org pillar) |
| **D11.1** | Are role-specific skill matrices defined and used? | 0-4 | FTE Sizing (Org pillar) |
| **D11.4** | Are there specialist roles (Category Manager, Contracts, Vendor Performance)? | 0-4 | FTE Sizing (Org pillar) |
| **D12.1** | Is the application landscape (ERP, e-sourcing, contract mgmt) integrated? | 0=siloed, 4=fully integrated | **DoA T4** |

---

## Appendix — How to apply without the tool

1. Get the client's DoA document + QRE survey responses + post-cleansed PO data.
2. **Theme 1**: read D2.4, D9.2, D10.2 directly; compute the percentages.
3. **Theme 2**: count mandatory cases addressed in the DoA document vs the 20 in Part 4 above.
4. **Theme 3**: get the actual tier matrix from the client. Bucket every PO. Compute volume_pct (count at Tier 1-3) + cap_breach_pct (spend at top tier).
5. **Theme 4**: read D5.2, D12.1.
6. **Theme 5**: compute p75/p90/p95/p99 of `net_value_inr`. Compare to current thresholds.
7. Score each theme; combine weighted; produce verdict.

Total effort for a 500-PO dataset + QRE complete: ~2 hours manually.

---

## Appendix — What this document does NOT cover

- The actual numeric benchmarks for individual industry segments (PSU vs private steel vs cement) — those live in the industry-overlay KB files in the app.
- The full RCA card content (root causes, recommendations) — only the trigger conditions are documented here.
- AI-generated narratives (the app composes these via Gemini with KB grounding).
