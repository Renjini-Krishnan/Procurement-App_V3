/* QRE bank editor — for qre-bank.yml.
   51 questions consultants ask clients to fill in the QRE stage.
   Each question has pillar, theme, answer_type, options, etc. */

import React, { useEffect, useMemo, useState } from "react";
import yaml from "js-yaml";
import { Card, Button, Input } from "../design/components.jsx";
import {
  EditorIntro, Section, Label, TextField, SelectField, TextAreaField,
  CheckboxField, TagList, ItemCard, ParseErrorBanner,
} from "./kbEditorPrimitives.jsx";

const PILLARS = ["op-model", "doa", "buying-channel", "org-structure",
                  "pr-to-po", "post-po", "supplier", "material-master"];

const ANSWER_TYPES = [
  { value: "yes_no_partial",  label: "Yes / Partial / No" },
  { value: "range_band",       label: "Percentage range bands" },
  { value: "count_band",       label: "Count range bands" },
  { value: "categorical",      label: "Categorical (pick one)" },
  { value: "multi_categorical",label: "Categorical (pick many)" },
  { value: "maturity_scale",   label: "Maturity 1-4 (Ad hoc → Managed)" },
  { value: "free_text",        label: "Free text" },
  { value: "numeric",          label: "Numeric (single value)" },
];

