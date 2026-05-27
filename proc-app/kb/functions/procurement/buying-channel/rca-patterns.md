---
id: buying-channel-rca-patterns
layer: function
function: procurement
pillar: buying-channel
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Buying Channel — RCA Patterns (Narrative for AI-Driven Synthesis)

## Purpose

Narrative RCA patterns for the AI-driven RCA path. While `rca-rules.yml` provides deterministic IF-THEN triggers, this file provides pattern descriptions in natural language, typical client narratives, diagnostic signals to verify, counter-arguments, and recommended narrative templates.

The AI engine reads at Stage 14 synthesis time: given a Buying Channel finding, it scans these patterns, scores fit, produces an RCA hypothesis with citations + counter-checks.

## Logic Embodied

For each finding produced by BC1-BC13:
1. Read finding shape (which analysis fired, with what magnitude)
2. Read QRE responses (Q-BC-01 through Q-BC-14)
3. Scan this file for patterns matching the finding shape
4. Generate RCA narrative using the template + engagement-specific data
5. Cross-check against `rca-rules.yml` deterministic output
6. Surface combined RCA: rule-detected (high precision) + AI-synthesised narrative (richer context)

## Editable Configuration

```yaml
ai_temperature: 0.3                # Lower = more deterministic RCA narrative
pattern_match_threshold: 0.65      # Below this, pattern doesn't surface
max_patterns_per_finding: 3        # Cognitive load limit on consultant
include_counter_arguments: true    # Pattern's counter-arguments shown to user
```

---

# A. Baseline Findings Patterns (R01-R04)

## rca-pat-bc-01 — No formal contract programme

**Finding shape:** Very low overall contracted % (<25%) + UNCLASSIFIED MGs not the cause.

**Typical client narrative:** *"We negotiate each PO. Contracts feel bureaucratic — by the time the contract is in place, the price has changed."*

**Diagnostic signals:** QRE Q-BC-01 confirms most spend is Spot / RFQ; Q-BC-08 confirms no central contract function; Org Structure pillar shows thin or absent central category managers; Op Model pillar likely flags plant-distributed posture.

**Counter-arguments:** A small set of very dynamic markets (commodities with thin contract horizons) may legitimately benefit from spot. But for INDIRECT recurring + SERVICE recurring, no contract is rarely a defensible choice.

**Narrative template:**
> *"Overall contract coverage of {contracted_pct}% sits well below the Indian large-enterprise band of 25-45%. With {unclassified_pct}% UNCLASSIFIED (not material), the gap is structural: no formal contract programme. Pattern across {n_indirect_recurring_mgs} recurring INDIRECT MGs + {n_service_recurring_mgs} recurring SERVICE MGs confirms greenfield contract programme as headline recommendation."*

## rca-pat-bc-02 — Contract field population gap (master-data discipline)

**Finding shape:** Contract reference fields populated on <50% of POs.

**Typical client narrative:** *"We have contracts — buyers just don't always reference them when raising the PO."*

**Diagnostic signals:** QRE Q-BC-03 stated contract coverage > PO-derived contracted % (perception > reality); contract repository disconnected from PO workflow; ERP doesn't enforce contract reference field on PR/PO creation.

**Counter-arguments:** Some contracts genuinely sit outside the ERP (Excel / paper-based) and a redesign cycle may surface them. Not necessarily systemic leakage — may be process maturity issue.

**Narrative template:**
> *"Only {contract_field_population_pct}% of POs carry any contract reference. The QRE-stated {qre_contract_coverage_pct}% coverage versus PO-derived {po_derived_contract_coverage_pct}% indicates either (a) contracts exist but PO process bypasses them, or (b) contracts are recorded outside ERP. Recommend confirming via PO sample review before deciding the remediation path."*

## rca-pat-bc-03 — BULK commodities not on long-term contracts

**Finding shape:** >50% of BULK spend in Spot/RFQ + total BULK spend ≥ ₹50 Cr.

**Typical client narrative:** *"We've always bought coal/iron-ore/scrap on the spot market. Trying to lock in a year ahead doesn't work for us."*

**Diagnostic signals:** No commodity-pricing analyst in Org Structure; Op Model centralisation theme shows BULK not centrally managed; no hedging activity; commodity exposure accepted as "uncontrollable."

**Counter-arguments:** Genuinely volatile commodity periods may justify shorter contract tenors; some BULK (low-spend) may not warrant LTC overhead. But for high-spend BULK at integrated steel/cement, RC-LT (often index-linked) is best practice.

