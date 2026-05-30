# Category Classification — Analysis Framework

**Purpose.** Assign every PO row (and through it, every material code and Material Group) to a single **canonical category** drawn from the industry taxonomy in `shared-kb/industries/<industry>/categories-master.yml`. The canonical assignment is the foundation every downstream procurement pillar reads — Spend Cube, Vendor 360, Sourcing Strategy, Buying Channel Strategy, Should-Cost, Demand Aggregation, Tail-Spend Management.

**Scope.** This document defines the classification methodology only — the engine, the signals it reads, and the outputs it produces. It does NOT define:
- The taxonomy content itself (that lives in `categories-master.yml`).
- Buying-channel decisions (spot / RFQ / contract / blanket / partnership) — these are computed downstream by the Buying Channel Strategy pillar, which reads the canonical assignment produced here.
- The consultant review UI in detail (separate UX spec).

---

## 1. Foundational principles

The methodology is grounded in five principles, each a direct response to observed Material Master pathologies in real client engagements.

1. **No field is ground truth.** MATKL — the field nominally designed to classify — is weakest exactly where classification is most needed (MISC catch-alls, blank values, generic "RAW MATERIAL"-style entries). Every Material Master field must be treated as a *weak signal*.
2. **Combine signals; never depend on one.** Material Description, Material Long Text, PO Short Text, Material Type (MTART), HSN/SAC, Vendor, G/L Account, Account Assignment Category together carry classification signal. Each fills the others' gaps.
3. **Classify at the transaction (PO row) level, then roll up to MG.** Many Material Master fields are stale; the PO carries fresher reality (especially PO Short Text and Vendor). MG-level mapping is *inferred* from row-level decisions, not assumed.
4. **External anchors over internal codes wherever possible.** HSN codes, vendor specialisation (learned and seeded), recognised brand names — these are stable across clients and engagements. Internal MGs are client-specific and dirty.
5. **The catch-all is the priority, not the exception.** "MISC" / blank-MATKL POs are typically the *largest* bucket by row count. The methodology explicitly targets these with row-level classification rather than tolerating them as residual.

A sixth, derived principle: **separate WHAT-signals from HOW-signals.** Frequency, value distribution, lead time, vendor concentration, PSTYP=B/K — these describe *how* something is bought (channel strategy). They MUST NOT feed the classifier. They are consumed downstream once classification is complete.

---

## 2. Inputs — fields the engine reads

### 2.1 Classification inputs (this engine reads these)

| Field (SAP) | Source | Role in classifier |
|---|---|---|
| Material Description (MAKTX) | Material Master | Primary short-text signal |
| Material Long Text (MAKT) | Material Master | High-quality full-spec text where populated |
| PO Short Text | PO line | Fresher text; only text source for service POs |
| Material Type (MTART) | Material Master | Partition: ROH / HALB / FERT / ERSA / HIBE / DIEN / ANLA / VERP — narrows candidate canonicals to the right taxonomy section |
| Material Group (MATKL) | Material Master | Direct hook to canonical when clean; ignored when catch-all / blank / generic |
| HSN / SAC Code | Material Master / PO line | External taxonomy anchor — strongest non-text signal when populated |
| Vendor Name (NAME1) | Vendor Master | Specialisation signal |
| Account Assignment Category (KNTTP) | PO line | K=cost-centre / P=project / A=asset / F=order — separates capex / services from goods |
| G/L Account (HKONT / SAKNR) | PO line | Real category signal for services and cost-centre POs |
| Item Category (PSTYP) | PO line | D=service / L=subcontracting are taxonomical; B=limit / K=blanket are excluded (channel-only) |

### 2.2 Analysis inputs (downstream pillars read these — NOT used by classifier)

| Field | Used by |
|---|---|
| Vendor Code + Name | Spend Cube, Vendor 360, vendor concentration |
| Plant (WERKS) | Spend Cube, Demand Aggregation, cross-plant pooling |
| Quantity (MENGE) + UoM (MEINS) | Should-Cost, rate normalisation, volume pooling |
| Net Value (NETWR) + Currency (WAERS) | All value-based analyses |
| Document Date (BEDAT) | Trends, frequency, seasonality |
| Planned Delivery Time | Buying Channel Strategy |
| Procurement Type (BESKZ) | Make-vs-Buy split |
| Special Procurement Type (SOBSL) | Subcontracting / consignment identification |
| Derived: PO count, value distribution, PSTYP distribution per canonical | Buying Channel Strategy |

### 2.3 Explicitly excluded from the classifier

- Purchase **frequency** / recurrence pattern
- PO **value size**, total spend size
- **Lead time**, payment terms
- **PSTYP = B (limit) / K (blanket)** — channel-only signals
- **Number of distinct vendors** per category — concentration is channel, not WHAT
- Captive vs market-open vendor flag — channel attribute

