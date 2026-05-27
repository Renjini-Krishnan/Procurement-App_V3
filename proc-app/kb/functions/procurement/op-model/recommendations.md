---
id: op-model-recommendations
layer: function
function: procurement
pillar: op-model
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Op Model — Recommendations Library

## Purpose

Recommendation card library for the Op Model pillar. Each card is a fully-structured recommendation surfaced by the engine when a matching finding pattern (from `rca-patterns.md` / `rca-rules.yml`) fires.

Cards are keyed by recommendation ID. Prompt 3 (`recommendation_matching` in `prompts.md`) selects the card; savings formula applied to engagement-specific spend; card displays on theme tab and feeds Findings Deck.

## Logic Embodied

At Stage 12, after RCA produces a primary pattern ID, the engine:
1. Filters cards by theme + pattern_id
2. Picks best-fit card (or top-2 if ambiguous)
3. Applies savings formula to engagement-specific spend / counts
4. Surfaces with action verb + scope + savings + duration + risks + preconditions

## Inputs Used

| Input | Source |
|---|---|
| Finding pattern ID | `rca-patterns.md` |
| Engagement spend / counts | Theme analysis output |
| Industry savings rate | `benchmarks.yml` + overlay |

## How Used by App
Stage 12 — Recommendation box on each theme card. Stage 28 — Findings Deck recommendation slides. Stage 29 — Exec Summary action bullets.

## Editable Configuration
```yaml
allow_engagement_override_savings_rate: true
show_secondary_recommendation_threshold_fit_score: 0.75
risk_inclusion_threshold: "include all in card"
```

---

# Card Schema
```yaml
recommendation_id: string
theme: centralisation | shared-services | coe | tail-spend | synthesis
matched_patterns: array of pattern IDs from rca-patterns.md
action: 1-2 sentence imperative action
scope_description: "what gets done"
savings_formula: explanation of how savings are computed
typical_savings_range_pct: applicable benchmark rate
typical_duration_months: implementation duration band
key_risks: list
preconditions: list
governance_required: HITL approval level
```

---

# A. Centralisation Recommendation Cards

## rec-cent-greenfield-centralisation
**Matched patterns:** rca-pat-cent-01 (M&A roll-up), rca-pat-cent-04 (partial)
**Action:** Stand up central category management capability; centralise sourcing for the Top-N multi-plant categories with high vendor commonality.
**Scope:** Identify 5-12 categories with multi-plant footprint and ≥ 50% vendor overlap. Establish category-management roles at central level. Move sourcing decision to central; plants execute against central RC.
**Savings formula:** `candidate_spend_inr_cr × industry_centralisation_rate_pct_range` (Steel: ₹X Cr × 4-7%)
**Typical savings:** Steel 4-7%, Cement 3-5%, generic 2-4% on candidate spend
**Typical duration:** 12-18 months first wave; 24-36 for full programme
**Key risks:** Plant pushback during transition; central team headcount investment may need hiring before saving; vendor sales-team pushback at plant level; spec rationalisation surfaces hidden complexity
**Preconditions:** CPO sponsorship + executive air cover; Stage 9 reclassification ≥ 90%; Plant Head buy-in; Org Structure prep for central roles
**Governance:** HITL Approve & Proceed required before client commitment

## rec-cent-expand-from-centre-led
**Matched patterns:** rca-pat-cent-02 (Centre-Led only)
**Action:** Promote a subset of Centre-Led categories to full Centralised model — capturing residual savings beyond Centre-Led baseline.
**Scope:** Take 3-5 highest-spend Centre-Led categories; transition from "central contract, plant execution" to "central execution end-to-end". Plant retains only true exception calls.
**Savings formula:** `candidate_centre_led_spend × (centralisation_rate − centre_led_rate)` (Steel: ₹X × (5.5% − 3%) = 2.5% incremental)
**Typical savings:** 2-3% incremental over Centre-Led baseline
**Typical duration:** 6-12 months
**Key risks:** Plant resistance; central team capacity (transactional volume increases)
**Preconditions:** Existing Centre-Led contracts running smoothly; tooling ready to absorb transaction volume centrally
**Governance:** HITL Approve & Proceed

