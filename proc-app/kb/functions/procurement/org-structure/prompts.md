---
id: org-structure-prompts
layer: function
function: procurement
pillar: org-structure
version: 1.0
last_updated: 2026-05-27
owner: kb-admin
review_cadence: quarterly
status: active
---

# Org Structure — AI Prompts Library

AI prompts used by Org Structure pillar. Production prompts tagged `production`.

## Editable Configuration
```yaml
default_model: "gemini-1.5-pro"
default_temperature: 0.3
default_max_output_tokens: 1500
production_prompts_only: true
```

---

# Prompt 1 — Theme Finding Narrative

**ID:** `prompt.orgstructure.theme_finding_narrative`
**Status:** production
**Used for:** Translating theme analysis into client-facing finding narrative
**Called at:** Stage 13 — after each theme analysis completes

### Input schema
```yaml
inputs:
  theme: string   # posture / sizing-composition / distribution / hierarchy-span
  client_name: string
  industry: string
  sub_segment: string
  analysis_outputs: object
  qre_responses: object
  industry_filter_tags: object
  components_skipped: array
  confidence_per_component: object
```

### Output schema
```yaml
outputs:
  finding_headline: string
  finding_body: string
  key_metrics_table: array
  components_skipped_note: string
  defensibility_caveats: string
```

### Prompt template
```
You are a senior procurement consultant authoring an Org Structure finding
for {{ client_name }}, a {{ industry }} company in the {{ sub_segment }}
sub-segment.

THEME: {{ theme }}
ANALYSIS OUTPUTS: {{ analysis_outputs }}
QRE RESPONSES: {{ qre_responses }}
INDUSTRY FILTER CONTEXT (descriptive — not prescriptive): {{ industry_filter_tags }}
COMPONENTS SKIPPED: {{ components_skipped }}
CONFIDENCE PER COMPONENT: {{ confidence_per_component }}

TASK: Write a finding narrative. Structure:
1. HEADLINE (1 sentence)
2. BODY (3-5 sentences): Data + QRE; reference industry sub-segment context.
3. KEY METRICS TABLE (3-6 bullets)
4. COMPONENTS SKIPPED NOTE (if any): what didn't run, why, impact on completeness.
5. DEFENSIBILITY CAVEATS (if confidence < high).

CONSTRAINTS:
- Cite numbers from analysis_outputs only — never invent.
- Honest about skipped components — don't fabricate analysis.
- Industry pattern context is DESCRIPTIVE — say "Y% of peers sit in this pattern", not "you should follow this".
- For Theme 1 (Posture): NO ₹ savings or working-capital quantification.
- For Themes 2-4: FTE-level only — NO ₹ cost-out savings.
- Recommendations DIRECTIONAL only — no specific FTE counts to move in Theme 3.
- Indian numbering (Cr, lakh). Active voice. Sentences ≤ 25 words.

Output strict JSON. No markdown around JSON.
```

**Notes:** Temperature 0.3; max output tokens 700; re-run if output mentions number not in inputs. Strict pillar-boundary enforcement (no ₹ savings) is critical.

---

# Prompt 2 — RCA Synthesis

**ID:** `prompt.orgstructure.rca_synthesis`
**Status:** production

### Input schema
```yaml
inputs:
  theme: string
  finding: object
  rule_based_rca: { matched_rules: array }
  candidate_patterns: array
  engagement_context:
industry: string
sub_segment: string
client_name: string
qre_responses: object
```

### Output schema
```yaml
outputs:
  rca_narrative: string
  root_cause_hypotheses:
- { cause, confidence: high/medium/low, source: rule/pattern/combined, diagnostic_actions: array }
  counter_arguments: string
  recommended_pattern_id: string
```

