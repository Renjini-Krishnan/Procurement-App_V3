---
id: op-model-prompts
layer: function
function: procurement
pillar: op-model
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Op Model — AI Prompts Library

## Purpose

This file holds AI prompts used by the Op Model pillar. Each prompt has a defined purpose, input schema, output schema, and a parameterised template. The app loads the relevant prompt at runtime, substitutes variables, and calls Vertex AI Gemini.

## Logic Embodied

At Stage 12, the app calls AI for:
1. **Theme finding narrative generation** — translate analysis output to client-facing prose
2. **RCA synthesis** — combine rule-based + AI pattern matching into one RCA narrative per finding
3. **Recommendation matching** — given a finding pattern, find best-fitting recommendation card from library
4. **Cross-theme synthesis narrative** — produce the Strategic Imperative narrative
5. **Confidence summary** — translate technical confidence drivers into client-readable language

## Editable Configuration
```yaml
default_model: "gemini-1.5-pro"
default_temperature: 0.3
default_max_output_tokens: 1500
production_prompts_only: true
```

---

# Prompt 1 — Theme Finding Narrative

**ID:** `prompt.opmodel.theme_finding_narrative`
**Status:** production
**Used for:** Translating theme analysis output into client-facing finding narrative
**Called at:** Stage 12 — after each theme's analysis completes (Centralisation, SSC, CoE, Tail Spend)

### Input schema
```yaml
inputs:
  theme: string   # centralisation / shared-services / coe / tail-spend
  client_name: string
  industry: string   # steel / cement / ...
  analysis_outputs: object   # theme-specific quantitative outputs
  qre_responses: object
  benchmark_values_used: { primary_source: string, value_range: array }
  industry_filter_tags: object  # SS2 / CE2 / TS3 tagging
  confidence: enum [high, medium, low]
```

### Output schema
```yaml
outputs:
  finding_headline: string   # 1 sentence
  finding_body: string   # 3-5 sentences
  key_metrics_table: array
  defensibility_caveats: string   # if confidence < high
```

### Prompt template
```
You are a senior procurement consultant authoring a finding for an Op Model
assessment of {{ client_name }}, a {{ industry }} company.

THEME: {{ theme }}

ANALYSIS OUTPUTS:
{{ analysis_outputs }}

QRE RESPONSES:
{{ qre_responses }}

BENCHMARK USED (primary):
{{ benchmark_values_used }}

INDUSTRY FILTER TAGS (where applicable):
{{ industry_filter_tags }}

CONFIDENCE: {{ confidence }}

TASK: Write a finding for this theme. Structure:

1. HEADLINE (1 sentence): State the headline gap or strength.
2. BODY (3-5 sentences): Describe what the data shows, contrasted against
   industry benchmark, with industry-specific nuance for {{ industry }}.
   Be specific about numbers. Avoid generic procurement vocabulary.
3. KEY METRICS TABLE (3-6 bullets): Most important quantified outputs.
4. DEFENSIBILITY CAVEATS (only if confidence < high): What's uncertain
   and why.

CONSTRAINTS:
- Cite numbers from analysis_outputs, never invent.
- Reference the primary benchmark source by name (e.g., "vs WSA 2024 typical").
- Use Indian numbering convention (Cr, lakh) since this is an Indian engagement.
- Active voice. Sentences ≤ 25 words.
- Don't recommend actions here — that's a separate prompt.
- Don't editorialise about client maturity unfavorably; describe gap factually.

Output strict JSON matching the output schema. No markdown around JSON.
```

**Notes:** Temperature 0.3; max output tokens 600; re-run if output mentions a number not in inputs.

---

# Prompt 2 — RCA Synthesis

**ID:** `prompt.opmodel.rca_synthesis`
**Status:** production
**Used for:** Combining rule-based RCA hypotheses with AI pattern matching into one RCA narrative
**Called at:** Stage 12 — after theme finding is produced

### Input schema
```yaml
inputs:
  theme: string
  finding: object   # output of theme_finding_narrative
  rule_based_rca:
matched_rules: [{ id, root_causes, confidence }]
  candidate_patterns: [{ pattern_id, narrative_template, fit_score }]
  engagement_context:
industry: string
client_name: string
qre_responses: object
industry_specific_context: string
```

### Output schema
```yaml
outputs:
  rca_narrative: string   # 2-4 sentences
  root_cause_hypotheses:
- cause: string
  confidence: enum [high, medium, low]
  source: enum [rule, pattern, combined]
  diagnostic_actions: array
  counter_arguments: string
  recommended_pattern_id: string   # primary pattern ID this RCA aligns with
```

