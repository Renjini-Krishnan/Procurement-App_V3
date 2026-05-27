---
id: org-structure-recommendations
layer: function
function: procurement
pillar: org-structure
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Org Structure — Recommendations Library

## Purpose

Recommendation card library for the Org Structure pillar. Each card matches a finding pattern (from `rca-patterns.md` / `rca-rules.yml`) and provides a structured recommendation.

**Pillar boundary applied to ALL cards:**
- **No ₹ cost-out savings** — actions are structural / FTE-level / capability-uplift
- **Directional recommendations** — FTE counts in ranges (e.g., "3-5 specialist hires") not specifics
- **HR / change-mgmt risks acknowledged** — structural change is slow and complex

## Card Schema
```yaml
recommendation_id: string
theme: posture / sizing-composition / distribution / hierarchy-span / synthesis
matched_patterns: array
action: 1-2 sentence imperative
scope_description: "what gets done"
fte_implications: "ranges only, not specifics; FTE-level not ₹"
typical_duration_months: implementation duration band
key_risks: list
preconditions: list
governance_required: HITL approval level
```

---

# A. Posture & Reporting Cards

## rec-os-posture-align-via-restructure
**Matched patterns:** rca-pat-os-posture-01 (M&A)
**Action:** Realign procurement structure with business posture; integrate acquired-entity procurement into corporate function.
**Scope:** Establish central category management; integrate acquired plant/BU procurement teams; consolidate vendor master + ERP discipline; align reporting line.
**FTE implications:** Aggregate FTE roughly unchanged through restructure; some role-level shifts as acquired-entity Cat Mgrs absorbed centrally.
**Typical duration:** 18-36 months for full integration
**Key risks:** Plant resistance during transition; acquired-entity vendor relationships disrupted; M&A integration fatigue; loss of acquired-entity tribal knowledge
**Preconditions:** CEO + CFO sponsorship; Stage 6 entity mapping complete; M&A integration playbook applies
**Governance:** HITL Approve & Proceed; partner sign-off

## rec-os-elevate-reporting-line
**Matched patterns:** rca-pat-os-posture-02 (strategic mandate vs CFO reporting)
**Action:** Elevate CPO reporting line to CEO/COO OR formalise ExCo seat as interim step.
**Scope:** Two-track:
- **Track 1 (lower-bar):** Formalise ExCo seat for CPO; preserves CFO reporting but adds strategic voice
- **Track 2 (full):** Restructure CPO reporting to CEO; CFO retains oversight of cost/working-capital metrics
**FTE implications:** No FTE change; structural authority change only.
**Typical duration:** 3-9 months for ExCo seat; 6-12 months for full reporting line change
**Key risks:** CFO political concerns (loss of direct control); ambiguity during transition; without specialist hires alongside, reporting line alone insufficient
**Preconditions:** CEO sponsorship; specialist hires alongside; mandate clarity documented
**Governance:** HITL Approve & Proceed; partner sign-off

## rec-os-establish-central-procurement
**Matched patterns:** rca-pat-os-posture-03 (Plant Head reporting)
**Action:** Establish corporate procurement function with central category management for top-N high-commonality categories.
**Scope:** Stand up corporate procurement team (typically 5-15 FTE); position under CEO/CFO/COO; central category mgmt for top categories; plant procurement focuses on execution.
**FTE implications:** Add 5-15 corporate FTE; existing plant FTE largely unchanged.
**Typical duration:** 12-24 months
**Key risks:** Plant Head resistance; capability/recruitment lead-time; cultural shift; initial savings quantification difficult
**Preconditions:** CEO / Board sponsorship; aligned with Op Model Centralisation theme; budget for new corporate FTE
**Governance:** HITL Approve & Proceed; partner sign-off; CEO buy-in

