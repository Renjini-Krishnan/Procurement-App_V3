---
id: op-model-rca-patterns
layer: function
function: procurement
pillar: op-model
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Op Model — RCA Patterns (Narrative for AI-Driven Synthesis)

## Purpose

Narrative RCA patterns for AI-driven RCA path. While `rca-rules.yml` provides deterministic IF-THEN triggers, this file provides pattern descriptions in natural language, typical client narratives, diagnostic signals to verify, counter-arguments, and recommended narrative templates.

AI engine reads at synthesis time: given a theme finding, scans patterns, scores fit, produces RCA hypothesis with citations.

## Logic Embodied

For each theme finding at Stage 12, AI engine:
1. Reads theme output (gap %, candidate count, savings range)
2. Reads QRE responses
3. Scans this file for patterns matching finding shape
4. Generates RCA narrative using template + engagement-specific data
5. Cross-checks against `rca-rules.yml` deterministic output
6. Surfaces combined RCA: rule-detected + AI-synthesised narrative

## Editable Configuration
```yaml
ai_temperature: 0.3        # Lower = more deterministic RCA output
pattern_match_threshold: 0.65  # Below this, pattern doesn't surface
max_patterns_per_finding: 3# Cognitive load limit on consultant
```

---

# A. Centralisation Patterns

## rca-pat-cent-01 — M&A roll-up without integration
**Finding shape:** Low centralisation (< 30%) + many candidate categories + high inter-plant vendor overlap.
**Typical client narrative:** *"Each of our plants came in via a different acquisition. We never really integrated procurement."*
**Diagnostic signals:** QRE Q-CL-01/02 confirms M&A history; plant teams retain pre-acquisition org; different ERPs/data models across plants; founding plant has more central buying.
**Counter-arguments:** Specialty plants may justify different supplier bases; recent acquisition (<2yr) integration in progress — not true gap.
**Narrative template:**
> *"Centralisation of {spend_central_pct}% sits well below industry typical of {benchmark}%. Pattern of {n_candidates} multi-plant categories with {avg_overlap}% vendor commonality strongly suggests historical M&A integration that didn't extend to procurement function. Standard M&A procurement integration playbook applies."*

## rca-pat-cent-02 — Central buying restricted to contracting
**Finding shape:** Many Centre-Led categories + no full Centralise candidates + central spend % moderate.
**Typical narrative:** *"Central team negotiates contracts, but plants execute their own POs."*
**Diagnostic signals:** QRE confirms Centre-Led as deliberate policy; central procurement org small (1-5 FTE); plant-level FTE handles all transactional work.
**Counter-arguments:** Some categories genuinely need plant execution (emergency spares, plant services).
**Narrative template:**
> *"All identified categories sit in Centre-Led posture. Breadth here ({n_centre_led} categories totalling ₹{spend} Cr) suggests deliberate compromise. Full centralisation savings (Steel 4-7%) partially captured (Centre-Led typical 2-4%). Expanding from Centre-Led to full Centralise on Top-N high-commonality categories is next maturity step."*

## rca-pat-cent-03 — Plant autonomy / political resistance
**Finding shape:** Low centralisation + HIGH inter-plant vendor overlap.
**Typical narrative:** *"Yes, our plants use the same vendors — but each plant has its own relationship."*
**Diagnostic signals:** Plant Heads control procurement at plant level; past failed centralisation attempt; vendor sales reps maintain plant-level relationships.
**Counter-arguments:** "Relationship" rationale often obscures simple cost benefit; may reflect legitimate concerns about supply continuity.
**Narrative template:**
> *"Vendor overlap of {overlap}% across plants is high — same suppliers, but each plant runs its own POs. Pattern points to political/cultural barriers rather than supplier diversity. Centralisation here is change-management more than sourcing. Recommend change-mgmt-led approach: start with 2-3 highest-spend categories where vendor overlap is highest."*

## rca-pat-cent-04 — True local supplier dependency
**Finding shape:** Low centralisation + LOW inter-plant vendor overlap.
**Typical narrative:** *"Each plant is in a different geography with different supplier ecosystems."*
**Diagnostic signals:** Plants in different countries/regions; local content/SME diversity policies; real supply continuity reasons.
**Counter-arguments:** Vendor consolidation work (not centralisation directly) can address some; spec variance may be artificial.
**Narrative template:**
> *"Vendor overlap of {overlap}% is low — plants use largely different suppliers. Centralisation cannot be quick win here; requires vendor consolidation first. Recommend: (1) spec rationalisation across plants for top categories, (2) AVL rationalisation, (3) THEN central contracting."*

