---
id: buying-channel-prompts
layer: function
function: procurement
pillar: buying-channel
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Buying Channel — AI Prompts Library

## Purpose

This file holds the AI prompts used by the Buying Channel pillar. Each prompt has a defined purpose, input schema, output schema, and a parameterised template. The app loads the relevant prompt at runtime, substitutes variables, and calls Vertex AI Gemini.

## Logic Embodied

At Stage 14, the app calls AI for:
1. **Portfolio channel mix narrative** — translate BC1 + BC3 outputs into client-facing current-state prose
2. **Per-MG recommendation justification** — for high-priority misrouted MGs, explain WHY the recommended channel fits (using dual-view category presentation)
3. **RCA synthesis** — combine rule-based RCA + AI pattern matching into one RCA narrative per finding
4. **Recommendation matching + tailoring** — pick best-fit card from `recommendations.md` and tailor to engagement-specific data
5. **Migration roadmap narrative** — sequence top migration candidates into a phased narrative
6. **No-₹ validator** — guardrail prompt that scans generated content and strips/regenerates any ₹ savings claims

## Editable Configuration

```yaml
default_model: "gemini-1.5-pro"
default_temperature: 0.3
default_max_output_tokens: 1500
production_prompts_only: true

# Buying Channel-specific guardrails
no_currency_savings_validator_enabled: true
dual_view_categories_required_in_output: true
framework_transparency_lead_in_required: true
```

---

# Prompt 1 — Portfolio Channel Mix Narrative

**ID:** `prompt.buying_channel.portfolio_narrative`
**Status:** production
**Used for:** Translating BC1 + BC3 outputs into client-facing current-state narrative
**Called at:** Stage 14 — after BC1, BC2, BC3 complete

### Input schema
```yaml
inputs:
  client_name: string
  industry: string
  bc1_channel_mix:
    contracted_spend_pct: float
    rc_lt_share_pct: float
    ola_share_pct: float
    catalogue_share_pct: float
    pac_share_pct: float
    spot_share_pct: float
  bc3_archetype_channel_heatmap: object   # archetype × channel pivot
  benchmark_band_used:
    typical_low: float
    typical_high: float
    indian_large_enterprise_low: float
    indian_large_enterprise_high: float
    bic_low: float
    bic_high: float
  confidence: enum [high, medium, low]
  contract_field_population_pct: float
```

### Output schema
```yaml
outputs:
  current_state_headline: string   # 1 sentence
  current_state_body: string       # 3-5 sentences
  archetype_observation: string    # 1-2 sentences on heat-map pattern
  defensibility_caveats: string    # if confidence < high OR contract_field_population_pct < 70
```

### Prompt template

```
You are a senior procurement consultant authoring the Buying Channel
"current state" finding for {{ client_name }}, a {{ industry }} company.

PORTFOLIO CHANNEL MIX (from BC1):
- Contracted spend (RC-LT + OLA + Catalogue combined): {{ bc1_channel_mix.contracted_spend_pct }}%
- RC-LT: {{ bc1_channel_mix.rc_lt_share_pct }}%
- OLA: {{ bc1_channel_mix.ola_share_pct }}%
- Catalogue/ROP: {{ bc1_channel_mix.catalogue_share_pct }}%
- PAC / Single-Tender: {{ bc1_channel_mix.pac_share_pct }}%
- Spot / Uncontracted: {{ bc1_channel_mix.spot_share_pct }}%

BENCHMARK BAND USED:
- Typical: {{ benchmark_band_used.typical_low }}-{{ benchmark_band_used.typical_high }}%
- Indian large enterprise: {{ benchmark_band_used.indian_large_enterprise_low }}-{{ benchmark_band_used.indian_large_enterprise_high }}%
- BIC: {{ benchmark_band_used.bic_low }}-{{ benchmark_band_used.bic_high }}%

ARCHETYPE × CHANNEL HEAT-MAP (from BC3):
{{ bc3_archetype_channel_heatmap }}

CONFIDENCE: {{ confidence }}
CONTRACT FIELD POPULATION RATE: {{ contract_field_population_pct }}%

INSTRUCTIONS:
1. Open with where {{ client_name }} sits vs benchmark bands.
2. Body: comment on the channel mix split — which channels dominate, which are absent or under-utilised.
3. Archetype observation: read the heat-map — call out the archetype-channel mismatches (e.g., BULK in Spot, INDIRECT not on Catalogue/OLA).
4. If confidence < high OR contract field population < 70%, add a defensibility caveat noting current contracted % may be a lower bound.
5. DO NOT make any ₹ savings claims — this pillar produces process / TAT / bandwidth improvements only.
6. Tone: professional, factual, consultant-grade. No marketing language. No hyperbole.
```