## rec-os-no-change
**Matched patterns:** rca-pat-os-posture-04 (Aligned-with-Tension stable), rca-pat-os-posture-05 (foreign-owned), rca-pat-os-distribution-01 (Central lean productive)
**Action:** No structural change recommended. Current state is functional + appropriate for context.
**Scope:** Acknowledge current structure works. Document; monitor for triggers (mandate evolution, M&A, leadership change).
**FTE implications:** No change.
**Typical duration:** N/A
**Preconditions:** Current state genuinely working (validate via QRE perception + cross-theme consistency).
**Governance:** HITL Approve (lightweight)

---

# B. FTE Sizing & Role Composition Cards

## rec-os-rightsize-team-add
**Matched patterns:** rca-pat-os-sizing-01 (under-staffed)
**Action:** Add FTE to relieve capacity strain; prioritise specialist roles for capability uplift.
**Scope:** Add indicative 4-10 FTE; mix of specialist + Cat Mgr roles; back-fill key vacancies; phased hiring over 12 months.
**FTE implications:** Net FTE increase 4-10 (band; not specific count).
**Typical duration:** 12-18 months for full hiring + ramp-up
**Key risks:** Talent market constraints; HR budget approval; onboarding consumes current team capacity
**Preconditions:** HR budget approved; recruitment plan; clear role definitions
**Governance:** HITL Approve

## rec-os-rightsize-team-reduce-or-redirect
**Matched patterns:** rca-pat-os-sizing-02 (over-staffed)
**Action:** Two paths — (a) right-size headcount if redundancy real OR (b) redirect FTE via Op Model SSC implementation (preferred).
**Scope:**
- **Path A (reduction):** 5-15% headcount reduction through natural attrition + role consolidation
- **Path B (redirection — preferred):** Op Model SSC implementation absorbs plant transactional volume; redirect freed plant FTE into specialist roles centrally OR into Op Model SSC roles
**FTE implications:** Path A: net reduction 5-15%; Path B: net unchanged, composition shift.
**Typical duration:** Path A: 18-24 months; Path B: 12-18 months (in concert with SSC roadmap)
**Key risks:** Path A: morale, attrition spikes, HR exposure; Path B: SSC implementation complexity; skills mismatch in redeployment
**Preconditions:** Op Model SSC analysis available (Path B); HR + change-mgmt resourcing; redeployment/training plan
**Governance:** HITL Approve & Proceed; partner sign-off (HR-sensitive)

## rec-os-rebalance-composition-via-specialists
**Matched patterns:** rca-pat-os-sizing-03 (transactional overrepresentation), rca-pat-os-sizing-04 (multiple specialist gaps)
**Action:** Add specialist FTE batch; redirect transactional FTE through SSC.
**Scope:** Hire 4-6 specialist FTE (Analytics, SRM, FBP, Sustainability/ESG, Commodity Analyst, others per gap analysis); Op Model SSC implementation absorbs transactional volume; redirect 4-5 transactional FTE.
**FTE implications:** Add 4-6 specialists; redirect 4-5 transactional. Net headcount approximately unchanged. Significantly stronger strategic posture.
**Typical duration:** 12-18 months in concert with Op Model SSC roadmap
**Key risks:** Specialist talent scarcity; redeployment requires training; composition shift slower than expected
**Preconditions:** HR budget for hires; Op Model SSC implementation underway; specialist career path defined
**Governance:** HITL Approve & Proceed

## rec-os-add-specialists-batch
**Matched patterns:** rca-pat-os-sizing-04 (multiple critical gaps)
**Action:** Batch hire specialist FTE to close critical capability gaps.
**Scope:** Phase 1 (priority): Analytics + SRM + Sustainability/ESG (3 FTE). Phase 2: FBP + Risk + Commodity Analyst (3 FTE). Phase 3: Digital/Tech.
**FTE implications:** Add 4-6 specialists over 12-18 months. Phased to manage capacity + budget.
**Typical duration:** 12-18 months total
**Key risks:** Specialist talent scarcity; budget phasing
**Preconditions:** HR budget approved per phase
**Governance:** HITL Approve