## rca-pat-cent-05 — Mid-tier blind spot
**Finding shape:** Top categories centralised + mid-tier scattered.
**Typical narrative:** *"We centralise the top 10 categories — the rest is plant business."*
**Diagnostic signals:** Central team headcount fixed for years; no documented criteria for scope expansion; mid-tier grew organically.
**Counter-arguments:** Some mid-tier truly local; adding mid-tier without capacity counter-productive.
**Narrative template:**
> *"Top categories ({high_value_central_pct}% centralisation) well-managed, but mid-tier ({mid_value_central_pct}%) sits largely outside central scope. Gap of {n_mid_tier_candidates} mid-tier multi-plant candidates with ₹{mid_tier_spend} Cr suggests structural blind spot. Recommend systematic scope-expansion governance + add ~2 FTE central capacity."*

## rca-pat-cent-06 — Stated vs actual centralisation gap
**Finding shape:** QRE response says high centralisation; data says low.
**Typical narrative:** *"Our policy says 80% central — but it's hard to enforce."*
**Diagnostic signals:** Formal centralisation policy exists; compliance not measured; plant-level workarounds common.
**Counter-arguments:** Data may be classified incorrectly (Stage 9 gap); "central spend" definition may differ.
**Narrative template:**
> *"QRE indicated centralisation >60%, but PO data shows {spend_central_pct}%. Possible explanations: (a) policy on paper not enforced, (b) Q9 reclassification missed some centrally-procured categories, (c) respondent definition differed. Recommend reconciliation with CPO + spend categorisation review."*

---

# B. Shared Services Patterns

## rca-pat-ss-01 — Greenfield SSC opportunity
**Finding shape:** No SSC + many Q1 transactional categories + addressable PO count high.
**Typical narrative:** *"We've never had a centralised SSC. Each plant handles its own transactional work."*
**Diagnostic signals:** No SSC headcount; plant buyer roles bundled (strategic + transactional); process variation across plants.
**Counter-arguments:** Cultural readiness — SSC requires process standardisation; geographic dispersion may complicate location decision.
**Narrative template:**
> *"No SSC exists. {ss1_q1_count} categories are Q1 transactional with {ss3_addressable_po_count}K POs/year — material greenfield case. Plant cost-per-PO {current_cost} vs SSC target {ssc_cost} = ₹{saving_per_po} per-PO saving × {po_count} = ₹{annual_saving} Cr/year. Plus 2-4 FTE freed. Phased build recommended."*

## rca-pat-ss-02 — Pilot SSC not scaled
**Finding shape:** Partial SSC (single plant or category) + large remaining gap.
**Typical narrative:** *"We piloted SSC at one plant. It worked, but we never expanded."*
**Diagnostic signals:** QRE confirms single-plant scope; pilot ran >18 months without expansion; other plants haven't asked to join.
**Counter-arguments:** Pilot results may have been mixed; operational issues may make replication non-trivial.
**Narrative template:**
> *"SSC exists at {current_plant} for {current_categories} — covering ₹{current_spend} Cr / {current_po_count}K POs. Data identifies ₹{gap_spend} Cr / {gap_po_count}K POs as additional SSC-suitable across other plants. Scaling sequence: (1) replicate to next 1-2 plants for same category, (2) add new categories once multi-plant base stable."*

## rca-pat-ss-03 — High SSC cost-per-PO (maturity issue)
**Finding shape:** SSC exists + cost-per-PO above mature benchmark.
**Typical narrative:** *"We have SSC, but I don't think we're getting world-class economics."*
**Diagnostic signals:** SSC <3 years old; scope includes non-transactional work; tooling lagging.
**Counter-arguments:** Steel-specific PO complexity keeps cost higher than pure-services benchmark.
**Narrative template:**
> *"SSC cost-per-PO of ₹{actual} vs mature benchmark ₹{benchmark} suggests process/tooling maturity gap. Options: (1) standardise top-5 process variations, (2) deploy e-catalog for high-volume SKUs, (3) revisit scope for non-transactional items."*

