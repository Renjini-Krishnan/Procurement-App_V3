/* Structured editors for known KB file schemas.
   Falls through to raw textarea for unrecognised files.
   Each editor:
     - Renders sections clearly labeled
     - Surfaces "edit-worthy" fields at the top of each section
     - Serializes back to YAML on save
*/
import React, { useState, useMemo, useEffect } from "react";
import yaml from "js-yaml";
import { Card, Badge, Button, Callout, Input } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import CategoriesMasterView from "./kbCategoriesEditor.jsx";

/* ============================================================
   Registry — match file path to a view component
   ============================================================ */

export function pickStructuredView(rel_path) {
  if (rel_path === "_meta/kpi-rca-library.yml") return RcaLibraryView;
  if (rel_path.endsWith("/benchmarks.yml")) return BenchmarksView;
  if (rel_path.endsWith("categories-master.yml")) return CategoriesMasterView;
  return null;
}

/* ============================================================
   View 1 — kpi-rca-library.yml (KPI × score band × narrative)
   ============================================================ */

const RcaLibraryView = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    try {
      setData(yaml.load(yamlText));
      setParseError(null);
    } catch (e) { setParseError(String(e)); }
  }, [yamlText]);

  // Push YAML back whenever data changes
  const flush = (next) => {
    setData(next);
    try {
      const text = yaml.dump(next, { lineWidth: 120, noRefs: true, sortKeys: false });
      onChange(text);
    } catch (e) { setParseError(String(e)); }
  };

  if (parseError) return <Callout tone="danger" title="YAML parse error" icon={<I.X size={16} />}>{parseError}</Callout>;
  if (!data) return <div style={{ color: "var(--ink-500)" }}>Parsing…</div>;
  const kpis = data.kpis || {};

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Callout tone="info" title="Structured editor — kpi-rca-library.yml" icon={<I.Doc size={16} />}>
        Each KPI is a section below. Inside each section you'll see the four score bands
        (1=Foundation → 4=Leading) with the editable narratives (insight · action · benefit)
        and per-pillar implications. Click "Edit raw YAML" at the top right to switch to
        text mode for advanced edits.
      </Callout>

      <Card padding={20}>
        <Label>Metadata</Label>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Library version">
            <Input value={data.metadata?.version || ""} onChange={(e) =>
              flush({ ...data, metadata: { ...(data.metadata || {}), version: e.target.value }})} />
          </Field>
          <Field label="Score scale">
            <Input value={data.metadata?.score_scale || ""} onChange={(e) =>
              flush({ ...data, metadata: { ...(data.metadata || {}), score_scale: e.target.value }})} />
          </Field>
        </div>
      </Card>

      <Label>KPIs · {Object.keys(kpis).length} total · click a section to expand</Label>

      {Object.entries(kpis).map(([kpiId, kpi]) => {
        const isOpen = expanded[kpiId];
        return (
          <Card key={kpiId} padding={0} style={{ overflow: "hidden" }}>
            <button onClick={() => setExpanded({ ...expanded, [kpiId]: !isOpen })}
                    style={{ width: "100%", padding: "16px 20px", textAlign: "left",
                             background: isOpen ? "var(--brand-50)" : "var(--surface-card)",
                             border: "none", cursor: "pointer", display: "flex",
                             justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{kpiId}</code>
                <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, color: "var(--ink-900)", marginTop: 2 }}>{kpi.label}</div>
                <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>
                  {kpi.unit} · {kpi.direction} · affects: {(kpi.pillars_affected || []).join(", ")}
                </div>
              </div>
              <span style={{ fontSize: "var(--fs-20)", color: "var(--brand-600)" }}>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-subtle)" }}>
                <SubLabel>Editable score-band narratives — these are the most-tuned content</SubLabel>
                <div style={{ marginTop: 12, display: "grid", gap: 16 }}>
                  {[1, 2, 3, 4].map((b) => {
                    const band = kpi.bands?.[b] || {};
                    const updateBand = (patch) => {
                      const next = { ...data };
                      next.kpis[kpiId].bands[b] = { ...band, ...patch };
                      flush(next);
                    };
                    return (
                      <Card key={b} padding={16} style={{ borderLeft: `4px solid ${bandColor(b)}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <strong style={{ fontSize: "var(--fs-14)" }}>Band {b} — {bandLabel(b)}</strong>
                          <Badge tone="neutral">{Object.keys(band.pillar_implications || {}).length} pillar implications</Badge>
                        </div>

                        <Field label="Insight (the headline finding)" highlight>
                          <Textarea value={band.insight || ""} onChange={(v) => updateBand({ insight: v })} rows={2} />
                        </Field>
                        <Field label="Action (what to do)" highlight>
                          <Textarea value={band.action || ""} onChange={(v) => updateBand({ action: v })} rows={2} />
                        </Field>
                        <Field label="Benefit (expected upside)" highlight>
                          <Textarea value={band.benefit || ""} onChange={(v) => updateBand({ benefit: v })} rows={2} />
                        </Field>

                        <SubLabel style={{ marginTop: 14 }}>Per-pillar implications</SubLabel>
                        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                          {Object.entries(band.pillar_implications || {}).map(([pid, txt]) => (
                            <Field key={pid} label={pid} compact>
                              <Textarea value={txt} onChange={(v) => updateBand({ pillar_implications: { ...band.pillar_implications, [pid]: v }})} rows={2} />
                            </Field>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

/* ============================================================
   View 2 — <pillar>/benchmarks.yml (numeric value + source)
   ============================================================ */

const BenchmarksView = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    try {
      setData(yaml.load(yamlText));
      setParseError(null);
    } catch (e) { setParseError(String(e)); }
  }, [yamlText]);

  const flush = (next) => {
    setData(next);
    try {
      onChange(yaml.dump(next, { lineWidth: 120, noRefs: true, sortKeys: false }));
    } catch (e) { setParseError(String(e)); }
  };

  if (parseError) return <Callout tone="danger" title="YAML parse error" icon={<I.X size={16} />}>{parseError}</Callout>;
  if (!data) return <div style={{ color: "var(--ink-500)" }}>Parsing…</div>;

  const benchmarks = data.benchmarks || {};
  const entries = Object.entries(benchmarks);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Callout tone="info" title="Structured editor — benchmarks.yml" icon={<I.Doc size={16} />}>
        Numeric benchmarks for this pillar. Edit the value(s), source, year, and confidence.
        These flow through the cascade (function default → industry overlay → engagement override).
      </Callout>

      <Card padding={20}>
        <Label>Metadata</Label>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Pillar"><Input value={data.metadata?.pillar || ""} onChange={(e) =>
            flush({ ...data, metadata: { ...(data.metadata || {}), pillar: e.target.value }})} /></Field>
          <Field label="Version"><Input value={data.metadata?.version || ""} onChange={(e) =>
            flush({ ...data, metadata: { ...(data.metadata || {}), version: e.target.value }})} /></Field>
        </div>
      </Card>

      <Label>Benchmarks · {entries.length} total</Label>

      {entries.map(([bId, b]) => {
        const updateB = (patch) => {
          const next = { ...data };
          next.benchmarks[bId] = { ...b, ...patch };
          flush(next);
        };
        const updatePrimary = (patch) => updateB({ primary: { ...(b.primary || {}), ...patch }});
        const primary = b.primary || {};
        return (
          <Card key={bId} padding={20}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{bId}</code>
                <div style={{ fontSize: "var(--fs-15)", fontWeight: 600 }}>{b.name || bId}</div>
              </div>
              <Badge tone="neutral">{primary.unit || "—"}</Badge>
            </div>

            <SubLabel>Editable value(s)</SubLabel>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {primary.value !== undefined && (
                <Field label="value" highlight>
                  <Input value={primary.value ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    const n = Number(v);
                    updatePrimary({ value: isNaN(n) ? v : n });
                  }} />
                </Field>
              )}
              {Array.isArray(primary.value_range) && (
                <>
                  <Field label="value_range — low" highlight>
                    <Input value={primary.value_range[0] ?? ""} onChange={(e) => {
                      const v = Number(e.target.value);
                      updatePrimary({ value_range: [isNaN(v) ? e.target.value : v, primary.value_range[1]] });
                    }} />
                  </Field>
                  <Field label="value_range — high" highlight>
                    <Input value={primary.value_range[1] ?? ""} onChange={(e) => {
                      const v = Number(e.target.value);
                      updatePrimary({ value_range: [primary.value_range[0], isNaN(v) ? e.target.value : v] });
                    }} />
                  </Field>
                </>
              )}
              {primary.unit !== undefined && (
                <Field label="unit"><Input value={primary.unit ?? ""} onChange={(e) => updatePrimary({ unit: e.target.value })} /></Field>
              )}
            </div>

            <SubLabel style={{ marginTop: 12 }}>Citation</SubLabel>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
              <Field label="source" highlight><Input value={primary.source ?? ""} onChange={(e) => updatePrimary({ source: e.target.value })} /></Field>
              <Field label="year"><Input value={primary.year ?? ""} onChange={(e) => updatePrimary({ year: Number(e.target.value) || e.target.value })} /></Field>
              <Field label="confidence"><Input value={primary.confidence ?? ""} onChange={(e) => updatePrimary({ confidence: e.target.value })} /></Field>
            </div>

            {b.description && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>Description (less commonly edited)</summary>
                <Textarea value={b.description} onChange={(v) => updateB({ description: v })} rows={4} />
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
};

/* ============================================================
   Shared primitives
   ============================================================ */

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", fontWeight: 600 }}>{children}</div>
);
const SubLabel = ({ children, style }) => (
  <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-600)", fontWeight: 600, ...style }}>{children}</div>
);
const Field = ({ label, children, highlight, compact }) => (
  <div style={{ marginBottom: compact ? 6 : 10 }}>
    <div style={{ fontSize: "var(--fs-11)", color: highlight ? "var(--brand-700)" : "var(--ink-600)",
                   textTransform: "uppercase", letterSpacing: "0.08em",
                   fontWeight: 600, marginBottom: 4 }}>
      {label}{highlight && <span style={{ marginLeft: 4, color: "var(--brand-500)" }}>★</span>}
    </div>
    {children}
  </div>
);
const Textarea = ({ value, onChange, rows = 3 }) => (
  <textarea value={value || ""} onChange={(e) => onChange(e.target.value)}
            rows={rows} spellCheck={true}
            style={{ width: "100%", padding: 10, fontSize: "var(--fs-13)",
                     fontFamily: "var(--font-sans)", lineHeight: 1.5,
                     border: "1px solid var(--border-default)",
                     borderRadius: "var(--r-md)", background: "var(--surface-card)",
                     color: "var(--ink-900)", resize: "vertical", outline: "none" }} />
);

const bandColor = (b) => ({ 1: "var(--danger-500)", 2: "var(--warn-500)",
                            3: "var(--brand-500)", 4: "var(--success-500)" })[b];
const bandLabel = (b) => ({ 1: "Foundation", 2: "Developing", 3: "Performing", 4: "Leading" })[b];