## rec-cent-change-mgmt-led-centralisation
**Matched patterns:** rca-pat-cent-03 (plant autonomy / political resistance)
**Action:** Centralisation roadmap led with change management, not commercial argument. Start with 2-3 lowest-controversy categories; build political capital before tackling contested ones.
**Scope:** Lowest-resistance multi-plant categories first. Run centralisation pilot demonstrating value WITHOUT undermining plant relationships. Pilot success → expand mandate.
**Savings formula:** `phase_1_candidate_spend × industry_centralisation_rate × phase_1_capture_rate (typically 0.7)`
**Typical savings:** 60-70% of full centralisation potential in Year 1; 100% by Year 3
**Typical duration:** 24-36 months (slower than greenfield)
**Key risks:** Slower pace frustrates leadership; political opposition may sabotage pilot; savings deferred to later years
**Preconditions:** CEO sponsorship (not just CPO); change-mgmt resource allocated; pilot category list aligned with plant heads upfront
**Governance:** HITL Approve & Proceed; partner sign-off recommended

## rec-cent-vendor-consolidation-precursor
**Matched patterns:** rca-pat-cent-04 (true local supplier dependency)
**Action:** Run vendor consolidation programme BEFORE attempting centralisation. Reduce vendor count via spec rationalisation + approved-vendor-list cleanup. Then centralise.
**Scope:** For top multi-plant categories with low vendor overlap: spec rationalise; consolidate AVL; THEN central contracting.
**Savings formula:** `candidate_spend × vendor_consolidation_savings_rate (1-2%) Year 1` + `candidate_spend × full_centralisation_rate Year 2+`
**Typical savings:** 1-2% Year 1 (vendor consol), 4-7% Year 2+ (centralisation)
**Typical duration:** 6-9 months vendor consol + 12-18 months centralisation
**Key risks:** Vendor consolidation complex; some "local" reasons may be legitimate
**Preconditions:** Vendor master deduplication; spec standardisation capability; engineering/quality involvement
**Governance:** HITL Approve & Proceed

## rec-cent-mid-tier-scope-expansion
**Matched patterns:** rca-pat-cent-05 (mid-tier blind spot)
**Action:** Expand central category management scope to cover mid-tier categories; add ~2 FTE central capacity.
**Scope:** Mid-tier multi-plant candidates (₹10-50 Cr each). 2-3 category mgr roles at central.
**Savings formula:** `mid_tier_candidate_spend × industry_centralisation_rate` (lower-end of band)
**Typical savings:** 3-5% on mid-tier spend
**Typical duration:** 9-12 months
**Key risks:** FTE investment may exceed savings; mid-tier vendor base may be fragmented
**Preconditions:** Central capacity OR FTE budget; mid-tier categories well-defined in Stage 9
**Governance:** HITL Approve

## rec-cent-policy-enforcement-uplift
**Matched patterns:** rca-pat-cent-06 (stated vs actual gap)
**Action:** Strengthen centralisation policy enforcement via measurement + governance + workflow controls.
**Scope:** Roll out central-spend KPI to plants. Workflow requires central approval for relevant POs. Compliance audit by central proc.
**Savings formula:** `gap_to_stated_pct × addressable_spend × industry_centralisation_rate`
**Typical savings:** 2-4% on spend currently bypassing central policy
**Typical duration:** 6-9 months
**Key risks:** Workflow changes face plant pushback; perceived as bureaucratic
**Preconditions:** ERP/workflow capability for spend routing; KPI dashboard; CPO + CFO joint sponsorship
**Governance:** HITL Approve

---

# B. Shared Services Recommendation Cards

## rec-ss-greenfield-ssc
**Matched patterns:** rca-pat-ss-01 (greenfield)
**Action:** Establish procurement SSC; phase scope across plants for SSC-suitable transactional categories.
**Scope:** SSC (6-12 FTE for mid-size). Pilot at one plant for 1-2 categories (MRO + lab chemicals). Scale across plants then categories per Steel filter logic.
**Savings formula:**
- Operational savings = (current_cost_per_po − ssc_cost_per_po) × ssc_addressable_po_count (Steel: (₹3,500 − ₹1,200) × N POs)
- FTE freed = (addressable_pos / plant_pos_per_fte) − (addressable_pos / ssc_pos_per_fte)
**Typical savings:** ₹3,300 per PO migrated × addressable count; plus 2-5 FTE freed
**Typical duration:** 12-18 months pilot + scale; 24+ months full coverage
**Key risks:** Process standardisation surfaces complexity; plant buyer resistance; SSC location politically charged; Year 1 at 50-70% mature throughput
**Preconditions:** Process standardisation done/planned; ERP/workflow capability; SSC location identified (tier-2 city typical); Plant Heads consulted
**Governance:** HITL Approve & Proceed; partner sign-off

