import React, { useEffect, useMemo, useState } from "react";
import { Card, Badge, Button, Callout, Input, Select } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 6 (QRE) — 52 maturity questions per Client Pack v10.
   Scored 1-4 with optional evidence. Persists to backend; engines load
   from DB when responses exist. */

const SCORE_OPTIONS = [
  { v: 1, label: "1 — Ad hoc / absent" },
  { v: 2, label: "2 — Emerging / partial" },
  { v: 3, label: "3 — Defined / documented" },
  { v: 4, label: "4 — Managed / measured" },
];

const QRE = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [activeArea, setActiveArea] = useState("All");
  const [hideAnswered, setHideAnswered] = useState(false);
  const [requiredOnly, setRequiredOnly] = useState(false);  // "show only questions consumed by a pillar engine"

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.getQRE(engagement.id);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  const updateResp = (id, patch) => {
    setData((d) => ({
      ...d,
      responses: d.responses.map((r) => r.id === id ? { ...r, ...patch } : r),
    }));
    setSavedMsg(null);
  };

  const save = async () => {
    setSaving(true); setSavedMsg(null); setError(null);
    try {
      const onlyAnswered = data.responses.filter((r) => r.score !== null && r.score !== undefined && r.score !== "");
      await api.saveQRE(engagement.id, onlyAnswered);
      setSavedMsg(`Saved ${onlyAnswered.length} responses.`);
      // Refresh counts
      const r = await api.getQRE(engagement.id);
      setData(r);
    } catch (e) {
      setError(e.body?.detail || e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const areas = useMemo(() => {
    if (!data) return [];
    return ["All", ...Object.keys(data.areas || {})];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.responses;
    if (activeArea !== "All") list = list.filter((r) => r.area === activeArea);
    if (hideAnswered) list = list.filter((r) => r.score === null || r.score === undefined);
    if (requiredOnly) {
      list = list.filter((r) => Array.isArray(r.required_by_pillars) && r.required_by_pillars.length > 0);
    }
    return list;
  }, [data, activeArea, hideAnswered, requiredOnly]);

  // Count of questions actually consumed by pillar engines (for the toggle label)
  const requiredCount = useMemo(
    () => (data?.responses || []).filter((r) => Array.isArray(r.required_by_pillars) && r.required_by_pillars.length > 0).length,
    [data]
  );
  const requiredAnswered = useMemo(
    () => (data?.responses || []).filter((r) => Array.isArray(r.required_by_pillars) && r.required_by_pillars.length > 0 && r.score != null).length,
    [data]
  );

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header />Loading QRE…</div>;
  if (error) return <div><Header /><Callout tone="danger" title="QRE failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const pct = Math.round((data.answered / data.total) * 100);

  return (
    <div>
      <Header />

      <Card padding={24}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Progress</div>
            <div style={{ fontSize: "var(--fs-28)", fontWeight: 600, marginTop: 4 }}>
              {data.answered} / {data.total} answered <span style={{ fontSize: "var(--fs-14)", color: "var(--ink-500)", fontWeight: 400 }}>· {pct}%</span>
            </div>
            <div style={{ marginTop: 12, height: 8, background: "var(--surface-sunk)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand-600)" }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save responses"}</Button>
          </div>
        </div>
      </Card>

      {savedMsg && <div style={{ marginTop: 12 }}><Callout tone="success" title={savedMsg} icon={<I.Check size={16} />} /></div>}

      {/* Area chips + filter */}
      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {areas.map((a) => {
          const ar = data.areas[a];
          const ans = a === "All" ? data.answered : ar?.answered || 0;
          const tot = a === "All" ? data.total : ar?.total || 0;
          return (
            <button key={a} onClick={() => setActiveArea(a)}
                    style={{
                      padding: "6px 12px",
                      background: activeArea === a ? "var(--brand-600)" : "var(--surface-raised)",
                      color: activeArea === a ? "white" : "var(--ink-700)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--r-pill)",
                      fontSize: "var(--fs-12)",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}>
              {a} · {ans}/{tot}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {/* Required-only toggle — surfaces only the ~12 questions that pillar
              engines actually consume (D2.1, D2.4, D5.2, D9.2, D10.1, etc.).
              These are the answers that unlock DoA + Org Structure scores. */}
          {requiredCount > 0 && (
            <button onClick={() => setRequiredOnly((v) => !v)}
                    style={{
                      padding: "5px 12px",
                      background: requiredOnly ? "var(--warn-600, #c08800)" : "var(--surface-raised)",
                      color: requiredOnly ? "white" : "var(--ink-700)",
                      border: "1px solid " + (requiredOnly ? "var(--warn-700, #a07400)" : "var(--border-default)"),
                      borderRadius: "var(--r-pill)",
                      fontSize: "var(--fs-12)", fontWeight: 600,
                      cursor: "pointer",
                    }}
                    title="Show only the questions that pillar engines need to compute scores">
              {requiredOnly ? "✓ " : ""}Required for pillars · {requiredAnswered}/{requiredCount}
            </button>
          )}
          <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={hideAnswered} onChange={(e) => setHideAnswered(e.target.checked)} />
            Hide answered
          </span>
        </div>
      </div>

      {/* Question list */}
      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        {filtered.map((r) => (
          <QRECard key={r.id} resp={r} onUpdate={(p) => updateResp(r.id, p)} />
        ))}
        {filtered.length === 0 && (
          <Card padding={24} style={{ textAlign: "center", color: "var(--ink-500)" }}>
            No questions match this filter.
          </Card>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save responses"}</Button>
      </div>
    </div>
  );
};

const QRECard = ({ resp, onUpdate }) => {
  const answered = resp.score !== null && resp.score !== undefined;
  return (
    <Card padding={18} style={{ borderLeft: `3px solid ${answered ? "var(--success-500)" : "var(--ink-300)"}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ minWidth: 88, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          {resp.id}
          {resp.required && <div style={{ fontSize: "var(--fs-10)", color: "var(--warn-700)", marginTop: 2 }}>required</div>}
          {Array.isArray(resp.required_by_pillars) && resp.required_by_pillars.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}
                 title={`Pillar engines consume this answer: ${resp.required_by_pillars.join(", ")}`}>
              {resp.required_by_pillars.map((t) => (
                <span key={t} style={{
                  fontSize: "var(--fs-10)", fontWeight: 600, letterSpacing: "0.04em",
                  background: "var(--warn-50, #fff5e6)", color: "var(--warn-700, #a07400)",
                  border: "1px solid var(--warn-200, #f0d9a8)",
                  borderRadius: "var(--r-pill)", padding: "1px 6px",
                  textAlign: "center",
                }}>{_pillarLabel(t)}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", color: "var(--ink-500)", letterSpacing: "0.1em", marginBottom: 4 }}>
            {resp.area}
          </div>
          <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-900)", fontWeight: 500, lineHeight: 1.45 }}>
            {resp.question}
          </div>
          {resp.guidance && (
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 6, fontStyle: "italic" }}>
              Guidance: {resp.guidance}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <AnswerControl resp={resp} onUpdate={onUpdate} />
          </div>
        </div>
      </div>
    </Card>
  );
};

/* Per-question input control — picks the right widget based on
   answer_type from the QRE bank. Multi-select stores the picked labels
   in `evidence` (semicolon-joined) and derives a score from selection
   count so DoA/Org-Structure engines that read .score still work. */
const AnswerControl = ({ resp, onUpdate }) => {
  const type = resp.answer_type;
  const opts = Array.isArray(resp.options) ? resp.options : [];

  if (type === "multi_categorical" && opts.length > 0) {
    const selected = parseSelections(resp.evidence);
    const toggle = (label) => {
      const next = selected.includes(label)
        ? selected.filter((x) => x !== label)
        : [...selected, label];
      onUpdate({
        evidence: next.join("; "),
        score: next.length === 0 ? null : Math.min(4, Math.max(1, Math.ceil(next.length * 4 / opts.length))),
      });
    };
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {opts.map((opt, i) => {
            const isOn = selected.includes(opt);
            return (
              <button key={i} type="button" onClick={() => toggle(opt)}
                       style={{
                         padding: "6px 12px", fontSize: "var(--fs-12)", fontWeight: 500,
                         background: isOn ? "var(--brand-600)" : "var(--surface-card)",
                         color: isOn ? "white" : "var(--ink-700)",
                         border: "1px solid " + (isOn ? "var(--brand-700)" : "var(--border-default)"),
                         borderRadius: "var(--r-pill)", cursor: "pointer",
                       }}>
                {isOn ? "✓ " : ""}{opt}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
          {selected.length === 0 ? "Select all that apply." : `${selected.length} selected`}
        </div>
      </div>
    );
  }

  if (type === "percentage") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
        <Input type="number" min="0" max="100" placeholder="0-100"
               value={resp.evidence ?? ""}
               onChange={(e) => {
                 const raw = e.target.value;
                 const n = raw === "" ? null : Math.max(0, Math.min(100, Number(raw)));
                 const score = n === null ? null : (n <= 25 ? 1 : n <= 50 ? 2 : n <= 75 ? 3 : 4);
                 onUpdate({ evidence: raw, score });
               }} />
        <span style={{ alignSelf: "center", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          % — maps to score 1 (0-25) · 2 (26-50) · 3 (51-75) · 4 (76-100)
        </span>
      </div>
    );
  }

  if (type === "free_text") {
    return (
      <textarea value={resp.evidence ?? ""}
                onChange={(e) => onUpdate({ evidence: e.target.value, score: e.target.value.trim() ? 3 : null })}
                rows={3}
                placeholder="Free-text answer…"
                style={{ width: "100%", padding: 10, resize: "vertical",
                          fontFamily: "var(--font-sans)", fontSize: "var(--fs-13)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--r-md)", lineHeight: 1.5,
                          background: "var(--surface-card)" }} />
    );
  }

  // categorical, yes_no_partial, maturity_scale — single-select with options
  if (opts.length > 0) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
        <Select value={resp.score ?? ""}
                onChange={(e) => onUpdate({ score: e.target.value === "" ? null : Number(e.target.value) })}>
          <option value="">Select an answer…</option>
          {opts.map((opt, i) => <option key={i} value={i + 1}>{opt}</option>)}
        </Select>
        <Input placeholder="Evidence (optional)" value={resp.evidence ?? ""}
               onChange={(e) => onUpdate({ evidence: e.target.value })} />
      </div>
    );
  }

  // No options — generic 1-4 maturity scale
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
      <Select value={resp.score ?? ""}
              onChange={(e) => onUpdate({ score: e.target.value === "" ? null : Number(e.target.value) })}>
        <option value="">Score…</option>
        {SCORE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </Select>
      <Input placeholder="Evidence (optional)" value={resp.evidence ?? ""}
             onChange={(e) => onUpdate({ evidence: e.target.value })} />
    </div>
  );
};

/* Map a theme id like 'organisation-posture' / 'system-enforcement' to a
   short, scannable pillar tag for the QRE card chips. */
const _pillarLabel = (themeId) => {
  const t = String(themeId || "");
  if (t.startsWith("organisation-") || t.startsWith("fte-") || t.startsWith("spend-fte") || t === "hierarchy-span") return "ORG-STR";
  if (t === "document-audit" || t === "robustness" || t === "system-enforcement" || t === "po-compliance" || t === "bucket-optimisation") return "DoA";
  if (t.startsWith("centralisation") || t.startsWith("shared-") || t.startsWith("coe") || t.startsWith("tail-")) return "OP-MODEL";
  if (t.startsWith("buying-")) return "BUY-CH";
  return t.slice(0, 8).toUpperCase();
};

const parseSelections = (evidence) => {
  if (!evidence || typeof evidence !== "string") return [];
  return evidence.split(";").map((s) => s.trim()).filter(Boolean);
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 06 · QRE</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Qualitative Response Evaluation
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      52 questions per Client Pack v10 · score 1-4 with evidence · feeds DoA + Org Structure scoring
    </p>
  </div>
);

export default QRE;
