/* KPI calculation rules editor — for _meta/kpi-calculation-rules.yml.
   Each top-level key is a KPI (tat, savings_over_lpo, rc_adoption…) with
   methodology config + benchmarks. */

import React, { useEffect, useState } from "react";
import yaml from "js-yaml";
import { Card } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, TextAreaField, TagList,
  SelectField, CheckboxField, ParseErrorBanner,
} from "./kbEditorPrimitives.jsx";

const KPI_LABELS = {
  tat: "TAT (PR → PO)",
  savings_over_lpo: "Savings over LPO",
  rc_adoption: "RC Adoption %",
  pac: "PAC / Single-Vendor %",
  tail_spend: "Tail Spend %",
  otd: "On-Time Delivery %",
  spend_unit_detection: "Spend unit detection (raw INR / thousands / Crore)",
  outlier_general: "Outlier handling (universal)",
  column_alias_resolution: "Column alias resolution fallback order",
};

const KpiCalcEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [activeTab, setActiveTab] = useState("tat");

  useEffect(() => {
    try {
      const parsed = yaml.load(yamlText) || {};
      setData(parsed);
      setParseError(null);
      // Pick first KPI as active
      const keys = Object.keys(parsed).filter((k) => k !== "metadata" && k !== "benchmarks");
      if (keys[0]) setActiveTab(keys[0]);
    } catch (e) { setParseError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propagate = (next) => {
    setData(next);
    try { onChange(yaml.dump(next, { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' })); }
    catch (e) { setParseError(e.message); }
  };

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

  const sectionKeys = Object.keys(data).filter((k) => k !== "metadata");
  const active = data[activeTab];

  const updateSection = (key, patch) => propagate({ ...data, [key]: { ...data[key], ...patch } });
  const updateNested = (key, sub, patch) => propagate({
    ...data, [key]: { ...data[key], [sub]: { ...(data[key]?.[sub] || {}), ...patch } },
  });

  return (
    <div>
      <EditorIntro
        title={`KPI calculation rules · ${sectionKeys.length} sections`}
        what={
          <span>
            Drives the <strong>methodology engine</strong> at Stage 10. Each KPI section configures
            how the engine computes the value: outlier handling for TAT, exclusion lists for RC
            adoption, threshold for tail spend, etc. There's also a benchmarks section that drives
            the "vs typical X-Y" band on every KPI card.
          </span>
        }
        why="These thresholds + lists are the auditable defence of every number on the dashboard. Tightening TAT IQR multiplier from 1.5 to 1.0 will surface more outliers as 'slow'. Adding 'non-rc' to the RC exclusion list will lower RC adoption % across all engagements."
        when="An engagement uses a different threshold (e.g. tail = ₹50K not ₹1L) · client uses non-standard contract codes we need to add to the RC exclusion list · adjusting industry benchmark bands"
        exampleEdits={[
          'Add "blanket-po" to rc_adoption.exclusion_list_case_insensitive',
          "Change tail_spend.threshold_inr_per_line from 100000 to 50000 for SME client",
          'Update tat benchmark typical_low/typical_high after fresh benchmarking',
        ]}
      />

      {/* Tabs for KPI sections */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12,
                       padding: 6, background: "var(--surface-sunk)",
                       borderRadius: "var(--r-md)" }}>
        {sectionKeys.map((k) => (
          <button key={k} onClick={() => setActiveTab(k)}
                   style={{ padding: "6px 12px", fontSize: "var(--fs-12)", fontWeight: 600,
                             background: activeTab === k ? "var(--surface-card)" : "transparent",
                             color: activeTab === k ? "var(--ink-900)" : "var(--ink-600)",
                             border: "1px solid " + (activeTab === k ? "var(--border-default)" : "transparent"),
                             borderRadius: "var(--r-md)", cursor: "pointer" }}>
            {KPI_LABELS[k] || k}
          </button>
        ))}
      </div>

      <Card padding={20}>
        <KpiSectionEditor sectionKey={activeTab} data={active}
                            onChange={(patch) => updateSection(activeTab, patch)}
                            onNestedChange={(sub, patch) => updateNested(activeTab, sub, patch)} />
      </Card>
    </div>
  );
};


const KpiSectionEditor = ({ sectionKey, data, onChange, onNestedChange }) => {
  if (sectionKey === "benchmarks") return <BenchmarksSubEditor data={data} onChange={onChange} />;
  if (!data || typeof data !== "object") {
    return <div style={{ color: "var(--ink-500)" }}>(empty section)</div>;
  }
  // Render every field on the section dynamically
  return (
    <div>
      <Section title={KPI_LABELS[sectionKey] || sectionKey}
               subtitle={sectionKey === "metadata" ? "Document metadata — change carefully" : null}>
        {Object.entries(data).map(([key, val]) => (
          <FieldRenderer key={key} fieldKey={key} value={val}
                            onChange={(v) => onChange({ [key]: v })}
                            onNestedChange={(sub, patch) => onNestedChange(key, patch)} />
        ))}
      </Section>
    </div>
  );
};


const FieldRenderer = ({ fieldKey, value, onChange }) => {
  if (Array.isArray(value)) {
    const allStrings = value.every((v) => typeof v === "string");
    if (allStrings) {
      return (
        <div style={{ marginBottom: 12 }}>
          <TagList label={fieldKey}
                      hint={listHints[fieldKey]}
                      values={value}
                      onChange={onChange} />
        </div>
      );
    }
    // Non-string array (list of dicts) — show as JSON textarea
    return (
      <div style={{ marginBottom: 12 }}>
        <Label hint="Complex list — edit as YAML">{fieldKey}</Label>
        <textarea value={yaml.dump(value, { lineWidth: -1 })}
                    onChange={(e) => { try { onChange(yaml.load(e.target.value)); } catch {} }}
                    rows={4}
                    style={textareaStyle} />
      </div>
    );
  }
  if (typeof value === "object" && value !== null) {
    return (
      <div style={{ marginBottom: 12, padding: 12, background: "var(--surface-sunk)",
                       borderRadius: "var(--r-md)" }}>
        <Label>{fieldKey} (nested)</Label>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {Object.entries(value).map(([k, v]) => (
            <ScalarOrComplex key={k} fieldKey={k} value={v}
                                onChange={(newV) => onChange({ ...value, [k]: newV })} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <ScalarOrComplex fieldKey={fieldKey} value={value} onChange={onChange} />
    </div>
  );
};

const ScalarOrComplex = ({ fieldKey, value, onChange }) => {
  if (typeof value === "boolean") {
    return <CheckboxField label={fieldKey} value={value} onChange={onChange} />;
  }
  if (typeof value === "number") {
    return <TextField label={fieldKey} type="number" value={value} onChange={onChange} />;
  }
  if (typeof value === "string") {
    if (value.includes("\n") || value.length > 80) {
      return <TextAreaField label={fieldKey} value={value} onChange={onChange} rows={3} />;
    }
    return <TextField label={fieldKey} value={value} onChange={onChange} />;
  }
  return (
    <div>
      <Label>{fieldKey}</Label>
      <textarea value={yaml.dump(value, { lineWidth: -1 })}
                  onChange={(e) => { try { onChange(yaml.load(e.target.value)); } catch {} }}
                  rows={3} style={textareaStyle} />
    </div>
  );
};

const BenchmarksSubEditor = ({ data, onChange }) => {
  const kpis = Object.keys(data || {});
  return (
    <div>
      <Section title="Industry benchmarks"
               subtitle="Typical low/high bands per KPI. Drives the 'vs typical X-Y' badge on every KPI card on Stage 10 + the dashboard.">
        {kpis.map((kpiId) => {
          const b = data[kpiId] || {};
          return (
            <div key={kpiId} style={{ marginBottom: 14, padding: 12, background: "var(--surface-sunk)",
                                          borderRadius: "var(--r-md)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", fontWeight: 700,
                              color: "var(--ink-900)", marginBottom: 8 }}>{kpiId}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <TextField label="Typical low" type="number" value={b.typical_low}
                             onChange={(v) => onChange({ ...data, [kpiId]: { ...b, typical_low: v } })} />
                <TextField label="Typical high" type="number" value={b.typical_high}
                             onChange={(v) => onChange({ ...data, [kpiId]: { ...b, typical_high: v } })} />
                <TextField label="Unit" value={b.unit}
                             onChange={(v) => onChange({ ...data, [kpiId]: { ...b, unit: v } })} />
                <SelectField label="Direction" value={b.direction}
                                onChange={(v) => onChange({ ...data, [kpiId]: { ...b, direction: v } })}
                                options={["higher_is_better", "lower_is_better"]} allowBlank={false} />
              </div>
              <div style={{ height: 8 }} />
              <TextAreaField label="Note" value={b.note}
                                onChange={(v) => onChange({ ...data, [kpiId]: { ...b, note: v } })}
                                rows={2} />
            </div>
          );
        })}
      </Section>
    </div>
  );
};


const listHints = {
  exclusion_list_case_insensitive: "Strings matched (case-insensitive) — if a row's contract field equals any of these, it's NOT counted as on-contract for RC adoption.",
  text_columns_scanned: "Column names the PAC detector scans for keywords like PAC, PROPRIETARY, SINGLE_SOURCE.",
  yes_values: "Values that count as 'yes' for boolean flags (rc_flag, pac_flag, etc.) Case-insensitive.",
  binary_flag_column_priority: "Column names checked in order for explicit PAC flag.",
  fallback_po_type_codes: "SAP po_type values that map to RC vs spot when no contract column.",
  date_priority: "Order the engine tries date sources for TAT computation.",
  lpo_priority: "Order the engine tries LPO sources for savings computation.",
};

const textareaStyle = {
  width: "100%", padding: 10, marginTop: 4, resize: "vertical",
  fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)",
  border: "1px solid var(--border-default)", borderRadius: "var(--r-md)",
  background: "var(--surface-card)", lineHeight: 1.5,
};

export default KpiCalcEditor;