## rec-os-add-sustainability-esg-role
**Matched patterns:** rca-pat-os-sizing-05 (Sustainability/ESG missing — Steel)
**Action:** Hire dedicated Sustainability/ESG Procurement Specialist.
**Scope:** New FTE focused on: green H2 / low-emission iron substitutes / scrap-heavy sourcing; ESG vendor scoring; BRSR + CBAM compliance liaison; decarbonisation roadmap procurement input.
**FTE implications:** Add 1 specialist FTE (Sustainability/ESG).
**Typical duration:** 6-9 months to hire + onboard
**Key risks:** Talent pipeline still building (early hires get better profiles); role definition may evolve; senior buy-in needed for budget
**Preconditions:** ESG strategy at corporate level; Sustainability function exists OR partnership with Sustainability team
**Governance:** HITL Approve

## rec-os-add-srm-role
**Matched patterns:** rca-pat-os-sizing-06 (SRM missing + high vendor concentration)
**Action:** Hire dedicated Supplier Relationship Manager for top strategic suppliers.
**Scope:** New FTE focused on: top-10 strategic supplier relationship governance; supplier risk monitoring; supplier innovation sessions; QBR / SLA management.
**FTE implications:** Add 1 SRM FTE at Sr Mgr level.
**Typical duration:** 4-6 months to hire + onboard
**Key risks:** Role boundary with Cat Mgrs (clarify in JD); supplier-relationship transition from informal to formal
**Preconditions:** Strategic supplier list defined; supplier risk framework; SRM tool (or willingness to invest)
**Governance:** HITL Approve

---

# C. Spend-FTE Distribution Cards

## rec-os-distribution-no-change
**Matched patterns:** rca-pat-os-distribution-01 (Central lean productive)
**Action:** No distribution change. Continue current Central:Plant allocation.
**Scope:** Central:Plant imbalance reflects healthy strategic mandate, not a problem. Document; no action.
**FTE implications:** No change.
**Governance:** HITL Approve (lightweight)

## rec-os-defer-to-ssc-implementation
**Matched patterns:** rca-pat-os-distribution-02 (plants systemically under-productive)
**Action:** No theme-3-only re-allocation. Defer to Op Model SSC implementation which naturally rebalances.
**Scope:** Op Model SSC theme already recommends transactional consolidation. SSC implementation will absorb plant transactional volume + free FTE.
**FTE implications:** Driven by Op Model SSC implementation.
**Typical duration:** Driven by Op Model SSC roadmap (12-18 months typical).
**Preconditions:** Op Model SSC recommendation accepted + funded.
**Governance:** HITL Approve

## rec-os-investigate-central-top-heaviness
**Matched patterns:** rca-pat-os-distribution-03 (Central over-staffed)
**Action:** Investigate Central FTE composition for top-heaviness sources.
**Scope:** Three-step diagnostic:
- Step 1: Verify role classification at Central (leadership over-representation?)
- Step 2: Check whether non-procurement functional roles (legal, compliance, MDM) are misclassified as procurement
- Step 3: Review Centre-Led-only categories absorbing FTE without spend ownership
**FTE implications:** Re-classification may reveal FTE actually belongs to other functions.
**Typical duration:** 2-3 months investigation; action depends on findings.
**Key risks:** Re-classification may surface inter-function political tensions.
**Preconditions:** HR + Finance alignment on role classification.
**Governance:** HITL Approve

## rec-os-investigate-plant-specific
**Matched patterns:** rca-pat-os-distribution-04 (one plant outlier)
**Action:** Plant-specific investigation into why plant X sits outside distribution pattern.
**Scope:** Plant-by-plant conversation. Diagnostic options: recently acquired plant; different category mix; specific Plant Head priorities; data quality issue; capability gap.
**FTE implications:** Depends on findings.
**Typical duration:** 1-2 months investigation.
**Key risks:** Plant Head political sensitivity.
**Preconditions:** Plant Head engaged in diagnostic.
**Governance:** HITL Approve (lightweight)

---

# D. Hierarchy & Span Cards