## rec-ss-scale-pilot-across-plants
**Matched patterns:** rca-pat-ss-02 (pilot not scaled)
**Action:** Scale existing SSC pilot across additional plants for current scope; then expand categories.
**Scope:** Sequential rollout: SSC at Plant A category X → extend to Plants B + C for same X → add categories Y + Z.
**Savings formula:** Per-PO saving × incremental gap PO count
**Typical savings:** Engagement-specific
**Typical duration:** 6-12 months per scaling wave
**Key risks:** Pilot replication may surface plant-specific complications; SSC capacity strain
**Preconditions:** Pilot results positive; additional Plant Heads briefed; SSC capacity headroom/hiring plan
**Governance:** HITL Approve

## rec-ss-process-tool-maturity
**Matched patterns:** rca-pat-ss-03 (high cost-per-PO)
**Action:** Drive SSC process standardisation + tooling uplift to bring cost-per-PO in line with mature benchmark.
**Scope:** Audit current variations; document SOP; deploy e-catalog for high-volume SKUs; automate 3-way match; review scope for non-transactional items.
**Savings formula:** `(current_ssc_cost_per_po − target_cost_per_po) × annual_ssc_po_count`
**Typical savings:** 20-40% reduction in current SSC cost-per-PO
**Typical duration:** 9-12 months
**Key risks:** E-catalog setup non-trivial; staff training required
**Preconditions:** SSC operating ≥ 2 years; tooling budget approved; spec/vendor data quality acceptable
**Governance:** HITL Approve

## rec-ss-plant-role-redesign
**Matched patterns:** rca-pat-ss-04 (plant buyer role bloat)
**Action:** Redesign plant buyer role to separate buying from non-buying activities; address tooling/process gaps absorbing buyer time.
**Scope:** Activity audit; identify non-buying activities (expediting, payment follow-up, vendor mgmt); redistribute or automate.
**Savings formula:** Productivity gain = current_pos_per_fte → target_pos_per_fte (Steel target: 5,500 POs/FTE/year)
**Typical savings:** 20-40% FTE productivity gain at plant buyer level
**Typical duration:** 6-9 months
**Key risks:** Union/HR resistance; some "absorbed" activities (expediting) genuinely belong with buyer
**Preconditions:** Activity baselining; HR/change-mgmt support; tooling fixes scoped
**Governance:** HITL Approve

## rec-ss-activity-scope-clarification
**Matched patterns:** rca-pat-ss-05 (activity ambiguity)
**Action:** Publish SSC charter clarifying activity-level scope per category type; document hand-offs explicitly.
**Scope:** Map each procurement activity (PO creation, GRN follow-up, invoice verification, vendor onboarding, payment follow-up, contract admin) to owner per category type. Publish RACI; train SSC + plant staff.
**Savings formula:** Eliminated duplication = duplicate_FTE_effort × loaded_FTE_cost (~0.5-1.5 FTE-equivalent freed)
**Typical savings:** ₹0.4-1.2 Cr/year + reduced cycle time
**Typical duration:** 3-6 months
**Key risks:** Documentation effort under-estimated; staff resistance
**Preconditions:** SSC charter exists/authorable; process owner identified
**Governance:** HITL Approve (low-stakes)

---

# C. CoE Recommendation Cards

