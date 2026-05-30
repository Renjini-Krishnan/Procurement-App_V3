import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 5 — AI Validation. Roster of all uploads with classifier confidence,
   per-file quick stats, and the AI's suggested column mapping for the
   primary upload. Confirmation happens in Stage 6 (User Validation).
   Full recon + cleansing happens in Stage 7 (Bronze). */

const AIValidation = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const s = await api.uploadsSummary(engagement.id);
        if (cancelled) return;
        if (!s.uploads || s.uploads.length === 0) {
          setError("No upload found. Go to Stage 4 (Upload) first.");
          setLoading(false); return;
        }
        setSummary(s);
        const firstId = s.uploads[0].upload_id;
        setSelectedUploadId(firstId);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  useEffect(() => {
    if (!engagement || !selectedUploadId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.previewUpload(engagement.id, selectedUploadId, 5);
        if (!cancelled) setPreview(p);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [engagement, selectedUploadId]);

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header />Loading…</div>;
  if (error) return <div><Header /><Callout tone="danger" title="AI validation failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!summary) return null;

  const uploads = summary.uploads || [];
  const selectedUpload = uploads.find((u) => u.upload_id === selectedUploadId) || uploads[0];

  const mapping = preview?.suggested_mapping || [];
  const mapped = mapping.filter((m) => m.suggested_field);
  const unmapped = mapping.filter((m) => !m.suggested_field);

  return (
    <div>
      <Header />

      {/* Roster — multi-file classification */}
      <FileRosterCard
        uploads={uploads}
        selectedId={selectedUploadId}
        onSelect={setSelectedUploadId}
        onMapColumns={(uid) =>
          navigate(`/engagement/${engagement.id}/user-validation?upload=${uid}`)
        }
      />

      {/* Quick stats for the selected upload */}
      {selectedUpload && <QuickStatsCard upload={selectedUpload} />}

      {/* Column mapping for the selected upload */}
      {preview && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16, marginTop: 24 }}>
            <Stat title="Columns detected" value={mapping.length} />
            <Stat title="Auto-mapped" value={mapped.length} tone="ok" />
            <Stat title="Needs review" value={unmapped.length} tone={unmapped.length > 0 ? "warn" : "ok"} />
          </div>

          <Card padding={20}>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", marginBottom: 12 }}>
              AI column mapping · {selectedUpload?.original_filename} ({selectedUpload?.file_type})
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
        </>
      )}

      <div style={{ marginTop: 20 }}>
        <Callout tone="info" title="Next: User Validation (Stage 6)" icon={<I.Arrow size={16} />}>
          Confirm or override the AI's column mapping. Anything left unmapped
          will be ignored by downstream engines.
        </Callout>
      </div>

      <div style={{ marginTop: 12 }}>
        <Callout tone="info" title="Recon & sense checks run at Stage 7 (Bronze Data)" icon={<I.Doc size={16} />}>
          The 39-rule cleansing engine fires there: PR→PO orphan detection,
          PO→GRN→Invoice chain hygiene, period-coverage vs scope lookback,
          duplicate detection, date parsing, missing-required drops, and
          currency-unit normalisation. Each rule shows up with severity +
          rows_affected + action_taken in the Bronze report.
        </Callout>
      </div>
    </div>
  );
};