**Narrative template:**
> *"BULK spend of ₹{bulk_spend_cr} Cr is flowing predominantly through Spot/RFQ ({bulk_spot_pct}%) — below benchmark band (60-80% RC-LT for BULK at integrated manufacturers). This indicates absent or lapsed strategic-sourcing programme for commodity raw materials. Index-linked LTC programme can capture pricing discipline without removing market sensitivity."*

## rca-pat-bc-04 — INDIRECT Spot-dominant

**Finding shape:** >60% of INDIRECT spend in Spot/RFQ + total INDIRECT spend ≥ ₹20 Cr.

**Typical client narrative:** *"Each plant buys what it needs from local vendors. We don't have central catalogues for spares."*

**Diagnostic signals:** Q-BC-04 / Q-BC-05 confirm no OLA / catalogue programme; plant procurement teams handle MRO locally; high vendor count in INDIRECT MGs (often 50+ vendors per MG); cross-plant fragmentation flag (BC7) fires for multiple INDIRECT MGs.

**Counter-arguments:** Some INDIRECT genuinely is plant-local (emergency spares, plant-specific equipment) — but the majority of recurring MRO consumables (bearings, lubricants, PPE) should be in OLA/Catalogue.

**Narrative template:**
> *"INDIRECT spend of ₹{indirect_spend_cr} Cr flows {indirect_spot_pct}% through Spot — typical of plant-distributed Op Models without central category management. {n_ola_candidates} MGs identified as OLA candidates + {n_catalogue_candidates} MGs as Catalogue candidates. Building the OLA + Catalogue infrastructure is the foundational lever."*

---

# B. Opportunity Findings Patterns (R05-R08)

## rca-pat-bc-05 — Catalogue programme absent or stalled

**Finding shape:** ≥10 INDIRECT MGs recommended for Catalogue + current Catalogue share of portfolio < 5%.

**Typical client narrative:** *"We tried catalogue once but vendors got outdated and people stopped using it."* OR *"Catalogue is on the IT roadmap but never funded."*

**Diagnostic signals:** Q-BC-05 reveals catalogue tech not implemented OR implemented but limited scope (only stationery); requisitioner direct-ordering rights not granted; no catalogue maintenance owner; vendors not enabled on catalogue platform.

**Counter-arguments:** Catalogue ROI sensitive to volume — sub-scale clients (small INDIRECT spend) may not warrant the technology investment. For large enterprises, ROI is clear.

**Narrative template:**
> *"Identified {n_catalogue_candidates} MGs ({total_catalogue_addressable_spend_cr} ₹ Cr) suitable for catalogue migration — currently at {current_catalogue_pct}% catalogue share vs Indian large-enterprise typical 5-15% and BIC 30-50%. The catalogue platform is {catalogue_state}: investment + scope-expansion combined with requisitioner direct-ordering rights would deliver the cycle-time + buyer-bandwidth improvements quantified in BC11/BC12."*

## rca-pat-bc-06 — OLA programme absent or narrow

**Finding shape:** ≥15 MGs recommended for OLA + current OLA share < 10%.

**Typical client narrative:** *"We have a few rate contracts — mostly for AMC. Spares are PO-by-PO."*

**Diagnostic signals:** Q-BC-04 confirms OLA exists but limited to AMC / housekeeping; no annual rate-contracting cycle institutionalised; plant buyers control buying decisions for recurring INDIRECT.

**Counter-arguments:** Some spec-drift categories (engineered spares with frequent design changes) genuinely don't fit OLA. But these are the minority.

**Narrative template:**
> *"OLA share at {current_ola_pct}% sits at the bottom of the typical band (10-20%). {n_ola_candidates} MGs spanning ₹{ola_addressable_spend_cr} Cr are OLA-suitable based on frequency + value profile. Expanding the OLA programme — annual rate-contracting cycle, plant-buyer enablement, ERP enforcement — captures the bulk of the migration opportunity."*

## rca-pat-bc-07 — Service procurement project-by-project

**Finding shape:** SERVICE misrouted spend > 40% + service recurring spend ≥ ₹10 Cr.

**Typical client narrative:** *"AMC is contracted but for one-off services we go through tender each time."*

**Diagnostic signals:** Q-BC-08 reveals service framework-agreement programme absent; service procurement may be HR-led (housekeeping) or Maintenance-led (AMC), bypassing procurement; no dedicated services category manager.

**Counter-arguments:** Truly project-specific services (one-off civil construction, specific consulting) genuinely need RFQ. But recurring services (contract labour, transport, training) should be in OLA.