## rec-os-plant-layer-redesign
**Matched patterns:** rca-pat-os-hierarchy-01 (plant Sr Mgr stretched)
**Action:** Plant layer redesign — add intermediate Mgr layer OR redistribute via Op Model SSC.
**Scope:** Two options:
- **Option A (intermediate layer):** Add Mgr-level role(s) between plant Sr Mgr + Asst Mgrs/Buyers. Plant Sr Mgr span drops to 4-7; intermediate Mgrs handle day-to-day.
- **Option B (SSC redirect — preferred):** Op Model SSC implementation absorbs transactional team; plant Sr Mgr span drops naturally.
**FTE implications:** Option A: Add 1 Mgr role per plant. Option B: No headcount change; team shifts to SSC.
**Typical duration:** Option A: 6-12 months. Option B: 12-18 months (in concert with SSC).
**Key risks:** Option A: adds hierarchy layer; Option B: SSC complexity
**Preconditions:** Option A: Mgr-level candidates internal or external; Option B: Op Model SSC recommendation accepted
**Governance:** HITL Approve

## rec-os-question-intermediate-layer
**Matched patterns:** rca-pat-os-hierarchy-02 (DGM under-leveraged)
**Action:** Question whether intermediate management layer adds value; consider consolidation.
**Scope:** Diagnostic conversation: what does the under-leveraged DGM role add? Can reports merge into another DGM? Can plants/BUs report directly to CPO?
**FTE implications:** Potentially eliminate 1 layer (1 FTE moved or redeployed); CPO span widens.
**Typical duration:** 3-6 months diagnostic; 6-9 months implementation if change agreed.
**Key risks:** Political sensitivity (existing DGM affected); CPO span increase may cross stretched threshold; loss of plant-coordination function
**Preconditions:** HR + CPO alignment; clear succession / redeployment for affected DGM
**Governance:** HITL Approve & Proceed

## rec-os-delayer
**Matched patterns:** rca-pat-os-hierarchy-03 (hierarchy too tall)
**Action:** Delayer procurement hierarchy by one level — typically removing intermediate DGM layer.
**Scope:** Reduce 6 levels to 5; consolidate intermediate management roles; clearer reporting lines.
**FTE implications:** Net headcount reduction of 1-3 FTE at intermediate management; redeployed where possible.
**Typical duration:** 12-18 months
**Key risks:** HR exposure; reporting line disruption; cultural change; may require external change management support
**Preconditions:** CEO + CHRO sponsorship; affected individuals have redeployment/exit plan
**Governance:** HITL Approve & Proceed; partner sign-off; CEO buy-in

## rec-os-add-dgm-layer
**Matched patterns:** rca-pat-os-hierarchy-04 (CPO stretched)
**Action:** Add DGM layer between CPO and Sr Mgrs.
**Scope:** Stand up 1-2 DGM roles; reorganise CPO's direct reports into DGM clusters (Direct / Indirect, or Strategic / Operations split common); CPO has 4-6 direct reports post-change.
**FTE implications:** Add 1-2 DGM FTE (senior level).
**Typical duration:** 6-12 months (hiring + transition)
**Key risks:** Senior talent scarcity; existing Sr Mgrs may resist new DGM layer; budget for senior FTE
**Preconditions:** HR budget for senior roles; org design clarity
**Governance:** HITL Approve & Proceed

## rec-os-rr-refresh
**Matched patterns:** rca-pat-os-hierarchy-05 (R&R overlap)
**Action:** R&R clarification exercise + JD refresh.
**Scope:** Document RACI for Sr Buyer vs Asst Mgr (and other surfaced overlaps); refresh JDs; communicate to team; revisit quarterly.
**FTE implications:** No headcount change; clarity exercise.
**Typical duration:** 3-6 months for documentation + rollout
**Key risks:** Surfaces hidden role disputes; requires Cat Mgr + Plant Heads time; JD refresh may surface other gaps
**Preconditions:** HR participation; Procurement Leadership commitment
**Governance:** HITL Approve

---

# E. Strategic Imperative (Cross-Theme) Cards

