/* Scoring descriptors editor — for {pillar}/scoring-descriptors.yml.
   Each theme has 5 maturity band descriptors (Initial → Optimised). */

import React, { useEffect, useState } from "react";
import yaml from "js-yaml";
import { Card } from "../design/components.jsx";
import { EditorIntro, Section, Label, TextAreaField, TextField, ParseErrorBanner } from "./kbEditorPrimitives.jsx";

const BANDS = [
  { score: 1, label: "Initial",     color: "var(--danger-500)" },
  { score: 2, label: "Developing",  color: "var(--warn-500)" },
  { score: 3, label: "Defined",     color: "var(--brand-500)" },
  { score: 4, label: "Managed",     color: "var(--success-500)" },
  { score: 5, label: "Optimised",   color: "var(--success-700)" },
];

const ScoringEditor = ({ yamlText, onChange }) => {
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

  const themes = data.themes || {};
  const themeIds = Object.keys(themes);

  const updateTheme = (id, patch) => propagate({
    ...data, themes: { ...themes, [id]: { ...themes[id], ...patch } },
  });

  const updateBand = (themeId, band, text) => propagate({
    ...data,
    themes: {
      ...themes,
      [themeId]: {
        ...themes[themeId],
        band_descriptors: { ...(themes[themeId]?.band_descriptors || {}), [band]: text },
      },
    },
  });

  return (
    <div>
      <EditorIntro
        title={`Scoring descriptors · ${themeIds.length} themes`}
        what={
          <span>
            Each theme has 5 <strong>maturity band descriptors</strong> (Initial → Optimised). These
            are the consultant-facing paragraphs shown on pillar maturity gauges, in the Findings
            Deck, and in Exec Summary. The engine maps a computed numeric score to a band; the
            band's descriptor is what the consultant reads.
          </span>
        }
        why="Descriptors are the verbal interpretation of every theme score in every export the client sees. Vague descriptors → vague stories. Industry-specific edits (e.g. steel-specific descriptors for centralisation) make findings sound credible."
        when="Adjusting wording for an industry overlay · adding more specific examples of what each band looks like · re-balancing the theme weight"
        exampleEdits={[
          "Steel: change 'Defined' for centralisation to explicitly mention multi-plant pooling",
          "Adjust theme weight from 0.35 → 0.40 to emphasise a particular theme",
          "Sharpen Initial vs Developing distinction with concrete examples",
        ]}
      />

      {themeIds.length === 0 && (
        <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
          No themes in this file.
        </Card>
      )}

      {themeIds.map((id) => {
        const t = themes[id] || {};
        const bands = t.band_descriptors || {};
        return (
          <Card key={id} padding={20} style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <Label hint="Mono-spaced theme identifier — used by the engine. Don't rename if pillar code references it.">
                  Theme ID
                </Label>
                <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "var(--fs-14)",
                                 fontWeight: 600, color: "var(--ink-900)" }}>{id}</div>
              </div>
              <TextField label="Weight (fraction)" type="number"
                            hint="Theme contribution to pillar score (sum should = 1.0)"
                            value={t.weight}
                            onChange={(v) => updateTheme(id, { weight: v })} />
            </div>
            <TextField label="Display label (UI)" value={t.label}
                         onChange={(v) => updateTheme(id, { label: v })} />

            <Section title="Maturity band descriptors"
                     subtitle="One paragraph per band. Shown verbatim on pillar pages + Findings Deck.">
              {BANDS.map((b) => (
                <div key={b.score} style={{ marginBottom: 12, padding: 12,
                                                  borderLeft: `3px solid ${b.color}`,
                                                  background: "var(--surface-sunk)",
                                                  borderRadius: "0 var(--r-md) var(--r-md) 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: "var(--fs-12)", fontFamily: "var(--font-mono)",
                                       color: "var(--ink-500)", marginRight: 8 }}>
                        Score {b.score}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>{b.label}</span>
                    </div>
                  </div>
                  <textarea value={bands[b.score] || bands[String(b.score)] || ""}
                              onChange={(e) => updateBand(id, b.score, e.target.value)}
                              placeholder={`Describe what '${b.label}' looks like for ${t.label || id}…`}
                              rows={2}
                              style={{ width: "100%", padding: 10, resize: "vertical",
                                        fontFamily: "var(--font-sans)", fontSize: "var(--fs-13)",
                                        border: "1px solid var(--border-default)",
                                        borderRadius: "var(--r-md)", lineHeight: 1.5,
                                        background: "var(--surface-card)" }} />
                </div>
              ))}
            </Section>
          </Card>
        );
      })}
    </div>
  );
};

export default ScoringEditor;