These are channel-strategy inputs and are consumed exclusively by the downstream Buying Channel Strategy pillar.

---

## 3. The methodology — five steps

### Step 1 — Partition by MTART (free pre-filter)

MTART is reliable enough across most clients to use as a partition. It collapses the candidate canonical pool before any expensive matching runs.

| MTART | Candidate section |
|---|---|
| ROH | Raw materials only |
| HALB / FERT | Intermediates / finished (rare on procurement side) |
| ERSA | Spares only |
| HIBE | Operating supplies (lubricants, gases, consumables) |
| DIEN | Services only |
| ANLA | Capital items only |
| VERP | Packaging only |
| UNBW / blank / unknown | All sections — fall through to full search |

For ~70-80% of rows this single partition reduces the candidate set 5-10×.

### Step 2 — Tiered classification within the partition

Each row passes through tiers in order. The engine **accumulates signals** rather than short-circuiting on the first hit — this enables corroboration and conflict detection. Final canonical is chosen by aggregating tier weights.

| Tier | Signal | What it does | Confidence |
|---|---|---|---|
| **A. HSN/SAC lookup** | HSN code → canonical map (seeded in `categories-master.yml`, supplemented per engagement) | Direct external-taxonomy hit | HIGH when present |
| **B. Clean-MG lookup** | If row's MATKL is in the engagement's MG→canonical map AND that map entry was Tier-A/B confirmed → reuse | Reuses already-validated MG decisions | HIGH (inherited) |
| **C. Text match** | Stem-aware keyword + synonym match against (MAKTX + MAKT + PO Short Text) against the canonical entries in the partition | Primary content classifier | MEDIUM–HIGH on multi-keyword hit |
| **D. Vendor anchor** | Vendor in canonical's `vendor_specialisation_examples` OR learned vendor→canonical map | Strong long-tail signal | MEDIUM; HIGH when corroborated by Tier C |
| **E. G/L anchor (services + cost-centre POs)** | For KNTTP=K rows OR MTART=DIEN: look up G/L account in engagement's GL→canonical map | The category signal for services lives here | MEDIUM–HIGH |
| **F. LLM fallback** | LLM sees the row + top-3 candidate canonicals (from accumulated tier signals) with their full YAML entries | Resolves ties; classifies the long tail | LOW (LLM-only); MEDIUM if upstream signal corroborates |
| **(none)** | All tiers failed | UNCLASSIFIED → review queue | — |

Notes:
- Tier A is *outright winning* when present — direct external taxonomy match.
- Tiers B-E accumulate evidence; the winning canonical is the one with the highest aggregated tier weight.
- Tier F runs only when (a) no Tier A/B hit AND top candidate's accumulated weight is below threshold, OR (b) two candidates are tied within threshold.
- **PSTYP = D and MTART = DIEN ARE used** (taxonomical: this is a service). PSTYP = B / K are excluded (channel-only).

### Step 3 — Roll row decisions up to MG (where clean)

After all rows are classified:
- For each MATKL value, count canonical assignments across its rows.
- If ≥95% of rows in this MG land on one canonical → mark MG **clean**, record MG→canonical map.
- If <95% → mark MG **mixed**, keep row-level decisions only.

Output is dual-layer:
- **MG→canonical map** for clean MGs (small set, fast lookup; reused for future PO drops in the same engagement).
- **Row-level exceptions** for mixed MGs and for MISC / blank buckets (where every row was classified independently anyway).

This is what makes the approach work for both clean-master and messy-master clients without changing the engine.

### Step 4 — Consultant review

Review-by-tier minimises consultant time:
- **HIGH-confidence rows / clean MGs**: bulk-accept by tier with one click; spot-audit a sample.
- **MEDIUM-confidence rows**: review per row or per MG with autocomplete dropdown of canonicals.
- **LOW / UNCLASSIFIED rows**: manual classification, with the engine's signal trace visible (so the consultant sees *why* the engine couldn't classify).

Every override writes to:
- `engagements/<client>/kb-overrides/categories-master.yml` — new synonyms, keywords, HSN codes, vendor anchors discovered.
- `engagements/<client>/learned/gl-to-canonical.yml` — GL→canonical map built from consultant decisions on service POs.
- `engagements/<client>/learned/vendor-to-canonical.yml` — vendor specialisation map.

These three files form the **engagement layer** of the KB cascade — they refine the industry-layer defaults for this specific client.

### Step 5 — Outputs

Per PO row:
```yaml
po_line: <po_number>/<line>
canonical_id: <id>
confidence_tier: HIGH | MEDIUM | LOW | UNCLASSIFIED
signal_trace:
  - tier: <A-F>
    signal: <description>
    weight: primary | corroboration
```

