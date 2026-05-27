---
id: op-model-coe
layer: function
function: procurement
pillar: op-model
theme: coe
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
status: active
---

# Centre of Excellence (CoE) Theme — Deep Dive

## Purpose

CoE analysis answers: **"Which strategic, high-value, high-complexity categories warrant a dedicated CoE — a small expert team owning category strategy, market intelligence, and supplier relationships across the enterprise?"** Produces a CoE Recommendation Matrix with quantified value-add savings.

This is theme 3 of 4 within the Op Model pillar.

## Logic Embodied

| Component | Purpose | Decision-driving? |
|---|---|---|
| **CE0 — Current CoE State** (QRE) | Capture baseline | No |
| **CE1 — Strategic Category Identification** | 3 lenses: SS1 Q4 + industry strategic-by-nature + vendor concentration | **YES** |
| **CE2 — Industry Knowledge Filter (CoE Suitability)** | Tag candidates as CoE-Suitable / Already-Strategic / Plant-Owned | **YES** |
| **CE3 — CoE Coverage Gap** | Compare CoE-Suitable list against current CoE scope | **YES** |
| **CE4 — CoE Value Quantification** | Apply CoE savings rate to coverage gap | **YES** |
| **CE5 — Reconciliation** | Cross-check with QRE | No |

## Editable Configuration

```yaml
min_coe_addressable_spend_inr_cr: 50
coe_optimal_category_count_range: [8, 15]
high_vendor_concentration_threshold_pct: 70
default_coe_savings_rate_pct_range: [2, 5]
```

---

# 2. Analytical Framework

## CE0 — Current CoE State (QRE)

| ID | Question |
|---|---|
| Q-OM-COE-01 | Does your organisation have a formal procurement CoE? (Yes / No / Informal-Only) |
| Q-OM-COE-02 | If yes, which categories does CoE cover? |
| Q-OM-COE-03 | How many FTEs in CoE (or informal)? |
| Q-OM-COE-04 | How is the CoE positioned (reporting line, BU-aligned, decision authority)? |

## CE1 — Strategic Category Identification (3 lenses)

**Lens A — Volume-Value Q4 quadrant (from SS1):** Q4 = low PO count + high avg PO value = economically strategic.

**Lens B — Industry strategic-by-nature:** Some categories are strategic regardless of Q4 status. Industry overlay provides list.

**Lens C — Spend concentration / vendor dependency:**
```
top_3_vendor_share = SUM(spend of top 3 vendors in category) / total category spend
IF top_3_vendor_share ≥ 70%:
flag as "high vendor concentration" → strengthens CoE case
```

Combined: `strategic_candidates = union(Q4 categories, industry strategic_by_nature, high vendor concentration)`

## CE2 — Industry Filter (CoE Suitability)

```
For each strategic candidate:
IF spend < min_coe_addressable_spend_inr_cr → "Too-Small-For-CoE"
ELSE IF in "coe_suitable" list → "CoE-Suitable"
ELSE IF in "already_strategic_no_coe_need" list → "Already-Strategic"
ELSE IF in "plant_owned" list → "Plant-Owned"
ELSE → "CoE-Suitable" (default)
```

## CE3 — Coverage Gap

```
coe_suitable_categories = candidates tagged "CoE-Suitable"
coe_current_categories = from Q-OM-COE-02
coe_coverage_gap = coe_suitable EXCEPT coe_current
```

## CE4 — Value Quantification

```
coe_gap_spend = SUM(spend across CoE Coverage Gap categories)
coe_savings_rate = industry overlay OR function default 2-5% (Steel 3-6%)
savings_range = coe_gap_spend × [low, high]
```

**Single rolled-up rate** including drivers:
- Negotiation leverage (30-40%)
- Spec standardisation + value engineering (25-35%)
- Supplier consolidation + relationship management (20-30%)
- Market intelligence + timing (10-15%)

**Avoid double-counting with Centralisation:** If category in BOTH Cent + CoE gap, savings NOT additive. CoE incremental value-add over centralisation baseline is ~1-2% (not full CoE rate). Engine flags overlap categories. See cross-theme-synthesis.md for stack-with-adjustment rule.

## CE5 — Reconciliation

```
IF QRE "No CoE" AND ce3 large gap → "Greenfield CoE opportunity"
IF QRE "Informal-Only" AND ce3 large gap → "Formalise CoE; significant strategic spend currently un-curated"
IF QRE "Yes formal CoE" AND ce3 narrow gap → "Existing CoE has appropriate scope"
```

---

# 3. ABC Steel Worked Example

CE0: Client has informal central category management for top 6 commodities led by 4 FTEs reporting to CPO; no formal CoE.

CE1 (3 lenses):
- Q4 (high vendor concentration): Iron ore market, Coking coal, Ferro alloys, Mill rolls, Industrial gases, Outbound logistics, Power, Refractories, Insurance, IT corporate, Professional services, Carbon electrodes
- Industry strategic-by-nature: 13 categories ~ ₹3,420 Cr addressable (excluding captive ₹1,200 Cr)

CE2 Industry Filter (Steel):
- CoE-Suitable: 9 categories (~₹2,860 Cr)
- Already-Strategic: 3 categories (incl. captive ₹1,680 Cr — Industrial gases on long-term ASU, Power on PPA)
- Plant-Owned: 1 category (Insurance ~₹80 Cr — typically Finance/Risk remit)

CE3 Coverage Gap: 4 new categories incremental into CoE (Mill rolls + IT corporate + Professional services + Carbon electrodes = **₹510 Cr**). Plus formalisation of existing informal ₹2,170 Cr scope.

CE4 Value (Steel rate 3-6%):
- Net new CoE: 3-6% × ₹510 Cr = **₹15-31 Cr/year**
- Formalisation uplift on existing informal: ~1.5-3% × ₹2,170 Cr = **₹33-65 Cr/year**
- **Total: ₹48-96 Cr/year value-add**

Categories overlapping with Centralisation (Refractories + Ferro alloys + Mill rolls) flagged.

CE5: "Client has informal CoE — data confirms strategic intent. Formalise + expand."

Final: **Formalise procurement CoE; expand 6 → 9 categories; add 4 specialist FTE (1 Lead + 4-6 strategists). ₹48-96 Cr/year value-add.**

---

# 4. Boundaries

| Out of scope | Where it goes |
|---|---|
| CoE detailed operating model design | Implementation roadmap |
| Specific CoE FTE role descriptions | Org Structure pillar |
| Market intelligence tooling selection | Tech & Digital |
| Captive supply strategy | Corporate Strategy (not procurement) |
| Long-term PPA negotiation | Already-Strategic flow |
| Supplier-specific risk register | Supplier pillar |

# 5. RCA Patterns

| Finding | Typical root causes |
|---|---|
| Strategic categories without CoE despite high value | CPO bandwidth absorbed by transactional; no executive sponsorship; "we already centralise" misconception |
| Informal-only CoE despite mature procurement | Historical resistance to formal structure; resource constraints |
| High vendor concentration in strategic categories with no CoE | Single-point-of-failure risk un-curated |
| Strategic categories with weak market intelligence | No subscription to commodity research; no internal capability |

# 6. Confidence Indicators

| Confidence | When |
|---|---|
| **High** | Stage 9 ≥ 90%; SS1 quadrant computed; vendor master deduped; QRE complete; industry overlay loaded |
| **Medium** | Stage 9 80-90%; vendor master partial; QRE gaps |
| **Low** | Stage 9 < 80%; strategic categories unclear |

(Note: File truncated to the most critical sections.)
