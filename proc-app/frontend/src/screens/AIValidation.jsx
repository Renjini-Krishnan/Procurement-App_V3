import React, { useEffect, useState } from "react";
import { Card, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 5 — AI Validation. Read-only view of the AI's suggested column
   mapping + per-row stats. Confirmation happens in Stage 6 (User Validation). */

const AIValidation = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [preview, setPreview] = useState(null);
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
          setError("No upload found. Go to Stage 4 (Upload) first.");
          setLoading(false); return;
        }
        const p = await api.previewUpload(engagement.id, uploads[0].id, 5);
        if (!cancelled) setPreview(p);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header />Loading…</div>;
  if (error) return <div><Header /><Callout tone="danger" title="AI validation failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!preview) return null;

  const mapping = preview.suggested_mapping || [];
  const mapped = mapping.filter((m) => m.suggested_field);
  const unmapped = mapping.filter((m) => !m.suggested_field);

  return (
    <div>
      <Header />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <Stat title="Columns detected" value={mapping.length} />
        <Stat title="Auto-mapped" value={mapped.length} tone="ok" />
        <Stat title="Needs review" value={unmapped.length} tone={unmapped.length > 0 ? "warn" : "ok"} />
      </div>

      <Card padding={20}>
        <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", marginBottom: 12 }}>
          AI column mapping · with confidence
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr>
              {["Raw column", "Suggested canonical", "Confidence", "Sample values"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: "var(--fs-12)", color: "var(--ink-600)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => (
              <tr key={m.raw_column}>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                  {m.raw_column}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  {m.suggested_field
                    ? <span style={{ color: "var(--brand-700)", fontWeight: 500 }}>{m.suggested_field}</span>
                    : <span style={{ color: "var(--ink-500)" }}>—</span>}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <ConfidencePill conf={m.confidence} />
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)", fontSize: "var(--fs-12)" }}>
                  {(m.sample_values || []).slice(0, 3).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Callout tone="info" title="Next: User Validation (Stage 6)" icon={<I.Arrow size={16} />}>
        Confirm or override the AI's column mapping. Anything left unmapped
        will be ignored by downstream engines.
      </Callout>
    </div>
  );
};

const ConfidencePill = ({ conf }) => {
  const palette = {
    high: { bg: "var(--success-50)", fg: "var(--success-700)" },
    medium: { bg: "var(--warn-50)", fg: "var(--warn-700)" },
    low: { bg: "var(--danger-50)", fg: "var(--danger-700)" },
  };
  const p = palette[conf] || { bg: "var(--surface-sunk)", fg: "var(--ink-600)" };
  return (
    <span style={{
      background: p.bg, color: p.fg, padding: "2px 8px",
      borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600,
    }}>{conf || "—"}</span>
  );
};

const Stat = ({ title, value, tone = "ok" }) => (
  <Card padding={16}>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-24)", fontWeight: 600, marginTop: 4, color: tone === "warn" ? "var(--warn-700)" : "var(--ink-900)" }}>{value}</div>
  </Card>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 05</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      AI Validation
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      AI's suggested column mapping. Confirmation happens in Stage 6.
    </p>
  </div>
);

export default AIValidation;
