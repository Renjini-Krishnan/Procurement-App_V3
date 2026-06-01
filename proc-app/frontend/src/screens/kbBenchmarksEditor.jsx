/* Benchmarks editor — for <pillar>/benchmarks.yml.
   These files refresh more frequently than any other KB (year-over-year
   benchmark updates, new supporting sources, industry overlays). The
   editor surfaces every field actually present in the source YAML:
   primary citation, supporting sources list, composite roll-up, drivers
   explanation, methodology, sample size, applies_to_industries, edit_risk. */

import React, { useEffect, useState } from "react";
import yaml from "js-yaml";
import { Card, Button } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, TextAreaField, SelectField,
  TagList, CheckboxField, ParseErrorBanner,
} from "./kbEditorPrimitives.jsx";

const CONFIDENCES = ["high", "medium", "low"];
const EDIT_RISKS = ["low", "medium", "high"];
const METRIC_TYPES = ["percentage", "percentage_range", "ratio", "count",
                       "currency", "duration_days", "score"];

const BenchmarksEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");

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

  const benchmarks = data.benchmarks || [];
  const meta = data.metadata || {};
  const filtered = benchmarks
    .map((b, i) => ({ b, idx: i }))
    .filter(({ b }) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (b.id || "").toLowerCase().includes(s) ||
             (b.name || "").toLowerCase().includes(s) ||
             (b.primary?.source_id || "").toLowerCase().includes(s);
    });

  const updateBench = (idx, patch) => propagate({
    ...data, benchmarks: benchmarks.map((b, i) => i === idx ? { ...b, ...patch } : b),
  });
  const updatePrimary = (idx, patch) => updateBench(idx, {
    primary: { ...(benchmarks[idx].primary || {}), ...patch },
  });
  const updateComposite = (idx, patch) => updateBench(idx, {
    composite: { ...(benchmarks[idx].composite || {}), ...patch },
  });

  const addBenchmark = () => {
    const newB = {
      id: `${meta.pillar || "pillar"}.new.benchmark`,
      name: "New benchmark",
      description: "",
      metric_type: "percentage_range",
      unit: "%",
      primary: { source_id: "", value_range: [0, 0], confidence: "medium",
                  year: new Date().getFullYear() },
      supporting: [],
      applies_to_pillars: [meta.pillar].filter(Boolean),
      applies_to_industries: [],
      layer: meta.layer || "function",
      edit_risk: "medium",
    };
    propagate({ ...data, benchmarks: [...benchmarks, newB] });
    setSelectedIdx(benchmarks.length);
  };

  const deleteBenchmark = (idx) => {
    if (!confirm(`Delete benchmark ${benchmarks[idx]?.id}?`)) return;
    propagate({ ...data, benchmarks: benchmarks.filter((_, i) => i !== idx) });
    if (selectedIdx >= benchmarks.length - 1) {
      setSelectedIdx(Math.max(0, benchmarks.length - 2));
    }
  };

  const selected = benchmarks[selectedIdx];

  return (
    <div>
      <EditorIntro
        title={`Benchmarks · ${meta.pillar || "(pillar)"} · ${benchmarks.length} entries`}
        what={
          <span>
            Numeric benchmarks used by the pillar engine + cited in every AI
            insight on this pillar. Each entry has a <strong>primary citation</strong>
            (the headline source — APQC, Hackett, ACN), a list of <strong>supporting
            sources</strong> (cross-references that triangulate the band), and a
            <strong> composite roll-up</strong> (the final band the engine applies).
            Industry overlays at <code>industries/&lt;ind&gt;/by-function/.../benchmarks.yml</code>{" "}
            override entries here on a per-id basis.
          </span>
        }
        why={
          <span>
            <strong>Refresh frequently.</strong> Benchmarks decay — last year's
            "typical 2-4%" might be this year's "typical 1-3%". When you publish
            a finding to a client, the source + year you cite here is what shows
            up under every AI insight on the pillar page. Stale citations =
            credibility loss.
          </span>
        }
        when="Annual benchmark refresh · new source publication (Hackett 2026, APQC update) · industry overlay tuning · revising the composite band after engagement feedback"
        exampleEdits={[
          "Update APQC value_range from [2,4] → [2,3] after 2025 refresh",
          'Add a new "supporting" Hackett-2025 entry under an existing benchmark',
          "Set edit_risk=high on a benchmark cited in the dashboard headline KPI",
          "Override the function-default at the steel-industry overlay layer",
        ]}
      />

      {/* Metadata strip */}
      <Card padding={14} style={{ marginBottom: 16 }}>
        <Label>Document metadata</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 6 }}>
          <TextField label="ID" value={meta.id}
                       onChange={(v) => propagate({ ...data, metadata: { ...meta, id: v }})} />
          <TextField label="Pillar" value={meta.pillar}
                       onChange={(v) => propagate({ ...data, metadata: { ...meta, pillar: v }})} />
          <SelectField label="Layer" value={meta.layer}
                          options={["function", "industry", "engagement"]}
                          onChange={(v) => propagate({ ...data, metadata: { ...meta, layer: v }})} />
          <TextField label="Version" value={meta.version}
                       onChange={(v) => propagate({ ...data, metadata: { ...meta, version: v }})} />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
        {/* Sidebar list */}
        <Card padding={0} style={{ display: "flex", flexDirection: "column", maxHeight: "78vh" }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>{filtered.length} of {benchmarks.length}</Label>
              <Button size="sm" onClick={addBenchmark}>+ Add</Button>
            </div>
            <input type="text" placeholder="Search id / name / source…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", fontSize: "var(--fs-12)",
                              border: "1px solid var(--border-default)",
                              borderRadius: "var(--r-md)" }} />
          </div>
          <div style={{ overflowY: "auto", padding: 6 }}>
            {filtered.map(({ b, idx }) => {
              const isSel = idx === selectedIdx;
              const risk = b.edit_risk || "medium";
              const riskTone = risk === "high" ? "var(--danger-700)"
                                : risk === "low" ? "var(--success-700)" : "var(--warn-700)";
              const vr = b.composite?.value_range || b.primary?.value_range;
              return (
                <button key={idx} onClick={() => setSelectedIdx(idx)}
                         style={{ display: "block", width: "100%", textAlign: "left",
                                    background: isSel ? "var(--brand-50)" : "transparent",
                                    border: "none", padding: "8px 10px", marginBottom: 2,
                                    borderRadius: "var(--r-md)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-10)",
                                     fontWeight: 600, color: isSel ? "var(--brand-700)" : "var(--ink-600)",
                                     wordBreak: "break-all", marginRight: 6 }}>
                      {b.id}
                    </span>
                    <span style={{ fontSize: "var(--fs-9)", color: riskTone, fontWeight: 700,
                                     textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {risk}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-800)", marginTop: 2, fontWeight: 500 }}>
                    {b.name || "—"}
                  </div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>
                    {b.primary?.source_id || "?"}
                    {vr ? ` · ${vr[0]}-${vr[1]}${b.unit || ""}` : ""}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 14, fontSize: "var(--fs-12)", color: "var(--ink-500)", textAlign: "center" }}>
                No matches.
              </div>
            )}
          </div>
        </Card>

        {/* Detail panel */}
        {selected ? (
          <Card padding={20}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Label>Benchmark ID</Label>
              <Button variant="outline" size="sm"
                       onClick={() => deleteBenchmark(selectedIdx)}
                       style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
                Delete
              </Button>
            </div>
            <TextField value={selected.id}
                         onChange={(v) => updateBench(selectedIdx, { id: v })}
                         style={{ fontFamily: "var(--font-mono)" }} />

            <Section title="Identity"
                      subtitle="How the benchmark surfaces in the UI + pillar engine.">
              <TextField label="Display name" value={selected.name}
                            onChange={(v) => updateBench(selectedIdx, { name: v })} />
              <div style={{ height: 10 }} />
              <TextAreaField label="Description"
                                hint="Free-text explanation. Shown in the structured editor's expand panel."
                                value={selected.description} rows={3}
                                onChange={(v) => updateBench(selectedIdx, { description: v })} />
              <div style={{ height: 10 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <SelectField label="Metric type" value={selected.metric_type}
                                options={METRIC_TYPES}
                                onChange={(v) => updateBench(selectedIdx, { metric_type: v })} />
                <TextField label="Unit" value={selected.unit}
                              hint='e.g. "%", "INR Cr", "days"'
                              onChange={(v) => updateBench(selectedIdx, { unit: v })} />
                <SelectField label="Edit risk" value={selected.edit_risk}
                                options={EDIT_RISKS} allowBlank={false}
                                onChange={(v) => updateBench(selectedIdx, { edit_risk: v })} />
              </div>
            </Section>

            <Section title="Primary citation"
                      subtitle="The headline source. This is what the AI cites in every theme insight + RCA narrative for this pillar.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px", gap: 10 }}>
                <TextField label="source_id"
                             hint='Short identifier — "APQC-2024", "Hackett-2024", "WSA-2024"'
                             value={selected.primary?.source_id}
                             onChange={(v) => updatePrimary(selectedIdx, { source_id: v })} />
                <TextField label="year" type="number"
                             value={selected.primary?.year}
                             onChange={(v) => updatePrimary(selectedIdx, { year: Number(v) || v })} />
                <SelectField label="confidence" value={selected.primary?.confidence}
                                options={CONFIDENCES} allowBlank={false}
                                onChange={(v) => updatePrimary(selectedIdx, { confidence: v })} />
              </div>
              <div style={{ height: 10 }} />
              <TextField label="source_reference"
                           hint="Page / section / dataset citation — useful for audit"
                           value={selected.primary?.source_reference}
                           onChange={(v) => updatePrimary(selectedIdx, { source_reference: v })} />
              <div style={{ height: 10 }} />
              <ValueRangeRow label="value_range (primary)"
                              range={selected.primary?.value_range}
                              onChange={(r) => updatePrimary(selectedIdx, { value_range: r })} />
              <div style={{ height: 10 }} />
              <TextField label="sample_size"
                           hint='Free-text — e.g. "500+ procurement organisations" or "n=1,247"'
                           value={selected.primary?.sample_size}
                           onChange={(v) => updatePrimary(selectedIdx, { sample_size: v })} />
              <div style={{ height: 10 }} />
              <TextAreaField label="methodology"
                                hint="How the source measured it — used for audit only, not surfaced in narratives"
                                value={selected.primary?.methodology} rows={2}
                                onChange={(v) => updatePrimary(selectedIdx, { methodology: v })} />
            </Section>

            <Section title="Supporting sources"
                      subtitle="Cross-references that triangulate the primary band. Add 1-3 to make the citation defensible.">
              <SupportingList
                items={selected.supporting || []}
                onChange={(list) => updateBench(selectedIdx, { supporting: list })} />
            </Section>

            <Section title="Composite (rolled-up band the engine applies)"
                      subtitle="The final band — usually the union of primary + supporting ranges, but you can tighten it.">
              <ValueRangeRow label="composite.value_range"
                              range={selected.composite?.value_range}
                              onChange={(r) => updateComposite(selectedIdx, { value_range: r })} />
              <div style={{ height: 10 }} />
              <TextAreaField label="drivers_explained"
                                hint="What contributes to the band, with rough weights. Shown in the audit drawer."
                                value={selected.drivers_explained} rows={3}
                                onChange={(v) => updateBench(selectedIdx, { drivers_explained: v })} />
            </Section>

            <Section title="Applicability"
                      subtitle="Which pillars + industries pick up this benchmark.">
              <TagList label="applies_to_pillars"
                          hint='Pillar IDs — e.g. "op-model", "doa". Comma-separated tags.'
                          values={selected.applies_to_pillars || []}
                          onChange={(v) => updateBench(selectedIdx, { applies_to_pillars: v })} />
              <div style={{ height: 10 }} />
              <TagList label="applies_to_industries"
                          hint='Industry IDs — empty = applies to all. Add "steel", "cement" to scope.'
                          values={selected.applies_to_industries || []}
                          onChange={(v) => updateBench(selectedIdx, { applies_to_industries: v })} />
            </Section>
          </Card>
        ) : (
          <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
            Select a benchmark or click "+ Add".
          </Card>
        )}
      </div>
    </div>
  );
};


