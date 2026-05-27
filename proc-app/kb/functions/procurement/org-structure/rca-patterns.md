---
id: org-structure-rca-patterns
layer: function
function: procurement
pillar: org-structure
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Org Structure — RCA Patterns (Narrative for AI-Driven Synthesis)

Narrative RCA patterns used by AI-driven RCA path. Companion to `rca-rules.yml` (deterministic IF-THEN).

For each theme finding at Stage 13, AI engine:
1. Reads theme output (verdict, key data points)
2. Reads QRE responses
3. Scans this file for patterns matching finding shape
4. Generates RCA narrative using template + engagement-specific data
5. Cross-checks against `rca-rules.yml` deterministic output
6. Surfaces combined RCA: rule-detected root causes + AI-synthesised narrative

---

# A. Posture & Reporting Patterns

## rca-pat-os-posture-01 — M&A integration didn't extend to procurement
**Finding shape:** Mis-aligned posture + recent M&A (< 5 years).
**Typical narrative:** *"We acquired Plant X two years ago. Their procurement team still runs independently."*
**Diagnostic signals:** QRE Q-CL-01 confirms recent M&A; acquired plant has separate procurement leadership; different ERPs/data structures; founder-era procurement at HQ, later acquisitions plant-managed.
**Counter-arguments:** Some plant autonomy may be deliberate; integration is multi-year; <2 years may still be transition.
**Narrative template:**
> *"Procurement structure misaligned ({alignment_verdict}) following M&A history within last {tenure}. Acquired entity/entities likely retained autonomous procurement structures. Standard post-M&A procurement integration playbook applies — central category management establishment + plant procurement integration."*

## rca-pat-os-posture-02 — Strategic mandate vs cost-focused reporting line
**Finding shape:** Stated strategic mandate + CFO reporting + specialist gaps.
**Typical narrative:** *"Our CPO mandate now includes sustainability and supplier innovation. But the structure is still cost-focused."*
**Diagnostic signals:** Q-OS-OP-05 includes Strategic_value/Innovation/Sustainability; reporting line is CFO; specialist roles absent or minimal; strategic categories handled by generalist Cat Mgrs.
**Counter-arguments:** Recent mandate adoption — structure may follow over time; CFO + strong ExCo seat can deliver strategic mandate with right CPO.
**Narrative template:**
> *"Stated procurement mandate includes strategic value / sustainability, but reporting line (CFO) and composition (specialist gaps in {missing_roles}) reflect a cost-focused era. Mandate evolved; structural execution hasn't caught up. Two-part fix: reporting line elevation (or ExCo seat formalisation) + specialist hires for {missing_roles}."*

## rca-pat-os-posture-03 — Decentralised by design (Plant Head reporting)
**Finding shape:** CPO equivalent reports to Plant Head or BU Head.
**Typical narrative:** *"We've never had a corporate CPO; each plant runs its own procurement."*
**Diagnostic signals:** Reporting line below corporate C-suite; no central category management; plant-level metrics dominate.
**Counter-arguments:** For single-plant or genuinely-federated business may be optimal; cross-plant leverage may be limited.
**Narrative template:**
> *"Procurement reporting to {reporting_line} signals decentralised-by-design model. For {business_org_type} business with {plant_count} plants and ₹{spend} Cr spend, cross-plant leverage opportunity is material. Recommend establishing corporate procurement function with central category management for top-N high-commonality categories. Aligns with Op Model Centralisation theme."*

## rca-pat-os-posture-04 — Aligned-with-Tension long-standing (not a problem)
**Finding shape:** Aligned-with-Tension + structure stable >10 years.
**Typical narrative:** *"The plants are autonomous on day-to-day but Central makes sourcing decisions. Has worked for 15+ years."*
**Diagnostic signals:** Long structural tenure; mature governance; no surfaced complaints.
**Narrative template:**
> *"Aligned-with-Tension verdict reflects {business_org_type} business + {procurement_pattern} combination — predictable friction managed by governance maturity over {tenure}. NOT a problem requiring structural change. Recommend continued governance discipline rather than restructure."*

