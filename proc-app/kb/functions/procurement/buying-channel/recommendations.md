---
id: buying-channel-recommendations
layer: function
function: procurement
pillar: buying-channel
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Buying Channel — Recommendations Library

## Purpose

Recommendation card library for the Buying Channel pillar. Each card is a fully-structured recommendation surfaced by the engine when a matching finding pattern (from `rca-patterns.md` / `rca-rules.yml`) fires.

Cards are keyed by recommendation ID (rec-bc-*). The engine reads from this library at Stage 14: picks the best-fit card given the pattern that fired; applies engagement-specific scope; surfaces with action verb + scope + impact + duration + risks + preconditions.

## Logic Embodied

At Stage 14, after RCA produces a primary pattern ID:
1. Filter cards by `triggered_by_patterns` matching the rule/pattern fired
2. Pick best-fit card (or top-2 if multiple patterns fire)
3. Apply engagement-specific data (spend, MG count, archetype-specific values)
4. Surface in:
   - Per-finding recommendation box (theme tab)
   - Findings Deck recommendation slides
   - Exec Summary action bullets
   - Transformation Roadmap (sequenced into phases)

## Inputs Used

| Input | Source |
|---|---|
| Finding pattern ID | `rca-patterns.md` (matched via `rca-rules.yml` rule fire) |
| Engagement spend / MG counts | BC analysis output |
| Industry channel mix benchmarks | `benchmarks.yml` + Steel overlay |
| Transformation ceiling | `benchmarks.yml` (default 25 pp) |

## Boundary: NO ₹ savings claims

Recommendations describe TAT reduction, buyer-bandwidth freed (FTE-equivalent), contract coverage lift (% points), and risk reduction. ₹ savings live in Op Model. AI prompts validate every generated recommendation to strip any "₹X Cr savings" claim that leaks through.

## Editable Configuration

```yaml
recommendation_phasing_horizons:
  quick_win_months: 3       # Phase 1 — quick wins (catalogue, OLA narrow)
  medium_term_months: 12    # Phase 2 — programme builds
  long_term_months: 24      # Phase 3 — structural transformation
risk_disclosure_required: true  # Every card must list 2-3 risks
preconditions_required: true    # Every card must list its preconditions
```

---

# A. Programme-Build Recommendations (greenfield / scale-up)

## rec-bc-greenfield-contract-programme

**Triggered by patterns:** rca-pat-bc-01

**Title:** Build a formal procurement contract programme

**Scope:** Establish central contract function + portfolio of contracts (RC-LT for top BULK, OLA for recurring INDIRECT + SERVICE, catalogue for low-value INDIRECT consumables).

**Action:**
1. Stand up central contract function — 2-4 FTE category managers + contract administrator
2. Identify top 20 categories by spend for contract programme launch
3. Negotiate + execute initial wave: 5 RC-LT (top BULK), 10 OLA (recurring INDIRECT/SERVICE), 5 ASL panels (DIRECT)
4. ERP discipline: enforce contract reference field at PR/PO creation
5. Build measurement: contract coverage % + leakage % as monthly KPI

**Expected impact (over 18-24 months):**
- Contract coverage lift: +20 to +25 percentage points (within transformation ceiling)
- Portfolio TAT reduction: 30-50% weighted average
- Buyer bandwidth freed: 8-15 FTE-equivalent (redeployable to category mgmt)

**Duration:** 18-24 months (Phase 1: 0-6 mo top 5 contracts; Phase 2: 6-18 mo expand; Phase 3: 18-24 mo institutionalise)

**Risks:**
- Buyer + plant resistance to centralised contracts (change management heavy)
- Contract negotiations take 3-6 months each — pipeline + capacity needs realistic
- ERP contract-reference enforcement requires IT change

**Preconditions:**
- Sponsorship from procurement leadership + plant heads
- IT bandwidth for ERP configuration changes
- Category-manager hires (or redeployment from spot-buying roles)

---

## rec-bc-indirect-ola-catalogue-build

**Triggered by patterns:** rca-pat-bc-04, rca-pat-bc-05, rca-pat-bc-06

**Title:** Build INDIRECT OLA + catalogue programme

**Scope:** Implement OLA programme for recurring MRO + catalogue / ROP for high-frequency low-value consumables.