### Prompt template
```
You are conducting Root Cause Analysis for a procurement Op Model finding
at {{ client_name }} ({{ industry }}).

FINDING:
{{ finding }}

DETERMINISTIC RULES FIRED:
{{ rule_based_rca }}

CANDIDATE PATTERNS (top-3 by fit score):
{{ candidate_patterns }}

ENGAGEMENT CONTEXT:
{{ engagement_context }}

TASK: Synthesise a coherent RCA narrative that:

1. Uses the rule-fired root causes as the spine (deterministic + high-confidence).
2. Elaborates with industry-specific narrative from the candidate patterns
   that match best.
3. Surfaces COUNTER-ARGUMENTS where applicable — don't suppress nuances.
   The consultant needs to see them.
4. Identifies the single best-fitting pattern (recommended_pattern_id) so
   the recommendation engine can match downstream.

CONSTRAINTS:
- Don't invent root causes beyond what rules + patterns provide.
- Ground each hypothesis in either rule output OR pattern + QRE evidence.
- For each hypothesis, suggest one diagnostic action the consultant can take
  to verify.
- If rule output and pattern output conflict, surface the conflict and
  recommend resolution.
- Indian context — use Indian procurement vocabulary.

Output strict JSON matching the output schema.
```

**Notes:** Temperature 0.3; max output tokens 1000.

---

# Prompt 3 — Recommendation Matching

**ID:** `prompt.opmodel.recommendation_matching`
**Status:** production
**Used for:** Given a finding + RCA + pattern, find the best-fitting recommendation card from `recommendations.md`

### Input schema
```yaml
inputs:
  theme: string
  finding: object
  rca_output: object   # from prompt 2
  primary_pattern_id: string
  available_recommendations: [{ recommendation_id, action, savings_formula, duration, risks, preconditions }]
  engagement_data:
candidate_spend_inr_cr: number
industry_savings_rate_pct_range: array
    current_state_metrics: object
```

### Output schema
```yaml
outputs:
  primary_recommendation:
recommendation_id: string
action: string
customised_savings_range_inr_cr: array   # engagement-specific numbers
duration: string
risks_to_flag: array
preconditions_to_address: array
  secondary_recommendation: object   # optional
  rationale: string
```

### Prompt template
```
You are matching a finding + RCA to recommendation cards for {{ client_name }}.

FINDING:
{{ finding }}

RCA OUTPUT:
{{ rca_output }}

PRIMARY PATTERN: {{ primary_pattern_id }}

CANDIDATE RECOMMENDATIONS:
{{ available_recommendations }}

ENGAGEMENT DATA:
{{ engagement_data }}

TASK:
1. Pick the best-fitting recommendation card.
2. Customise its savings range using THIS engagement's specific spend and
   industry rate.
3. List any preconditions that this engagement should address first.
4. List risks that should be flagged.
5. Optionally identify a secondary recommendation if the finding warrants
   a compound action.

CONSTRAINTS:
- Don't invent recommendations beyond available cards.
- Savings range must be computed from engagement spend × industry rate.
- Risks must come from the card's risk list, not invented.
- Indian context.

Output strict JSON matching the output schema.
```

**Notes:** Temperature 0.2 (deterministic recommendation card selection); max output tokens 800.

---

# Prompt 4 — Cross-Theme Synthesis Narrative

**ID:** `prompt.opmodel.cross_theme_synthesis`
**Status:** production
**Used for:** Generating the Strategic Imperative narrative from all 4 themes' outputs
**Called at:** Stage 12 — after all four themes complete + X1-X3 synthesis components run

### Input schema
```yaml
inputs:
  client_name: string
  industry: string
  theme_outputs:
centralisation: object   # finding + recommendation + score
shared_services: object
coe: object
tail_spend: object
  per_category_decision_matrix: array   # X1 output
  detected_strategic_imperative_patterns:
- pattern_id: string   # SI-01 through SI-05
  narrative_template: string
  fit_score: float
  roll_up_savings:
centralisation_savings_range: array
coe_incremental_savings_range: array
ssc_savings: { operational, fte }
tail_outsourcing_savings_range: array
grand_total_range: array
fte_freed_count: number
  pillar_maturity_score: number
```

### Output schema
```yaml
outputs:
  strategic_imperative_headline: string   # 1 sentence
  strategic_imperative_narrative: string  # 4-6 sentences
  prioritised_actions: array          # 4-6 bullets, ordered by impact
  pillar_summary_one_liner: string
```