---

# Prompt 2 — Per-MG Recommendation Justification

**ID:** `prompt.buying_channel.per_mg_justification`
**Status:** production
**Used for:** Explaining WHY a specific MG got its recommended channel (used for top-priority misrouted MGs in the deck + dashboard)
**Called at:** Stage 14 — for each MG in the migration roadmap (BC6 top 20)

### Input schema
```yaml
inputs:
  mg_data:
    original_mg_code: string
    original_mg_desc: string
    reclassified_category: string
    archetype: enum [BULK, DIRECT, INDIRECT, SERVICE, CAPEX, UNCLASSIFIED]
    total_spend_inr_cr: float
    po_count: int
    distinct_months: int
    avg_po_value_inr: float
    vendor_count: int
    top_vendor_share_pct: float
    pac_pct: float
    current_channel: string
    recommended_channel: string
    rule_fired: string   # e.g., R5_indirect_catalogue
    flags: array of strings
```

### Output schema
```yaml
outputs:
  justification: string   # 3-5 sentences explaining the recommendation
  dual_view_header: string   # 1 sentence showing both original + reclassified category
```

### Prompt template

```
You are explaining a single Buying Channel recommendation to the client.
Use dual-view category presentation (their original code AND our reclassified
canonical category) so they recognise the item.

MATERIAL GROUP DATA:
- Their code: {{ mg_data.original_mg_code }}
- Their description: "{{ mg_data.original_mg_desc }}"
- Our canonical category: {{ mg_data.reclassified_category }}
- Archetype: {{ mg_data.archetype }}
- Total spend: ₹{{ mg_data.total_spend_inr_cr }} Cr
- PO count: {{ mg_data.po_count }} ({{ mg_data.distinct_months }} distinct months)
- Avg PO value: ₹{{ mg_data.avg_po_value_inr }}
- Vendor count: {{ mg_data.vendor_count }} (top vendor commands {{ mg_data.top_vendor_share_pct }}% share)
- PAC %: {{ mg_data.pac_pct }}%
- Current channel: {{ mg_data.current_channel }}
- Recommended channel: {{ mg_data.recommended_channel }}
- Rule fired: {{ mg_data.rule_fired }}
- Flags: {{ mg_data.flags }}

INSTRUCTIONS:
1. Dual-view header: state both their code/description AND our canonical category, so they immediately recognise the item.
2. Justification body (3-5 sentences):
   - State the recommended channel and why it fits given the archetype + frequency + value pattern
   - Reference the SPECIFIC data signals that drove the recommendation (e.g., "purchased in {{ distinct_months }} distinct months at avg ₹X per PO across {{ vendor_count }} vendors")
   - If a flag is present (PAC, single-vendor, cross-plant fragmentation), call it out + what action is recommended
3. DO NOT claim ₹ savings — describe channel-fit benefits (cycle time, buyer touch-time, supplier discipline)
4. Tone: factual, specific to this MG. Avoid generic phrasing.
```

---

# Prompt 3 — RCA Synthesis

**ID:** `prompt.buying_channel.rca_synthesis`
**Status:** production
**Used for:** Combining deterministic rule-fired RCA with AI-pattern-matched RCA into one synthesised narrative per finding
**Called at:** Stage 14 — after rca-rules.yml fires for a finding