## rec-os-si-under-resourced-build
**Matched patterns:** rca-pat-os-si-01 (under-resourced central capability)
**Action:** Multi-year procurement function build — structural realignment + specialist hires + SSC implementation + plant layer redesign.
**Scope:** 24-36 month transformation:
- Phase 1 (Months 1-9): Structural realignment + reporting line + Phase 1 specialist hires
- Phase 2 (Months 9-18): Op Model SSC implementation + Phase 2 specialist hires
- Phase 3 (Months 18-36): Plant layer redesign + capability uplift + sustained operation
**FTE implications:** Net FTE add 3-8 (specialists); composition heavily shifts toward strategic + specialist.
**Typical duration:** 24-36 months
**Key risks:** Major transformation; political risk high; investment ahead of returns; leadership change can stall; multi-year discipline required
**Preconditions:** CEO + Board sponsorship; transformation budget multi-year; change management resource
**Governance:** HITL Approve & Proceed; partner sign-off; CEO + Board

## rec-os-si-strategic-mismatch
**Matched patterns:** rca-pat-os-si-02 (strategic mandate-structure mismatch)
**Action:** Reporting line elevation (or ExCo seat) + 4-6 specialist hires + operating model refinement.
**Scope:** 12-18 month transformation:
- Reporting line elevation OR ExCo formalisation (3-6 months)
- Specialist hires: Analytics + SRM + FBP + Sustainability/ESG + 1-2 others (6-12 months)
- Operating model refinement to reinforce mandate (6-12 months)
**FTE implications:** Add 4-6 specialist FTE; no other structural change.
**Typical duration:** 12-18 months
**Key risks:** Without specialist hires, reporting line change cosmetic; specialist talent scarcity; mandate clarity not yet documented
**Preconditions:** Mandate stated + documented; CEO sponsorship; HR budget approved
**Governance:** HITL Approve & Proceed

## rec-os-si-fill-capability-gaps
**Matched patterns:** rca-pat-os-si-03 (operational shape healthy, capability gaps)
**Action:** Focused capability build — 4-6 specialist hires without structural overhaul.
**Scope:** Hire Analytics + SRM + FBP + Sustainability/ESG + Commodity Analyst + Risk specialists in phases. No structural change; no reporting line change.
**FTE implications:** Add 4-6 specialist FTE.
**Typical duration:** 12-18 months
**Key risks:** Specialist talent scarcity; onboarding consumes current team time
**Preconditions:** HR budget approved; specialist career path defined; mandate clarity
**Governance:** HITL Approve

## rec-os-si-composition-rebalance
**Matched patterns:** rca-pat-os-si-04 (composition-led rebalance)
**Action:** Specialist hires + transactional redirect via Op Model SSC (combined).
**Scope:** Compound of `rec-os-rebalance-composition-via-specialists` + `rec-os-plant-layer-redesign` (Option B) + cross-link to Op Model SSC.
**FTE implications:** Add 4-6 specialists; redirect 4-5 transactional via SSC. Net headcount approximately unchanged.
**Typical duration:** 12-18 months in concert with Op Model SSC roadmap
**Preconditions:** Op Model SSC implementation underway.
**Governance:** HITL Approve & Proceed

## rec-os-si-no-change
**Matched patterns:** rca-pat-os-si-05 (already-balanced)
**Action:** No structural Org Structure action. Focus on continuous improvement within structure + other pillars.
**Scope:** Sustained capability development; emerging-role hiring (Sustainability/ESG, Digital); other pillars (Capability, Tech & Digital) may surface opportunity.
**FTE implications:** Minor — emerging-role hires (1-2 over 12-24 months) at most.
**Typical duration:** Ongoing
**Governance:** HITL Approve (lightweight)

---

# F. Recommendation Selection Notes

When multiple cards match a pattern, selection priority:
1. Industry-specific cards beat generic
2. Higher confidence matches beat lower
3. Higher pattern fit score
4. Engagement-specific override

Cards are **composable** — Strategic Imperative cards (E) typically reference and combine multiple individual theme cards (A-D). Engine surfaces SI card as headline; theme cards as backup for granular review.

**Boundary reminder:** All Org Structure cards FTE-level + structural. No ₹ cost-out savings. Op Model pillar owns ₹ quantification.