**Narrative template:**
> *"Service spend of ₹{service_spend_cr} Cr is {service_misrouted_pct}% misrouted — recurring services treated as project work each time. Framework agreements (OLA-equivalent for services) capture: contract labour, AMC, housekeeping, transport, training. Building this programme — owned by procurement, with department service-buyers transitioning to OLA call-offs — is the next maturity step."*

## rca-pat-bc-08 — Cross-plant vendor fragmentation

**Finding shape:** ≥10 MGs flagged for cross-plant aggregation + average vendor overlap across plants < 40%.

**Typical client narrative:** *"Each plant has its own vendor relationships. We don't really cross-shop between plants."*

**Diagnostic signals:** Op Model centralisation theme also fires (C3 / C4 flags); Plant Heads control plant-level buying; M&A heritage left plants with autonomous vendor bases; central category mgr absent.

**Counter-arguments:** Some MGs genuinely need local vendors (logistics, plant services, regulated state-licensed services). But for INDIRECT MRO + DIRECT engineered, cross-plant consolidation is almost always feasible.

**Narrative template:**
> *"{n_cross_plant_candidates} MGs across ₹{cross_plant_spend_cr} Cr exhibit cross-plant fragmentation — same MG bought from largely different vendors at each plant. This is a precondition to channel migration: vendor consolidation must precede contract programmes. Cross-reference with Op Model centralisation findings; consider sequencing as: (1) vendor consolidation, (2) central OLA/RC-LT, (3) plant call-offs."*

---

# C. Feasibility / Risk Findings Patterns (R09-R11)

## rca-pat-bc-09 — High PAC / sole-source concentration

**Finding shape:** ≥5 categories PAC-justified + total PAC share of portfolio > 10%.

**Typical client narrative:** *"For OEM spares we can't go competitive."* OR *"Engineering specifies the brand."*

**Diagnostic signals:** Q-BC-12 reveals PAC reasons cluster around OEM / proprietary / spec-uniqueness; no structured PAC review forum; vendor development programme absent; engineering team's spec authority unchallenged by procurement.

**Counter-arguments:** Some PAC is genuinely defensible (regulated industries, IP-protected tech). But systemic >10% PAC almost always indicates an alternate vendor qualification gap.

**Narrative template:**
> *"PAC / sole-source spend at {pac_pct}% of portfolio is notable — typical Indian large enterprise sits at 5-15%, BIC <5%. The {n_pac_categories} PAC-justified categories cluster around {top_pac_reason_categories}. Structured PAC review programme + vendor-development pipeline can reduce PAC % over 18-24 months. Start with the highest-spend PAC categories where alternate qualification is technically feasible."*

## rca-pat-bc-10 — Single-vendor critical DIRECT

**Finding shape:** ≥3 critical DIRECT categories with single vendor + total single-vendor DIRECT spend ≥ ₹30 Cr.

**Typical client narrative:** *"We've worked with this vendor for 20 years — they're the only ones who can supply to our spec."*

**Diagnostic signals:** Specification written around incumbent's capability; past alternate-vendor qualification attempts failed (technical / commercial); supply continuity risk not formally tracked; cross-pillar Supplier signals fragility.

**Counter-arguments:** Genuinely narrow markets (specialty refractories, specific mill rolls) may have <3 viable vendors globally — but most clients overstate this. Technical spec is usually rewritable.

**Narrative template:**
> *"{n_single_vendor_direct} DIRECT critical categories operate on single-vendor sourcing totalling ₹{single_vendor_direct_spend_cr} Cr. Supply continuity risk is concentrated. Structured supplier risk register + alternate-vendor qualification programme (over 12-18 months) is the standard response. Specific categories warrant immediate attention: {top_single_vendor_direct_mgs}."*

## rca-pat-bc-11 — Material master data quality issue

**Finding shape:** UNCLASSIFIED MG % > 15% OR UNCLASSIFIED spend % > 10%.

**Typical client narrative:** *"Our material master is a mess. We have items called 'MISC' and 'GENERAL'."*

**Diagnostic signals:** MG descriptions overly generic; multiple legacy ERP systems merged without MG harmonisation; no master-data stewardship at category-manager level.

**Counter-arguments:** Some level of UNCLASSIFIED is normal (truly miscellaneous items). >15% indicates systemic issue worth a Material Master cleanup project.

**Narrative template:**
> *"{unclassified_mg_pct}% of MGs ({unclassified_spend_cr} ₹ Cr spend) couldn't be classified by Stage 9. This is a Material Master pillar finding — the Buying Channel engine cannot recommend channels for MGs with cryptic descriptions. Recommend cross-pillar handoff: Material Master MG cleanup project to enable higher-precision channel routing."*

---