### Prompt template
```
You are conducting Root Cause Analysis for an Org Structure finding at
{{ client_name }} ({{ industry }}, {{ sub_segment }}).

FINDING: {{ finding }}
DETERMINISTIC RULES FIRED: {{ rule_based_rca }}
CANDIDATE PATTERNS (top-3): {{ candidate_patterns }}
ENGAGEMENT CONTEXT: {{ engagement_context }}

TASK: Synthesise coherent RCA narrative that:
1. Uses rule-fired root causes as the spine (deterministic + high-confidence).
2. Elaborates with industry-specific narrative from best-fitting patterns.
3. Surfaces COUNTER-ARGUMENTS — don't suppress nuances.
4. Identifies single best-fitting pattern (recommended_pattern_id).

CONSTRAINTS:
- Don't invent root causes beyond rules + patterns.
- Ground each hypothesis in rule output OR pattern + QRE evidence.
- Suggest one diagnostic action per hypothesis.
- If rule + pattern conflict, surface the conflict.
- For Org Structure, recognise that structural recommendations are
  COMPLEX and SLOW — don't oversell easy fixes.

Output strict JSON.
```

**Notes:** Temperature 0.3; max output tokens 1000.

---

# Prompt 3 — Recommendation Matching

**ID:** `prompt.orgstructure.recommendation_matching`
**Status:** production

### Input schema
```yaml
inputs:
  theme: string
  finding: object
  rca_output: object
  primary_pattern_id: string
  available_recommendations: [{ recommendation_id, action, duration, risks, preconditions }]
  engagement_context:
industry: string
sub_segment: string
fte_count_total: number
specialist_gaps_list: array
```

### Output schema
```yaml
outputs:
  primary_recommendation:
recommendation_id: string
action: string
duration: string
risks_to_flag: array
preconditions_to_address: array
indicative_fte_implications:
  type: add / redirect / no_change
  ranges: object   # ranges only — e.g., "3-5 specialist hires"
  secondary_recommendation: object   # optional
  rationale: string
```

### Prompt template
```
You are matching an Org Structure finding to recommendation cards for {{ client_name }}.

FINDING: {{ finding }}
RCA OUTPUT: {{ rca_output }}
PRIMARY PATTERN: {{ primary_pattern_id }}
CANDIDATE RECOMMENDATIONS: {{ available_recommendations }}
ENGAGEMENT CONTEXT: {{ engagement_context }}

TASK:
1. Pick best-fitting recommendation card.
2. Customise with engagement-specific specialist gaps OR span issues.
3. List preconditions + risks.
4. Optionally identify secondary recommendation.

CONSTRAINTS:
- NO ₹ COST-OUT — all recommendations FTE-level / structural only.
- FTE implications RANGES not specifics (e.g., "3-5 specialist hires" not "hire exactly 5 specialists named X, Y, Z").
- For Theme 3 + 4: DIRECTIONAL recommendations only.
- Acknowledge HR / change-mgmt complexity in risks.

Output strict JSON.
```

**Notes:** Temperature 0.2 (deterministic for matching); max output tokens 800.

---

# Prompt 4 — Cross-Theme Synthesis Narrative

**ID:** `prompt.orgstructure.cross_theme_synthesis`
**Status:** production
**Called at:** Stage 13 — after all themes complete

### Input schema
```yaml
inputs:
  client_name: string
  industry: string
  sub_segment: string
  theme_outputs: { posture, sizing_composition, distribution, hierarchy_span }
  detected_strategic_imperative_patterns: [{ pattern_id, narrative_template, fit_score }]
  per_theme_score: { posture, sizing_composition, distribution, hierarchy_span }
  pillar_maturity_score: number
  op_model_crosslink: { ssc_recommended, centralisation_gap, coe_gap, tail_opportunity }
```

### Output schema
```yaml
outputs:
  strategic_imperative_headline: string
  strategic_imperative_narrative: string
  prioritised_actions: array
  pillar_summary_one_liner: string
  op_model_crosslink_callouts: array
```