## rec-coe-formalise-existing-informal
**Matched patterns:** rca-pat-coe-01 (informal-only)
**Action:** Formalise existing informal CoE — charter + KPIs + scope clarity + staffing plan.
**Scope:** Author CoE charter (mission, scope, decision authority, KPIs). Confirm existing informal scope + expand by ~3-5 categories. Add 1-3 FTE if warranted. Establish market intelligence subscriptions.
**Savings formula:** `current_informal_scope_spend × 1.5-3%` (formalisation uplift) + `ce3_gap_spend × industry_coe_rate` (Steel 3-6%)
**Typical savings:** Steel: ₹40-80 Cr/year combined for mid-size
**Typical duration:** 6-9 months formalisation; 12-18 months full expansion
**Key risks:** Informal owners may resist new structure; KPI contested; capability investment not budgeted
**Preconditions:** CPO sponsorship; existing category managers willing to formalise
**Governance:** HITL Approve

## rec-coe-greenfield-establishment
**Matched patterns:** rca-pat-coe-02 (no CoE + high concentration)
**Action:** Establish formal procurement CoE; staff with category strategists for top strategic categories.
**Scope:** Stand up CoE (4-8 FTE incl. CoE Lead). Initial scope: top 6-10 CoE-Suitable categories per industry filter. Market intel subscriptions. KPIs around savings + supplier risk.
**Savings formula:** `ce4_addressable_spend × industry_coe_rate` (Steel: ₹X × 3-6%)
**Typical savings:** Steel: ₹50-150 Cr/year depending on strategic spend size
**Typical duration:** 9-12 months stand-up; 18-24 months to mature
**Key risks:** FTE investment faces pushback; strategists must be hired (long lead); subscriptions add OpEx; Year 1 capture conservative
**Preconditions:** CPO + CFO joint sponsorship; FTE budget approved; reporting line to CPO
**Governance:** HITL Approve & Proceed; partner sign-off

## rec-coe-scope-expansion
**Matched patterns:** rca-pat-coe-03 (narrow scope)
**Action:** Expand existing CoE scope to cover all CoE-suitable categories; add capacity if needed.
**Scope:** Add 3-5 categories to existing CoE remit. Add 1-2 FTE if warranted. Re-baseline KPIs.
**Savings formula:** As per greenfield card applied to expansion-only spend
**Typical savings:** Steel: ₹15-40 Cr/year incremental
**Typical duration:** 6-9 months
**Key risks:** Capacity strain if FTE not added; new categories may have weak data baseline
**Preconditions:** CoE operating well in current scope; FTE budget OR re-allocation
**Governance:** HITL Approve

## rec-coe-capability-uplift
**Matched patterns:** rca-pat-coe-04 (capability under-funded)
**Action:** Invest in CoE capability — market intelligence subscriptions, tooling, training.
**Scope:** Commodity research subscriptions (Platts, CRU, Argus for Steel). Analytics tooling (spend analytics, supplier risk monitoring). Training: commercial negotiation, commodity hedging.
**Savings formula:** Indicative 1-2% additional value-add on commodity-exposed strategic categories
**Typical savings:** Steel: ₹10-30 Cr/year
**Typical duration:** 3-6 months setup; ongoing
**Key risks:** Subscriptions add OpEx; ROI hard to quantify upfront; tooling integration with ERP
**Preconditions:** CoE exists; budget for ongoing OpEx
**Governance:** HITL Approve

## rec-coe-governance-redesign
**Matched patterns:** rca-pat-coe-05 (structural issue)
**Action:** Re-architect CoE governance — reporting line, decision authority, BU engagement model.
**Scope:** Reposition CoE under CPO if currently elsewhere. RACI. BU-engagement model. CoE-led governance forums (commodity review, supplier review).
**Savings formula:** No direct savings; enables other CoE recommendations. Indirect value enabler.
**Typical savings:** Pre-requisite — not standalone
**Typical duration:** 3-6 months
**Key risks:** Reporting line changes contested; BU heads resistant to losing influence
**Preconditions:** CEO/CPO sponsorship; org design willing
**Governance:** HITL Approve & Proceed; partner sign-off

---

# D. Tail Spend Recommendation Cards