Engagement artefacts:
- **MG→canonical map** (clean MGs) — for reuse on subsequent PO drops.
- **Vendor→canonical map** (learned specialisations) — supplements seed list.
- **GL→canonical map** (built from service-PO classifications) — client-specific, since COA varies.
- **Synonym / abbreviation additions** — client-specific terms encountered.

On the next PO drop or next engagement phase, only NEW codes / vendors / GLs need classification. The engine becomes progressively cheaper and more accurate within an engagement.

---

## 4. Confidence tiering

| Tier | Definition |
|---|---|
| **HIGH** | Tier A hit, OR (Tier C + at least one of D/E corroborate on the same canonical) |
| **MEDIUM** | Tier C OR Tier D OR Tier E alone, no corroboration |
| **LOW** | Tier F LLM-only, no upstream signal |
| **UNCLASSIFIED** | Tier F returns null; routes to consultant review queue |

Thresholds (HIGH/MEDIUM cutoffs) are configurable per engagement and will be calibrated against real classification accuracy as engagement data accumulates.

---

## 5. Worked example

### Input row

| Field | Value |
|---|---|
| PO Number / Line | 4500123456 / 10 |
| Plant | 1000 (Jamshedpur) |
| Material Number | M-00892341 |
| MAKTX | `BRG 6205-2RS SKF` |
| MAKT (long text) | `Ball bearing, deep groove, 25mm bore, sealed both sides, for rolling mill auxiliary drive motor` |
| MATKL | `MISC-MECH` ← catch-all |
| MTART | `ERSA` |
| HSN | `8482` |
| Vendor | 100234 — `PUNE BEARINGS PVT LTD` |
| PO Short Text | `BEARING 6205 - URGENT FOR MILL #3` |
| KNTTP | `K` |
| G/L | `5403001 — Maintenance Stores` |

### Tier walkthrough

**Step 1 — MTART partition.** `MTART = ERSA` → Spares section. Candidate pool: ~15 canonicals (was ~110).

**Tier A — HSN lookup.** HSN `8482` → `bearings_anti_friction`. **DIRECT HIT — HIGH.**

**Tier B — Clean-MG lookup.** `MISC-MECH` flagged as catch-all. Skip.

**Tier C — Text match** against MAKTX + MAKT + PO Short Text, restricted to spares section:
- MAKTX `BRG 6205-2RS SKF` → "BRG" (synonym) → `bearings_anti_friction`.
- MAKT `deep groove ball bearing ... rolling mill auxiliary drive motor` → "ball bearing" + "deep groove" → `bearings_anti_friction`.
- PO Short Text `BEARING 6205` → "BEARING" → `bearings_anti_friction`.

All three converge. **Strong corroboration.**

**Tier D — Vendor anchor.** Vendor name `PUNE BEARINGS PVT LTD` contains "BEARINGS" → `bearings_anti_friction`. Engagement KB records `vendor 100234 → bearings_anti_friction` for future reuse. **Corroborates.**

**Tier E — G/L anchor.** G/L `5403001 — Maintenance Stores` → broad MRO bucket. Consistent with `bearings_anti_friction`. **Neutral, no conflict.**

**Tier F — LLM fallback.** Not invoked. Tier A is HIGH with strong corroboration.

### Output

```yaml
po_line: 4500123456/10
canonical_id: bearings_anti_friction
confidence_tier: HIGH
signal_trace:
  - tier: A
    signal: "HSN 8482 → bearings_anti_friction"
    weight: primary
  - tier: C
    signal: "MAKT match: 'deep groove ball bearing'"
    weight: corroboration
  - tier: C
    signal: "MAKTX match: 'BRG' (synonym)"
    weight: corroboration
  - tier: C
    signal: "PO Short Text match: 'BEARING'"
    weight: corroboration
  - tier: D
    signal: "Vendor name contains 'BEARINGS'"
    weight: corroboration
```

### Variations

**Variation 1 — Same vendor's next PO.** Tier D fires from the *learned* vendor map (recorded above), reducing classifier work to a constant-time lookup.

**Variation 2 — Genuinely unclassifiable row.** MAKTX = "MISC ITEM AS PER SPEC", MAKT blank, HSN blank, vendor is a non-specialist trading house, PO Short Text references an external indent document. All tiers fail. Tier F LLM returns `UNCLASSIFIED` with reason. Row routes to consultant review queue.

**Variation 3 — Service PO with no useful Material Master.** MATKL blank, MTART = DIEN, no material code. PO Short Text "AMC for cooling towers", G/L "6201005 — AMC Mechanical", Vendor "Thermax Services". Tier C matches keywords ("AMC", "cooling tower"); Tier E learns G/L 6201005 → `amc_mechanical`; Tier D corroborates via vendor specialisation. HIGH on `amc_mechanical` from C + E + D — none of which required Material Master content.

---

## 6. Failure-mode handling