## rca-pat-os-posture-05 — Foreign-owned follows parent pattern
**Finding shape:** Foreign-owned Indian operation + reports to global CPO.
**Narrative template:**
> *"Reporting line follows parent-company global procurement structure (typical pattern — {pct}% of foreign-owned Indian operations). Local autonomy on Indian-market-specific decisions; parent global handles strategic global contracts. Expected and appropriate."*

---

# B. FTE Sizing & Role Composition Patterns

## rca-pat-os-sizing-01 — Under-staffed (high spend/FTE + vacancy signals)
**Finding shape:** Spend/FTE > 120% of industry benchmark high.
**Typical narrative:** *"Our team is stretched. We've had vacant positions for months."*
**Diagnostic signals:** High spend per FTE; open positions in QRE; burnout/attrition signals.
**Narrative template:**
> *"Spend/FTE of ₹{actual} Cr is materially above Steel benchmark ₹{benchmark_high} Cr — indicates capacity stretch. Add {indicative_count} FTE (specialist or transactional depending on role gap analysis) to restore healthy productivity band. Reduces burnout + quality risk."*

## rca-pat-os-sizing-02 — Over-staffed (low spend/FTE)
**Finding shape:** Spend/FTE < 80% of industry benchmark low.
**Typical narrative:** *"We have a large team. Honestly, I'm not sure all of them are necessary."*
**Diagnostic signals:** Low spend per FTE; plant-distributed model (duplicate buyer roles); historical accretion.
**Counter-arguments:** Low-value-scope items may inflate transaction count; Steel context may need more FTE for spec-laden work.
**Narrative template:**
> *"Spend/FTE of ₹{actual} Cr is below Steel band lower edge ₹{benchmark_low} Cr — team appears over-allocated vs spend. Two-part diagnostic: (a) is scope appropriate (low-value items inflating count)? (b) is plant-distributed model creating duplicate roles? Op Model SSC implementation typically rebalances this through transactional consolidation."*

## rca-pat-os-sizing-03 — Composition heavily skewed transactional
**Finding shape:** Transactional > 60% of FTE; multiple specialist gaps.
**Typical narrative:** *"Most of our team is buyers. We don't really have specialist roles."*
**Diagnostic signals:** High transactional share; 4+ critical specialist gaps; Cat Mgr role doing buyer work.
**Counter-arguments:** High transactional in young procurement org is expected; composition shift takes time and budget.
**Narrative template:**
> *"Composition heavily skewed — {transactional_pct}% transactional vs Steel benchmark 35-50% — and {specialist_gaps} critical specialist roles absent (Analytics, SRM, FBP, Sustainability). Procurement positioned as execution function; capability investment minimal. Composition rebalance via specialist hires + transactional redirect (Op Model SSC implementation creates natural opportunity)."*

## rca-pat-os-sizing-04 — Multiple critical specialist gaps
**Finding shape:** 4+ specialist roles missing.
**Narrative template:**
> *"{specialist_gaps_count} critical specialist roles absent ({missing_roles_list}). Each gap creates distinct capability shortfall: Analytics absence → reactive procurement; SRM absence → un-managed strategic relationship risk; FBP absence → weak finance partnership; Sustainability/ESG → unable to deliver decarbonisation mandate. Recommend phased hiring — typically 4-6 specialist FTE batch over 12-18 months."*

## rca-pat-os-sizing-05 — Sustainability/ESG missing (Steel-specific)
**Finding shape:** Steel industry + Sustainability/ESG role absent.
**Typical narrative:** *"We're starting to think about ESG. The sustainability team has someone but not in procurement."*
**Narrative template:**
> *"Sustainability/ESG procurement specialist absent. For Steel, this is increasingly critical given EU CBAM regulations + India BRSR + decarbonisation roadmaps. Most Steel mills currently lack this role (emerging-critical); leaders are hiring 1-2 sustainability procurement specialists. Recommend prioritising — talent pipeline still building, early hires get better profiles."*

## rca-pat-os-sizing-06 — SRM missing + high vendor concentration
**Finding shape:** No SRM role + strategic categories show high top-3 vendor concentration.
**Narrative template:**
> *"{n_high_conc_categories} strategic categories show ≥70% top-3 vendor concentration. No dedicated SRM role — relationship management distributed across Cat Mgrs as part-time work. Strategic supplier risk (single-source dependency, relationship continuity, performance management) un-curated. Recommend dedicated SRM role at Sr Mgr level + supplier risk dashboard."*

