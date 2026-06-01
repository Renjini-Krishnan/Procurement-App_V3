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
    return list;
  }, [data, activeArea, hideAnswered]);

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
        <span style={{ marginLeft: "auto", fontSize: "var(--fs-13)", color: "var(--ink-600)", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={hideAnswered} onChange={(e) => setHideAnswered(e.target.checked)} />
          Hide answered
        </span>
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
        <div style={{ minWidth: 60, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          {resp.id}
          {resp.required && <div style={{ fontSize: "var(--fs-10)", color: "var(--warn-700)", marginTop: 2 }}>required</div>}
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
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
            {resp.options && Array.isArray(resp.options) && resp.options.length > 0 ? (
              // Per-question categorical options from the QRE bank.
              // Save the index+1 as the score (1-based), and the chosen
              // option label as evidence prefix for traceability.
              <Select value={resp.score ?? ""}
                       onChange={(e) => {
                         const v = e.target.value === "" ? null : Number(e.target.value);
                         onUpdate({ score: v });
                       }}>
                <option value="">Select an answer…</option>
                {resp.options.map((opt, i) => (
                  <option key={i} value={i + 1}>{opt}</option>
                ))}
              </Select>
            ) : (
              // Fallback: 4-point maturity scale for questions without
              // explicit options in the bank.
              <Select value={resp.score ?? ""}
                       onChange={(e) => onUpdate({ score: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">Score…</option>
                {SCORE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </Select>
            )}
            <Input placeholder="Evidence (optional)" value={resp.evidence ?? ""}
                   onChange={(e) => onUpdate({ evidence: e.target.value })} />
          </div>
        </div>
      </div>
    </Card>
  );
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