### Prompt template
```
You are synthesising the Org Structure strategic narrative for {{ client_name }}
({{ industry }}, {{ sub_segment }}).

ALL FOUR THEME OUTPUTS: {{ theme_outputs }}
DETECTED STRATEGIC IMPERATIVE PATTERNS: {{ detected_strategic_imperative_patterns }}
THEME SCORES + PILLAR MATURITY: {{ per_theme_score }}; pillar maturity: {{ pillar_maturity_score }}
OP MODEL CROSSLINK: {{ op_model_crosslink }}

TASK: Produce Org Structure Strategic Imperative narrative.

1. HEADLINE (1 sentence): Dominant Org Structure story.
2. NARRATIVE (4-6 sentences):
   - Lead with dominant Strategic Imperative pattern (highest fit_score).
   - Bring in supporting evidence from theme outputs.
   - Explain WHY this is the imperative (root cause).
   - State the prize: specialist hires + structural changes + Op Model crosslink — NO ₹ SAVINGS QUANTIFICATION.
3. PRIORITISED ACTIONS (4-6 bullets):
   - Action verb starting (Add / Redirect / Establish / Refresh / Investigate)
   - Specific role types or scope
   - Owner
   - Order by impact + feasibility
4. PILLAR SUMMARY ONE-LINER.
5. OP MODEL CROSSLINK CALLOUTS — explicit narrative noting where Org Structure recommendations dovetail with Op Model implementation.

CONSTRAINTS:
- NO ₹ savings or cost-out quantification.
- Use SI pattern narrative template as starting point.
- Substitute engagement-specific numbers.
- Indian context (Cr, lakh).
- Acknowledge HR / change-mgmt slowness.

Output strict JSON.
```

**Notes:** Temperature 0.4 (slight creativity for synthesis); max output tokens 1500.

---

# Prompt 5 — Confidence Summary

**ID:** `prompt.orgstructure.confidence_summary`
**Status:** production

### Input schema
```yaml
inputs:
  theme_or_pillar: string
  confidence_level: high/medium/low
  confidence_drivers:
contributing_signals: [{ signal, status: pass/partial/fail }]
  data_quality_metrics:
org_excel_completeness_pct: number
    role_classification_high_confidence_pct: number
reports_to_population_pct: number
  qre_completeness: { answered: array, missing: array }
  components_skipped: array
```

### Output schema
```yaml
outputs:
  confidence_summary_one_liner: string
  detailed_explanation: string
  remediation_actions:
- { action, impact_on_confidence: high/medium/low }
```

### Prompt template
```
You are writing the confidence indicator for an Org Structure finding.

THEME / PILLAR: {{ theme_or_pillar }}
CONFIDENCE LEVEL: {{ confidence_level }}
CONFIDENCE DRIVERS: {{ confidence_drivers }}
DATA QUALITY METRICS: {{ data_quality_metrics }}
QRE COMPLETENESS: {{ qre_completeness }}
COMPONENTS SKIPPED: {{ components_skipped }}

TASK:
1. ONE-LINER (10-15 words): Confidence level + headline reason.
   Examples:
   - "High — Org excel + role classification + reports_to all clean."
   - "Medium — role classification 70%; FT2-by-role skipped."
   - "Low — Org excel incomplete; HS1/HS2 skipped."
2. DETAILED EXPLANATION (2-3 sentences).
3. REMEDIATION ACTIONS (if confidence < high):
   - Concrete actions to improve confidence
   - Expected impact

CONSTRAINTS:
- Honest about gaps — don't gloss.
- Use universal vocabulary (high / medium / low).
- For consultant audience.
- Reference Stage 6 consultant validation if relevant (e.g., reports_to uplift via Stage 6).

Output strict JSON.
```

**Notes:** Temperature 0.2 (deterministic); max output tokens 400.

---

# Engineering Notes

## Prompt versioning
Same pattern as Op Model prompts.md.

## Retrieval
Same loading + selection logic — filter by `production` status, match by ID, render template with input variables.

## JSON output validation
Same validation rules. Critical: validate "no ₹ savings" in output text — if AI accidentally includes ₹ quantification (e.g., "estimated savings ₹X Cr"), flag as boundary violation + reject output.

## Citations
All claims must trace to inputs:
- Numbers cited appear in inputs
- Patterns cited match `rca-patterns.md` IDs
- Recommendations cited match `recommendations.md` IDs
- For Theme 1 OP3: industry pattern % must appear in industry overlay file

Citation failure flags low-defensibility output for consultant review.
