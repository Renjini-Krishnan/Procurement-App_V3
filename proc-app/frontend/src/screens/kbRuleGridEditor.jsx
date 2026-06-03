/* Rule grid editor — handles two related YAML shapes:

   1. cleansing-rules.yml (procurement-specific, Stages 5-9 HITL gates):
        id, name, description, stage (number), hitl_required, hitl_prompt,
        hitl_screen, inputs, output, logic, error_handling, consumed_by,
        edit_risk (HIGH/MEDIUM/LOW), implemented, implementation_note, fires_as.

   2. data-quality-universal.yml (Stage 7 bronze checks):
        id, name, description, severity (blocking/warning/auto-fix/info),
        when (upload/bronze/gold/stage9), action, auto_apply,
        implemented, implementation_note, fires_as.

   The editor auto-detects which shape is in use (based on which fields
   the first rule carries) and renders the matching form.

   Earlier version assumed shape 2 universally — caused shape 1 files to
   render mostly-empty cards and look broken.
*/

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
const STAGE_OPTIONS = [
  { value: 4, label: "Stage 4 — Upload" },
  { value: 5, label: "Stage 5 — AI Validation" },
  { value: 6, label: "Stage 6 — User Validation (HITL)" },
  { value: 7, label: "Stage 7 — Bronze" },
  { value: 8, label: "Stage 8 — Gold" },
  { value: 9, label: "Stage 9 — Category Classification" },
];
const EDIT_RISKS = ["LOW", "MEDIUM", "HIGH"];

const IMPL_STATUS = {
  implemented:             { bg: "var(--success-50)", fg: "var(--success-700)", label: "Implemented" },
  not_implemented:         { bg: "var(--danger-50)",  fg: "var(--danger-700)",  label: "Not implemented" },
  handled_at_other_stage:  { bg: "var(--info-50, #e6f0ff)", fg: "var(--info-700, #1d4ed8)", label: "Handled elsewhere" },
  subsumed:                { bg: "var(--surface-sunk)", fg: "var(--ink-600)",     label: "Subsumed" },
};

const detectSchema = (rules) => {
  if (!rules || rules.length === 0) return "universal";   // empty file → assume universal
  const r0 = rules[0];
  if ("stage" in r0 || "hitl_required" in r0 || "logic" in r0) return "procurement";
  return "universal";
};


const RuleGridEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [implFilter, setImplFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");

  useEffect(() => {
    try { setData(yaml.load(yamlText) || {}); setParseError(null); }
    catch (e) { setParseError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IMPORTANT: keep all hooks above the early returns below — React's
  // Rules of Hooks require the same hook count on every render. An
  // earlier version had these useMemo blocks AFTER 'if (!data) return …',
  // which crashed on the second render when data loaded.
  const rules = data?.rules || [];
  const schema = detectSchema(rules);

  const filtered = useMemo(() => {
    let list = rules.map((r, i) => ({ r, idx: i }));
    if (implFilter !== "All") list = list.filter(({ r }) => (r.implemented || "not_implemented") === implFilter);
    if (stageFilter !== "All") {
      list = list.filter(({ r }) => {
        if (schema === "procurement") return String(r.stage) === stageFilter;
        return (r.when || "") === stageFilter;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(({ r }) =>
        (r.id || "").toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s) ||
        (r.description || "").toLowerCase().includes(s));
    }
    return list;
  }, [rules, search, implFilter, stageFilter, schema]);

  const totals = useMemo(() => {
    const t = { total: rules.length, implemented: 0, not_implemented: 0,
                 handled_at_other_stage: 0, subsumed: 0 };
    rules.forEach((r) => {
      const s = r.implemented || "not_implemented";
      t[s] = (t[s] || 0) + 1;
    });
    return t;
  }, [rules]);

  const propagate = (next) => {
    setData(next);
    try { onChange(yaml.dump(next, { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' })); }
    catch (e) { setParseError(e.message); }
  };

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

  const updateRule = (idx, patch) => propagate({
    ...data,
    rules: rules.map((r, i) => i === idx ? { ...r, ...patch } : r),
  });

  const addRule = () => {
    let id = "new_rule", n = 1;
    while (rules.some((r) => r.id === id)) id = `new_rule_${++n}`;
    const template = schema === "procurement"
      ? { id, name: "New rule", description: "", stage: 7, hitl_required: false,
          inputs: {}, output: {}, logic: "", error_handling: "",
          consumed_by: "", edit_risk: "MEDIUM", implemented: "not_implemented" }
      : { id, name: "New rule", description: "", severity: "warning",
          when: "bronze", action: "flag", auto_apply: false,
          implemented: "not_implemented" };
    propagate({ ...data, rules: [...rules, template] });
    setSelectedIdx(rules.length);
  };
  const deleteRule = (idx) => {
    if (!confirm(`Delete rule "${rules[idx]?.id}"?`)) return;
    propagate({ ...data, rules: rules.filter((_, i) => i !== idx) });
    if (selectedIdx >= rules.length - 1) setSelectedIdx(Math.max(0, rules.length - 2));
  };

  const stageOptionsForFilter = schema === "procurement"
    ? ["All", ...Array.from(new Set(rules.map((r) => String(r.stage)).filter(Boolean))).sort()]
    : ["All", ...WHEN_OPTIONS];

  return (
    <div>
      <EditorIntro {...INTROS[schema]} />

      {/* Status totals */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <Label>Implementation status (engine audit map)</Label>
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
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={dropdown}>
          {stageOptionsForFilter.map((s) => (
            <option key={s} value={s}>{schema === "procurement" && s !== "All" ? `Stage ${s}` : s}</option>
          ))}
        </select>
        <select value={implFilter} onChange={(e) => setImplFilter(e.target.value)} style={dropdown}>
          <option>All</option>
          {Object.entries(IMPL_STATUS).map(([k, meta]) => <option key={k} value={k}>{meta.label}</option>)}
        </select>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginLeft: 8 }}>
          {filtered.length} of {rules.length} matching
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
              {(schema === "procurement"
                ? ["Status", "Rule ID", "Name", "Stage", "HITL?", "Edit risk", ""]
                : ["Status", "Rule ID", "Name", "Severity", "When", "Auto-apply", ""]
              ).map((h) => (<th key={h} style={th}>{h}</th>))}
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
                    {schema === "procurement" ? (
                      <>
                        <td style={td}>{r.stage ? `Stage ${r.stage}` : "—"}</td>
                        <td style={{ ...td, fontSize: "var(--fs-11)" }}>{r.hitl_required ? "✓ yes" : "—"}</td>
                        <td style={td}>
                          {r.edit_risk && <RiskChip risk={r.edit_risk} />}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={td}>{r.severity || "—"}</td>
                        <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.when || "—"}</td>
                        <td style={{ ...td, fontSize: "var(--fs-11)" }}>{r.auto_apply ? "✓ yes" : "—"}</td>
                      </>
                    )}
                    <td style={td}>{isExpanded ? "▾" : "▸"}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} style={{ background: "var(--surface-sunk)", padding: 0 }}>
                        {schema === "procurement"
                          ? <ProcurementRuleForm rule={r} onChange={(p) => updateRule(idx, p)}
                                                  onDelete={() => deleteRule(idx)} />
                          : <UniversalRuleForm rule={r} onChange={(p) => updateRule(idx, p)}
                                                onDelete={() => deleteRule(idx)} />}
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


/* Procurement-specific rule form (cleansing-rules.yml shape) */
const ProcurementRuleForm = ({ rule, onChange, onDelete }) => (
  <div style={{ padding: 18 }}>
    <Section title="Identification">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12 }}>
        <TextField label="Rule ID (dot-namespaced)" value={rule.id}
                     onChange={(v) => onChange({ id: v })}
                     style={{ fontFamily: "var(--font-mono)" }} />
        <TextField label="Display name" value={rule.name}
                     onChange={(v) => onChange({ name: v })} />
      </div>
      <div style={{ height: 10 }} />
      <TextAreaField label="Description"
                        hint="What this rule does, written for a consultant."
                        value={rule.description} rows={3}
                        onChange={(v) => onChange({ description: v })} />
    </Section>

    <Section title="When it runs">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <SelectField label="Pipeline stage" value={rule.stage}
                        options={STAGE_OPTIONS} allowBlank={false}
                        onChange={(v) => onChange({ stage: Number(v) })}
                        hint="Which pipeline stage triggers this rule." />
        <div>
          <Label>HITL required</Label>
          <div style={{ marginTop: 6 }}>
            <CheckboxField label="Pauses for consultant review"
                             value={rule.hitl_required}
                             onChange={(v) => onChange({ hitl_required: v })} />
          </div>
        </div>
        <SelectField label="Edit risk" value={rule.edit_risk}
                        options={EDIT_RISKS} allowBlank={false}
                        onChange={(v) => onChange({ edit_risk: v })}
                        hint="How dangerous is it to change this rule? HIGH = touches every engagement." />
      </div>
    </Section>

    {rule.hitl_required && (
      <Section title="HITL details (consultant-facing review screen)">
        <TextField label="HITL screen id" value={rule.hitl_screen}
                     hint="Frontend screen the consultant lands on (e.g. column_mapping_grid)"
                     onChange={(v) => onChange({ hitl_screen: v })} />
        <div style={{ height: 10 }} />
        <TextAreaField label="HITL prompt (what the consultant sees)"
                          value={rule.hitl_prompt} rows={3}
                          onChange={(v) => onChange({ hitl_prompt: v })} />
      </Section>
    )}

    <Section title="Logic + I/O">
      <TextAreaField label="Logic (engine pseudocode / decision tree)"
                        hint="Numbered steps the engine follows. Preserved as-is in YAML."
                        value={rule.logic} rows={6}
                        onChange={(v) => onChange({ logic: v })} />
      <div style={{ height: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <DictField label="Inputs" value={rule.inputs}
                     onChange={(v) => onChange({ inputs: v })}
                     hint="Map of input keys → which file/field they come from" />
        <DictField label="Output" value={rule.output}
                     onChange={(v) => onChange({ output: v })}
                     hint="What this rule writes to (modifies, adds_fields, etc.)" />
      </div>
      <div style={{ height: 10 }} />
      <TextAreaField label="Error handling"
                        hint="What happens when this rule encounters bad data."
                        value={rule.error_handling} rows={2}
                        onChange={(v) => onChange({ error_handling: v })} />
    </Section>

    <Section title="Consumers + implementation status">
      <TextField label="Consumed by"
                   hint="Downstream stages / pillars that read this rule's output. Use ALL when universal."
                   value={rule.consumed_by}
                   onChange={(v) => onChange({ consumed_by: v })} />
      <div style={{ height: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SelectField label="Implementation status" value={rule.implemented}
                        options={Object.keys(IMPL_STATUS)} allowBlank={false}
                        onChange={(v) => onChange({ implemented: v })} />
        <TextField label="Fires as (engine rule id)"
                     value={rule.fires_as}
                     hint="If implemented, the rule id the engine actually emits."
                     onChange={(v) => onChange({ fires_as: v })}
                     style={{ fontFamily: "var(--font-mono)" }} />
      </div>
      <div style={{ height: 10 }} />
      <TextAreaField label="Implementation note"
                        hint="Engineering context — link to PR, stage handoff, deferred-to message."
                        value={rule.implementation_note} rows={2}
                        onChange={(v) => onChange({ implementation_note: v })} />
    </Section>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <Button variant="outline" onClick={onDelete}
                style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
        Delete rule
      </Button>
    </div>
  </div>
);


/* Universal-DQ rule form (data-quality-universal.yml shape) */
const UniversalRuleForm = ({ rule, onChange, onDelete }) => (
  <div style={{ padding: 18 }}>
    <Section title="Identification">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <TextField label="Rule ID" value={rule.id} onChange={(v) => onChange({ id: v })}
                     style={{ fontFamily: "var(--font-mono)" }} />
        <TextField label="Display name" value={rule.name} onChange={(v) => onChange({ name: v })} />
      </div>
      <div style={{ height: 10 }} />
      <TextAreaField label="Description"
                        value={rule.description} rows={3}
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
                        options={WHEN_OPTIONS} />
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

    <Section title="Implementation status">
      <SelectField label="Status" value={rule.implemented}
                      options={Object.keys(IMPL_STATUS)} allowBlank={false}
                      onChange={(v) => onChange({ implemented: v })} />
      <div style={{ height: 10 }} />
      <TextAreaField label="Implementation note" value={rule.implementation_note} rows={2}
                        onChange={(v) => onChange({ implementation_note: v })} />
      <div style={{ height: 10 }} />
      <TextField label="Fires as (engine rule id)" value={rule.fires_as}
                   onChange={(v) => onChange({ fires_as: v })}
                   style={{ fontFamily: "var(--font-mono)" }} />
    </Section>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <Button variant="outline" onClick={onDelete}
                style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
        Delete rule
      </Button>
    </div>
  </div>
);


/* Generic key→value dict editor (for inputs / output blocks) */
const DictField = ({ label, value, onChange, hint }) => {
  const entries = value && typeof value === "object" ? Object.entries(value) : [];
  const update = (k, v) => onChange({ ...(value || {}), [k]: v });
  const remove = (k) => {
    const next = { ...(value || {}) }; delete next[k]; onChange(next);
  };
  const [newKey, setNewKey] = useState("");
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 24px", gap: 6, alignItems: "center" }}>
            <input value={k} readOnly
                    style={{ ...inp, fontFamily: "var(--font-mono)", background: "var(--surface-sunk)" }} />
            <input value={typeof v === "object" ? JSON.stringify(v) : String(v)}
                    onChange={(e) => update(k, e.target.value)}
                    style={inp} />
            <button onClick={() => remove(k)}
                    style={{ background: "transparent", border: "1px solid var(--danger-500)",
                                color: "var(--danger-700)", borderRadius: "var(--r-md)",
                                fontSize: "var(--fs-11)", padding: "2px 4px", cursor: "pointer" }}>×</button>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 24px", gap: 6 }}>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)}
                  placeholder="new key…" style={{ ...inp, fontFamily: "var(--font-mono)" }} />
          <input placeholder="value…" style={inp}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newKey.trim()) {
                      update(newKey.trim(), e.target.value); setNewKey(""); e.target.value = "";
                    }
                  }} />
          <span style={{ color: "var(--ink-400)", fontSize: "var(--fs-11)", textAlign: "center" }}>↵</span>
        </div>
      </div>
    </div>
  );
};


const RiskChip = ({ risk }) => {
  const t = { HIGH: ["var(--danger-50)","var(--danger-700)"],
              MEDIUM: ["var(--warn-50)","var(--warn-700)"],
              LOW: ["var(--success-50)","var(--success-700)"] }[risk] || ["var(--surface-sunk)","var(--ink-600)"];
  return (
    <span style={{ background: t[0], color: t[1], padding: "1px 8px",
                    borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>
      {risk}
    </span>
  );
};

const StatChip = ({ label, count, bg, fg }) => (
  <div style={{ background: bg, color: fg, padding: "6px 12px", borderRadius: "var(--r-md)",
                  fontSize: "var(--fs-12)", fontWeight: 600 }}>
    {label}: {count}
  </div>
);


const INTROS = {
  procurement: {
    title: "Procurement cleansing rules · staged HITL gates",
    what: <span>Rules that run at <strong>Stages 5, 6, 8, and 9</strong> of the pipeline.
      Each rule specifies its <strong>stage</strong>, whether it requires HITL (consultant) review,
      its <strong>logic</strong> (engine pseudocode), and its <strong>inputs/outputs</strong>.
      <strong>HIGH edit-risk</strong> rules touch every engagement — change with care.</span>,
    why: "These rules are the contract between raw client uploads and the canonical schema the engine reasons over. Adding a HITL rule means a new consultant review step. Adding a non-HITL auto rule means silent transformation — audit it carefully via implementation_note.",
    when: "Onboarding a new file type · adding a client-specific normalisation step · downgrading a chatty HITL rule to auto · documenting a planned rule before engineering wires it",
    exampleEdits: [
      "Add vendor-dedup rule that runs at Stage 8 (Gold) with HITL prompt",
      "Mark a planned rule implemented='not_implemented' + engineering note",
      "Change a rule from hitl_required=true to false once engine handles it",
    ],
  },
  universal: {
    title: "Universal data-quality rules · structural / blanks / dates / outliers",
    what: <span>Stage-7 (Bronze) checks that apply to <strong>any</strong> uploaded file regardless of file type.
      Severity controls behaviour: <strong>blocking</strong> rejects the upload entirely;
      <strong> warning</strong> creates a HITL flag for consultant review on Stage 6;
      <strong> auto-fix</strong> runs silently and is logged; <strong>info</strong> just records an observation.</span>,
    why: "These guardrails catch garbage uploads before they pollute downstream pillars. Tightening severity from warning → blocking will reject more files at the gate; loosening it the other way reduces consultant load but lets more questionable data through.",
    when: "Tightening DQ after a bad-data incident · adding a new generic check (e.g. unicode normalisation) · documenting a planned rule",
    exampleEdits: [
      "Add a rule that flags rows where unit_price × quantity ≠ net_value > 5%",
      "Change a chatty 'warning' to 'auto-fix' so consultants don't see it",
      'Document a planned rule with implemented="not_implemented"',
    ],
  },
};

const th = { textAlign: "left", padding: "10px 12px", fontSize: "var(--fs-11)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--ink-600)", borderBottom: "1px solid var(--border-default)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
              color: "var(--ink-800)", verticalAlign: "top" };
const dropdown = { padding: "7px 10px", border: "1px solid var(--border-default)",
                     borderRadius: "var(--r-md)", fontSize: "var(--fs-13)" };
const inp = { padding: "6px 10px", border: "1px solid var(--border-default)",
                borderRadius: "var(--r-md)", fontSize: "var(--fs-12)",
                background: "var(--surface-card)" };

export default RuleGridEditor;
