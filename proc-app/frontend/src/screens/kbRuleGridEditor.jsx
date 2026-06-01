/* Rule grid editor — for cleansing-rules.yml + data-quality-universal.yml.
   Each rule has: id, name, description, severity, when, action, auto_apply,
   plus our augmentation: implemented (status from the engine audit map). */

import React, { useEffect, useMemo, useState } from "react";
import yaml from "js-yaml";
import { Card, Button, Input } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, SelectField, TextAreaField,
  CheckboxField, ParseErrorBanner,
} from "./kbEditorPrimitives.jsx";

const SEVERITIES = [
  { value: "blocking", label: "Blocking (rejects upload)" },
  { value: "warning",  label: "Warning (HITL review)" },
  { value: "auto-fix", label: "Auto-fix (silent)" },
  { value: "info",     label: "Info only" },
];

const WHEN_OPTIONS = ["upload", "bronze", "gold", "stage9", "stage10"];

const IMPL_STATUS = {
  implemented:             { bg: "var(--success-50)", fg: "var(--success-700)", label: "Implemented" },
  not_implemented:         { bg: "var(--danger-50)",  fg: "var(--danger-700)",  label: "Not implemented" },
  handled_at_other_stage:  { bg: "var(--info-50)",     fg: "var(--info-700)",     label: "Handled elsewhere" },
  subsumed:                { bg: "var(--surface-sunk)", fg: "var(--ink-600)",     label: "Subsumed" },
};

const RuleGridEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [implFilter, setImplFilter] = useState("All");

  useEffect(() => {
    try {
      const parsed = yaml.load(yamlText) || {};
      setData(parsed);
      setParseError(null);
    } catch (e) { setParseError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propagate = (next) => {
    setData(next);
    try {
      onChange(yaml.dump(next, { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' }));
    } catch (e) { setParseError(e.message); }
  };

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

  const rules = data.rules || [];
  const updateRule = (idx, patch) => propagate({
    ...data,
    rules: rules.map((r, i) => i === idx ? { ...r, ...patch } : r),
  });

  const filtered = useMemo(() => {
    let list = rules.map((r, i) => ({ r, idx: i }));
    if (severityFilter !== "All") list = list.filter(({ r }) => r.severity === severityFilter);
    if (implFilter !== "All") list = list.filter(({ r }) => (r.implemented || "not_implemented") === implFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(({ r }) =>
        (r.id || "").toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s) ||
        (r.description || "").toLowerCase().includes(s));
    }
    return list;
  }, [rules, search, severityFilter, implFilter]);

  const addRule = () => {
    let id = "new_rule", n = 1;
    while (rules.some((r) => r.id === id)) id = `new_rule_${++n}`;
    propagate({
      ...data,
      rules: [...rules, { id, name: "New rule", description: "", severity: "warning",
                            when: "bronze", action: "flag", auto_apply: false }],
    });
    setSelectedIdx(rules.length);
  };
  const deleteRule = (idx) => {
    if (!confirm(`Delete rule "${rules[idx]?.id}"?`)) return;
    propagate({ ...data, rules: rules.filter((_, i) => i !== idx) });
    if (selectedIdx >= rules.length - 1) setSelectedIdx(Math.max(0, rules.length - 2));
  };

  const selectedRule = filtered[0] ? rules[selectedIdx] : null;

  // Status totals
  const totals = useMemo(() => {
    const t = { total: rules.length, implemented: 0, not_implemented: 0,
                 handled_at_other_stage: 0, subsumed: 0 };
    rules.forEach((r) => {
      const s = r.implemented || "not_implemented";
      t[s] = (t[s] || 0) + 1;
    });
    return t;
  }, [rules]);

  return (
    <div>
      <EditorIntro
        title={`Rule library · ${rules.length} rules`}
        what={
          <span>
            Each rule defines an automated data check that runs at upload (Bronze) or transformation
            (Gold). Severity controls behaviour: <strong>blocking</strong> rejects the upload entirely;
            <strong>warning</strong> creates a HITL flag for consultant review on Stage 6;
            <strong>auto-fix</strong> runs silently and is logged; <strong>info</strong> just records
            an observation.
          </span>
        }
        why={
          <span>
            Adding a rule with severity=warning will start surfacing flags consultants must clear.
            Changing severity from warning → auto-fix removes the consultant gate (engine
            self-resolves). The <strong>implemented</strong> field documents whether the engine
            actually runs this rule — a doc-only "not_implemented" rule has no effect until
            engineering wires it.
          </span>
        }
        when="Adding domain-specific data quality checks · downgrading a chatty warning rule to auto-fix · documenting a rule the engine doesn't yet enforce so reviewers know the gap"
        exampleEdits={[
          "Add a rule that flags PO rows where unit_price × quantity ≠ net_value by > 5%",
          "Mark an existing rule's severity as 'blocking' so bad files don't proceed",
          'Document a planned rule with implemented="not_implemented" + an engineering note',
        ]}
      />

      {/* Status totals strip */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <Label>Implementation status</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <StatChip label="Total" count={totals.total} bg="var(--surface-sunk)" fg="var(--ink-700)" />
          {Object.entries(IMPL_STATUS).map(([k, meta]) => (
            <StatChip key={k} label={meta.label} count={totals[k] || 0} bg={meta.bg} fg={meta.fg} />
          ))}
        </div>
      </Card>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Input placeholder="Search rules…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }} />
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={dropdown}>
          <option>All</option>
          {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={implFilter} onChange={(e) => setImplFilter(e.target.value)} style={dropdown}>
          <option>All</option>
          {Object.entries(IMPL_STATUS).map(([k, meta]) => <option key={k} value={k}>{meta.label}</option>)}
        </select>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginLeft: 8 }}>
          {filtered.length} matching
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Button size="sm" onClick={addRule}>+ Add rule</Button>
        </div>
      </div>

      {/* Rule table */}
      <Card padding={0}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr style={{ background: "var(--surface-sunk)" }}>
              {["Status", "ID", "Name", "Severity", "When", "Auto-apply", ""].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ r, idx }) => {
              const status = r.implemented || "not_implemented";
              const meta = IMPL_STATUS[status] || IMPL_STATUS.not_implemented;
              const isExpanded = selectedIdx === idx;
              return (
                <React.Fragment key={idx}>
                  <tr style={{ background: isExpanded ? "var(--brand-50)" : "transparent",
                                  cursor: "pointer" }}
                       onClick={() => setSelectedIdx(idx)}>
                    <td style={td}>
                      <span style={{ background: meta.bg, color: meta.fg, padding: "2px 8px",
                                       borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)",
                                       fontWeight: 600, whiteSpace: "nowrap" }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.id}</td>
                    <td style={td}>{r.name || "—"}</td>
                    <td style={td}>{r.severity || "—"}</td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.when || "—"}</td>
                    <td style={{ ...td, fontSize: "var(--fs-11)" }}>{r.auto_apply ? "✓ yes" : "—"}</td>
                    <td style={td}>{isExpanded ? "▾" : "▸"}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} style={{ background: "var(--surface-sunk)", padding: 0 }}>
                        <RuleForm rule={r} onChange={(patch) => updateRule(idx, patch)}
                                    onDelete={() => deleteRule(idx)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const RuleForm = ({ rule, onChange, onDelete }) => (
  <div style={{ padding: 18 }}>
    <Section title="Identification">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <TextField label="Rule ID (snake_case)" value={rule.id}
                     onChange={(v) => onChange({ id: v })}
                     style={{ fontFamily: "var(--font-mono)" }} />
        <TextField label="Display name" value={rule.name}
                     onChange={(v) => onChange({ name: v })} />
      </div>
      <div style={{ height: 10 }} />
      <TextAreaField label="Description"
                        hint="What the rule does. Shown to consultants in the cleansing report."
                        value={rule.description}
                        onChange={(v) => onChange({ description: v })} />
    </Section>

    <Section title="Behaviour">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <SelectField label="Severity" value={rule.severity}
                        onChange={(v) => onChange({ severity: v })}
                        options={SEVERITIES} allowBlank={false}
                        hint="blocking → rejects upload · warning → HITL · auto-fix → silent · info → log only" />
        <SelectField label="When the rule runs" value={rule.when}
                        onChange={(v) => onChange({ when: v })}
                        options={WHEN_OPTIONS}
                        hint="upload (Stage 4) · bronze (Stage 7) · gold (Stage 8) · stage9 · stage10" />
        <div>
          <Label>Auto-apply</Label>
          <div style={{ marginTop: 6 }}>
            <CheckboxField label="Apply automatically without HITL"
                             value={rule.auto_apply}
                             onChange={(v) => onChange({ auto_apply: v })} />
          </div>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <TextField label="Action keyword"
                   hint="e.g. flag, drop, fix, strip-and-flag — engine-specific verb"
                   value={rule.action}
                   onChange={(v) => onChange({ action: v })} />
    </Section>

    <Section title="Implementation status (read-only — set in engine audit map)">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <Label>Status</Label>
          <div style={{ marginTop: 4, fontSize: "var(--fs-13)" }}>
            {(() => {
              const s = rule.implemented || "not_implemented";
              const m = IMPL_STATUS[s];
              return <span style={{ background: m.bg, color: m.fg, padding: "3px 10px",
                                       borderRadius: "var(--r-pill)", fontWeight: 600 }}>{m.label}</span>;
            })()}
          </div>
        </div>
        <TextField label="Fires as (engine rule_id, if implemented)"
                     value={rule.fires_as}
                     onChange={(v) => onChange({ fires_as: v })}
                     style={{ fontFamily: "var(--font-mono)" }} />
      </div>
      {rule.implementation_note && (
        <div style={{ marginTop: 8, padding: 8, background: "var(--surface-card)",
                         borderRadius: "var(--r-md)", fontSize: "var(--fs-12)", color: "var(--ink-700)" }}>
          <strong>Engineering note:</strong> {rule.implementation_note}
        </div>
      )}
    </Section>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <Button variant="outline" onClick={onDelete}
                style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
        Delete rule
      </Button>
    </div>
  </div>
);

const StatChip = ({ label, count, bg, fg }) => (
  <div style={{ background: bg, color: fg, padding: "6px 12px", borderRadius: "var(--r-md)",
                  fontSize: "var(--fs-12)", fontWeight: 600 }}>
    {label}: {count}
  </div>
);

const th = { textAlign: "left", padding: "10px 12px", fontSize: "var(--fs-11)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--ink-600)", borderBottom: "1px solid var(--border-default)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
              color: "var(--ink-800)", verticalAlign: "top" };
const dropdown = { padding: "7px 10px", border: "1px solid var(--border-default)",
                     borderRadius: "var(--r-md)", fontSize: "var(--fs-13)" };

export default RuleGridEditor;