### Input schema
```yaml
inputs:
  finding_id: string
  finding_data: object   # what the analysis output
  rule_fired:
    rule_id: string      # e.g., rca.buying_channel.r04_indirect_spot_dominant
    root_causes: array of strings   # from rca-rules.yml
    confidence: enum
  ai_matched_patterns:   # from rca-patterns.md
    - pattern_id: string
      diagnostic_signals: array
      counter_arguments: array
      narrative_template: string
      pattern_match_score: float
  qre_responses: object   # relevant Q-BC-* responses
```

### Output schema
```yaml
outputs:
  rca_headline: string   # 1 sentence — primary root cause
  rca_body: string       # 4-6 sentences — synthesised narrative
  diagnostic_actions: array of strings   # what consultant should verify
  counter_consideration: string   # 1-2 sentences — alternative explanation worth checking
  confidence_label: enum [high, medium, low]
  confidence_rationale: string
```

### Prompt template

```
You are synthesising the root cause analysis for a Buying Channel finding.
Combine deterministic rule-based RCA with pattern-matched narrative RCA.

FINDING: {{ finding_id }}
FINDING DATA: {{ finding_data }}

DETERMINISTIC RULE FIRED:
- Rule: {{ rule_fired.rule_id }}
- Listed root causes: {{ rule_fired.root_causes }}
- Confidence: {{ rule_fired.confidence }}

AI-MATCHED PATTERNS:
{% for p in ai_matched_patterns %}
- Pattern: {{ p.pattern_id }} (match score {{ p.pattern_match_score }})
  Diagnostic signals: {{ p.diagnostic_signals }}
  Counter-arguments: {{ p.counter_arguments }}
  Narrative template: {{ p.narrative_template }}
{% endfor %}

QRE RESPONSES (relevant):
{{ qre_responses }}

INSTRUCTIONS:
1. Headline (1 sentence): primary root cause — converge rule-based + AI-matched
2. Body (4-6 sentences):
   - Lead with the strongest evidence (highest-confidence signal)
   - Weave in QRE corroboration where available
   - Explain the causal chain (data signal → root cause → finding shape)
3. Diagnostic actions: 2-4 specific things the consultant should verify with the client
4. Counter-consideration: 1-2 sentences acknowledging alternative explanations (use counter-arguments from patterns)
5. Confidence:
   - HIGH if deterministic rule + AI pattern + QRE all align
   - MEDIUM if 2 of 3 align
   - LOW if rule fires but pattern match < 0.65 OR QRE contradicts
6. DO NOT make ₹ savings claims. Process / TAT / bandwidth / risk reduction language only.
```

---

# Prompt 4 — Recommendation Matching + Tailoring

**ID:** `prompt.buying_channel.recommendation_matching`
**Status:** production
**Used for:** Given a finding pattern, pick best-fitting card from recommendations.md + tailor to engagement specifics
**Called at:** Stage 14 — after RCA produces primary pattern

### Input schema
```yaml
inputs:
  primary_pattern_id: string
  secondary_pattern_ids: array of strings
  engagement_data:
    industry: string
    total_addressable_spend_inr_cr: float
    n_misrouted_mgs: int
    contracted_pct_current: float
    transformation_ceiling_lift_pp: int   # from benchmarks.yml
  recommendation_library:   # filtered by triggered_by_patterns
    - id: string
      title: string
      scope: string
      action: array
      expected_impact: object
      duration: string
      risks: array
      preconditions: array
```

### Output schema
```yaml
outputs:
  primary_recommendation:
    id: string
    tailored_title: string         # adapted to engagement scope
    tailored_action: array
    tailored_impact: object        # numerical values applied
    duration: string
    risks: array
    preconditions: array
  alternate_recommendation: object  # second-best card, if multiple patterns fire
  phasing: array                    # quick-win / medium / long-term breakdown
```

