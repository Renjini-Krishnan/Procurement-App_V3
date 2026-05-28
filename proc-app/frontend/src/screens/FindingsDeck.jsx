import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 28 — Findings Deck.
   Lists persisted findings from all pillar runs (op-model, doa, buying-channel,
   org-structure) grouped by pillar. Each finding has headline + metrics. */

const PILLAR_LABELS = {
  "op-model": "Op Model",
  "doa": "DoA",
  "buying-channel": "Buying Channel",
  "org-structure": "Org Structure",
};

const FindingsDeck = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pillarTab, setPillarTab] = useState("all");

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const r = await api.listFindings(engagement.id);
        if (!cancelled) setFindings(r.findings || []);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header />Loading findings…</div>;
  if (error) return <div><Header /><Callout tone="danger" title="Findings load failed" icon={<I.X size={16} />}>{error}</Callout></div>;

  const byPillar = findings.reduce((acc, f) => {
    (acc[f.pillar] = acc[f.pillar] || []).push(f);
    return acc;
  }, {});
  const pillars = Object.keys(byPillar);
  const tabItems = [{ id: "all", label: `All · ${findings.length}` },
                    ...pillars.map((p) => ({ id: p, label: `${PILLAR_LABELS[p] || p} · ${byPillar[p].length}` }))];

  const visible = pillarTab === "all" ? findings : (byPillar[pillarTab] || []);

  if (findings.length === 0) {
    return (
      <div>
        <Header />
        <Callout tone="info" title="No findings yet" icon={<I.Doc size={16} />}>
          Findings are persisted once you run a pillar (Op Model, DoA, Buying Channel, Org Structure).
          Open any pillar from the rail to generate findings.
        </Callout>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div style={{ marginBottom: 16 }}>
        <Tabs items={tabItems} value={pillarTab} onChange={setPillarTab} />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {visible.map((f) => <FindingCard key={f.id} f={f} />)}
      </div>
    </div>
  );
};

const FindingCard = ({ f }) => {
  const sev = { high: "danger", medium: "warn", low: "info" }[f.severity] || "info";
  const sevColor = { high: "var(--danger-500)", medium: "var(--warn-500)", low: "var(--brand-500)" }[f.severity] || "var(--brand-500)";
  return (
    <Card padding={20} style={{ borderLeft: `3px solid ${sevColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Badge tone="brand">{PILLAR_LABELS[f.pillar] || f.pillar}</Badge>
            <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {f.theme}
            </span>
          </div>
          <div style={{ fontSize: "var(--fs-15)", color: "var(--ink-900)", lineHeight: 1.5, fontWeight: 500 }}>
            {f.headline}
          </div>
          {f.metrics && Object.keys(f.metrics).length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: "var(--fs-12)", color: "var(--brand-700)" }}>
                Show metrics
              </summary>
              <table style={{ marginTop: 8, fontSize: "var(--fs-12)" }}>
                <tbody>
                  {Object.entries(f.metrics).slice(0, 10).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: "3px 8px 3px 0", color: "var(--ink-600)" }}>
                        <code style={{ fontFamily: "var(--font-mono)" }}>{k}</code>
                      </td>
                      <td style={{ padding: "3px 0", color: "var(--ink-900)" }}>
                        {typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Output</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 28</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Findings deck
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Quantified gaps + headlines, persisted across pillar runs.
    </p>
  </div>
);

export default FindingsDeck;