---

# C. Spend-FTE Distribution Patterns

## rca-pat-os-distribution-01 — Central lean and productive (healthy)
**Finding shape:** Central spend share exceeds FTE share by 15-25 pp.
**Narrative template:**
> *"Central handles {central_spend_pct}% of spend with {central_fte_pct}% of FTE — productive lean structure. {pp_gap} pp gap (spend > FTE) is HEALTHY and reflects strategic-mandate Centralised model — Cat Mgrs at Central manage high-value categories without proportional FTE. NOT a problem. Continue current allocation."*

## rca-pat-os-distribution-02 — Plants systemically under-productive (SSC opportunity)
**Finding shape:** Multiple plants under Steel band on spend/FTE; SSC absent/partial.
**Typical narrative:** *"Plant teams feel busy but spend they manage isn't huge."*
**Narrative template:**
> *"All {plant_count} plants show spend/FTE below Steel band ₹{benchmark_low}-{benchmark_high} Cr/FTE. Systemic pattern (not plant-specific) — reflects plant-distributed transactional model. Op Model SSC theme already recommends transactional consolidation. SSC implementation naturally rebalances this; no separate Org-Structure-only re-allocation."*

## rca-pat-os-distribution-03 — Central over-staffed for spend
**Finding shape:** Central FTE share exceeds spend share.
**Narrative template:**
> *"Central FTE share {central_fte_pct}% exceeds spend share {central_spend_pct}% — top-heavy pattern. Investigate: (a) Leadership over-representation; (b) functional roles (legal, compliance, MDM) misclassified as procurement central; (c) Centre-Led-only categories absorbing central FTE without spend ownership."*

## rca-pat-os-distribution-04 — One plant outlier
**Finding shape:** One plant significantly outside distribution pattern.
**Narrative template:**
> *"Plant {plant_name} sits {direction} the pattern observed at other plants — investigate plant-specific context: (a) different category mix; (b) recent organisational change; (c) plant-specific resourcing decision; (d) data quality at the plant. Plant-by-plant conversation rather than systemic finding."*

---

# D. Hierarchy & Span Patterns

## rca-pat-os-hierarchy-01 — Plant Sr Mgr stretched (Steel-typical)
**Finding shape:** Plant Sr Mgr with 10-15 direct reports.
**Typical narrative:** *"Plant Sr Manager runs the whole plant procurement team. Yes, they're stretched."*
**Diagnostic signals:** 13-15 direct reports at plant Sr Mgr level; common Steel pattern (60% prevalence); SSC absent or partial; tool maturity low.
**Counter-arguments:** Steel plant procurement is execution-heavy; span at boundary of first-line lead band; "stretched" depends on tool maturity + scope breadth.
**Narrative template:**
> *"Plant Sr Mgrs span {avg_span} direct reports vs healthy 6-10 mid-mgmt band. Common Steel pattern (60% of Indian Steel mills). Plant layer redesign options: (a) add intermediate Mgr layer; (b) redistribute via Op Model SSC implementation; (c) move some buyers to functional sub-teams. Combined with SSC theme, naturally addressed."*

## rca-pat-os-hierarchy-02 — DGM layer under-leveraged
**Finding shape:** DGM-level role with <5 direct reports.
**Narrative template:**
> *"DGM {role_name} has {direct_reports} direct reports — under-leveraged vs healthy 5-8 senior mgmt band. Historical pattern: layer added for coordination or political reason; value-add unclear. Worth questioning: can reports merge into another DGM role? Or eliminate the layer if it adds depth without value?"*

## rca-pat-os-hierarchy-03 — Hierarchy too tall
**Finding shape:** 6+ levels for integrated Steel mill.
**Narrative template:**
> *"Hierarchy at {depth} levels — one layer deeper than 4-5 typical for integrated steel mills ({pct}% of Indian peers run 4-5 levels). Often historical accretion. Combined with {dgm_under_leveraged_count} under-leveraged senior mgmt roles, suggests delayering opportunity."*