**Action:**
1. Implement (or scope-expand) catalogue platform — SAP MM Catalog / Ariba Catalogue / Coupa / Moglix-managed
2. Onboard top 15-25 MGs with vendor catalogue depth (PPE, bearings, lubricants, stationery, IT consumables)
3. Grant requisitioner direct-ordering rights for catalogue items
4. Parallel OLA programme: annual rate-contracts for recurring INDIRECT MGs (top 25-30 by spend)
5. Train plant buyers + requisitioners on the new model
6. Measure: catalogue penetration % (INDIRECT spend) + OLA share (total)

**Expected impact (12-18 months):**
- Catalogue penetration in INDIRECT: from <5% to 15-25% (typical band)
- OLA share: from <10% to 15-20% (typical band)
- TAT on migrated POs: from 25-70 days (spot/RFQ) to 1-3 days (catalogue/OLA)
- Buyer touch-time freed: 8-12 FTE-equivalent on INDIRECT alone

**Duration:** 12-18 months (Phase 1: 0-3 mo platform + top 5 MG catalogue; Phase 2: 3-12 mo scale catalogue + OLA programme; Phase 3: 12-18 mo institutionalise)

**Risks:**
- Catalogue maintenance — risk of vendor catalogue going stale, leading to bypass
- Plant-buyer resistance to direct-ordering by requisitioners
- Initial onboarding cycles can be slow if vendors aren't catalogue-enabled

**Preconditions:**
- Catalogue platform (build or buy decision; technology investment)
- Material master cleanup for the catalogued MGs (≥80% accurate MG descriptions)
- Procurement governance permitting requisitioner direct-ordering

---

## rec-bc-bulk-ltc-programme

**Triggered by patterns:** rca-pat-bc-03

**Title:** Build BULK long-term-contract programme

**Scope:** Index-linked long-term contracts for top commodity raw materials (coal, iron ore, ferro alloys, etc.).

**Action:**
1. Identify top 8-10 BULK MGs by spend; assess contract-readiness (vendor stability, volume predictability)
2. Develop index-linked pricing framework with commodity analyst input (Platts / LME / domestic indices)
3. Negotiate multi-year contracts (typically 2-3 years) with annual review provisions
4. Build hedging capability where applicable (FX hedging for imported BULK)
5. ERP setup: scheduling agreements for periodic call-offs

**Expected impact:**
- RC-LT share of BULK: from <50% to 70-85% (typical band; BIC 90%+)
- Pricing variance reduction (commodity exposure managed via index, not absorbed)
- TAT on BULK call-offs: ~3 days (vs ~70-day spot RFQ)

**Duration:** 12-24 months (per-MG negotiation 3-6 months; full programme 12-24 mo)

**Risks:**
- Commodity-pricing risk shift — index-linked exposes client to index movements (which they may not currently have transparency on)
- Multi-year commitments reduce flexibility if demand changes
- Vendor selection critical — wrong long-term partner is hard to exit

**Preconditions:**
- Commodity-pricing analyst in central procurement (Org Structure dependency)
- Volume predictability — production planning integrated with sourcing
- Senior leadership commitment to multi-year commitments

---

## rec-bc-service-framework-programme

**Triggered by patterns:** rca-pat-bc-07

**Title:** Build service framework-agreement programme

**Scope:** OLA-equivalent framework agreements for recurring service categories (contract labour, AMC, housekeeping, transport, training, security).

**Action:**
1. Inventory recurring service spend (frequency ≥3 POs per 6 months)
2. Migrate department-led service buying (HR for housekeeping, Maintenance for AMC) under procurement governance
3. Negotiate annual framework agreements with vendor panels (typically 2-3 vendors per service)
4. Service SLAs + performance metrics embedded in framework agreement
5. Call-off mechanism: department raises PR against framework; procurement releases PO

**Expected impact:**
- Service contracted %: from <40% to 70-80% over 18 months
- Vendor consolidation in services (often 5-10 vendors per category → 2-3 vendor panel)
- Performance discipline via SLA-based framework

**Duration:** 12-18 months

**Risks:**
- Department resistance — services have historically been bought by user departments
- Service quality risk if vendor panel too narrow
- SLA enforcement requires capability that procurement may not currently have

**Preconditions:**
- Service category manager (often a gap in Indian large-enterprise procurement orgs)
- Department alignment + transition plan from existing service buying

---

# B. Discipline / Master-Data Recommendations

## rec-bc-erp-discipline-contract-ref

**Triggered by patterns:** rca-pat-bc-02, rca-pat-bc-12

**Title:** Enforce contract reference discipline in PO creation

**Scope:** ERP configuration + buyer training to ensure contract reference field populated on every applicable PO.