## rca-pat-ss-04 — Plant buyer role bloat
**Finding shape:** Plant POs/FTE significantly below benchmark.
**Typical narrative:** *"Our plant buyers do everything — sourcing, expediting, payment chasing."*
**Diagnostic signals:** Plant buyer role description includes non-buying activities; ERP/tooling limitations; high exception/rework rate.
**Counter-arguments:** Some industries genuinely need expediting on the buyer (Steel maintenance spares).
**Narrative template:**
> *"Plant POs/FTE of {actual} sits below benchmark {benchmark} suggesting role absorbs significant non-buying activity. Even pre-SSC, role redesign + tool uplift could lift to ~{target}. SSC implementation will surface this regardless — best to address proactively."*

## rca-pat-ss-05 — Activity scope ambiguity
**Finding shape:** Q-OM-SS-05 surfaces activity-level concern.
**Typical narrative:** *"Our SSC handles POs but our plant team still does the GRN follow-up. It's confusing."*
**Diagnostic signals:** SSC charter unclear on activity hand-offs; plant + SSC overlap on specific activities; duplicate effort in interviews.
**Counter-arguments:** Some duplication acceptable for control; activity boundaries differ by category type.
**Narrative template:**
> *"Q-OM-SS-05 surfaces activity-level scope ambiguity: '{qre_response}'. Recommend SSC charter clarification document specifying responsibilities for each activity per category type."*

---

# C. CoE Patterns

## rca-pat-coe-01 — Informal CoE — historical resistance to formalisation
**Finding shape:** Informal-only CoE + many CoE-suitable categories.
**Typical narrative:** *"We have category managers, but no formal 'CoE'."*
**Diagnostic signals:** Category managers exist but no CoE label/charter; past formal CoE attempt didn't stick; "We already manage these centrally" confuses centralisation with CoE.
**Counter-arguments:** Sometimes informal works if individuals are strong; formalisation can ADD bureaucracy without value.
**Narrative template:**
> *"Client has {informal_fte} FTE doing informal category management for {informal_categories}. Data identifies {ce3_gap_count} additional strategic categories warranting formal CoE attention. Recommend: (a) name the CoE explicitly (charter, KPIs), (b) expand scope, (c) add {recommended_fte_addition} FTE. Net value-add ₹{ce4_savings_range}/year."*

## rca-pat-coe-02 — Strategic supplier relationship risk un-curated
**Finding shape:** No CoE + high vendor concentration on strategic categories.
**Typical narrative:** *"We have one main coking coal supplier, but we don't have a formal SRM programme."*
**Diagnostic signals:** Top-3 vendor share >70% on strategic categories; no named relationship owner; single-source risk un-mitigated.
**Counter-arguments:** Some narrow supplier bases unavoidable (mill rolls, electrodes); risk depends on supplier financial health.
**Narrative template:**
> *"{n_high_conc_categories} strategic categories show top-3 vendor share ≥70% without designated CoE owner. Single-point-of-failure risk un-managed. Establishing CoE with named category strategists creates relationship continuity + market-watch capability."*

## rca-pat-coe-03 — CoE narrow scope (frozen at original design)
**Finding shape:** Formal CoE exists but scope hasn't expanded.
**Typical narrative:** *"CoE was set up for the top 5 commodities five years ago. Scope hasn't changed."*
**Diagnostic signals:** CoE Lead in role 3+ years; no scope-review cadence documented; strategic spend has shifted but CoE coverage hasn't.
**Counter-arguments:** Some categories don't warrant expansion (stable, low-volatility); capacity constraint genuine.
**Narrative template:**
> *"CoE covers {current_count} categories | ₹{current_spend} Cr. Data identifies {gap_count} additional CoE-suitable categories | ₹{gap_spend} Cr. Expansion case clear. May require +{additional_fte} FTE depending on complexity."*

## rca-pat-coe-04 — Capability investment under-funded
**Finding shape:** CoE exists but lacks market intel + tooling.
**Typical narrative:** *"Our category managers don't have Platts or CRU access."*
**Diagnostic signals:** No market intelligence subscriptions; no advanced analytics tooling; minimal spend on training/capability uplift.
**Counter-arguments:** ROI on market intel hard to quantify; some categories don't need real-time intel.
**Narrative template:**
> *"CoE exists but operates without commodity market intelligence (Q-OM-COE-04: '{response}'). For categories with commodity exposure (coking coal, ferro alloys, electrodes), market timing alone worth 1-2% on spend. Recommend capability investment: subscriptions + training + tooling. Indicative cost ₹{cost} vs return ₹{return}/year."*