## rca-pat-os-hierarchy-04 — CPO stretched
**Finding shape:** CPO with >8 direct reports.
**Narrative template:**
> *"CPO has {direct_reports} direct reports — exceeds healthy 4-7 band. Common in mid-cap integrated mills without DGM layer. Add DGM layer (one tier between CPO and Sr Mgrs) — moves 4-6 reports to DGM, frees CPO bandwidth for strategic decisions + ExCo engagement."*

## rca-pat-os-hierarchy-05 — R&R overlap (Sr Buyer / Asst Mgr)
**Finding shape:** Q-OS-HS-03 surfaces Sr Buyer + Asst Mgr overlap.
**Narrative template:**
> *"Q-OS-HS-03 surfaces R&R overlap between Sr Buyers and Asst Mgrs (common — 70% prevalence in Indian Steel). Operator-level role + supervisory role share day-to-day execution responsibilities, creating ambiguous accountability. Recommend R&R clarification exercise + JD refresh — typically alongside any structural redesign at plant level."*

---

# E. Strategic Imperative (Cross-Theme) Patterns

## rca-pat-os-si-01 — Under-resourced central capability
**Finding shape:** All four themes at low maturity.
**Narrative template:**
> *"Procurement function under-built across all dimensions — posture, sizing+composition, distribution, hierarchy. Central capability foundation needs rebuild. Phased build (24-36 months): (1) reporting line elevation + central function establishment; (2) specialist hires for capability foundation; (3) Op Model SSC implementation; (4) plant layer redesign. Major transformation."*

## rca-pat-os-si-02 — Strategic mandate-structure mismatch
**Finding shape:** Stated strategic mandate + low Theme 1 + Theme 2 specialist gaps.
**Narrative template:**
> *"Mandate evolved to strategic value / sustainability but structure reflects cost-focused era. Reporting line + composition + capability all need to evolve together. Sequence: (1) ExCo seat formalisation OR reporting line elevation; (2) 4-6 specialist hires (Analytics, SRM, FBP, Sustainability); (3) operating model refinement to reinforce strategic mandate. 12-18 month transformation."*

## rca-pat-os-si-03 — Operational shape healthy with capability gaps
**Finding shape:** Themes 1+3+4 healthy + Theme 2 specialist gaps.
**Narrative template:**
> *"Structural shape works — posture aligned, distribution healthy, management layers appropriate. Gap is capability: {specialist_gaps_count} critical specialist roles absent ({list}). Focused investment in {target_hires} specialist hires (no structural overhaul) materially uplifts function. 6-12 month focused capability build."*

## rca-pat-os-si-04 — Composition-led rebalance
**Finding shape:** Composition skewed transactional + specialist gaps + plant FTE over-allocation.
**Narrative template:**
> *"Aggregate sizing fine but composition heavily skewed transactional ({transactional_pct}% vs 35-50% band); {specialist_gaps_count} critical specialist roles absent; plants over-allocated FTE. Op Model SSC implementation creates redirect opportunity — SSC absorbs plant transactional volume, frees {redirect_count} FTE, redirected to specialist roles. Composition rebalance through redeployment, not net headcount addition. Net headcount approximately unchanged; significantly stronger strategic posture. 12-18 months in concert with SSC roadmap."*

## rca-pat-os-si-05 — Already-balanced
**Finding shape:** All themes at maturity 4+.
**Narrative template:**
> *"Org Structure mature across all four themes (pillar maturity {pillar_score}/5). No structural transformation case from Org Structure perspective. Focus shifts to: (a) operational excellence — JD refresh, capability uplift, sustained specialist development; (b) other pillars (Capability, Tech & Digital) where opportunity may exist."*

---

# F. Pattern Usage Notes for AI Engine

When matching findings to patterns:
1. **Match on shape** — does finding's quantitative + qualitative profile match pattern's "Finding shape"?
2. **Cross-check signals** — are diagnostic signals present in this engagement?
3. **Surface counter-arguments** — flag nuances for consultant review
4. **Generate narrative** — use template + engagement-specific values
5. **Cite** — every claim backed by data (with citation) or QRE response (with question ID)
6. **Pair with rule output** — if same pattern ID flagged by `rca-rules.yml`, present AI narrative as elaboration

If multiple patterns match, surface top 2-3 with fit scores; consultant resolves.