### Prompt template

```
You are selecting and tailoring a recommendation for a Buying Channel
finding.

PRIMARY PATTERN: {{ primary_pattern_id }}
SECONDARY PATTERNS: {{ secondary_pattern_ids }}

ENGAGEMENT DATA:
- Industry: {{ engagement_data.industry }}
- Total addressable spend: ₹{{ engagement_data.total_addressable_spend_inr_cr }} Cr
- Misrouted MGs: {{ engagement_data.n_misrouted_mgs }}
- Current contracted %: {{ engagement_data.contracted_pct_current }}%
- Transformation ceiling (max lift in single programme): {{ engagement_data.transformation_ceiling_lift_pp }} percentage points

CANDIDATE RECOMMENDATION CARDS (from recommendations.md):
{% for r in recommendation_library %}
- ID: {{ r.id }}
  Title: {{ r.title }}
  Scope: {{ r.scope }}
  Action: {{ r.action }}
  Impact: {{ r.expected_impact }}
  Duration: {{ r.duration }}
  Risks: {{ r.risks }}
  Preconditions: {{ r.preconditions }}
{% endfor %}

INSTRUCTIONS:
1. Pick the best-fit primary recommendation card.
2. Tailor the title to be engagement-specific (e.g., "Build INDIRECT OLA + catalogue programme for {{ engagement_data.industry }} — {{ engagement_data.n_misrouted_mgs }} misrouted MGs").
3. Tailor expected impact to engagement specifics:
   - Apply transformation ceiling to projected contracted % lift
   - Apply industry overlay if any
   - Convert MG counts and spend to engagement values
4. If multiple patterns fire and the secondary card adds materially different scope, include it as alternate_recommendation. Otherwise leave alternate_recommendation empty.
5. Phasing: split the action into quick-win (0-3 mo) / medium-term (3-12 mo) / long-term (12-24 mo) buckets.
6. DO NOT generate ₹ savings figures. Use TAT / bandwidth / contract coverage lift framing.
7. Tone: action-oriented, specific, defensible.
```

---

# Prompt 5 — Migration Roadmap Narrative

**ID:** `prompt.buying_channel.migration_roadmap`
**Status:** production
**Used for:** Sequencing the top-20 migration candidates into a phased narrative
**Called at:** Stage 14 — after BC6 + BC4 outputs ready

### Input schema
```yaml
inputs:
  client_name: string
  industry: string
  top_migration_candidates:   # top 20 by spend × priority
    - original_mg_code: string
      original_mg_desc: string
      reclassified_category: string
      archetype: string
      total_spend_inr_cr: float
      current_channel: string
      recommended_channel: string
      migration_priority: enum [high, medium, low]
      precondition_flags: array   # cross-plant aggregation needed, PAC review, etc.
  phasing_horizons:
    quick_win_months: int
    medium_term_months: int
    long_term_months: int
  transformation_ceiling_lift_pp: int
```

### Output schema
```yaml
outputs:
  roadmap_headline: string
  roadmap_body: string
  phased_actions:
    phase_1_quick_wins: array   # MGs + actions for 0-3 months
    phase_2_medium_term: array  # 3-12 months
    phase_3_long_term: array    # 12-24 months
  sequencing_rationale: string  # 2-3 sentences explaining the order
  precondition_callouts: string # 2-3 sentences on what must happen before what
```

### Prompt template

