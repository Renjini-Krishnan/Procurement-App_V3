import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Background jobs panel — submit pillar runs / KPI dashboard runs without
   blocking the UI, then poll for status. */

const STATUS_TONES = {
  queued: { bg: "var(--surface-sunk)", fg: "var(--ink-600)" },
  running: { bg: "var(--brand-50)", fg: "var(--brand-700)" },
  done: { bg: "var(--success-50)", fg: "var(--success-700)" },
  failed: { bg: "var(--danger-50)", fg: "var(--danger-700)" },
  cancelled: { bg: "var(--warn-50)", fg: "var(--warn-700)" },
};

const Jobs = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [jobs, setJobs] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [error, setError] = useState(null);

  const refresh = async () => {
    if (!engagement) return;
    try {
      const [j, u] = await Promise.all([
        api.listJobs(engagement.id),
        api.listUploads(engagement.id),
      ]);
      setJobs(j.jobs || []);
      setUploads(u || []);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  useEffect(() => {
    if (!engagement) return;
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;

  const submitPillar = async (pillar) => {
    if (uploads.length === 0) return alert("No uploads. Go to Stage 4 first.");
    try {
      await api.submitPillarJob(engagement.id, pillar, uploads[0].id, engagement.industry);
      refresh();
    } catch (e) { alert(e.message); }
  };
  const submitKpi = async () => {
    if (uploads.length === 0) return alert("No uploads. Go to Stage 4 first.");
    try {
      await api.submitKpiJob(engagement.id, uploads[0].id, engagement.industry);
      refresh();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <Header />

      <Card padding={20} style={{ marginBottom: 16 }}>
        <Label>Submit a new job</Label>
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["op-model", "doa", "buying-channel", "org-structure"].map((p) => (
            <Button key={p} variant="outline" onClick={() => submitPillar(p)}>
              Run {p}
            </Button>
          ))}
          <Button onClick={submitKpi}>Run KPI dashboard</Button>
        </div>
        <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          Jobs run in background threads; refreshes every 2s.
        </div>
      </Card>

      {error && <Callout tone="danger" title="Job poll failed" icon={<I.X size={16} />}>{error}</Callout>}

      {jobs.length === 0 ? (
        <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
          No jobs yet for this engagement.
        </Card>
      ) : (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead>
              <tr>
                {["Kind", "Status", "Progress", "Result / error", "Started", "Completed"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const tone = STATUS_TONES[j.status] || STATUS_TONES.queued;
                return (
                  <tr key={j.id}>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{j.kind}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ background: tone.bg, color: tone.fg, padding: "2px 10px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>
                        {j.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ width: 120, height: 6, background: "var(--surface-sunk)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${j.progress || 0}%`, height: "100%", background: tone.fg }} />
                      </div>
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>
                        {j.progress || 0}% · {j.progress_message || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-12)" }}>
                      {j.error
                        ? <span style={{ color: "var(--danger-700)" }}>{j.error.split("\n")[0].slice(0, 100)}</span>
                        : <span style={{ color: "var(--ink-700)" }}>{j.result_summary || "—"}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)", fontSize: "var(--fs-12)" }}>
                      {j.started_at ? new Date(j.started_at).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)", fontSize: "var(--fs-12)" }}>
                      {j.completed_at ? new Date(j.completed_at).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Output</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Jobs</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Background jobs
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Non-blocking pillar / dashboard runs · live progress polling
    </p>
  </div>
);

export default Jobs;