## rec-ts-aggregator-onboarding
**Matched patterns:** rca-pat-ts-01 (no aggregator + large addressable)
**Action:** Onboard managed-procurement aggregator (Moglix typically first choice for Indian Steel) for aggregator-suitable tail categories.
**Scope:** Sequence: (1) stationery + office supplies pilot, (2) MRO consumables tail, (3) lab consumables, (4) IT peripherals. ERP integration (PunchOut) by phase 2.
**Savings formula:** `aggregator_addressable_spend × industry_outsourcing_rate` (Steel: ₹X × 4-7%)
**Typical savings:** Steel: ₹1-3 Cr/year for typical mid-size
**Typical duration:** 3-6 months pilot + ongoing rollout
**Key risks:** IT integration friction (PunchOut); existing vendor relationships resist; aggregator commercial terms need careful negotiation; some "tail" items have plant-specific spec needs
**Preconditions:** Tail spend analytics complete; IT engagement on integration; pilot category list aligned
**Governance:** HITL Approve

## rec-ts-scale-existing-aggregator
**Matched patterns:** rca-pat-ts-02 (pilot not scaled)
**Action:** Scale existing aggregator scope (typically Moglix) to cover identified suitable categories.
**Scope:** Expand from current scope (e.g., stationery) to MRO consumables tail + lab consumables + IT peripherals per industry filter. Renegotiate terms if volume scales materially.
**Savings formula:** As per onboarding card applied to incremental scope spend
**Typical savings:** Steel: ₹1-2 Cr/year incremental
**Typical duration:** 3-6 months per category wave
**Key risks:** Stakeholder fatigue if previous expansion stalled; aggregator may need to invest in new catalog
**Preconditions:** Existing aggregator relationship in good standing; pilot results positive
**Governance:** HITL Approve

## rec-ts-vendor-consolidation
**Matched patterns:** rca-pat-ts-03 (long-tail fragmentation)
**Action:** Vendor consolidation programme — combine with aggregator partnership where possible.
**Scope:** Annual vendor master cleanup; central vendor onboarding gate; rationalise AVL; aggregator picks up catalog-suitable purchases; remainder consolidated to fewer relationships.
**Savings formula:** Reduced vendor mgmt overhead + 1-2% pricing improvement via consolidation
**Typical savings:** ₹2-5 Cr/year (mix of OpEx + price)
**Typical duration:** 6-12 months
**Key risks:** Vendor master cleanup data-intensive; onboarding gate creates short-term friction; some long-tail vendors may be MSE/supplier-diversity goals
**Preconditions:** Vendor master dedup; central proc willing to gatekeep onboarding; Plant Heads briefed
**Governance:** HITL Approve

## rec-ts-tail-discipline-uplift
**Matched patterns:** rca-pat-ts-04 (high tail share)
**Action:** Combined intervention — rate contract expansion + catalog enablement + aggregator partnership + PR-to-PO process review.
**Scope:** Multi-dimensional uplift. Rate contract coverage from current X% to 70%+ on indirect. Catalog buying for top SKUs. Aggregator for suitable tail. PR-to-PO process pilot.
**Savings formula:** Compound savings across multiple dimensions; indicative 3-5% on indirect spend total
**Typical savings:** Steel: ₹5-15 Cr/year for mid-size
**Typical duration:** 12-18 months (transformational)
**Key risks:** Multiple workstreams stretch capacity; cross-pillar coordination needed; initial year capture conservative
**Preconditions:** CPO-led transformation mandate; cross-pillar alignment; resource allocation
**Governance:** HITL Approve & Proceed; partner sign-off

## rec-ts-policy-review-required
**Matched patterns:** rca-pat-ts-05 (policy restriction)
**Action:** Review procurement policy that's blocking aggregator adoption; if outdated, update.
**Scope:** Document the specific policy clause; check against aggregator capabilities (e.g., Moglix MSE-supplier filter); if barrier is dated, update policy with explicit aggregator guidance.
**Savings formula:** Pre-requisite — unlocks aggregator card's savings
**Typical savings:** Unlocks downstream aggregator card
**Typical duration:** 3-6 months for policy review + approval
**Key risks:** Policy review slow; supplier diversity goals may legitimately constrain aggregator use; legal/compliance involvement
**Preconditions:** CPO supports policy review; aggregator capability validated (e.g., MSE-filter)
**Governance:** HITL Approve

---

# E. Strategic Imperative (Cross-Theme) Recommendation Cards