```
You are sequencing the channel migration roadmap for {{ client_name }}.

TOP MIGRATION CANDIDATES (top 20 by spend × priority):
{{ top_migration_candidates }}

PHASING HORIZONS:
- Quick wins: 0-{{ phasing_horizons.quick_win_months }} months
- Medium-term: {{ phasing_horizons.quick_win_months }}-{{ phasing_horizons.medium_term_months }} months
- Long-term: {{ phasing_horizons.medium_term_months }}-{{ phasing_horizons.long_term_months }} months

TRANSFORMATION CEILING: {{ transformation_ceiling_lift_pp }} pp lift in contracted % per programme cycle.

INSTRUCTIONS:
1. Sequence the migrations into 3 phases. Rules:
   - Phase 1 (quick wins): catalogue migrations of standardised items + simple OLA conversions
   - Phase 2: programme builds (OLA scale-up, RC-LT negotiations)
   - Phase 3: structural items (cross-plant consolidation needing vendor base rework, vendor development for PAC reduction)
2. Honour preconditions: if an MG needs cross-plant aggregation first, sequence the aggregation in Phase 1/2 and the channel migration in Phase 2/3
3. Sequencing rationale: 2-3 sentences explaining the order (quick wins first to build momentum; structural items last to allow capability + change management to land)
4. Precondition callouts: explicit dependencies (e.g., "MG017 OLA migration depends on cross-plant vendor consolidation completing first")
5. DO NOT specify ₹ savings per MG or per phase. Process discipline language: cycle time, buyer bandwidth, contract coverage.
6. Tone: implementation-ready, sequenced thinking.
```

---

# Prompt 6 — No-₹ Savings Validator (Guardrail)

**ID:** `prompt.buying_channel.no_currency_validator`
**Status:** production (guardrail — runs on every generated narrative before display)
**Used for:** Scanning generated content for ₹ savings claims and stripping/regenerating without them
**Called at:** Stage 14 — after any narrative-generation prompt (Prompts 1-5) outputs

### Input schema
```yaml
inputs:
  generated_content: string
  prompt_id_origin: string   # which prompt produced this
```

### Output schema
```yaml
outputs:
  has_currency_savings_claims: boolean
  violations: array of objects   # each violation: snippet + reason
  cleaned_content: string        # content with violations regenerated/removed
```

### Prompt template

```
You are a guardrail validator. The Buying Channel pillar produces process,
TAT, and capability improvements — NOT ₹ savings (those belong to Op Model).

CONTENT TO VALIDATE:
{{ generated_content }}

ORIGIN PROMPT: {{ prompt_id_origin }}

INSTRUCTIONS:
1. Scan for any of these violation patterns:
   - "₹X Cr savings" or "₹X crore savings" or "Rs X savings"
   - "% savings" attributed to channel migration
   - "cost reduction" with specific currency amounts
   - "EBITDA impact" with currency amounts
   - Implied cost-out via headcount reduction (vs FTE-redeployment framing)

2. For each violation, report:
   - The snippet
   - Reason (which boundary it crosses)

3. Produce cleaned_content:
   - Strip the violation
   - Rewrite the sentence(s) using approved framings:
     - TAT reduction (days/year, % cycle-time reduction)
     - Buyer bandwidth freed (FTE-equivalent, redeployable to category mgmt)
     - Contract coverage lift (% point increase)
     - Process discipline improvement (qualitative)
     - Risk reduction (qualitative, for sole-source / leakage)

4. If no violations found: has_currency_savings_claims = false, cleaned_content = generated_content unchanged.

5. Tone of cleaned content: maintain consultant register; surgical replacement, not full rewrites.
```

---

# Editable Configuration

| Element | Edit risk | Notes |
|---|---|---|
| Prompt template wording | MEDIUM | Affects output tone + structure |
| Input/output schema | HIGH | Affects engine integration; coordinate with app code |
| Default model + temperature | LOW | Tunable per-engagement if needed |
| Guardrail enable/disable flags | HIGH | No-₹ validator should always stay enabled |
| Adding new prompt | MEDIUM | Often paired with new analysis (e.g., new BC analysis) |
| Removing a prompt | HIGH | Engine integration dependency |

# Operational notes

- All prompts run at temperature 0.3 (mostly deterministic) except where finer style variation needed
- Prompt 6 (no-₹ validator) runs as post-processor on every other prompt's output before display
- Production prompts only — experimental / proposed prompts kept in a separate `prompts-staging.md` file (not yet created)