## rca-pat-coe-05 — CoE governance / reporting line issue
**Finding shape:** Structural concern surfaced in Q-OM-COE-04.
**Typical narrative:** *"CoE reports to the plant head, not the CPO."*
**Diagnostic signals:** Reporting line below CPO; decision authority unclear; BU-aligned vs corporate confusion.
**Counter-arguments:** Some matrixed reporting can work; authority comes from individuals, not boxes.
**Narrative template:**
> *"Q-OM-COE-04 surfaces governance concern: '{response}'. CoE structural design has more impact than scope. Recommend: (a) reporting line clarified to CPO, (b) decision authority documented, (c) BU-engagement model formalised."*

---

# D. Tail Spend Patterns

## rca-pat-ts-01 — Awareness / adoption gap
**Finding shape:** No aggregator + large addressable tail.
**Typical narrative:** *"We've heard of Moglix but never seriously evaluated."*
**Diagnostic signals:** Aggregator awareness limited; no structured tail spend strategy document; plant buyers don't see their own cost-to-serve.
**Counter-arguments:** Some genuine technical concerns (integration, IT); team capacity to evaluate may be limited.
**Narrative template:**
> *"No aggregator usage despite ₹{ts4_addressable} Cr addressable tail spend. Indian aggregator landscape (Moglix, Industrybuying, Bizongo) has matured significantly. Onboarding 3-6 months for first category; payback <1 year typically. Recommend pilot with Moglix for stationery (lowest-risk entry)."*

## rca-pat-ts-02 — Pilot not scaled
**Finding shape:** Partial aggregator usage + much larger addressable opportunity.
**Typical narrative:** *"We use Moglix for stationery — never expanded."*
**Diagnostic signals:** Aggregator scope narrow despite multi-year tenure; no expansion roadmap; vendor relationships with incumbents strong.
**Counter-arguments:** Initial pilot may have had issues; some categories better as direct-managed.
**Narrative template:**
> *"Existing aggregator scope ₹{existing_scope} Cr | data identifies ₹{addressable} Cr further opportunity = {multiple}x current scope. Client has demonstrated aggregator-model tolerance. Phased rollout: (1) MRO consumables tail, (2) lab consumables, (3) IT peripherals."*

## rca-pat-ts-03 — Long-tail vendor fragmentation
**Finding shape:** >30% of vendors with single PO/year + no aggregator.
**Typical narrative:** *"We have hundreds of vendors we deal with once a year for tiny purchases."*
**Diagnostic signals:** Vendor master count high vs spend; no central vendor onboarding gate; plant-level vendor creation default.
**Counter-arguments:** Some genuine one-off purchases need new vendor; vendor count alone isn't the metric — spend distribution matters.
**Narrative template:**
> *"{long_tail_pct}% of vendor base ({long_tail_count} vendors) is engaged for ≤1 PO/year — representing ₹{long_tail_spend} Cr in spend but consuming disproportionate plant buyer effort. Recommend: (a) aggregator partnership for catalogue-suitable, (b) vendor onboarding gate restored to central, (c) annual vendor master cleanup."*

## rca-pat-ts-04 — High tail share — sourcing discipline gap
**Finding shape:** Tail share >15% of indirect spend.
**Typical narrative:** *"Lots of small POs everywhere — hard to control."*
**Diagnostic signals:** Rate contract coverage low; no catalog buying; PR-to-PO process issues (cross-pillar).
**Counter-arguments:** Some industries genuinely have higher tail (services-heavy); tail share doesn't translate to value if individual POs are tiny.
**Narrative template:**
> *"Tail share of {tail_share_pct}% (vs industry typical 5-10%) suggests systemic sourcing discipline issues — POs that should be on RC, weak catalog adoption, PR-to-PO gaps. Aggregator outsourcing alone won't solve; combine with rate contract uplift + catalog enablement."*

