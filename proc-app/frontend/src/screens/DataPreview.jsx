import React from "react";
import { Card, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 7 (Bronze) / Stage 8 (Gold) — data preview.
   Bronze = cleansed; Gold = enriched (vendor dedup, currency normalised, joins).
   In V1 backend, bronze and gold are the same dataframe — we render both
   from useIntel and label appropriately. */

export const Bronze = () => <DataPreview stage={7} title="Bronze Data" phase="Diagnostic"
  blurb="Cleansed PO data after universal data-quality rules pass — type coercion, date parsing, currency tagging." />;

export const Gold = () => <DataPreview stage={8} title="Gold Data" phase="Diagnostic"
  blurb="Final validated dataset — vendor dedup, currency normalised to INR, archetype-ready." />;

const DataPreview = ({ stage, title, phase, blurb }) => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data, loading, error } = useIntel(engagement);

  if (engLoading || !engagement) return <div>Loading…</div>;

  return (
    <div>
      <Header stage={stage} title={title} phase={phase} blurb={blurb} />

      {loading && <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>Building dataset…</Card>}
      {error && <Callout tone="danger" title="Failed to build dataset" icon={<I.X size={16} />}>{error}</Callout>}

      {data && (
        <>
          <SummaryGrid summary={data.gold_summary} />

          {data.cleansing_report && (
            <CleansingReport report={data.cleansing_report} />
          )}

          <div style={{ marginTop: 24 }}>
            <Card padding={20}>
              <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", marginBottom: 12 }}>
                Sample · top categories by spend
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
                  <thead>
                    <tr>
                      {["MG", "Description", "Archetype", "₹ Cr", "POs", "Vendors", "Plants"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: "var(--fs-12)", color: "var(--ink-600)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_mg_table.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.material_group}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>{r.material_group_desc}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>{r.archetype}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right", fontWeight: 500 }}>{r.total_spend_inr_cr}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{r.po_count}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{r.vendor_count}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{r.plant_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const SEVERITY_TONES = {
  fix: { bg: "var(--success-50)", fg: "var(--success-700)", border: "var(--success-500)" },
  drop: { bg: "var(--warn-50)", fg: "var(--warn-700)", border: "var(--warn-500)" },
  warn: { bg: "var(--warn-50)", fg: "var(--warn-700)", border: "var(--warn-500)" },
  info: { bg: "var(--surface-sunk)", fg: "var(--ink-600)", border: "var(--ink-300)" },
};

const CleansingReport = ({ report }) => {
  const entries = report.entries || [];
  const summary = report.summary || {};
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
        Cleansing report · {summary.rules_fired} rules fired
      </div>
      <Card padding={20}>
        <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
          <span>Total rules: <strong>{summary.rules_fired}</strong></span>
          <span>Rows fixed: <strong>{summary.rows_fixed_total}</strong></span>
          <span>Rows dropped: <strong>{summary.rows_dropped_total}</strong></span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr>
              {["Severity", "Stage", "Rule", "Rows affected", "Action"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const tone = SEVERITY_TONES[e.severity] || SEVERITY_TONES.info;
              return (
                <tr key={i}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ background: tone.bg, color: tone.fg, padding: "2px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>
                      {e.severity}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{e.stage}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontWeight: 500 }}>{e.rule_name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{e.rule_id}</div>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {e.rows_affected?.toLocaleString?.("en-IN") || e.rows_affected}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{e.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const SummaryGrid = ({ summary }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
    <Stat title="Rows" value={summary.row_count?.toLocaleString("en-IN")} />
    <Stat title="POs" value={summary.po_count?.toLocaleString("en-IN")} />
    <Stat title="Material Groups" value={summary.mg_count} />
    <Stat title="Vendors" value={summary.vendor_count?.toLocaleString("en-IN")} />
    <Stat title="Plants" value={summary.plant_count} />
    <Stat title="Total spend" value={summary.total_spend_inr ? `₹${(summary.total_spend_inr / 1e7).toFixed(1)} Cr` : "—"} />
    {summary.date_min && <Stat title="Period" value={`${summary.date_min} → ${summary.date_max}`} />}
    {summary.cancellation_count !== undefined && <Stat title="Cancellations" value={summary.cancellation_count} tone={summary.cancellation_count > 0 ? "warn" : "ok"} />}
  </div>
);

const Stat = ({ title, value, tone = "ok" }) => (
  <Card padding={14}>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4, color: tone === "warn" ? "var(--warn-700)" : "var(--ink-900)" }}>{value}</div>
  </Card>
);

const Header = ({ stage, title, phase, blurb }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">{phase}</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage {String(stage).padStart(2, "0")}</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>{blurb}</p>
  </div>
);

export default DataPreview;