# D. Quantification Findings Patterns (R12-R13)

## rca-pat-bc-12 — Contracted but high TAT (contract leakage)

**Finding shape:** Portfolio contracted % > 40% AND portfolio weighted TAT > 20 days.

**Typical client narrative:** *"Contracts are in place but our PO cycle is still long. Approvals + paperwork take time."*

**Diagnostic signals:** Q-BC-09 reveals contract leakage isn't measured; Q-BC-13 reveals DoA doesn't differentiate by channel type (call-off treated same as spot); contract repository disconnected from PO workflow; ERP doesn't enforce contract reference.

**Counter-arguments:** Some categories genuinely need approval workflow regardless of contract (high-value items). But for OLA call-offs, light DoA is standard practice.

**Narrative template:**
> *"Portfolio contracted % of {contracted_pct}% is mid-band, but weighted TAT of {tat_days} days sits above benchmark (typical 10-20 days for contracted-heavy portfolios). The discrepancy points to (a) contract leakage — POs raised without referencing contracts, or (b) DoA workflow treating call-offs same as spot. Targeted fix: contract-reference enforcement at PR creation + channel-differentiated DoA."*

## rca-pat-bc-13 — PR dump absent / PR module not implemented

**Finding shape:** PR dump unavailable OR PR-PO join coverage < 70%.

**Typical client narrative:** *"We have an SAP PR module but most people don't use it — they just send an email to procurement."* OR *"PRs are tracked in Excel."*

**Diagnostic signals:** PR module not active in ERP OR active but bypass-rate high; PR-to-PO process manual; no PR cycle-time visibility.

**Counter-arguments:** Some clients legitimately operate via PR-less PO requests (small ops, very high trust); but for large enterprises, PR-PO discipline is foundational.

**Narrative template:**
> *"PR data unavailable / partial — TAT impact analysis (BC11) was skipped. This is itself a finding: PR system implementation (or revival of bypassed PR module) is a precondition for measuring cycle-time KPI. Until then, cycle-time improvement claims rely on QRE estimates rather than measured baselines."*

---

# E. Cross-Cutting Findings Patterns (R14-R15)

## rca-pat-bc-14 — Over-engineered RC-LT use

**Finding shape:** ≥5 over-engineered categories + over-engineered spend ≥ ₹20 Cr.

**Typical client narrative:** *"Once an RC-LT is in place, we just keep it — easier than re-evaluating."*

**Diagnostic signals:** RC-LT contracts auto-renewed without rationale review; procurement KPI rewards contract count; mid-volume INDIRECT or stable-vendor SERVICE on heavyweight RC-LT.

**Counter-arguments:** Some "over-engineered" cases are deliberate risk-management (strategic supplier, despite mid-spend). Worth case-by-case review.

**Narrative template:**
> *"{n_over_engineered} categories ({over_engineered_spend_cr} ₹ Cr) carry RC-LT where OLA fits — over-engineered contracts add management overhead without commensurate value. Selective conversion of mid-volume RC-LTs to OLA simplifies the contract portfolio + frees ~{estimated_contract_mgmt_fte_freed} FTE of contract management bandwidth."*

## rca-pat-bc-15 — Already mature / minimal remaining gap

**Finding shape:** Portfolio contracted % > 70% AND catalogue share > 25% AND PAC share < 5% AND TAT < 12 days.

**Typical client narrative:** *"We've worked on procurement maturity for years. Channel discipline is one of our stronger areas."*

**Diagnostic signals:** Best-practice ERP discipline; mature catalogue platform with regular maintenance; active PAC review; channel-differentiated DoA.

**Counter-arguments:** Even mature clients have residual opportunity — typically in automation depth or emerging categories. Not "nothing to do," but no structural rework.

**Narrative template:**
> *"Buying channel discipline at {contracted_pct}% contracted + {catalogue_pct}% catalogue + {pac_pct}% PAC + {tat_days}-day weighted TAT puts the client at the upper end of the maturity curve. Recommendations are continuous-improvement: e-catalogue depth, ML-suggested category-channel reviews, periodic benchmark refresh. No structural intervention."*

---

# Editable Configuration

| Element | Edit risk | Notes |
|---|---|---|
| Pattern narrative templates | LOW | Self-edit; phrasing for narrative tone |
| Pattern diagnostic signals | MEDIUM | Affects what evidence the AI looks for |
| Counter-arguments | LOW | Worth adding nuanced cases as engagement experience grows |
| New patterns | MEDIUM | Add when new finding shape emerges from engagements |
| Pattern IDs | HIGH | Referenced by `rca-rules.yml` — don't rename without updating both files |
