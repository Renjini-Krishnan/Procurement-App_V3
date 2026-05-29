import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api, postDownload } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Central export hub — every downloadable artefact in one place + history. */

const EXPORTS = [
  { id: "bronze-csv",      label: "Bronze data",        format: "CSV",  desc: "Cleansed PO data after type coercion + vendor dedup + currency normalisation", path: api.exportBronzeCsvPath },
  { id: "gold-csv",        label: "Gold data",          format: "CSV",  desc: "Enriched data with category archetype classification (Stage 9 applied)",      path: api.exportGoldCsvPath },
  { id: "kpis-xlsx",       label: "KPI workbook",       format: "XLSX", desc: "3 sheets — KPIs, Pillar summary, Findings", path: api.exportKpisXlsxPath },
  { id: "findings-deck",   label: "Findings deck",      format: "PPTX", desc: "8-slide deck — cover · exec summary · per-pillar detail · attention · appendix", path: api.exportFindingsDeckPath },
  { id: "exec-summary",    label: "Executive summary",  format: "PPTX", desc: "3-slide briefing — cover · exec summary · pillar overview", path: api.exportExecSummaryPath },
];

const FORMAT_TONES = {
  CSV:  { bg: "var(--success-50)", fg: "var(--success-700)" },
  XLSX: { bg: "var(--success-50)", fg: "var(--success-700)" },
  PPTX: { bg: "var(--brand-50)",   fg: "var(--brand-700)" },
  JSON: { bg: "var(--surface-sunk)", fg: "var(--ink-700)" },
};

const ExportCenter = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [uploads, setUploads] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (engagement) {
      api.listUploads(engagement.id).then(setUploads).catch(() => {});
      try {
        const h = JSON.parse(localStorage.getItem(`procvault.exports.${engagement.id}`) || "[]");
        setHistory(h);
      } catch { /* ignore */ }
    }
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;

  const recordHistory = (item) => {
    const entry = { id: item.id, label: item.label, format: item.format, at: new Date().toISOString() };
    const next = [entry, ...history].slice(0, 25);
    setHistory(next);
    try { localStorage.setItem(`procvault.exports.${engagement.id}`, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const download = async (item) => {
    if (uploads.length === 0) { alert("Upload PO data first (Stage 4)."); return; }
    setBusy((b) => ({ ...b, [item.id]: true }));
    try {
      await postDownload(item.path(engagement.id), {
        upload_id: uploads[0].id, industry: engagement.industry,
      }, `${item.id}.${item.format.toLowerCase()}`);
      recordHistory(item);
    } catch (e) {
      alert(`${item.label} failed: ${e.message || e}`);
    } finally {
      setBusy((b) => ({ ...b, [item.id]: false }));
    }
  };

  return (
    <div>
      <Header />

      {uploads.length === 0 && (
        <Callout tone="warn" title="No upload yet" icon={<I.Doc size={16} />}>
          Some exports run the analytics pipeline on demand and require a PO upload (Stage 4).
        </Callout>
      )}

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        {EXPORTS.map((e) => {
          const tone = FORMAT_TONES[e.format] || FORMAT_TONES.JSON;
          return (
            <Card key={e.id} padding={20}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ background: tone.bg, color: tone.fg, padding: "4px 10px",
                                borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)",
                                fontWeight: 700, letterSpacing: "0.08em",
                                fontFamily: "var(--font-mono)" }}>
                  {e.format}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--ink-900)" }}>{e.label}</div>
                  <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 2 }}>{e.desc}</div>
                </div>
                <Button onClick={() => download(e)} disabled={!!busy[e.id]} iconRight={<I.Arrow size={14} />}>
                  {busy[e.id] ? "Generating…" : "Download"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 32 }}>
        <SectionHeader title="Recent downloads (last 25)" count={`${history.length}`} />
        {history.length === 0 ? (
          <Card padding={20} style={{ marginTop: 12, textAlign: "center", color: "var(--ink-500)" }}>
            No downloads yet — click any button above. History persists in your browser.
          </Card>
        ) : (
          <Card padding={0} style={{ marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
              <thead>
                <tr>
                  {["Artefact", "Format", "When"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px",
                                          fontSize: "var(--fs-11)", color: "var(--ink-500)",
                                          textTransform: "uppercase", letterSpacing: "0.08em",
                                          borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>{h.label}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{h.format}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{new Date(h.at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};

const SectionHeader = ({ title, count }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{count}</div>
  </div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Output</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Export Centre</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Export Centre
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Every downloadable artefact in one place · recent history below
    </p>
  </div>
);

export default ExportCenter;
