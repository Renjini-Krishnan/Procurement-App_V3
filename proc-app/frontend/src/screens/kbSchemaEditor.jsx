/* Schema editor — for the 9 canonical-column data templates:
   po.yml · pr.yml · vendor_master.yml · material_master.yml · org_structure.yml ·
   contract_master.yml · grn.yml · invoice.yml · qre.yml
*/

import React, { useEffect, useMemo, useState } from "react";
import yaml from "js-yaml";
import { Card, Button } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, SelectField, TextAreaField,
  CheckboxField, TagList, ItemCard, ParseErrorBanner,
} from "./kbEditorPrimitives.jsx";

const FIELD_TYPES = ["string", "number", "date", "boolean"];
const V1_STATUSES = ["consumed_in_v1", "captured_for_v2", "deprecated"];

const SchemaEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      setData(yaml.load(yamlText) || {});
      setParseError(null);
    } catch (e) {
      setParseError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propagate = (next) => {
    setData(next);
    try {
      onChange(yaml.dump(next, { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' }));
    } catch (e) {
      setParseError(`Could not serialize: ${e.message}`);
    }
  };

  // Hooks must run on every render. Keep useMemo above the early returns.
  const fields = data?.fields || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return fields.map((f, i) => ({ f, idx: i }));
    const q = search.toLowerCase();
    return fields
      .map((f, i) => ({ f, idx: i }))
      .filter(({ f }) =>
        (f.field || "").toLowerCase().includes(q) ||
        (f.description || "").toLowerCase().includes(q) ||
        ((f.aliases || []).join(" ").toLowerCase().includes(q)));
  }, [fields, search]);

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

  const updateField = (idx, patch) => {
    const next = { ...data, fields: fields.map((f, i) => i === idx ? { ...f, ...patch } : f) };
    propagate(next);
  };
  const addField = () => {
    const next = { ...data, fields: [...fields, { field: "new_field", required: false, type: "string", aliases: [], description: "" }] };
    propagate(next);
    setSelectedIdx(fields.length);
  };
  const deleteField = (idx) => {
    const next = { ...data, fields: fields.filter((_, i) => i !== idx) };
    propagate(next);
    if (selectedIdx >= next.fields.length) setSelectedIdx(Math.max(0, next.fields.length - 1));
  };
  const moveField = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = { ...data, fields: [...fields] };
    [next.fields[idx], next.fields[j]] = [next.fields[j], next.fields[idx]];
    propagate(next);
    setSelectedIdx(j);
  };

  const updateGuidelines = (patch) => propagate({
    ...data,
    guidelines: { ...(data.guidelines || {}), ...patch },
  });

  const selectedField = fields[selectedIdx];

  return (
    <div>
      <EditorIntro
        title={`Data schema · ${data.label || data.file_type || "file template"}`}
        what={
          <span>
            Defines the <strong>canonical column structure</strong> that the app expects when you upload
            a {data.file_type || "this"} file. Each field has a name (what the engine sees internally),
            aliases (raw header variants the auto-mapper will match), type, required flag, and a
            description shown in the upload UI.
          </span>
        }
        why="When a client's data has column names different from your defaults, add their headers as aliases here so they map automatically. Without this, every consultant manually re-maps the same columns over and over."
        when="A new client uses non-standard SAP exports or column names · adding fields the engine should know about · adjusting the required-field list"
        exampleEdits={[
          'Add "Pur.Order Number" as an alias for po_number → next upload from that client auto-maps',
          "Mark a field optional because a particular ERP doesn't carry it",
          "Add a new optional field that downstream pillars will consume",
        ]}
      />

      {/* File-level metadata */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <Section title="File metadata">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12 }}>
            <TextField label="File type (engine identifier)" value={data.file_type}
                         onChange={(v) => propagate({ ...data, file_type: v })}
                         hint="UPPER_SNAKE_CASE. The engine routes uploads by this value." />
            <TextField label="Label (UI display name)" value={data.label}
                         onChange={(v) => propagate({ ...data, label: v })} />
            <SelectField label="V1 status" value={data.guidelines?.v1_status}
                            onChange={(v) => updateGuidelines({ v1_status: v })}
                            options={V1_STATUSES}
                            hint="Affects the 'used in V1' pill on Stage 4" />
          </div>
        </Section>

        {/* Guidelines */}
        <Section title="Guidelines (shown to consultants at upload time)"
                 subtitle="These ground rules go into the per-file download templates + Stage 4 instructions.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <TextField label="Lookback months recommended" type="number"
                         value={data.guidelines?.lookback_months_recommended}
                         onChange={(v) => updateGuidelines({ lookback_months_recommended: v })} />
            <TextField label="Minimum months required" type="number"
                         value={data.guidelines?.minimum_months_required}
                         onChange={(v) => updateGuidelines({ minimum_months_required: v })} />
            <TextField label="Date format expected"
                         value={data.guidelines?.date_format_expected}
                         onChange={(v) => updateGuidelines({ date_format_expected: v })}
                         placeholder="DD-MM-YYYY" />
          </div>
          <div style={{ height: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <TextField label="Encoding expected" value={data.guidelines?.encoding_expected}
                         onChange={(v) => updateGuidelines({ encoding_expected: v })} />
            <TextField label="Row granularity" value={data.guidelines?.row_granularity}
                         onChange={(v) => updateGuidelines({ row_granularity: v })}
                         placeholder="e.g. one row per PO line" />
            <TagList label="Accepted formats" values={data.guidelines?.accepted_formats}
                       onChange={(v) => updateGuidelines({ accepted_formats: v })} />
          </div>
          <div style={{ height: 10 }} />
          <TagList label="Notes for client"
                     hint="One bullet per item — these print on the client template cover sheet"
                     values={data.guidelines?.notes_for_client}
                     onChange={(v) => updateGuidelines({ notes_for_client: v })} />
        </Section>
      </Card>

      {/* Fields */}
      <Card padding={0} style={{ marginBottom: 16 }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border-subtle)",
                         display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: "var(--fs-13)", fontWeight: 600 }}>
              Fields · {fields.length} total · {fields.filter((f) => f.required).length} required
            </div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>
              Click a field to edit · drag-equivalent up/down arrows on each
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Search fields…" value={search} onChange={(e) => setSearch(e.target.value)}
                    style={{ padding: "6px 10px", fontSize: "var(--fs-12)",
                              border: "1px solid var(--border-default)",
                              borderRadius: "var(--r-md)", width: 200 }} />
            <Button size="sm" onClick={addField}>+ Add field</Button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 500 }}>
          {/* Field list */}
          <div style={{ borderRight: "1px solid var(--border-subtle)", overflowY: "auto", maxHeight: 600 }}>
            {filtered.map(({ f, idx }) => {
              const isSelected = idx === selectedIdx;
              return (
                <button key={idx} onClick={() => setSelectedIdx(idx)}
                         style={{ display: "block", width: "100%", textAlign: "left",
                                    background: isSelected ? "var(--brand-50)" : "transparent",
                                    border: "none", padding: "8px 14px",
                                    borderBottom: "1px solid var(--border-subtle)",
                                    cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)",
                                       fontWeight: isSelected ? 600 : 500,
                                       color: isSelected ? "var(--brand-700)" : "var(--ink-900)" }}>
                      {f.field || "(unnamed)"}
                    </span>
                    {f.required && (
                      <span style={{ fontSize: "var(--fs-10)", fontWeight: 700,
                                       color: "var(--warn-700)", textTransform: "uppercase" }}>req</span>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>
                    {f.type} · {(f.aliases?.length || 0)} aliases
                  </div>
                </button>
              );
            })}
          </div>

          {/* Field detail form */}
          <div style={{ padding: 18 }}>
            {selectedField ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, color: "var(--ink-900)" }}>
                    Field detail
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => moveField(selectedIdx, -1)} style={arrowBtn}>↑</button>
                    <button onClick={() => moveField(selectedIdx, 1)} style={arrowBtn}>↓</button>
                    <button onClick={() => deleteField(selectedIdx)}
                             style={{ ...arrowBtn, color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <TextField label="Field name (canonical, snake_case)"
                               hint="What the engine calls this field internally. DO NOT rename if pillars already reference it."
                               value={selectedField.field}
                               onChange={(v) => updateField(selectedIdx, { field: v })}
                               style={{ fontFamily: "var(--font-mono)" }} />
                  <SelectField label="Type" value={selectedField.type}
                                  onChange={(v) => updateField(selectedIdx, { type: v })}
                                  options={FIELD_TYPES} allowBlank={false} />
                  <div>
                    <Label>Required?</Label>
                    <div style={{ marginTop: 8 }}>
                      <CheckboxField label="Required field"
                                       hint="Engine will reject upload if missing"
                                       value={selectedField.required}
                                       onChange={(v) => updateField(selectedIdx, { required: v })} />
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />
                <TagList label="Aliases (raw column headers that map to this field)"
                            hint="Add every variant you've seen from real client exports. Matching is case-insensitive + word-boundary. e.g. for po_number: 'PO_Number', 'PO Number', 'Pur.Order No', 'EBELN'."
                            monoChips
                            values={selectedField.aliases || []}
                            onChange={(v) => updateField(selectedIdx, { aliases: v })} />

                <div style={{ height: 12 }} />
                <TextAreaField label="Description"
                                  hint="Shown in the upload UI + on the per-file template cover sheet."
                                  value={selectedField.description}
                                  onChange={(v) => updateField(selectedIdx, { description: v })} />
              </>
            ) : (
              <div style={{ textAlign: "center", color: "var(--ink-500)", padding: 40 }}>
                Select a field or click "+ Add field"
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

const arrowBtn = {
  padding: "4px 10px", fontSize: "var(--fs-12)", fontWeight: 600,
  background: "transparent", color: "var(--ink-700)",
  border: "1px solid var(--border-default)", borderRadius: "var(--r-md)",
  cursor: "pointer",
};

export default SchemaEditor;
