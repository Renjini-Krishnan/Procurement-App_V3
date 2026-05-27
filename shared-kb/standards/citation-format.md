---
id: citation-format
layer: universal
applies_to: all-functions-all-industries
version: 1.0
updated: 2026-05-25
owner: kb-admin
---

# Citation Format — Universal Standard

This document defines HOW every source citation displays across the entire app: in the in-app analysis pages, findings decks, exec summaries, PDF reports, dashboards, and audit logs.

The goal: a single, consistent citation pattern that consultants and clients can trust at a glance, with full traceability to the underlying source.

---

## The Canonical Citation Pattern

Every citation must contain four required parts. A fifth (layer indicator) appears when relevant.

| Part | Required? | What it is | Example |
|---|---|---|---|
| **Source name** | Required | The short canonical name of the source (must match an entry in `sources-library.yml`) | APQC, Hackett, World Cement Assn |
| **Year of publication** | Required | Year the data was published or last refreshed | 2024 |
| **Specific reference** | Required | Page / section / dataset version that supports the cited value | p47, §3.2, "Q2 2024 dataset" |
| **Confidence level** | Required | One of: high / medium / low (see Confidence Scale below) | confidence: high |
| **Layer indicator** | Optional — shown only when the value is overridden by an industry or engagement overlay | Indicates which cascade layer this citation belongs to | Cement industry override / Engagement override |

### Display format

**Standard citation (function-default value):**
```
[APQC 2024, p47, confidence: high]
```

**Industry-overlay citation (value overrides function default):**
```
[World Cement Assn 2024, Annual Report §3.2, confidence: high — Cement industry override]
```

**Engagement-override citation (value overrides industry for this engagement only):**
```
[Internal engagement decision, 2026-05-25, confidence: medium — Engagement override; see note from <consultant>]
```

**Multi-source citation (when value is supported by more than one source):**
```
[APQC 2024, p47 + Hackett 2023, §2.1, confidence: high]
```

---

## Confidence Scale

| Level | When to use | Visual cue |
|---|---|---|
| **high** | Reputed source (APQC, Hackett, Gartner, industry association); recent (≤ 2 years); large sample size; methodology disclosed | Solid colour, no qualifier shown |
| **medium** | Reputed source but older (3–5 years); OR newer source with smaller sample; OR aggregated from multiple lower-confidence sources | Solid colour with a small "medium" tag |
| **low** | Single anecdotal source; opinion-based; >5 years old; methodology unclear; OR estimate based on adjacent data | Faded colour with "low confidence — directional only" caveat shown |

The app must NOT use values from `low` confidence sources without showing the caveat to the consultant.

---

## Where Citations Appear

| Location | How citations display |
|---|---|
| **In-app analysis page (per benchmark)** | Citation block appears directly below the value, with a click-through to the Sources Library entry |
| **Hover tooltip** | Compact form: `[Source 2024, p47, conf: high]`. Click expands to full source card. |
| **Findings deck (PPT)** | Footnote at the bottom of each slide listing all cited sources for that slide |
| **Exec Summary deck (PPT)** | Aggregated "Sources" appendix slide at the end; in-line citations on each finding slide use the compact form |
| **Detailed PDF Report** | Full citation displayed inline; a Sources Bibliography section at the end consolidates all citations |
| **KPI Dashboard** | Click the (i) icon on any KPI tile to see citation popup |
| **Audit log entry** | All sources used by that analysis logged with timestamp |
| **Engagement export** | Sources used for that engagement listed in the export bundle for client traceability |

---

## Citation Hierarchy in the Cascade

When a value passes through the cascade (Function → Industry → Engagement), the citation shows the LAYER THAT WON, but ALSO references the lower layers for transparency.

Example: Cement client analysis, Op Model centralization benchmark.

- Function default: 70% [APQC 2024, p47, confidence: high]
- Cement industry overlay: 80% [World Cement Assn 2024, §3.2, confidence: high]
- This engagement override: 75% [Renjini, 2026-05-25 — single-plant client, smaller commonality, confidence: medium]

**The app displays:**

> **Centralization benchmark used: 75%**
> Source: [Internal engagement decision, 2026-05-25, confidence: medium — Engagement override]
> Cement industry reference: [World Cement Assn 2024, §3.2, confidence: high] (80%)
> Function-default reference: [APQC 2024, p47, confidence: high] (70%)

---

## Citation Linking to Sources Library

Every source name in a citation MUST resolve to an entry in `shared-kb/references/sources-library.yml`. The library entry contains:
- Full source name and publisher
- URL / DOI / access path
- License terms
- Refresh cadence
- Applicable industries / functions

The app validates this at PR time via schema check. Citations referencing a source not in the library will fail validation.

---

## Edits to Citations

A KB editor changing a benchmark value is also responsible for:
1. Confirming the source still supports the new value
2. Updating the citation if the source has changed
3. Adjusting the confidence level if the source quality has changed

Submitting a benchmark edit without confirming the citation is a form-validation error in the KB Editor UI.

---

## Citation Style Rules

- Always English, sentence case
- Year displayed as 4-digit (2024, not '24)
- No quote marks around source names
- Use `+` to join multiple sources, not "and" or commas
- Confidence is always lowercase (high / medium / low)
- Layer indicator phrases:
  - `Cement industry override` (capital Cement, lowercase rest)
  - `Engagement override`
  - `Function default` (only shown when explicitly contrasted)

---

## Schema Reference

```yaml
source:
  source_id: "APQC-2024"
  reference: "p47"
  confidence: high
  layer: function
  added_date: 2026-05-25
  added_by: kb-admin
```