### Prompt template
```
You are synthesising the Op Model strategic narrative for {{ client_name }}
({{ industry }}).

ALL FOUR THEME OUTPUTS:
{{ theme_outputs }}

PER-CATEGORY DECISION MATRIX (Top-20 by impact):
{{ per_category_decision_matrix }}

DETECTED STRATEGIC IMPERATIVE PATTERNS:
{{ detected_strategic_imperative_patterns }}

ROLL-UP SAVINGS:
{{ roll_up_savings }}

PILLAR MATURITY SCORE: {{ pillar_maturity_score }}

TASK: Produce the Op Model Strategic Imperative narrative for the consultant
deliverable.

1. HEADLINE (1 sentence): What's the dominant Op Model story?
2. NARRATIVE (4-6 sentences):
   - Lead with the dominant Strategic Imperative pattern (highest fit_score).
   - Bring in supporting evidence from the relevant theme outputs.
   - Explain WHY this is the imperative (root cause from RCA).
   - State the prize: total savings range + FTE freed.
3. PRIORITISED ACTIONS (4-6 bullets):
   - Action verb starting (Centralise / Move / Establish / Outsource / Consolidate)
   - Specific category list or scope
   - Quantified savings each
   - Order by absolute savings
4. PILLAR SUMMARY ONE-LINER (1 sentence): "<X-themed> Op Model maturity at
   <score>/5; <pillar's prize>."

CONSTRAINTS:
- Use the Strategic Imperative pattern narrative template as starting point.
- Substitute engagement-specific numbers throughout.
- Don't repeat individual theme findings; this is synthesis.
- Indian context — use Indian Cr/lakh.
- Defensible language; avoid hyperbole.

Output strict JSON matching the output schema.
```

**Notes:** Temperature 0.4 (slightly higher for synthesis creativity within bounds); max output tokens 1500.

---

# Prompt 5 — Confidence Summary

**ID:** `prompt.opmodel.confidence_summary`
**Status:** production
**Used for:** Translating technical confidence drivers into consultant-readable / client-readable language
**Called at:** Stage 12 — at theme card + pillar summary level

### Input schema
```yaml
inputs:
  theme_or_pillar: string
  confidence_level: enum [high, medium, low]
  confidence_drivers:
contributing_signals:
  - signal: string
    status: enum [pass, partial, fail]
  data_quality_metrics:
stage9_classification_pct: number
plant_codes_mapped: boolean
vendor_dedup_done: boolean
  qre_completeness:
answered: array
missing: array
```

### Output schema
```yaml
outputs:
  confidence_summary_one_liner: string   # for theme card chip
  detailed_explanation: string        # for tooltip / drill-down
  remediation_actions:                # only if confidence < high
- action: string
  impact_on_confidence: enum [high, medium, low]
```

### Prompt template
```
You are writing the confidence indicator for a procurement finding.

THEME / PILLAR: {{ theme_or_pillar }}
CONFIDENCE LEVEL: {{ confidence_level }}

CONFIDENCE DRIVERS:
{{ confidence_drivers }}

DATA QUALITY METRICS:
{{ data_quality_metrics }}

QRE COMPLETENESS:
{{ qre_completeness }}

TASK: Translate this into:

1. ONE-LINER (10-15 words): What confidence level + headline reason.
   Examples:
   - High: "High confidence — full data + industry overlay + QRE complete."
   - Medium: "Medium — Stage 9 at 85%; QRE partial."
   - Low: "Low — significant data gaps; finding directional only."

2. DETAILED EXPLANATION (2-3 sentences): What specifically is/isn't contributing.

3. REMEDIATION ACTIONS (if confidence < high):
   - 1-3 concrete actions consultant can take
   - Each tagged with expected impact on confidence

CONSTRAINTS:
- Honest about what's missing; don't gloss over.
- Use the universal scoring vocabulary (high / medium / low).
- For consultant audience, not client.
- Indian context.

Output strict JSON matching the output schema.
```

**Notes:** Temperature 0.2 (deterministic); max output tokens 400.

---

# Engineering Notes

## Prompt versioning
Production prompts are versioned within this file. When updating a prompt:
1. Author new version below the existing (don't overwrite)
2. Tag old version `deprecated`
3. Tag new version `experimental` initially
4. After validation, switch new to `production` + old to `archived`

## Retrieval
The app loads this file at startup. Prompt selection logic:
1. Filter by `production` status (unless `production_prompts_only: false`)
2. Match by `ID` requested
3. Render template with input variables

## JSON output validation
Each prompt's output is validated against the declared output schema. Validation failures trigger:
- Retry once with stricter "Output strict JSON. No markdown." reminder
- If still fails: fallback to deterministic output (rule-only RCA, default recommendation card)
- Log failure for prompt-tuning analysis

## Citations
All claims in AI-generated narrative must trace back to inputs. Post-processing checks:
- Numbers cited appear in inputs
- Benchmarks cited match the benchmark IDs in inputs
- Patterns cited match `rca-patterns.md` IDs
- Recommendations cited match `recommendations.md` IDs

Citation failure flags the output as low-defensibility and prompts consultant review before display.