| Failure mode | Methodology response |
|---|---|
| MATKL = blank | MTART partition + Tier C (text) + Tier D (vendor) classify the row directly. MG-level mapping skipped. |
| MISC / OTHERS / GENERAL catch-all | Every row classified independently via Tiers C-F. MG marked "mixed", no MG-level rollup. The largest problem bucket gets the most engine attention. |
| Duplicate MGs ("BEARING" + "BEARINGS" + "BEARING-MECH") | All map to the same canonical via Tier C; many-to-one canonicalisation is automatic. |
| Generic MG, specific material code | Tier C reads the description from the material code, not the MG. |
| Specific MG, generic material code | Tier B (clean-MG lookup) catches it. |
| Services with no useful material master | MTART=DIEN OR KNTTP=K routes to Tier E (G/L anchor) + Tier C (PO Short Text). |
| Plant-specific MG drift | Each plant's MGs classified independently; all roll up to the same canonical. Cross-plant aggregation works at the canonical layer. |
| Abbreviations / spelling / synonyms | Tier C uses stem-aware matching + canonical synonyms + engagement-learned synonyms. |
| Capex booked as opex | MTART=ANLA OR KNTTP=A routes to capex section; account assignment overrides description noise. |
| Subcontracting / job-work blurring | SOBSL or PSTYP=L signal routes to a "subcontracting services" branch of the taxonomy. |
| Legacy migration codes ("M001-XXX-99") | Treated as missing — engine falls through to text + vendor + GL signals. |

---

## 7. KB cascade — how `categories-master.yml` is resolved at runtime

The classifier reads canonical definitions through the three-layer cascade defined in the broader KB architecture:

1. **Function default** (`proc-app/kb/functions/procurement/categories-master.yml` — Build 2+, currently empty).
2. **Industry overlay** (`shared-kb/industries/<industry>/categories-master.yml` — the primary source today for Steel).
3. **Engagement override** (`engagements/<client>/kb-overrides/categories-master.yml` — accumulated during the engagement).

Merge semantics per field type:
- **Identifier** (`id`): must match — join key across layers.
- **Scalars** (`label`, `archetype`, `direct_indirect`, `notes`): higher layer wins; lower preserved for citation.
- **Lists** (`keywords`, `synonyms`, `hsn_codes`, `vendor_specialisation_examples`, `sap_signals.*`): union across layers.
- **New canonicals** (`id` exists only at a higher layer): addition, visible from that layer downward.

Every classification result preserves a winning-layer trace per attribute, enabling full audit of why a row was classified the way it was.

---

## 8. What the engine produces vs what downstream consumes

| Produced by Stage 9 | Consumed downstream |
|---|---|
| `canonical_id` per PO row | All pillars |
| `confidence_tier` + `signal_trace` per PO row | Audit + consultant review |
| MG → canonical map (clean MGs) | Reused on subsequent PO drops |
| Vendor → canonical learned map | Vendor 360, Sourcing Strategy |
| GL → canonical learned map | Services analysis, P&L allocation |
| Engagement synonym / keyword additions | Future engagement re-runs |

Downstream pillars compute their own derived attributes from canonical-tagged data:
- **Buying Channel Strategy** computes frequency, value distribution, vendor concentration, PSTYP usage per canonical, and recommends spot / RFQ / contract / blanket / partnership.
- **Spend Cube** rolls canonical-tagged spend along (category × vendor × plant × time).
- **Vendor 360** aggregates vendor activity across canonicals.
- **Sourcing Strategy** applies category-specific levers per canonical.
- **Should-Cost** builds cost models per canonical.
- **Demand Aggregation** identifies cross-plant pooling opportunities per canonical.

Stage 9 does NOT decide any of these. It only assigns `canonical_id`.

---

## 9. Open items — to be calibrated against real engagement data

- **Threshold X% for MG cleanliness** (currently 95%) — tune against accuracy of MG-level rollup decisions.
- **Tier weights** for aggregating signals in Step 2 — tune against consultant override rates.
- **HIGH / MEDIUM / LOW confidence cutoffs** — tune against false-positive rate at each tier.
- **LLM prompt template** for Tier F — to be specified in a Stage 9 engine design document.
- **Consultant review UI** — to be specified in a Stage 9 UX document.
- **Engagement override file schema** — will mirror `categories-master.yml` schema; to be finalised when authoring the seed file.

---

## 10. Out of scope for this framework

- Taxonomy *content* (the actual canonicals) — lives in `shared-kb/industries/<industry>/categories-master.yml`.
- Buying-channel decisions — owned by Buying Channel Strategy pillar.
- Direct / Indirect / Capex archetype designation as a classification target — these are *attributes of the canonical*, not classification outcomes; consumed by downstream pillars for slicing.
- Column detection from raw client uploads — handled upstream in Stages 5-6 (AI Validation + User Validation).
