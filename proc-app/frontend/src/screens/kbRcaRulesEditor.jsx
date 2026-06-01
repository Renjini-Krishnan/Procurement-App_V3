/* RCA rules editor — for {pillar}/rca-rules.yml.
   Rules fire when a theme's metrics match a trigger. Each rule lists
   likely root causes + diagnostic_actions + references to patterns. */

import React, { useEffect, useMemo, useState } from "react";
import yaml from "js-yaml";
import { Card, Button, Input } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, TextAreaField, SelectField,
  TagList, ParseErrorBanner,
} from "./kbEditorPrimitives.jsx";

const CONFIDENCES = ["high", "medium", "low"];

const RcaRulesEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState("All");

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

  const rules = data.rules || [];
  const themes = useMemo(() => Array.from(new Set(rules.map((r) => r.theme).filter(Boolean))).sort(), [rules]);

  const filtered = useMemo(() => {
    let list = rules.map((r, i) => ({ r, idx: i }));
    if (themeFilter !== "All") list = list.filter(({ r }) => r.theme === themeFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(({ r }) =>
        (r.id || "").toLowerCase().includes(s) ||
        (r.trigger || "").toLowerCase().includes(s) ||
        ((r.root_causes || []).join(" ").toLowerCase().includes(s)));
    }
    return list;
  }, [rules, search, themeFilter]);

  const update = (idx, patch) => propagate({ ...data, rules: rules.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  const updateRefs = (idx, patch) => update(idx, { references: { ...(rules[idx].references || {}), ...patch } });

  const add = () => {
    let id = "rca.new.r01", n = 1;
    while (rules.some((r) => r.id === id)) id = `rca.new.r${String(++n).padStart(2, "0")}`;
    propagate({ ...data, rules: [...rules, { id, theme: themes[0] || "general", trigger: "",
                                                root_causes: [], confidence: "medium", references: {},
                                                diagnostic_actions: [] }] });
    setSelectedIdx(rules.length);
  };
  const del = (idx) => {
    if (!confirm(`Delete rule ${rules[idx]?.id}?`)) return;
    propagate({ ...data, rules: rules.filter((_, i) => i !== idx) });
    if (selectedIdx >= rules.length - 1) setSelectedIdx(Math.max(0, rules.length - 2));
  };

  const selected = rules[selectedIdx];

  return (
    <div>
      <EditorIntro
        title={`RCA rules · ${rules.length} rules · ${themes.length} themes`}
        what={
          <span>
            Each rule is an <strong>IF-THEN</strong>: when a theme's metrics match the trigger (e.g.
            "spend_central_pct &lt; 30% AND vendor_overlap_avg &gt; 50%"), the engine surfaces the
            listed root causes as hypotheses on the pillar's RCA panel. Rule-based output sits
            alongside AI-generated narrative (which Gemini drafts dynamically).
          </span>
        }
        why={
          <span>
            RCA rules are <strong>deterministic + auditable</strong> — they're what defends a
            finding in front of a sceptical client. AI narrative can be turned off; rule-based RCA
            keeps working. Adding rules here means more consistent diagnoses across engagements.
          </span>
        }
        when="A new failure mode is observed in field engagements that isn't yet codified · refining a trigger after seeing it fire too often / not enough · adding industry-specific root causes"
        exampleEdits={[
          'Add a rule for "central buying restricted to contracting only" with confidence=medium',
          "Tighten a trigger threshold from 50% → 70% after engagement feedback",
          "Add a third root cause to an existing rule",
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        {/* Sidebar */}
        <Card padding={0} style={{ display: "flex", flexDirection: "column", maxHeight: "75vh" }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>{filtered.length} of {rules.length} rules</Label>
              <Button size="sm" onClick={add}>+ Add</Button>
            </div>
            <Input placeholder="Search id / trigger / cause…" value={search}
                    onChange={(e) => setSearch(e.target.value)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {["All", ...themes].map((t) => (
                <button key={t} onClick={() => setThemeFilter(t)}
                         style={{ padding: "3px 8px", fontSize: "var(--fs-11)", fontWeight: 600,
                                    background: themeFilter === t ? "var(--brand-700)" : "var(--surface-card)",
                                    color: themeFilter === t ? "white" : "var(--ink-700)",
                                    border: "1px solid var(--border-default)",
                                    borderRadius: "var(--r-pill)", cursor: "pointer" }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowY: "auto", padding: 6 }}>
            {filtered.map(({ r, idx }) => {
              const isSelected = idx === selectedIdx;
              const confTone = r.confidence === "high" ? "var(--success-700)"
                              : r.confidence === "medium" ? "var(--warn-700)" : "var(--ink-500)";
              return (
                <button key={idx} onClick={() => setSelectedIdx(idx)}
                         style={{ display: "block", width: "100%", textAlign: "left",
                                    background: isSelected ? "var(--brand-50)" : "transparent",
                                    border: "none", padding: "8px 10px", marginBottom: 2,
                                    borderRadius: "var(--r-md)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
                                     fontWeight: 600, color: isSelected ? "var(--brand-700)" : "var(--ink-600)" }}>
                      {r.id}
                    </span>
                    <span style={{ fontSize: "var(--fs-10)", color: confTone, fontWeight: 700 }}>
                      {r.confidence}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>{r.theme}</div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-700)", marginTop: 3, lineHeight: 1.4 }}>
                    {(r.root_causes?.[0] || "(no root cause)").slice(0, 90)}…
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Form */}
        {selected ? (
          <Card padding={20}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Label>Rule ID</Label>
              <Button variant="outline" size="sm"
                       onClick={() => del(selectedIdx)}
                       style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>Delete</Button>
            </div>
            <Input value={selected.id} onChange={(e) => update(selectedIdx, { id: e.target.value })}
                    style={{ fontFamily: "var(--font-mono)" }} />

            <Section title="Theme + trigger"
                     subtitle="The IF clause — what data state causes this rule to fire.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <TextField label="Theme" value={selected.theme}
                             onChange={(v) => update(selectedIdx, { theme: v })} />
                <SelectField label="Confidence" value={selected.confidence}
                                onChange={(v) => update(selectedIdx, { confidence: v })}
                                options={CONFIDENCES} allowBlank={false} />
              </div>
              <div style={{ height: 10 }} />
              <TextAreaField label="Trigger"
                                hint="Free-text expression describing the condition. The engine matches against computed component values. Use the same identifiers as the theme outputs (e.g. spend_central_pct, c2_vendor_overlap_avg)."
                                value={selected.trigger} rows={4}
                                onChange={(v) => update(selectedIdx, { trigger: v })} />
            </Section>

            <Section title="Root causes"
                     subtitle="List of likely causes when the trigger matches. Each shows up as a separate diagnostic on the RCA panel.">
              <TagList label="Root cause hypotheses"
                          hint="One per chip — these are the consultant-facing narratives that follow 'because…'"
                          values={selected.root_causes}
                          onChange={(v) => update(selectedIdx, { root_causes: v })} />
            </Section>

            <Section title="References (linking to deeper documentation)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <TextField label="Pattern reference"
                             hint="Maps to a documented pattern in rca-patterns.md (free-text id)"
                             value={selected.references?.pattern || ""}
                             onChange={(v) => updateRefs(selectedIdx, { pattern: v })}
                             style={{ fontFamily: "var(--font-mono)" }} />
                <TextField label="Recommendation reference"
                             hint="Maps to a recommendation in recommendations.md"
                             value={selected.references?.recommendation || ""}
                             onChange={(v) => updateRefs(selectedIdx, { recommendation: v })}
                             style={{ fontFamily: "var(--font-mono)" }} />
              </div>
            </Section>

            <Section title="Diagnostic actions"
                     subtitle="What the consultant should verify before presenting the cause as conclusion.">
              <TagList label="Diagnostic actions"
                          hint="One per item — typically 'Verify via QRE Q-XX-YY' or 'Check column XYZ for…'"
                          values={selected.diagnostic_actions}
                          onChange={(v) => update(selectedIdx, { diagnostic_actions: v })} />
            </Section>
          </Card>
        ) : (
          <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
            Select a rule or click "+ Add"
          </Card>
        )}
      </div>
    </div>
  );
};

export default RcaRulesEditor;
