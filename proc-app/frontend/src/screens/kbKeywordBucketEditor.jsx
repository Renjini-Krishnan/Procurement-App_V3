/* Keyword bucket editor — for po-type-derivation-rules.yml + designation-tier-seed.yml +
   industry filter files. These all share the shape "named lists of strings under buckets". */

import React, { useEffect, useState } from "react";
import yaml from "js-yaml";
import { Card } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, TextAreaField, TagList,
  ParseErrorBanner, CheckboxField,
} from "./kbEditorPrimitives.jsx";

const KeywordBucketEditor = ({ yamlText, onChange, fileHint }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    try { setData(yaml.load(yamlText) || {}); setParseError(null); }
    catch (e) { setParseError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propagate = (next) => {
    setData(next);
    try { onChange(yaml.dump(next, { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' })); }
    catch (e) { setParseError(e.message); }
  };

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

  // Intro varies by file
  const intro = INTROS[fileHint] || INTROS.default;

  const update = (key, val) => propagate({ ...data, [key]: val });
  const updateNested = (parent, key, val) => propagate({
    ...data, [parent]: { ...(data[parent] || {}), [key]: val },
  });

  return (
    <div>
      <EditorIntro {...intro} />

      {/* Render top-level scalar fields first */}
      {Object.entries(data)
        .filter(([k, v]) => k !== "metadata" && !isComplex(v))
        .map(([k, v]) => (
          <Card key={k} padding={14} style={{ marginBottom: 10 }}>
            <Field fieldKey={k} value={v} onChange={(nv) => update(k, nv)} />
          </Card>
        ))}

      {/* Render top-level lists */}
      {Object.entries(data)
        .filter(([k, v]) => k !== "metadata" && Array.isArray(v))
        .map(([k, v]) => {
          const allStrings = v.every((x) => typeof x === "string");
          if (allStrings) {
            return (
              <Card key={k} padding={14} style={{ marginBottom: 10 }}>
                <TagList label={k}
                            hint={hintFor(fileHint, k)}
                            values={v} onChange={(nv) => update(k, nv)} />
              </Card>
            );
          }
          // List of objects — render each as a card
          return (
            <Card key={k} padding={14} style={{ marginBottom: 10 }}>
              <Label>{k}</Label>
              <div style={{ marginTop: 8 }}>
                {v.map((item, idx) => (
                  <ObjectItem key={idx} item={item}
                                onChange={(nv) => {
                                  const arr = [...v]; arr[idx] = nv; update(k, arr);
                                }}
                                onDelete={() => update(k, v.filter((_, i) => i !== idx))} />
                ))}
                <button onClick={() => update(k, [...v, {}])}
                         style={{ marginTop: 6, padding: "6px 12px", fontSize: "var(--fs-12)",
                                    background: "var(--brand-50)", color: "var(--brand-700)",
                                    border: "1px solid var(--brand-500)", borderRadius: "var(--r-md)",
                                    cursor: "pointer", fontWeight: 600 }}>
                  + Add to {k}
                </button>
              </div>
            </Card>
          );
        })}

      {/* Render top-level dicts of lists (most common shape: type_keywords: {capex: [...], opex: [...]}) */}
      {Object.entries(data)
        .filter(([k, v]) => k !== "metadata" && v && typeof v === "object" && !Array.isArray(v))
        .map(([k, v]) => (
          <Card key={k} padding={14} style={{ marginBottom: 10 }}>
            <Label hint={hintFor(fileHint, k)}>{k}</Label>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {Object.entries(v).map(([sub, subVal]) => {
                if (Array.isArray(subVal) && subVal.every((x) => typeof x === "string")) {
                  return (
                    <div key={sub} style={{ padding: 10, background: "var(--surface-sunk)",
                                                 borderRadius: "var(--r-md)" }}>
                      <TagList label={sub}
                                  values={subVal}
                                  onChange={(nv) => updateNested(k, sub, nv)} />
                    </div>
                  );
                }
                return (
                  <ScalarField key={sub} fieldKey={sub} value={subVal}
                                 onChange={(nv) => updateNested(k, sub, nv)} />
                );
              })}
            </div>
          </Card>
        ))}
    </div>
  );
};


const ObjectItem = ({ item, onChange, onDelete }) => (
  <div style={{ padding: 10, marginBottom: 6, background: "var(--surface-sunk)",
                  borderRadius: "var(--r-md)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {Object.entries(item).map(([k, v]) => (
          <ScalarField key={k} fieldKey={k} value={v}
                         onChange={(nv) => onChange({ ...item, [k]: nv })} />
        ))}
      </div>
      <button onClick={onDelete}
               style={{ background: "transparent", color: "var(--danger-700)",
                          border: "1px solid var(--danger-500)", borderRadius: "var(--r-md)",
                          padding: "4px 10px", fontSize: "var(--fs-12)", cursor: "pointer",
                          fontWeight: 600 }}>×</button>
    </div>
  </div>
);


const Field = ({ fieldKey, value, onChange }) => {
  if (typeof value === "boolean") return <CheckboxField label={fieldKey} value={value} onChange={onChange} />;
  if (typeof value === "number") return <TextField label={fieldKey} type="number" value={value} onChange={onChange} />;
  if (typeof value === "string") {
    if (value.length > 80) return <TextAreaField label={fieldKey} value={value} onChange={onChange} rows={3} />;
    return <TextField label={fieldKey} value={value} onChange={onChange} />;
  }
  return null;
};
const ScalarField = Field;


const isComplex = (v) => typeof v === "object" && v !== null;


const INTROS = {
  default: {
    title: "Keyword / threshold seed",
    what: <span>Edit string lists, numeric thresholds, and named buckets used by the engine for deterministic classification + tagging.</span>,
    why: "These seeds drive a layer of the engine's signal processing — typically Tier C (text keywords), Tier D (vendor anchors), or value thresholds. Adding to a list means the engine recognises more variants; tightening a threshold means fewer rows trip the rule.",
    when: "A client uses category terminology not yet in the bucket · adjusting threshold values after seeing false positives in engagement data",
    exampleEdits: ["Add 'kiln liner' to capex keywords", "Move a designation pattern from Tier 2 to Tier 3"],
  },
  "po-type-derivation-rules.yml": {
    title: "PO type derivation — keyword buckets",
    what: <span>Buckets of keywords that derive a PO's <strong>po_type_inferred</strong> column at Stage 8 (Gold). The engine substring-matches each row's <code>material_group_desc</code> against the keyword lists in order (capex first, then services, then opex), takes the first hit. PAC + emergency keywords flag the corresponding boolean columns.</span>,
    why: "The Gold-layer enrichment + downstream pillar analyses (DoA tier breach attribution, Op Model capex vs opex split) all read po_type_inferred. Adding 'AMC' to services keywords means more rows correctly classify as service spend; adding 'capital project' to capex helps the capex flag fire on civil works.",
    when: "Client has industry-specific terminology · false-positive in classification (e.g. 'breakdown maintenance' wrongly classified emergency) · new spend pattern observed",
    exampleEdits: [
      'Add "annual maintenance contract" to type_keywords.services',
      'Move "kiln" from capex to opex if client treats kiln consumables as opex',
      "Raise capex_min_value_inr from 5000000 → 10000000 for a larger client",
    ],
  },
  "designation-tier-seed.yml": {
    title: "Approver designation → tier mapping",
    what: <span>Regex patterns that map a PO's <strong>po_approver_designation</strong> string to a tier number 1-5. The engine matches case-insensitively, first-pattern-wins. Tier 1 = officer/buyer; Tier 5 = CXO / board. Used by Gold enrichment + DoA pillar's tier-breach detection.</span>,
    why: "DoA scoring depends on knowing the seniority of who approved each PO. A bad mapping (e.g. 'AGM' classified as Tier 1) drastically skews tier-breach counts. Client-specific titles must be added for accurate breach detection.",
    when: "Client uses non-standard titles (e.g. 'Functional Head', 'Vertical Lead') · onboarding from a new ERP with different designation strings · adding a custom designation hierarchy",
    exampleEdits: [
      "Add 'Functional Head' to Tier 4 patterns",
      "Move 'Lead Buyer' from Tier 1 to Tier 2 for a specific client",
      "Add canonical_overrides entry for an ambiguous title",
    ],
  },
  "archetype-overrides.yml": {
    title: "Industry archetype overrides — keyword refinements",
    what: <span>Industry-specific extensions to the universal archetype keyword banks (BULK / DIRECT / INDIRECT / SERVICE / CAPEX). Used in addition to the function-default keywords by Stage 9's archetype classifier.</span>,
    why: "Steel and cement industries have different category vocabularies. Without industry overrides, generic keyword lists miss industry-specific terms (e.g. 'sinter feed' in steel BULK, 'clinker' in cement BULK).",
    when: "Adding industry-typical raw materials · refining archetype assignment for industry edge cases",
    exampleEdits: [
      "Add 'sinter feed' to BULK for steel",
      "Add 'pet coke' to BULK for cement",
      "Move 'mill scale' from BULK to DIRECT",
    ],
  },
  "centralisation-filters.yml": {
    title: "Industry-specific centralisation filters",
    what: <span>Filter thresholds + plant codes for the Op Model centralisation theme. Industry overlay narrows the global filters to industry-typical values.</span>,
    why: "Steel mills have plant structures that need industry-specific thresholds (e.g. central buying typically covers raw materials but not plant spares).",
    when: "Refining what counts as 'centralised' for an industry · adjusting the candidate-category threshold",
  },
};

const hintFor = (file, key) => {
  // Per-file-key fine-grained hints
  if (file === "po-type-derivation-rules.yml") {
    if (key === "type_keywords") return "3 buckets — capex, services, opex. Engine matches in this order, takes the first hit per row.";
    if (key === "emergency_keywords") return "Substrings in short_text that flag the row as is_emergency=true";
    if (key === "pac_keywords") return "Substrings in short_text that flag is_pac=true";
    if (key === "capex_min_value_inr") return "If a row matches opex/services keywords but exceeds this value, bump to capex";
  }
  if (file === "designation-tier-seed.yml") {
    if (key === "designation_patterns") return "List of {pattern, tier} pairs. Patterns are case-insensitive regex; first match wins.";
    if (key === "canonical_overrides") return "Exact-match designation → tier dictionary; checked before regex patterns.";
    if (key === "tier_definitions") return "Tier 1-5 with name + typical authority cap (informational, not enforced)";
  }
  return null;
};

export default KeywordBucketEditor;