**Action:**
1. ERP configuration: contract reference becomes mandatory field on PR/PO creation for MGs with active contracts
2. Contract repository — single source of truth, integrated with ERP lookup
3. Monthly contract-leakage report: POs raised without contract reference where contract exists
4. Buyer training on contract-ref discipline + DoA differentiation by channel
5. Channel-differentiated DoA: lighter approval workflow for OLA call-offs vs spot

**Expected impact:**
- Contract field population rate: from <50% to ≥90%
- Contracted % (PO-derived) closer aligns to actual contract coverage
- TAT on call-offs: reduces by 30-50% if DoA differentiated

**Duration:** 6-12 months

**Risks:**
- ERP enforcement may slow PO creation initially (buyer adjustment period)
- Contract repository quality is the binding constraint — bad repository = bad enforcement

**Preconditions:**
- Active contract repository (or willingness to build one)
- IT bandwidth for ERP changes
- DoA review forum + governance to approve channel-differentiated DoA

---

## rec-bc-material-master-cleanup

**Triggered by patterns:** rca-pat-bc-11

**Title:** Material master MG description cleanup (cross-pillar handoff)

**Scope:** Cleanup of UNCLASSIFIED MG descriptions to enable Buying Channel + downstream pillar analytics.

**Action:** (Owned by Material Master pillar — full scope in its recommendations library)
1. Identify top UNCLASSIFIED MGs by spend; review with category-manager + plant-buyer
2. Rewrite MG descriptions following the canonical industry taxonomy
3. Establish ongoing MG stewardship — new MGs require category-manager approval before activation

**Expected impact for Buying Channel:**
- UNCLASSIFIED reduces to <5%
- Channel recommendations operate at HIGH confidence for >95% of MGs
- BC10 finding closes

**Duration:** 6-9 months (Material Master pillar timeline)

**Cross-pillar handoff:** Material Master owns execution. Buying Channel surfaces the finding + the list of MGs needing cleanup.

---

# C. PAC / Sole-Source Risk Recommendations

## rec-bc-pac-review-vendor-development

**Triggered by patterns:** rca-pat-bc-09

**Title:** Structured PAC review + vendor development programme

**Scope:** Reduce sole-source dependency by structurally reviewing PAC categories + qualifying alternate vendors.

**Action:**
1. PAC review forum — quarterly review of PAC-justified MGs by category manager + procurement leadership
2. PAC reason categorisation (OEM / proprietary / urgency / spec-uniqueness)
3. Vendor development pipeline for top PAC categories where alternate is feasible
4. Engineering engagement: rewrite specs to be vendor-agnostic where possible
5. Track PAC % as KPI — target reduction trajectory

**Expected impact:**
- PAC share: from 10-20% to <8% over 18-24 months
- Reduced sole-source supply continuity risk

**Duration:** 18-24 months

**Risks:**
- Engineering pushback on spec rewrites
- Vendor development cycles long (3-6 months per alternate qualification)
- Some PAC genuinely irreducible — set realistic target

**Preconditions:**
- Engineering + procurement engagement (often a relationship-building dependency)
- Vendor development capability in procurement (capability gap in many Indian large enterprises)

---

## rec-bc-srm-critical-direct

**Triggered by patterns:** rca-pat-bc-10

**Title:** SRM programme for critical single-vendor DIRECT categories

**Scope:** Structured supplier relationship management for single-vendor critical DIRECT categories where alternate qualification is feasible.

**Action:** (Cross-pillar with Supplier — primary execution in Supplier pillar)
1. Risk register for single-vendor critical DIRECT MGs
2. SRM cadence: quarterly business review with each critical single-vendor
3. Alternate-vendor qualification pipeline (parallel programme; 12-18 month cycles)
4. Contingency plans: dual-source where feasible, safety stock for irreducible single-vendor

**Expected impact for Buying Channel:**
- Single-vendor critical DIRECT count reduces over 18-24 months
- BC8 sole-source risk register actively managed

**Duration:** 18-24 months

**Cross-pillar handoff:** Supplier pillar owns SRM execution. Buying Channel surfaces the candidate list + criticality classification.

---

# D. Aggregation / Centralisation Recommendations

## rec-bc-cross-plant-consolidation

**Triggered by patterns:** rca-pat-bc-08

**Title:** Cross-plant vendor consolidation (precondition for channel programmes)

**Scope:** Consolidate cross-plant vendor base for MGs flagged by BC7 — precondition to any contracted-channel migration.