## rca-pat-ts-05 — Policy / supplier-diversity restriction
**Finding shape:** Q-OM-TS-04 surfaces restriction.
**Typical narrative:** *"Our policy says we must give MSE vendors priority — aggregators don't fit."*
**Diagnostic signals:** Documented procurement policy mandates; supplier diversity KPIs; past policy reviews.
**Counter-arguments:** Some aggregators offer MSE-supplier flags (Moglix's MSE category); policy may be outdated.
**Narrative template:**
> *"Aggregator adoption constrained by policy: '{qre_response}'. Recommend: (a) review policy in light of aggregator MSE-supplier capability, (b) negotiate aggregator commitment to MSE quotas in commercial terms, (c) update policy with explicit aggregator guidance if barrier outdated."*

---

# E. Cross-Theme (Strategic Imperative) Patterns

## rca-pat-si-01 — Under-investment in central capability
**Finding shape:** Centralisation + SSC + CoE all at low maturity levels.
**Typical narrative:** *"We've grown plant-by-plant; never had a strong central procurement function."*
**Diagnostic signals:** Procurement reports to plant heads, not central CPO; no central category mgmt team; plant-level metrics dominate; historical: family-owned OR roll-up acquisition.
**Narrative template:**
> *"All three central-capability themes (Centralisation, SSC, CoE) sit at maturity 2 or below. Structural — central procurement function materially under-built. Phased build:
> 1. Stand up SSC first (transactional efficiency, creates capacity)
> 2. Formalise CoE for top strategic categories (strategic depth)
> 3. Expand centralisation scope on the back of CoE-led category management
> Sequencing matters: SSC creates the bandwidth that enables CoE."*

## rca-pat-si-02 — Volume-focused, value-blind
**Finding shape:** Centralisation maturity ≥3 + CoE maturity ≤2.
**Typical narrative:** *"We centralise most categories — but I'm not sure we get the most out of strategic ones."*
**Diagnostic signals:** Central procurement adequate for volume but light on strategic depth; top categories handled by buyers, not strategists; market intelligence absent.
**Narrative template:**
> *"Centralisation mature ({centralisation_score}/5) but CoE significantly behind ({coe_score}/5). Categories flow centrally for transactional efficiency but lack strategic-depth ownership — typical maturity stage. Next: formalise CoE for {ce3_gap_count} strategic categories. Annual value-add ₹{ce4_savings_range}/year incremental."*

## rca-pat-si-03 — Strategic well-managed, transactional ignored
**Finding shape:** CoE maturity ≥3 + SSC + Tail at low maturity.
**Typical narrative:** *"We have great category managers — but the plant buyers are drowning in transactional work."*
**Diagnostic signals:** CoE established; plant buyer headcount high relative to PO complexity; no SSC or partial; no aggregator partnership.
**Narrative template:**
> *"Strategic categories well-curated (CoE {coe_score}/5) but transactional efficiency materially under-built (SSC {ss_score}/5 + Tail {tail_score}/5). Strategic procurement leadership historically prioritised top categories. Recommend transactional efficiency build: SSC expansion (₹{ss4_savings_range}/year) + aggregator partnership (₹{ts4_savings_range}/year) + plant buyer role redesign."*

## rca-pat-si-04 — Sourcing discipline gap
**Finding shape:** Centralisation low + Tail share high + Vendor fragmentation high.
**Typical narrative:** *"Honestly, our procurement processes are pretty ad-hoc."*
**Diagnostic signals:** Low centralisation; high tail share (>15%); long-tail vendor fragmentation; no procurement transformation history.
**Narrative template:**
> *"Multiple symptoms of sourcing discipline gap: low centralisation ({centralisation_score}/5) + high tail share ({tail_share_pct}%) + {long_tail_pct}% fragmented vendor base. Procurement perceived as service function. Combined intervention: (a) centralisation roadmap, (b) aggregator partnership for tail, (c) vendor consolidation programme. CPO-led transformation needed."*

## rca-pat-si-05 — Already-optimal
**Finding shape:** All themes at maturity 4+.
**Typical narrative:** *"We're pretty mature on procurement — looking for refinement."*
**Diagnostic signals:** All theme scores ≥4; few quantified savings surfaced; refinement/optimisation, not transformation.
**Narrative template:**
> *"Op Model mature across all four themes. Pillar score {pillar_score}/5. No structural transformation case from Op Model perspective. Focus shifts to: (a) operational excellence within model, (b) other pillars where opportunity may exist, (c) cross-pillar themes like sustainable/responsible procurement."*

---

# F. Pattern Usage Notes for AI Engine

When matching a finding to patterns, AI should:
1. **Match on shape** — does finding's quantitative profile match pattern's "Finding shape"?
2. **Cross-check signals** — are diagnostic signals present in this engagement?
3. **Surface counter-arguments** — flag for consultant review (don't suppress)
4. **Generate narrative** — use template, substituting engagement-specific values
5. **Cite** — every claim backed by data (with citation) or QRE response (with question ID)
6. **Pair with rule output** — if same pattern ID flagged by `rca-rules.yml`, present AI narrative as elaborated version of rule-detected root cause

If multiple patterns match, surface top 2-3 with fit scores and let consultant resolve.
