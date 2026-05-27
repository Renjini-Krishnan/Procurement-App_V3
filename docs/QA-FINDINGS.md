# QA Findings — Op Model + Org Structure KB Extraction

**Run date:** 2026-05-27
**Files audited:** 36 (13 Op Model function-default + 5 Op Model Steel overlay + 13 Org Structure function-default + 5 Org Structure Steel overlay)

## TL;DR

- **20 of 20 Markdown files** came through the docx → disk extraction **clean**. No HTML-entity leftovers, no stray bundle delimiters, no broken frontmatter, no unbalanced code fences.
- **16 of 16 YAML files** have **systemic indent corruption** introduced when the originals were copy-pasted into Word to produce the `.docx` bundles. All 16 fail YAML parse.
- The corruption is **not file-specific** — it's the same Word-induced pattern across every YAML: sub-properties under list items and block scalars (`|`) lost their indent (typically 4 spaces). The pattern is also **inconsistent within files** — some list items came through with correct child indent, others did not. This rules out a clean uniform `+4` fix.

## Evidence (representative samples)

### `proc-app/kb/functions/procurement/op-model/benchmarks.yml`

Lines around 56-65 — second list item's children lost indent that the first item's children kept:
```yaml
benchmarks:
  - id: opmodel.centralisation.savings_rate
    name: "..."
    ...
    layer: function          # col 4 — CORRECT
    edit_risk: high          # col 4 — CORRECT

  - id: opmodel.centralisation.centre_led_savings_rate
name: "Centre-Led Savings Rate (Combined)"   # col 0 — should be col 4
description: |                                # col 0 — should be col 4
  Single rolled-up % applied when ...         # col 2 — should be col 6
```

### `proc-app/kb/functions/procurement/op-model/analysis-config.yml`

Block scalar (`|`) content lost indent — line 26:
```yaml
pillar:
  id: op-model
  display_name: "Operating Model"
  scope_note: |
"How procurement is organised to BUY — ..."   # col 0 — should be col 4
CoE + Tail Spend. Captive excluded..."         # col 0 — should be col 4
  run_order: 12
```

### `proc-app/kb/functions/procurement/op-model/scoring-descriptors.yml`

Inconsistent within a single block — line 30-36:
```yaml
  - level: 1
label: "Initial"                          # col 0 — should be col 4
signals:                                  # col 0 — should be col 4
  spend_central_pct_band: "< 30%"         # col 2 — should be col 6
      c1_candidate_categories_addressable_pct_band: "> 60%"   # col 6 — CORRECT(!)
  c2_vendor_overlap_band: "< 30%"         # col 2 — should be col 6
narrative: "Procurement plant-distributed..." # col 0 — should be col 4
```

This file shows the **inconsistency clearly**: line 34 has correct col-6 indent while its siblings (lines 33, 35, 36) are at col 2 or 0. Word's per-paragraph formatting was applied unevenly.

## Why heuristic fixing is risky

Tried a `+4 everywhere except L1 markers` heuristic against the master tracker first; **it doesn't survive nested lists or block scalars**. Concrete failure modes:

1. **Nested list-items**: `qre_questions_used: [- id: Q-OM-01, - id: Q-OM-02]` — the inner `- id:` matches the outer "level-1 marker" regex
2. **Block scalars (`|`)**: content lines need indent matching the scalar's parent, not the list item's children pattern
3. **Mid-block inconsistency**: file might have ~70% lines at correct indent and ~30% wrong — automatic fix can't tell which is which

A subtly-wrong YAML (a property attached to the wrong list item) would compile but encode wrong engine relationships. Better to refuse and re-acquire than ship subtly broken data.

## Markdown files — clean

All 20 MD files pass:
- ✅ No HTML entities (`&quot;`, `&lt;`, `&gt;`, etc.)
- ✅ No stray bundle delimiters (`FILE:`, `END OF FILE`)
- ✅ Frontmatter present and balanced
- ✅ Code fences balanced
- ✅ No suspicious leading-space patterns

Spot-checked 3 of the 20 (`centralization.md`, `fte-sizing-role-composition.md`, `analysis-framework.md`) — content reads coherently end-to-end.

## Recommendation

**Re-acquire the YAML files from a clean source rather than heuristic repair.** Options in priority order:

1. **Best:** the user has direct access to the original repo (`shared-kb/` + `proc-app/`) from the prior account — copy files over via Git
2. **Good:** the user can paste each YAML's content directly (one at a time) into chat as raw text — bypasses Word entirely
3. **Acceptable fallback:** re-author each YAML from its sibling MD file (the deep-dive MD has the same data in narrative form; YAML is the structured restatement). Slow (~1-2 hours per pillar) but produces guaranteed-valid YAML
4. **Not recommended:** heuristic repair — subtle errors will surface as engine bugs later

## Affected files (16)

```
proc-app/kb/functions/procurement/op-model/
  analysis-config.yml
  benchmarks.yml
  rca-rules.yml
  scoring-descriptors.yml

proc-app/kb/functions/procurement/org-structure/
  analysis-config.yml
  benchmarks.yml
  rca-rules.yml
  scoring-descriptors.yml

shared-kb/industries/steel/by-function/procurement/op-model/
  benchmarks.yml
  centralisation-filters.yml
  coe-filters.yml
  shared-services-filters.yml
  tail-spend-filters.yml

shared-kb/industries/steel/by-function/procurement/org-structure/
  benchmarks.yml
  fte-sizing-role-composition-filters.yml
  organisation-posture-filters.yml
```

(Note: `hierarchy-span-filters.yml` and `spend-fte-distribution-filters.yml` were not flagged by parser, may have been small enough to escape corruption. Worth spot-checking content.)

## Knock-on effects

- **Cross-reference integrity check** (planned task #3) is blocked until YAMLs parse — most cross-refs target benchmark IDs in `benchmarks.yml`
- **QRE bank consolidation** (planned task #4) — partially viable: source data lives in the tracker, which is itself broken but readable as text. Can extract manually.
- **Engine cannot run** against current YAMLs — but engine doesn't exist yet, so not blocking
- **MD content is fully usable** for any task that reads narrative content (e.g., feeding context to AI prompts, generating findings deck text)
