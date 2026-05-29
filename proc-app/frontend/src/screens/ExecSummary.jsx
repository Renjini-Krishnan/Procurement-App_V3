import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { MaturityGauge } from "../design/patterns.jsx";
import { api, postDownload } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";

/* Stage 29 — Exec Summary. Runs the KPI dashboard once and renders a
   narrative synthesis of pillar maturity + top findings + headline numbers. */

const PILLAR_LABELS = {
  "op-model": "Op Model",
  "buying-channel": "Buying Channel",
  "org-structure": "Org Structure",
  "doa": "Delegation of Authority",
};

const ExecSummary = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const uploads = await api.listUploads(engagement.id);
        if (uploads.length === 0) {
          setError("No PO data uploaded. Go to Stage 4 first.");
          setLoading(false); return;
        }
        const r = await api.runKpiDashboard(engagement.id, uploads[0].id, engagement.industry);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header /><Card padding={32} style={{ marginTop: 24, textAlign: "center", color: "var(--ink-500)" }}>Running all 4 pillars + assembling KPIs…</Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="Exec summary failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const overall = avgScore(Object.values(data.pillar_summary));
  const overBand = data.kpis.filter((k) => k.status === "over");
  const underBand = data.kpis.filter((k) => k.status === "under");
  const topAlerts = [...overBand, ...underBand].slice(0, 5);

  return (
    <div>
      <Header />

      {/* Hero — overall maturity */}
      <Card padding={32}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <MaturityGauge value={overall} max={5} size={160} />
            <div style={{ marginTop: 12, fontSize: "var(--fs-14)", color: "var(--ink-600)" }}>
              Overall maturity · {label(overall)}
            </div>
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-32)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.01em" }}>
              {engagement.client_name} sits at <em style={{ fontWeight: 500 }}>{label(overall)}</em> across
              4 functional pillars.
            </h2>
            <p style={{ fontSize: "var(--fs-15)", color: "var(--ink-700)", lineHeight: 1.55, marginTop: 12 }}>
              {underBand.length + overBand.length} of {data.kpis.length} KPIs sit outside
              their benchmark band — {underBand.length} below, {overBand.length} above. Findings
              deck (Stage 28) carries the full evidence pack.
            </p>
          </div>
        </div>
      </Card>

      {/* Pillar grid */}
      <div style={{ marginTop: 24 }}>
        <Label>Per-pillar maturity</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          {Object.entries(data.pillar_summary).map(([pid, s]) => (
            <Card key={pid} padding={20}>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {PILLAR_LABELS[pid] || pid}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "var(--fs-28)", fontWeight: 600 }}>{s.pillar_score?.score?.toFixed?.(1) ?? s.pillar_score?.score ?? "—"}</span>
                <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>/ 5</span>
              </div>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 2 }}>{s.pillar_score?.label}</div>
              <div style={{ marginTop: 10, fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
                {s.in_band} in band · {s.under} below · {s.over} above
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Top alerts */}
      <div style={{ marginTop: 24 }}>
        <Label>Top {topAlerts.length} attention items</Label>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {topAlerts.map((k) => (
            <Card key={k.id} padding={16} style={{ borderLeft: `3px solid ${k.status === "over" ? "var(--danger-500)" : "var(--warn-500)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase" }}>{PILLAR_LABELS[k.pillar]} · {k.theme}</div>
                  <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                  {k.finding && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 4 }}>{k.finding}</div>}
                </div>
                <div style={{ minWidth: 100, textAlign: "right" }}>
                  <div style={{ fontSize: "var(--fs-18)", fontWeight: 600 }}>{typeof k.value === "number" ? k.value.toFixed(1) : k.value}</div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{k.unit}</div>
                  <div style={{ fontSize: "var(--fs-11)", color: k.status === "over" ? "var(--danger-700)" : "var(--warn-700)", marginTop: 2 }}>{k.delta}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Callout tone="info" title="Next steps" icon={<I.Arrow size={16} />}>
        Open the Findings Deck (Stage 28) for the full evidence pack, or the KPI Dashboard (Stage 30) for interactive drill-downs.
      </Callout>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={() => downloadExecDeck(engagement)}>Export PPT</Button>
        <Button variant="outline" onClick={() => downloadKpisXlsx(engagement)}>Export Excel</Button>
        <Button variant="outline" onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button variant="outline" onClick={() => exportExec(data, engagement)}>Export JSON</Button>
      </div>

      <SignoffWidget engagementId={engagement.id} scope="diagnostic" label="Diagnostic phase" expectedCadence="end-of-phase" />
      <SignoffWidget engagementId={engagement.id} scope="analyze"    label="Analyze phase"    expectedCadence="end-of-phase" />
      <SignoffWidget engagementId={engagement.id} scope="output"     label="Output phase"     expectedCadence="end-of-phase" />
    </div>
  );
};

const downloadExecDeck = async (engagement) => {
  if (!engagement) return;
  const uploads = await api.listUploads(engagement.id);
  if (uploads.length === 0) return alert("No uploads.");
  try {
    await postDownload(`/engagement/${engagement.id}/export/exec-summary.pptx`,
      { upload_id: uploads[0].id, industry: engagement.industry }, "exec-summary.pptx");
  } catch (e) { alert("PPT export failed: " + e.message); }
};

const downloadKpisXlsx = async (engagement) => {
  if (!engagement) return;
  const uploads = await api.listUploads(engagement.id);
  if (uploads.length === 0) return alert("No uploads.");
  try {
    await postDownload(`/engagement/${engagement.id}/export/kpis.xlsx`,
      { upload_id: uploads[0].id, industry: engagement.industry }, "kpis.xlsx");
  } catch (e) { alert("Excel export failed: " + e.message); }
};

const exportExec = (data, engagement) => {
  const payload = {
    engagement: { id: engagement.id, client_name: engagement.client_name, industry: engagement.industry, sub_segment: engagement.sub_segment },
    pillar_summary: data.pillar_summary,
    portfolio: data.portfolio,
    kpis: data.kpis,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `procvault-exec-summary-${engagement.client_name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const avgScore = (pillars) => {
  if (!pillars.length) return 0;
  return pillars.reduce((a, p) => a + (p.pillar_score?.score || 0), 0) / pillars.length;
};
const label = (s) => s < 1.5 ? "Initial" : s < 2.5 ? "Developing" : s < 3.5 ? "Defined" : s < 4.5 ? "Managed" : "Optimised";

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Output</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 29</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Executive summary
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Narrative synthesis · overall maturity · top attention items
    </p>
  </div>
);

export default ExecSummary;
