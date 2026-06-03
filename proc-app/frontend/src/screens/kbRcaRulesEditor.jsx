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

  // All hooks must run on every render — keep useMemo above the early
  // returns below. React's Rules of Hooks: hook count must be stable.
  const rules = data?.rules || [];
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

  // Auto-extract all metric identifiers used across triggers. Above the
  // early returns to satisfy Rules of Hooks.
  const metricInventory = useMemo(() => extractMetrics(rules), [rules]);

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

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
            Each rule is an <strong>IF (trigger) → THEN (root causes + recommendation)</strong> mapping.
            When a pillar runs, the engine computes per-theme metrics; if the metrics match a rule's
            trigger condition, the rule fires and the listed root causes appear as RCA cards on the
            pillar page.
            <br/><br/>
            <strong>Trigger</strong> is free-text that references metric identifiers the pillar
            engine computes. The "Available metrics" panel below lists every identifier already
            referenced by another rule — use it as your reference vocabulary for this pillar.
            <br/><br/>
            <strong>Root causes</strong> are the consultant-facing diagnoses ("Spend distribution
            outgrew bucket thresholds", etc.). The first one becomes the card headline; the rest
            render as bullets.
            <br/><br/>
            <strong>Confidence</strong> controls the severity badge: high = strong evidence,
            medium = likely, low = hypothesis.
          </span>
        }
        why={
          <span>
            Rule-based RCA is <strong>deterministic + auditable</strong> — it's what defends a
            finding in front of a sceptical client. AI narrative (Gemini) can be turned off; these
            rules keep working. Adding rules here means more consistent diagnoses across engagements.
          </span>
        }
        when="A new failure mode is observed in field engagements that isn't yet codified · refining a trigger threshold after seeing it fire too often / not enough · adding industry-specific root causes"
        exampleEdits={[
          'Add rule "central buying restricted to contracting only" with confidence=medium',
          'Tighten trigger threshold from 50% → 70% after engagement feedback',
          'Add a third root cause to an existing rule',
        ]}
      />

      {/* Available metrics reference — auto-extracted from existing triggers. */}
      {metricInventory.length > 0 && (
        <Card padding={14} style={{ marginBottom: 16, background: "var(--surface-sunk)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Label hint="Metric identifiers extracted from every existing rule's trigger. Use these in new triggers — they're the engine-computed values you can reference.">
              Available metrics in this pillar · {metricInventory.length}
            </Label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {metricInventory.map((m) => (
              <span key={m.metric}
                    title={`Used in ${m.count} rule(s) · sample trigger: ${m.metric} ${m.sample_op} ${m.sample_threshold}`}
                    style={{ padding: "3px 8px", background: "var(--surface-card)",
                                border: "1px solid var(--border-default)",
                                borderRadius: "var(--r-pill)",
                                fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
                                color: "var(--ink-800)", cursor: "help" }}>
                {m.metric} <span style={{ color: "var(--ink-500)" }}>· {m.count}</span>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
            Hover any chip to see how it's used in existing triggers. Component prefixes
            <code style={{ fontFamily: "var(--font-mono)", margin: "0 4px" }}>bc1_</code>
            <code style={{ fontFamily: "var(--font-mono)", margin: "0 4px" }}>c2_</code>
            <code style={{ fontFamily: "var(--font-mono)", margin: "0 4px" }}>ts3_</code>
            map to component IDs in the pillar's analysis-config.yml.
          </div>
        </Card>
      )}

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

            <Section title="When does this rule fire?"
                     subtitle="IF the trigger expression evaluates true on the pillar's computed metrics → THEN the root causes below are shown as RCA cards.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <TextField label="Theme this rule belongs to" value={selected.theme}
                             hint="Pillar theme id (e.g. centralisation, tail-spend, document-audit)"
                             onChange={(v) => update(selectedIdx, { theme: v })} />
                <SelectField label="Confidence (severity badge)" value={selected.confidence}
                                onChange={(v) => update(selectedIdx, { confidence: v })}
                                options={CONFIDENCES} allowBlank={false}
                                hint="high → red severity · medium → amber · low → grey" />
              </div>
              <div style={{ height: 10 }} />
              <TextAreaField label="Trigger expression (the IF)"
                                hint="Plain text describing the condition. Reference engine-computed metrics by their identifier (see the 'Available metrics' panel above). Operators: < · > · <= · >= · == · AND · OR. Example: 'seventy_rule_pct < 60 AND cap_breach_pct > 10'."
                                value={selected.trigger} rows={4}
                                onChange={(v) => update(selectedIdx, { trigger: v })} />
            </Section>

            <Section title="What does the consultant see when this rule fires? (THEN)"
                     subtitle="One RCA card is rendered with the first root cause as headline + remaining causes as evidence bullets.">
              <TagList label="Root cause hypotheses (in order)"
                          hint="The first chip becomes the card headline. Remaining chips render as evidence bullets. Write as full consultant-facing sentences."
                          values={selected.root_causes}
                          onChange={(v) => update(selectedIdx, { root_causes: v })} />
            </Section>

            <Section title="Recommendation + pattern references"
                     subtitle="The card's 'Recommendation' link jumps to the doc with detailed remediation steps.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <TextField label="Pattern doc id"
                             hint="Points to an entry in rca-patterns.md (this pillar's KB folder)"
                             value={selected.references?.pattern || ""}
                             onChange={(v) => updateRefs(selectedIdx, { pattern: v })}
                             style={{ fontFamily: "var(--font-mono)" }} />
                <TextField label="Recommendation doc id"
                             hint="Points to an entry in recommendations.md (this pillar's KB folder)"
                             value={selected.references?.recommendation || ""}
                             onChange={(v) => updateRefs(selectedIdx, { recommendation: v })}
                             style={{ fontFamily: "var(--font-mono)" }} />
              </div>
            </Section>

            <Section title="Diagnostic actions for the consultant"
                     subtitle="Pre-presentation checks. Shown beneath the recommendation as a checklist the consultant works through before walking the client through this finding.">
              <TagList label="Verify-before-presenting list"
                          hint="One per chip. Typical formats: 'Verify via QRE Q-OM-01', 'Cross-check with vendor master', 'Confirm with plant head'."
                          values={selected.diagnostic_actions}
                          onChange={(v) => update(selectedIdx, { diagnostic_actions: v })} />
            </Section>

            {/* Runtime preview — what the consultant actually sees on the pillar RCA panel */}
            <RuntimePreview rule={selected} />
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

/* Walk every rule's trigger string, pull out identifiers that look like
   engine metrics (snake_case words), and dedupe with usage counts. */
const extractMetrics = (rules) => {
  const map = new Map();   // metric → {count, sample_op, sample_threshold, used_in_rules:[]}
  const TOKEN = /\b([a-z][a-z0-9_]{2,}(?:_pct|_count|_share|_rate|_avg|_inr|_inr_cr|_days|_score|_pct_typical|_typical|_target)?)\b/g;
  const OPS_RE = /\b([a-z_][a-z0-9_]*)\s*(<=|>=|==|!=|<|>)\s*([0-9.]+%?)/g;
  const SKIP = new Set(["and","or","not","true","false","null","if","then","else"]);
  for (const r of rules) {
    const trig = String(r.trigger || "");
    // Identify operator-comparison candidates first (they're the real metrics)
    let m;
    OPS_RE.lastIndex = 0;
    while ((m = OPS_RE.exec(trig)) !== null) {
      const [, ident, op, thr] = m;
      if (SKIP.has(ident)) continue;
      const entry = map.get(ident) || { metric: ident, count: 0,
                                          sample_op: op, sample_threshold: thr,
                                          used_in_rules: [] };
      entry.count += 1;
      if (!entry.used_in_rules.includes(r.id)) entry.used_in_rules.push(r.id);
      map.set(ident, entry);
    }
    // Also catch bare identifiers (boolean checks, function-like usage)
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(trig)) !== null) {
      const ident = m[1];
      if (SKIP.has(ident)) continue;
      if (!map.has(ident)) {
        map.set(ident, { metric: ident, count: 1, sample_op: "—", sample_threshold: "—",
                          used_in_rules: [r.id] });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.metric.localeCompare(b.metric));
};


/* Runtime preview — shows the consultant exactly what this rule produces
   when it fires, so they can sanity-check before saving. */
const RuntimePreview = ({ rule }) => {
  const causes = rule.root_causes || [];
  if (causes.length === 0 && !rule.trigger) return null;
  const conf = rule.confidence || "medium";
  const sevColor = { high: "var(--danger-700)", medium: "var(--warn-700)", low: "var(--ink-500)" }[conf];
  const sevBg    = { high: "var(--danger-50)",  medium: "var(--warn-50)",  low: "var(--surface-sunk)" }[conf];
  return (
    <Section title="Preview · what the consultant sees on the pillar RCA panel"
             subtitle="Live render of how this rule will display when it fires.">
      <div style={{ padding: 14, border: "1px solid var(--border-default)",
                      borderRadius: "var(--r-md)", background: "var(--surface-card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
            {rule.id || "(no id)"}
          </div>
          <span style={{ background: sevBg, color: sevColor, padding: "2px 10px",
                            borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 700 }}>
            {conf} confidence
          </span>
        </div>
        <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-900)", marginBottom: 8 }}>
          {causes[0] || "(no root cause set)"}
        </div>
        {causes.length > 1 && (
          <ul style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", paddingLeft: 18, margin: 0 }}>
            {causes.slice(1).map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
        {(rule.diagnostic_actions || []).length > 0 && (
          <div style={{ marginTop: 10, padding: 10, background: "var(--surface-sunk)", borderRadius: "var(--r-md)" }}>
            <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em",
                            color: "var(--ink-500)", fontWeight: 600, marginBottom: 4 }}>Verify before presenting</div>
            <ul style={{ fontSize: "var(--fs-12)", color: "var(--ink-700)", paddingLeft: 18, margin: 0 }}>
              {rule.diagnostic_actions.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
        {(rule.references?.recommendation || rule.references?.pattern) && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border-subtle)",
                          fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
            See: <code style={{ fontFamily: "var(--font-mono)" }}>{rule.references?.recommendation || rule.references?.pattern}</code>
          </div>
        )}
      </div>
    </Section>
  );
};


export default RcaRulesEditor;