const QreBankEditor = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState("All");

  useEffect(() => {
    try {
      const parsed = yaml.load(yamlText) || {};
      setData({
        metadata: parsed.metadata || {},
        qres: Array.isArray(parsed.qres) ? parsed.qres : [],
      });
      setParseError(null);
      if (parsed.qres?.length && !selectedId) setSelectedId(parsed.qres[0].id);
    } catch (e) {
      setParseError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const propagate = (next) => {
    setData(next);
    try {
      onChange(yaml.dump({ metadata: next.metadata, qres: next.qres },
        { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' }));
    } catch (e) { setParseError(e.message); }
  };

  if (parseError) return <ParseErrorBanner error={parseError} />;
  if (!data) return <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading…</div>;

  const qres = data.qres;
  const filtered = useMemo(() => {
    let list = qres;
    if (pillarFilter !== "All") list = list.filter((q) => q.pillar === pillarFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((q) =>
        (q.id || "").toLowerCase().includes(s) ||
        (q.question || "").toLowerCase().includes(s) ||
        (q.theme || "").toLowerCase().includes(s));
    }
    return list;
  }, [qres, pillarFilter, search]);

  const selected = qres.find((q) => q.id === selectedId);

  const updateQre = (id, patch) => propagate({
    ...data,
    qres: qres.map((q) => q.id === id ? { ...q, ...patch } : q),
  });

  const addQre = () => {
    let id = "Q-NEW-01", n = 1;
    while (qres.some((q) => q.id === id)) id = `Q-NEW-${String(++n).padStart(2, "0")}`;
    const newQ = {
      id, pillar: "op-model", theme: "general",
      question: "Replace with the question text…",
      answer_type: "maturity_scale", options: [],
      compulsory: false, used_by: [],
    };
    propagate({ ...data, qres: [...qres, newQ] });
    setSelectedId(id);
  };
  const deleteQre = (id) => {
    if (!confirm(`Delete question ${id}?`)) return;
    const next = { ...data, qres: qres.filter((q) => q.id !== id) };
    propagate(next);
    if (selectedId === id) setSelectedId(next.qres[0]?.id || null);
  };
  const duplicateQre = (id) => {
    const src = qres.find((q) => q.id === id); if (!src) return;
    let copyId = `${src.id}-COPY`, n = 1;
    while (qres.some((q) => q.id === copyId)) copyId = `${src.id}-COPY-${++n}`;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: copyId };
    propagate({ ...data, qres: [...qres, copy] });
    setSelectedId(copyId);
  };

  // Counts per pillar
  const countsByPillar = useMemo(() => {
    const c = { All: qres.length };
    PILLARS.forEach((p) => { c[p] = qres.filter((q) => q.pillar === p).length; });
    return c;
  }, [qres]);

  return (
    <div>
      <EditorIntro
        title={`QRE bank · ${qres.length} questions`}
        what={
          <span>
            These are the <strong>Qualitative-Response Engagement</strong> questions consultants put
            to the client on Stage 15 (QRE). Each question feeds one or more pillars' theme
            calculations (e.g. centralisation, shared services, DoA tier mapping). Without QRE
            responses, those pillars return "needs QRE" instead of a maturity score.
          </span>
        }
        why="Adding a question here makes it appear on the QRE form for every engagement going forward. The 'used by' field tells the engine which pillar themes consume the answer — change those carefully or the pillar engine will fail to find the input it expects."
        when="A new pillar / theme is added that needs a qualitative input · industry-specific question variant · the client raises a recurring issue you want captured systematically"
        exampleEdits={[
          'Add a "Sustainability — Scope 3 maturity" question for the Org Structure pillar',
          "Change a question's answer type from 'maturity_scale' to 'yes_no_partial' if the engine expects a boolean now",
          "Mark a question compulsory so consultants can't skip it",
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        {/* Sidebar */}
        <Card padding={0} style={{ display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>{filtered.length} of {qres.length} questions</Label>
              <Button size="sm" onClick={addQre}>+ Add</Button>
            </div>
            <Input placeholder="Search id / question / theme…" value={search}
                    onChange={(e) => setSearch(e.target.value)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {["All", ...PILLARS].map((p) => (
                <button key={p} onClick={() => setPillarFilter(p)}
                         style={{ padding: "3px 8px", fontSize: "var(--fs-11)", fontWeight: 600,
                                    background: pillarFilter === p ? "var(--brand-700)" : "var(--surface-card)",
                                    color: pillarFilter === p ? "white" : "var(--ink-700)",
                                    border: "1px solid var(--border-default)",
                                    borderRadius: "var(--r-pill)", cursor: "pointer" }}>
                  {p} · {countsByPillar[p] || 0}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowY: "auto", padding: "6px 6px 8px" }}>
            {filtered.map((q) => {
              const isSelected = q.id === selectedId;
              return (
                <button key={q.id} onClick={() => setSelectedId(q.id)}
                         style={{ display: "block", width: "100%", textAlign: "left",
                                    background: isSelected ? "var(--brand-50)" : "transparent",
                                    border: "none", padding: "8px 10px", marginBottom: 2,
                                    borderRadius: "var(--r-md)", cursor: "pointer" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
                                  fontWeight: 600, color: isSelected ? "var(--brand-700)" : "var(--ink-600)" }}>
                    {q.id} · {q.pillar}
                  </div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-900)", marginTop: 3, lineHeight: 1.4 }}>
                    {(q.question || "").slice(0, 80)}{(q.question || "").length > 80 ? "…" : ""}
                  </div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", marginTop: 2 }}>
                    {q.theme} · {q.answer_type}{q.compulsory ? " · required" : ""}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 16, color: "var(--ink-500)", fontSize: "var(--fs-12)" }}>No questions match.</div>}
          </div>
        </Card>

        {/* Form */}
        {selected ? (
          <Card padding={20}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <Label>Question ID</Label>
                <Input value={selected.id} disabled style={{ marginTop: 4, fontFamily: "var(--font-mono)",
                                                                 background: "var(--surface-sunk)" }} />
                <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", marginTop: 4 }}>
                  ID is the primary key — used by pillar engines via `used_by`. Renaming breaks references.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Button size="sm" variant="outline" onClick={() => duplicateQre(selected.id)}>Duplicate</Button>
                <Button size="sm" variant="outline"
                          onClick={() => deleteQre(selected.id)}
                          style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
                  Delete
                </Button>
              </div>
            </div>

            <Section title="Question text + pillar binding">
              <TextAreaField label="Question text"
                                hint="What the consultant will read out to the client. Keep it specific, plain-English."
                                value={selected.question} rows={3}
                                onChange={(v) => updateQre(selected.id, { question: v })} />
              <div style={{ height: 10 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <SelectField label="Pillar" value={selected.pillar}
                                onChange={(v) => updateQre(selected.id, { pillar: v })}
                                options={PILLARS} allowBlank={false} />
                <TextField label="Theme (within pillar)"
                             hint="e.g. centralisation, shared-services, document-audit"
                             value={selected.theme}
                             onChange={(v) => updateQre(selected.id, { theme: v })} />
                <div>
                  <Label>Compulsory?</Label>
                  <div style={{ marginTop: 8 }}>
                    <CheckboxField label="Required to submit"
                                     hint="Engine errors if missing"
                                     value={selected.compulsory}
                                     onChange={(v) => updateQre(selected.id, { compulsory: v })} />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Answer shape"
                     subtitle="Determines what control the consultant sees + how the engine parses the response.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SelectField label="Answer type" value={selected.answer_type}
                                onChange={(v) => updateQre(selected.id, { answer_type: v })}
                                options={ANSWER_TYPES} allowBlank={false} />
              </div>
              <div style={{ height: 10 }} />
              {(["range_band", "count_band", "categorical", "multi_categorical", "yes_no_partial"].includes(selected.answer_type)) && (
                <TagList label="Options"
                            hint={selected.answer_type === "yes_no_partial"
                              ? "Use this for Yes/No type questions; typical: ['Yes', 'No', 'Partial']."
                              : "What the consultant picks from. Listed in display order."}
                            values={selected.options}
                            onChange={(v) => updateQre(selected.id, { options: v })} />
              )}
            </Section>

            <Section title="Engine wiring (advanced)"
                     subtitle="Pillar engines reference this question via 'used_by'. Mis-spelling breaks scoring.">
              <TagList label="Used by"
                          hint="One per engine reference. Format: 'pillar.theme.component_id'. e.g. opmodel.centralisation.c0_baseline"
                          monoChips
                          values={selected.used_by}
                          onChange={(v) => updateQre(selected.id, { used_by: v })} />
              <div style={{ height: 10 }} />
              <TextAreaField label="Notes (consultant guidance)"
                                hint="Shown to the consultant under the question on Stage 15. Use to explain ambiguities, give examples."
                                value={selected.notes} rows={2}
                                onChange={(v) => updateQre(selected.id, { notes: v })} />
            </Section>
          </Card>
        ) : (
          <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
            Select a question or click "+ Add"
          </Card>
        )}
      </div>
    </div>
  );
};

export default QreBankEditor;
