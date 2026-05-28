import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api, postDownload } from "../api/client.js";
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
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pillarTab, setPillarTab] = useState("all");

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [fr, rr] = await Promise.all([
          api.listFindings(engagement.id),
          api.listPillarRuns(engagement.id),
        ]);
        if (!cancelled) {
          setFindings(fr.findings || []);
          setRuns(rr.runs || []);
        }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <Tabs items={tabItems} value={pillarTab} onChange={setPillarTab} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => downloadDeck(engagement)}>Export PPT deck</Button>
          <Button variant="outline" onClick={() => downloadXlsx(engagement)}>Export Excel</Button>
          <Button variant="outline" onClick={() => exportJson(visible, `findings-${pillarTab}`)}>Export JSON</Button>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {visible.map((f) => <FindingCard key={f.id} f={f} />)}
      </div>

      {runs.length > 0 && <RunHistoryPanel runs={runs} pillarTab={pillarTab} />}
    </div>
  );
};

const RunHistoryPanel = ({ runs, pillarTab }) => {
  const filtered = pillarTab === "all" ? runs : runs.filter((r) => r.pillar === pillarTab);
  if (filtered.length === 0) return null;
  // Compute deltas vs prior run per pillar
  const byPillar = {};
  filtered.forEach((r) => { (byPillar[r.pillar] = byPillar[r.pillar] || []).push(r); });
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--ink-600)", marginBottom: 12 }}>
        Run history · {filtered.length} runs
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {filtered.slice(0, 25).map((r, i) => {
          const sameP = byPillar[r.pillar];
          const idx = sameP.findIndex((x) => x.id === r.id);
          const prev = sameP[idx + 1];
          const delta = prev?.pillar_score != null && r.pillar_score != null
            ? (r.pillar_score - prev.pillar_score).toFixed(1)
            : null;
          const deltaColor = delta === null ? "var(--ink-500)" : Number(delta) > 0 ? "var(--success-700)" : Number(delta) < 0 ? "var(--danger-700)" : "var(--ink-500)";
          return (
            <Card key={r.id} padding={14}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge tone="brand">{PILLAR_LABELS[r.pillar] || r.pillar}</Badge>
                    <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
                      {new Date(r.ran_at).toLocaleString()}
                    </span>
                  </div>
                  {r.headline && (
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-700)", marginTop: 4, lineHeight: 1.4 }}>
                      {r.headline.slice(0, 200)}{r.headline.length > 200 ? "…" : ""}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "var(--fs-18)", fontWeight: 600 }}>{r.pillar_score?.toFixed?.(1) ?? "—"}</div>
                  <div style={{ fontSize: "var(--fs-11)", color: deltaColor, marginTop: 2 }}>
                    {delta === null ? "first run" : Number(delta) > 0 ? `+${delta}` : delta}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const downloadDeck = async (engagement) => {
  if (!engagement) return alert("No engagement context");
  const uploads = await api.listUploads(engagement.id);
  if (uploads.length === 0) return alert("No uploads — generate the dashboard first.");
  try {
    await postDownload(`/engagement/${engagement.id}/export/findings-deck.pptx`,
      { upload_id: uploads[0].id, industry: engagement.industry }, "findings.pptx");
  } catch (e) { alert("PPT export failed: " + e.message); }
};

const downloadXlsx = async (engagement) => {
  if (!engagement) return;
  const uploads = await api.listUploads(engagement.id);
  if (uploads.length === 0) return alert("No uploads.");
  try {
    await postDownload(`/engagement/${engagement.id}/export/kpis.xlsx`,
      { upload_id: uploads[0].id, industry: engagement.industry }, "kpis.xlsx");
  } catch (e) { alert("Excel export failed: " + e.message); }
};

const exportJson = (data, name) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `procvault-${name}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