const ValueRangeRow = ({ label, range, onChange }) => {
  const lo = Array.isArray(range) ? range[0] : "";
  const hi = Array.isArray(range) ? range[1] : "";
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
        <input type="number" placeholder="low" value={lo ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? null : Number(v);
                  onChange([isNaN(n) ? v : n, hi]);
                }}
                style={fieldStyle} />
        <input type="number" placeholder="high" value={hi ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? null : Number(v);
                  onChange([lo, isNaN(n) ? v : n]);
                }}
                style={fieldStyle} />
      </div>
    </div>
  );
};


const SupportingList = ({ items, onChange }) => {
  const update = (idx, patch) => onChange(items.map((x, i) => i === idx ? { ...x, ...patch } : x));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, { source_id: "", value_range: [0, 0],
                                            confidence: "medium",
                                            year: new Date().getFullYear() }]);
  return (
    <div>
      {items.map((s, idx) => (
        <div key={idx} style={{
          padding: 10, marginBottom: 8,
          background: "var(--surface-sunk)", borderRadius: "var(--r-md)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 1fr 0.8fr 32px", gap: 8, alignItems: "end" }}>
            <TextField label="source_id" value={s.source_id}
                          onChange={(v) => update(idx, { source_id: v })} />
            <TextField label="year" type="number" value={s.year}
                          onChange={(v) => update(idx, { year: Number(v) || v })} />
            <ValueRangeRow label="value_range" range={s.value_range}
                            onChange={(r) => update(idx, { value_range: r })} />
            <SelectField label="confidence" value={s.confidence}
                            options={CONFIDENCES} allowBlank={false}
                            onChange={(v) => update(idx, { confidence: v })} />
            <button onClick={() => remove(idx)}
                     style={{ background: "transparent", color: "var(--danger-700)",
                                border: "1px solid var(--danger-500)",
                                borderRadius: "var(--r-md)",
                                padding: "4px 8px", fontSize: "var(--fs-12)",
                                cursor: "pointer", height: 30 }}>×</button>
          </div>
          <div style={{ marginTop: 6 }}>
            <TextField label="note"
                          hint='Why this source matters — "world-class subset" / "industry-specific"'
                          value={s.note}
                          onChange={(v) => update(idx, { note: v })} />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>+ Add supporting source</Button>
    </div>
  );
};


const fieldStyle = {
  width: "100%", padding: "6px 10px", fontSize: "var(--fs-12)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--r-md)", background: "var(--surface-card)",
};

export default BenchmarksEditor;
