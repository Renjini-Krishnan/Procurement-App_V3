import React, { useEffect, useState } from "react";
import { Card, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Comparison view — current vs prior pillar runs.
   Shows per-pillar score delta + theme-level deltas + score history mini chart. */

const PILLAR_LABELS = {
  "op-model": "Op Model",
  "buying-channel": "Buying Channel",
  "org-structure": "Org Structure",
  "doa": "Delegation of Authority",
};

const Comparison = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    (async () => {
      try {
        setLoading(true); setError(null);
        const r = await api.getComparison(engagement.id);
        setData(r);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header /><Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>Loading comparison…</Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="Comparison failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const comps = data.comparisons || [];

  if (comps.length === 0) {
    return (
      <div>
        <Header />
        <Callout tone="info" title="No pillar runs yet" icon={<I.Doc size={16} />}>
          Run any pillar (Op Model, DoA, Buying Channel, Org Structure) or the KPI Dashboard
          first. Comparison appears once you have at least 2 runs.
        </Callout>
      </div>
    );
  }

  const eligible = comps.filter((c) => c.prior);

  return (
    <div>
      <Header />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
        {comps.map((c) => <PillarCompCard key={c.pillar} c={c} />)}
      </div>

      {eligible.length > 0 && (
        <Card padding={24}>
          <Label>Theme-level deltas</Label>
          <div style={{ marginTop: 12, display: "grid", gap: 16 }}>
            {eligible.map((c) => (
              <div key={c.pillar}>
                <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, marginBottom: 6 }}>
                  {PILLAR_LABELS[c.pillar] || c.pillar}
                </div>
                {c.theme_deltas.length === 0
                  ? <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>No theme-level history.</div>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
                      <thead>
                        <tr>
                          {["Theme", "Prior", "Current", "Delta"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {c.theme_deltas.map((t) => (
                          <tr key={t.theme}>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>{t.theme}</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{Number(t.prior).toFixed(1)}</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600 }}>{Number(t.current).toFixed(1)}</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", color: deltaColor(t.delta), fontWeight: 600 }}>
                              {fmtDelta(t.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

const PillarCompCard = ({ c }) => {
  const cur = c.current?.score ?? 0;
  const prior = c.prior?.score;
  const delta = c.delta;
  const trend = c.trend;
  return (
    <Card padding={20} style={{ borderLeft: `3px solid ${trendColor(trend)}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Label>{PILLAR_LABELS[c.pillar] || c.pillar}</Label>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginTop: 8 }}>
            <span style={{ fontSize: "var(--fs-32)", fontWeight: 600, color: "var(--ink-900)" }}>
              {typeof cur === "number" ? cur.toFixed(1) : cur}
            </span>
            <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
              {c.current?.label}
            </span>
          </div>
          <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 6 }}>
            {prior !== undefined && prior !== null
              ? `Prior ${Number(prior).toFixed(1)} · ${new Date(c.prior.ran_at).toLocaleDateString()}`
              : "First run — no prior comparison"}
          </div>
        </div>
        {delta !== null && delta !== undefined && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, color: deltaColor(delta) }}>
              {fmtDelta(delta)}
            </div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>
              {c.run_count} runs total
            </div>
          </div>
        )}
      </div>
      {c.history && c.history.length > 1 && <ScoreHistory history={c.history.slice().reverse()} />}
    </Card>
  );
};

const ScoreHistory = ({ history }) => {
  const vals = history.map((h) => h.score).filter((v) => v !== null && v !== undefined);
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 5);
  const min = Math.min(...vals, 1);
  const range = max - min || 1;
  const w = 100, h = 28;
  const pts = vals.map((v, i) => {
    const x = (i / Math.max(vals.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ marginTop: 12, display: "block" }}>
      <polyline points={pts} fill="none" stroke="var(--brand-500)" strokeWidth="1.5" />
    </svg>
  );
};

const fmtDelta = (d) => {
  if (d === null || d === undefined) return "—";
  if (d === 0) return "0.0";
  return d > 0 ? `+${d.toFixed(1)}` : `${d.toFixed(1)}`;
};
const deltaColor = (d) => {
  if (d === null || d === undefined || d === 0) return "var(--ink-500)";
  return d > 0 ? "var(--success-700)" : "var(--danger-700)";
};
const trendColor = (t) => ({ up: "var(--success-500)", down: "var(--danger-500)" })[t] || "var(--ink-300)";

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Output</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Comparison</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Run comparison
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Current vs prior pillar runs · score deltas · theme-level breakdowns
    </p>
  </div>
);

export default Comparison;