**Action:** (Cross-pillar handoff to Op Model centralisation)
1. Identify top 10 MGs with cross-plant fragmentation (BC7 output)
2. For each: cross-plant vendor base review; identify candidate consolidation vendors
3. Plant-level qualification of consolidation vendors (technical + commercial)
4. Sequence: vendor consolidation → central OLA / RC-LT → plant call-offs
5. Change management: plant-buyer + plant-head engagement throughout

**Expected impact:**
- Cross-plant vendor count: 50-80% reduction in top fragmented MGs
- Enables downstream contract-channel migrations (BC6 candidates)
- Op Model centralisation savings (cross-pillar)

**Duration:** 18-24 months

**Cross-pillar handoff:** Op Model centralisation theme owns the centralisation narrative + savings quantification. Buying Channel surfaces the channel-readiness angle.

---

# E. Contract Simplification / Maturity Recommendations

## rec-bc-contract-simplification

**Triggered by patterns:** rca-pat-bc-14

**Title:** Contract simplification — convert over-engineered RC-LT to OLA

**Scope:** Periodic right-sizing of contract portfolio — categories outgrowing or never warranting RC-LT migrated to OLA.

**Action:**
1. Identify over-engineered RC-LT contracts (BC5 over-engineered candidates)
2. Categorise: continue / convert to OLA / consolidate
3. At next renewal, convert mid-volume + stable-vendor RC-LT to OLA
4. Establish contract review cycle — annual right-sizing review

**Expected impact:**
- Contract portfolio size reduces 15-25%
- Contract management bandwidth freed: 0.5-1.5 FTE (typically)
- Maintained channel discipline at lower management overhead

**Duration:** 12-18 months (timed with contract renewals)

**Risks:**
- Some "over-engineered" cases serve risk-management purposes — careful case-by-case review needed
- OLA simpler but provides less commitment leverage; balance with vendor relationship considerations

**Preconditions:**
- Active contract management function (not just contract storage)

---

## rec-bc-continuous-improvement-only

**Triggered by patterns:** rca-pat-bc-15

**Title:** Continuous improvement — mature state, no structural recommendation

**Scope:** No major structural change. Continuous improvement on automation + emerging categories.

**Action:**
1. E-catalogue depth — expand catalogue to remaining suitable MGs
2. ML-suggested category-channel review — periodic re-evaluation of channel fit
3. Emerging-category coverage — new MGs (sustainability-driven, digital-driven) folded into channel programmes
4. Periodic benchmark refresh — annual review of channel mix vs evolving best-in-class

**Expected impact:**
- Incremental improvements at the margin
- Maintains mature state through continuous attention

**Duration:** Ongoing

**Risks:**
- Maturity erosion if attention lapses
- Emerging categories (sustainability, digital) may not fit existing channel programmes

**Preconditions:**
- Sustained procurement function investment (capability not eroded)

---

## rec-bc-pr-system-implementation

**Triggered by patterns:** rca-pat-bc-13

**Title:** PR module implementation (or revival of bypassed PR module)

**Scope:** Implement or activate PR module in ERP to enable PR-to-PO cycle-time KPI + workflow discipline.

**Action:**
1. ERP configuration: activate PR module + define PR-required value thresholds
2. PR workflow design: requisition → approval → buyer assignment → PO conversion
3. Buyer + requisitioner training on PR-led workflow
4. Bypass-rate monitoring: track POs created without preceding PR

**Expected impact:**
- PR-to-PO TAT becomes measurable
- Workflow discipline + audit trail
- Enables future BC11 TAT impact analysis on subsequent assessments

**Duration:** 6-12 months

**Risks:**
- User adjustment — adds friction to a process some users currently bypass
- Approval routing design critical — wrong DoA can create bottlenecks

**Preconditions:**
- ERP module licence (PR module sometimes a separate licence)
- Workflow design + governance — DoA matrix for PR approval
- Change management for PR-bypass habit

---

# Editable Configuration

| Element | Edit risk | Notes |
|---|---|---|
| Recommendation card text | LOW | Tone + phrasing; engagement-specific tailoring |
| Action steps | MEDIUM | Affects what the consultant proposes |
| Expected impact ranges | MEDIUM | Should match benchmarks.yml ranges |
| Duration estimates | MEDIUM | Calibrate to engagement experience |
| Risks + preconditions | LOW | Add nuances from engagement learnings |
| New recommendation card | MEDIUM | Add when new finding pattern emerges |
| Recommendation IDs | HIGH | Referenced by rca-rules.yml — don't rename without coordination |
| Cross-pillar handoffs | HIGH | Coordinate with target pillar's recommendations |