const FileRosterCard = ({ uploads, selectedId, onSelect, onMapColumns }) => (
  <Card padding={20} style={{ marginBottom: 16 }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", marginBottom: 12 }}>
      Uploaded files · auto-classification ({uploads.length})
    </div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
      <thead>
        <tr>
          {["File", "Detected type", "Confidence", "Score", "Auto?", "Rows", ""].map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: "var(--fs-12)", color: "var(--ink-600)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {uploads.map((u) => {
          const c = u.classification || {};
          const matches = c.matches_persisted_type !== false;
          const isSelected = u.upload_id === selectedId;
          return (
            <tr key={u.upload_id} style={{ background: isSelected ? "var(--brand-50)" : "transparent" }}>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                {u.original_filename}
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: 500 }}>{u.file_type || "—"}</span>
                {!matches && c.best && (
                  <span style={{ display: "block", fontSize: "var(--fs-11)", color: "var(--warn-700)", marginTop: 2 }}>
                    Reclassifier suggests: {c.best}
                  </span>
                )}
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                <ConfidencePill conf={c.confidence} />
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
                {c.score != null ? `${(c.score * 100).toFixed(0)}%` : "—"}
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                {u.auto_classified
                  ? <Badge tone="brand">auto</Badge>
                  : <span style={{ color: "var(--ink-500)", fontSize: "var(--fs-12)" }}>manual</span>}
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                {u.row_count?.toLocaleString() || "—"}
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                <button
                  type="button"
                  onClick={() => onSelect(u.upload_id)}
                  style={{
                    border: "1px solid var(--border-default)",
                    background: isSelected ? "var(--brand-700)" : "var(--surface-elev)",
                    color: isSelected ? "white" : "var(--ink-900)",
                    padding: "4px 10px", borderRadius: "var(--r-md)",
                    fontSize: "var(--fs-12)", cursor: "pointer", marginRight: 6,
                  }}
                >
                  {isSelected ? "Selected" : "Inspect"}
                </button>
                <button
                  type="button"
                  onClick={() => onMapColumns(u.upload_id)}
                  style={{
                    border: "1px solid var(--brand-700)",
                    background: "var(--surface-elev)",
                    color: "var(--brand-700)",
                    padding: "4px 10px", borderRadius: "var(--r-md)",
                    fontSize: "var(--fs-12)", cursor: "pointer", fontWeight: 500,
                  }}
                >
                  Map columns →
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </Card>
);

const QuickStatsCard = ({ upload }) => {
  const s = upload.quick_stats || {};
  const ft = upload.file_type;
  const tiles = [];

  tiles.push({ label: "Rows", value: (s.row_count || upload.row_count || 0).toLocaleString() });

  if (s.total_value_label) tiles.push({ label: "Total value", value: s.total_value_label });
  if (s.distinct_vendors != null) tiles.push({ label: "Distinct vendors", value: s.distinct_vendors.toLocaleString() });
  if (s.distinct_material_groups != null) tiles.push({ label: "Material groups", value: s.distinct_material_groups.toLocaleString() });
  if (s.distinct_prs != null) tiles.push({ label: "Distinct PRs", value: s.distinct_prs.toLocaleString() });
  if (s.distinct_grns != null) tiles.push({ label: "Distinct GRNs", value: s.distinct_grns.toLocaleString() });
  if (s.distinct_invoices != null) tiles.push({ label: "Distinct invoices", value: s.distinct_invoices.toLocaleString() });
  if (s.distinct_materials != null) tiles.push({ label: "Distinct materials", value: s.distinct_materials.toLocaleString() });
  if (s.distinct_contracts != null) tiles.push({ label: "Distinct contracts", value: s.distinct_contracts.toLocaleString() });
  if (s.distinct_employees != null) tiles.push({ label: "Distinct employees", value: s.distinct_employees.toLocaleString() });
  if (s.date_range) {
    tiles.push({
      label: "Date range",
      value: `${s.date_range.min} → ${s.date_range.max}`,
      hint: `${s.date_range.span_days} days · ${s.date_range.parsed_rows.toLocaleString()} parsed`,
    });
  }

  return (
    <Card padding={20} style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", marginBottom: 12 }}>
        Quick stats · {upload.original_filename} ({ft})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{
            background: "var(--surface-sunk)", padding: 12, borderRadius: "var(--r-md)",
            border: "1px solid var(--border-subtle)",
          }}>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.label}</div>
            <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 4, color: "var(--ink-900)" }}>{t.value}</div>
            {t.hint && <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>{t.hint}</div>}
          </div>
        ))}
      </div>

      {Array.isArray(s.top_categories) && s.top_categories.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Top 5 material groups by value
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <tbody>
              {s.top_categories.map((c, i) => (
                <tr key={c.label}>
                  <td style={{ padding: "4px 12px 4px 0", color: "var(--ink-500)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", width: 24 }}>{i + 1}</td>
                  <td style={{ padding: "4px 12px 4px 0" }}>{c.label}</td>
                  <td style={{ padding: "4px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>{c.value_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s._stats_error && (
        <div style={{ marginTop: 8, fontSize: "var(--fs-11)", color: "var(--warn-700)" }}>
          Stats partial — {s._stats_error}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: "var(--fs-11)", color: "var(--ink-500)", fontStyle: "italic" }}>
        Stats are best-effort using the AI-suggested mapping. Final numbers
        appear in Stage 13 (KPI Dashboard) after Stage 7 cleansing.
      </div>
    </Card>
  );
};

const ConfidencePill = ({ conf }) => {
  const palette = {
    high: { bg: "var(--success-50)", fg: "var(--success-700)" },
    medium: { bg: "var(--warn-50)", fg: "var(--warn-700)" },
    low: { bg: "var(--danger-50)", fg: "var(--danger-700)" },
    none: { bg: "var(--danger-50)", fg: "var(--danger-700)" },
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
      Auto-classification of every upload, per-file quick stats, and AI's
      suggested column mapping. Confirmation in Stage 6 · recon in Stage 7.
    </p>
  </div>
);

export default AIValidation;