## rec-si-phased-central-capability-build
**Matched patterns:** rca-pat-si-01 (under-investment in central capability)
**Action:** Phased build of central procurement capability over 24-36 months: SSC first, then CoE, then full centralisation.
**Scope:** Sequence designed for capacity creation and political viability:
- Phase 1 (Months 1-12): Stand up SSC; absorb transactional work from plant buyers
- Phase 2 (Months 6-18): Formalise CoE for top strategic categories
- Phase 3 (Months 12-24): Centralise sourcing scope for high-commonality categories
- Phase 4 (Months 18-36): Expand and optimise
**Savings formula:** Roll-up across themes per `cross-theme-synthesis.md` X3 logic
**Typical savings:** Steel: ₹100-250 Cr/year at full capture
**Typical duration:** 24-36 months
**Key risks:** Multi-year transformation, political risk high; investment ahead of returns (Year 1 cost > saving); plant resistance; leadership change can stall
**Preconditions:** CEO sponsorship (CPO alone insufficient); transformation budget; change management resource
**Governance:** HITL Approve & Proceed; partner sign-off

## rec-si-formalise-coe
**Matched patterns:** rca-pat-si-02 (volume-focused, value-blind)
**Action:** Formalise CoE — the next maturity step after centralisation. Strategic depth on top categories.
**Scope:** Formalise existing informal capability + scope expansion to comprehensive CoE-suitable category list per industry filter.
**Savings formula:** Combination of `rec-coe-formalise-existing-informal` + `rec-coe-scope-expansion`
**Typical savings:** Steel: ₹40-100 Cr/year incremental
**Typical duration:** 12-24 months
**Key risks:** As per CoE-specific cards
**Preconditions:** As per CoE-specific cards
**Governance:** HITL Approve & Proceed

## rec-si-transactional-efficiency-build
**Matched patterns:** rca-pat-si-03 (strategic well-managed, transactional ignored)
**Action:** Build transactional efficiency — SSC expansion + aggregator partnership + plant buyer role redesign.
**Scope:** Combination of SSC expansion + tail outsourcing + plant role redesign cards.
**Savings formula:** Sum across SSC + Tail Spend themes (no overlap; different bases)
**Typical savings:** Steel: ₹5-15 Cr/year + 3-8 FTE freed
**Typical duration:** 18-30 months
**Governance:** HITL Approve & Proceed

## rec-si-combined-sourcing-discipline-uplift
**Matched patterns:** rca-pat-si-04 (sourcing discipline gap)
**Action:** CPO-led transformation programme combining centralisation, vendor consolidation, aggregator partnership.
**Scope:** Multi-dimensional sourcing transformation. Address centralisation, tail spend, vendor fragmentation together. Cross-pillar engagement (PR-to-PO + Supplier).
**Savings formula:** Compound across themes per `cross-theme-synthesis.md`
**Typical savings:** Steel: ₹80-200 Cr/year at full capture
**Typical duration:** 24-36 months
**Key risks:** Transformational change requires CEO mandate; multiple workstreams compete for capacity; vendor relationships across plants disrupted; Year 1 capture conservative
**Preconditions:** CEO + CFO + CPO joint sponsorship; dedicated transformation team; multi-year commitment
**Governance:** HITL Approve & Proceed; partner sign-off; CEO buy-in

## rec-si-continuous-improvement-only
**Matched patterns:** rca-pat-si-05 (already-optimal)
**Action:** No structural Op Model action. Focus on continuous improvement within model + other pillars.
**Scope:** Operational excellence — digital uplift in SSC + CoE tooling, supplier development, continuous improvement KPIs. Op Model is mature; investment shifts to Capability or Tech & Digital pillars.
**Savings formula:** Not applicable. Op Model "no structural change" finding.
**Typical savings:** Minimal from Op Model perspective
**Typical duration:** Ongoing
**Governance:** N/A — no recommendation requires HITL

---

# F. Recommendation Selection Notes

When multiple cards match a pattern, selection priority:
1. Industry-specific cards (where available) beat generic
2. Higher confidence matches beat lower
3. Higher pattern fit score
4. Engagement-specific override (if consultant has explicitly preferred)

Cards are designed to be **composable** — a Strategic Imperative card (E) typically references and combines multiple individual theme cards (A-D). The engine should surface the SI card if SI pattern detected, but show individual theme cards as backup for granular review.
