import React, { useState } from "react";
import { Card, Badge, Callout, Button } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 7 (Bronze) / Stage 8 (Gold) — data preview.
   Bronze = cleansed; Gold = enriched (vendor dedup, currency normalised, joins).
   Bronze now iterates every upload + runs cross-file recon. */

export const Bronze = () => <DataPreview stage={7} title="Bronze Data" phase="Diagnostic"
  blurb="Cleansing pipeline applied per upload + cross-file recon. Click any rule to expand details." />;

export const Gold = () => <DataPreview stage={8} title="Gold Data" phase="Diagnostic"
  blurb="Bronze + V1 enrichments: derived po_type, capex/PAC/emergency flags, approver_tier. Analysis-ready." />;

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

          {stage === 7 && data.data_quality_score && (
            <DataQualityScoreCard dqs={data.data_quality_score} />
          )}

          {stage === 7 && data.pillar_feasibility && (
            <PillarFeasibilityCard feasibility={data.pillar_feasibility} />
          )}

          {stage === 7 && data.cross_file_recon && (
            <CrossFileReconCard recon={data.cross_file_recon} engagementId={engagement.id} />
          )}

          {stage === 7 && data.per_upload_reports && data.per_upload_reports.length > 0 && (
            <PerUploadReportsCard reports={data.per_upload_reports} engagementId={engagement.id} />
          )}

          {/* Stage 8 Gold-specific: enrichment + breakdown */}
          {stage === 8 && data.per_upload_reports && (
            <GoldEnrichmentsCard reports={data.per_upload_reports} summary={data.gold_summary} />
          )}

          {stage === 8 && data.cleansing_report && (
            <CleansingReport report={data.cleansing_report} title="Underlying Bronze cleansing report · primary upload" />
          )}

          {stage === 7 && <RuleAuditCard />}

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

// ─── Data Quality Score card (KB-PART-5 formula) ─────────────────────────

const DQS_BAND_COLOR = {
  HIGH: { bg: "var(--success-50)", fg: "var(--success-700)", bar: "var(--success-500)" },
  GOOD: { bg: "var(--success-50)", fg: "var(--success-700)", bar: "var(--success-500)" },
  ACCEPTABLE: { bg: "var(--warn-50)", fg: "var(--warn-700)", bar: "var(--warn-500)" },
  LOW: { bg: "var(--warn-50)", fg: "var(--warn-700)", bar: "var(--warn-500)" },
  VERY_LOW: { bg: "var(--danger-50)", fg: "var(--danger-700)", bar: "var(--danger-500)" },
};

const DataQualityScoreCard = ({ dqs }) => {
  const palette = DQS_BAND_COLOR[dqs.band] || DQS_BAND_COLOR.ACCEPTABLE;
  const Bar = ({ value }) => (
    <div style={{ width: "100%", height: 6, background: "var(--surface-sunk)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: palette.bar }} />
    </div>
  );
  return (
    <div style={{ marginTop: 24 }}>
      <Card padding={20}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
              Data Quality Score · KB-PART-5
            </div>
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
              0.40 × completeness + 0.30 × validity + 0.30 × consistency
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "var(--fs-36)", fontWeight: 700, color: palette.fg, lineHeight: 1 }}>
              {dqs.score}
              <span style={{ fontSize: "var(--fs-16)", color: "var(--ink-500)", fontWeight: 400 }}> / 100</span>
            </div>
            <span style={{ display: "inline-block", marginTop: 6,
                            background: palette.bg, color: palette.fg,
                            padding: "3px 10px", borderRadius: "var(--r-pill)",
                            fontSize: "var(--fs-12)", fontWeight: 600 }}>
              {dqs.band}
            </span>
          </div>
        </div>
        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", marginBottom: 14 }}>
          {dqs.band_interpretation}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Completeness · 40%</div>
            <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4 }}>{dqs.components.completeness_pct}%</div>
            <Bar value={dqs.components.completeness_pct} />
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 6 }}>
              % of required fields populated across templates
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Validity · 30%</div>
            <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4 }}>{dqs.components.validity_pct}%</div>
            <Bar value={dqs.components.validity_pct} />
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 6 }}>
              % of rows passing cleansing rules (warn = ½ penalty, drop = full)
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Consistency · 30%</div>
            <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4 }}>{dqs.components.consistency_pct}%</div>
            <Bar value={dqs.components.consistency_pct} />
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 6 }}>
              {dqs.cross_file_rules_passed} of {dqs.cross_file_rules_total} cross-file rules passed
            </div>
          </div>
        </div>
        {dqs.per_template_completeness && Object.keys(dqs.per_template_completeness).length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Per-template completeness × validity
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(dqs.per_template_completeness).map(([ft, c]) => {
                const v = (dqs.per_template_validity || {})[ft];
                return (
                  <span key={ft} style={{
                    background: "var(--surface-sunk)", padding: "4px 10px", borderRadius: "var(--r-md)",
                    fontSize: "var(--fs-12)", color: "var(--ink-700)",
                  }}>
                    <strong>{ft}</strong> · {c}% complete · {v}% valid
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── Pillar Feasibility card ─────────────────────────────────────────────

const TIER_TONE = {
  high:   { bg: "var(--success-50)", fg: "var(--success-700)" },
  medium: { bg: "var(--warn-50)", fg: "var(--warn-700)" },
  low:    { bg: "var(--warn-50)", fg: "var(--warn-700)" },
  skip:   { bg: "var(--danger-50)", fg: "var(--danger-700)" },
};

const PILLAR_LABELS = {
  op_model: "Op Model", org_structure: "Org Structure", doa: "DoA",
  buying_channel: "Buying Channel", pr_to_po: "PR-to-PO",
  post_po: "Post-PO", material_master: "Material Master", supplier: "Supplier",
};

const PillarFeasibilityCard = ({ feasibility }) => (
  <div style={{ marginTop: 16 }}>
    <Card padding={20}>
      <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 4 }}>
        Pillar feasibility gates · KB-PART-5
      </div>
      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginBottom: 12 }}>
        Confidence tier per pillar, based on uploaded templates + completeness thresholds.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {Object.entries(feasibility).map(([k, v]) => {
          const tone = TIER_TONE[v.tier] || TIER_TONE.skip;
          return (
            <div key={k} style={{
              border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)",
              padding: "10px 12px",
            }}>
              <div style={{ fontSize: "var(--fs-13)", fontWeight: 500, color: "var(--ink-900)" }}>
                {PILLAR_LABELS[k] || k}
              </div>
              <span style={{
                display: "inline-block", marginTop: 6,
                background: tone.bg, color: tone.fg,
                padding: "2px 8px", borderRadius: "var(--r-pill)",
                fontSize: "var(--fs-11)", fontWeight: 600, textTransform: "uppercase",
              }}>{v.tier}</span>
              {v.reason && (
                <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 4 }}>
                  {v.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  </div>
);

// ─── Gold Enrichments card (Stage 8 honesty UX) ───────────────────────────

const GoldEnrichmentsCard = ({ reports, summary }) => {
  // Find PO upload + filter enrichment entries
  const po = (reports || []).find((u) => u.file_type === "PO");
  if (!po) return null;
  const entries = (po.cleansing_report?.entries || [])
    .filter((e) => e.severity === "enrichment" || e.severity === "enrichment_skipped");
  if (entries.length === 0) return null;

  const applied = entries.filter((e) => e.severity === "enrichment");
  const skipped = entries.filter((e) => e.severity === "enrichment_skipped");
  const columnsAdded = applied.map((e) => e.details?.column_added).filter(Boolean);

  return (
    <div style={{ marginTop: 24 }}>
      <Card padding={20}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
              Gold enrichments applied · what's different from Bronze
            </div>
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
              {applied.length} enrichment{applied.length === 1 ? "" : "s"} applied · {columnsAdded.length} new column{columnsAdded.length === 1 ? "" : "s"} added
              {skipped.length > 0 && ` · ${skipped.length} skipped (see why below)`}
            </div>
          </div>
          {columnsAdded.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "55%", justifyContent: "flex-end" }}>
              {columnsAdded.map((c) => (
                <span key={c} style={{
                  background: "var(--success-50)", color: "var(--success-700)",
                  padding: "3px 10px", borderRadius: "var(--r-pill)",
                  fontSize: "var(--fs-12)", fontWeight: 600, fontFamily: "var(--font-mono)",
                }}>+ {c}</span>
              ))}
            </div>
          )}
        </div>

        {/* Breakdown tiles */}
        {(summary?.po_type_breakdown || summary?.approver_tier_breakdown) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            {summary.po_type_breakdown && (
              <BreakdownTile
                title="PO type breakdown"
                items={Object.entries(summary.po_type_breakdown).map(([k, v]) => ({ label: k, value: v }))}
              />
            )}
            {summary.capex_po_count !== undefined && (
              <KVTile title="Capex POs" value={summary.capex_po_count.toLocaleString("en-IN")}
                       hint={summary.po_count ? `${(100 * summary.capex_po_count / summary.po_count).toFixed(1)}% of POs` : null} />
            )}
            {summary.pac_po_count !== undefined && (
              <KVTile title="PAC POs" value={summary.pac_po_count.toLocaleString("en-IN")}
                       hint={summary.po_count ? `${(100 * summary.pac_po_count / summary.po_count).toFixed(1)}% of POs` : null} />
            )}
            {summary.emergency_po_count !== undefined && (
              <KVTile title="Emergency POs" value={summary.emergency_po_count.toLocaleString("en-IN")}
                       hint={summary.po_count ? `${(100 * summary.emergency_po_count / summary.po_count).toFixed(1)}% of POs` : null} />
            )}
            {summary.approver_tier_breakdown && (
              <BreakdownTile
                title="Approver tier breakdown"
                items={Object.entries(summary.approver_tier_breakdown)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([k, v]) => ({ label: `Tier ${k}`, value: v }))}
              />
            )}
          </div>
        )}

        {/* Per-rule table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr>
              {["Status", "Rule", "Column added", "Counts"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const isApplied = e.severity === "enrichment";
              const tone = isApplied
                ? { bg: "var(--success-50)", fg: "var(--success-700)" }
                : { bg: "var(--surface-sunk)", fg: "var(--ink-500)" };
              const col = e.details?.column_added;
              const counts = e.details?.counts || {};
              return (
                <tr key={i}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ background: tone.bg, color: tone.fg, padding: "2px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>
                      {isApplied ? "applied" : "skipped"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontWeight: 500 }}>{e.rule_name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{e.rule_id}</div>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                    {col ? <span style={{ color: "var(--success-700)" }}>+ {col}</span> : <span style={{ color: "var(--ink-500)" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-700)", fontSize: "var(--fs-12)" }}>
                    {!isApplied
                      ? <span style={{ color: "var(--ink-500)", fontStyle: "italic" }}>{e.details?.reason || "skipped"}</span>
                      : <span>
                          {Object.entries(counts)
                            .filter(([k, v]) => typeof v === "number" && v > 0)
                            .map(([k, v]) => `${k}: ${v.toLocaleString("en-IN")}`)
                            .join(" · ") || "—"}
                        </span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 14, fontSize: "var(--fs-11)", color: "var(--ink-500)", fontStyle: "italic" }}>
          KB sources: <code>kb/functions/procurement/data-cleansing/po-type-derivation-rules.yml</code> ·{" "}
          <code>kb/functions/procurement/data-cleansing/designation-tier-seed.yml</code>
        </div>
      </Card>
    </div>
  );
};

const BreakdownTile = ({ title, items }) => (
  <div style={{ background: "var(--surface-sunk)", padding: 12, borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{title}</div>
    {items.map((it) => (
      <div key={it.label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "var(--fs-13)" }}>
        <span style={{ color: "var(--ink-700)" }}>{it.label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--ink-900)" }}>{Number(it.value).toLocaleString("en-IN")}</span>
      </div>
    ))}
  </div>
);

const KVTile = ({ title, value, hint }) => (
  <div style={{ background: "var(--surface-sunk)", padding: 12, borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4, color: "var(--ink-900)" }}>{value}</div>
    {hint && <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>{hint}</div>}
  </div>
);

// ─── Cross-file recon card ────────────────────────────────────────────────

const CrossFileReconCard = ({ recon, engagementId }) => {
  if (!recon || !recon.entries || recon.entries.length === 0) {
    return (
      <div style={{ marginTop: 24 }}>
        <Callout tone="info" title="Cross-file recon" icon={<I.Doc size={16} />}>
          No cross-file rules fired — upload more file types (PO + PR + GRN + Invoice + Vendor Master + Contract Master + Material Master) to see linkage checks.
        </Callout>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
          Cross-file recon · {recon.entries.length} rules fired
        </div>
        <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          Files joined: {(recon.available_file_types || []).join(" · ")}
        </div>
      </div>
      <Card padding={20}>
        <RuleTable entries={recon.entries} />
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <a href={api.cleansingReportCsvUrl(engagementId, "cross_only")} download
             style={{ fontSize: "var(--fs-12)", color: "var(--brand-700)", textDecoration: "underline" }}>
            ↓ Download cross-file report (CSV)
          </a>
        </div>
      </Card>
    </div>
  );
};

// ─── Per-upload tabbed view ──────────────────────────────────────────────

const PerUploadReportsCard = ({ reports, engagementId }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = reports[activeIdx];
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
        Per-upload cleansing · {reports.length} files
      </div>
      <Card padding={0}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-default)", overflowX: "auto" }}>
          {reports.map((u, i) => {
            const summary = u.cleansing_report?.summary || {};
            const isActive = i === activeIdx;
            const hasError = !!u._error;
            return (
              <button
                key={u.upload_id}
                type="button"
                onClick={() => setActiveIdx(i)}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--brand-700)" : "2px solid transparent",
                  background: isActive ? "var(--brand-50)" : "transparent",
                  color: hasError ? "var(--danger-700)" : isActive ? "var(--brand-700)" : "var(--ink-700)",
                  cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {u.file_type}
                <span style={{ color: "var(--ink-500)", marginLeft: 6, fontSize: "var(--fs-11)", fontWeight: 400 }}>
                  {hasError ? "✗" : `${summary.rules_fired || 0} rules`}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: 20 }}>
          {active._error ? (
            <Callout tone="danger" title={`Failed: ${active.file_type}`} icon={<I.X size={16} />}>{active._error}</Callout>
          ) : (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
                <span>{active.original_filename}</span>
                <span>Rows raw: <strong>{active.row_count_raw?.toLocaleString?.("en-IN")}</strong></span>
                <span>Rows cleaned: <strong>{active.row_count_cleaned?.toLocaleString?.("en-IN")}</strong></span>
                <span>Rules fired: <strong>{active.cleansing_report?.summary?.rules_fired}</strong></span>
                <span>Fixed: <strong>{active.cleansing_report?.summary?.rows_fixed_total?.toLocaleString?.("en-IN")}</strong></span>
                <span>Dropped: <strong>{active.cleansing_report?.summary?.rows_dropped_total?.toLocaleString?.("en-IN")}</strong></span>
              </div>
              <RuleTable entries={active.cleansing_report?.entries || []} />
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <a href={api.cleansingReportCsvUrl(engagementId, active.upload_id)} download
                   style={{ fontSize: "var(--fs-12)", color: "var(--brand-700)", textDecoration: "underline" }}>
                  ↓ Download this file's report (CSV)
                </a>
              </div>
            </>
          )}
        </div>
      </Card>
      <div style={{ marginTop: 8, textAlign: "right" }}>
        <a href={api.cleansingReportCsvUrl(engagementId, "all")} download
           style={{ fontSize: "var(--fs-12)", color: "var(--brand-700)", textDecoration: "underline" }}>
          ↓ Download FULL cleansing report (all files + cross-file) — CSV
        </a>
      </div>
    </div>
  );
};

// ─── Rule table with expandable details ──────────────────────────────────

const RuleTable = ({ entries }) => {
  const [openIdx, setOpenIdx] = useState(null);
  if (!entries || entries.length === 0) {
    return <div style={{ color: "var(--ink-500)", fontStyle: "italic", padding: 12 }}>No rules fired.</div>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
      <thead>
        <tr>
          {["", "Severity", "Stage", "Rule", "Rows", "Action"].map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const tone = SEVERITY_TONES[e.severity] || SEVERITY_TONES.info;
          const hasDetails = e.details && Object.keys(e.details).length > 0;
          const isOpen = openIdx === i;
          return (
            <React.Fragment key={i}>
              <tr
                style={{ cursor: hasDetails ? "pointer" : "default" }}
                onClick={() => hasDetails && setOpenIdx(isOpen ? null : i)}
              >
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", width: 24, color: "var(--ink-500)" }}>
                  {hasDetails ? (isOpen ? "▾" : "▸") : ""}
                </td>
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
              {isOpen && hasDetails && (
                <tr>
                  <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid var(--border-subtle)" }}>
                    <pre style={{
                      margin: 0, padding: "12px 24px",
                      background: "var(--surface-sunk)", color: "var(--ink-700)",
                      fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
                      whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 280,
                    }}>{JSON.stringify(e.details, null, 2)}</pre>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

// ─── Legacy single-report fallback (Gold) ────────────────────────────────

const CleansingReport = ({ report, title }) => {
  const entries = report.entries || [];
  const summary = report.summary || {};
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
        {title || `Cleansing report · ${summary.rules_fired} rules fired`}
      </div>
      <Card padding={20}>
        <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
          <span>Total rules: <strong>{summary.rules_fired}</strong></span>
          <span>Rows fixed: <strong>{summary.rows_fixed_total}</strong></span>
          <span>Rows dropped: <strong>{summary.rows_dropped_total}</strong></span>
        </div>
        <RuleTable entries={entries} />
      </Card>
    </div>
  );
};

// ─── KB-vs-engine implementation audit ───────────────────────────────────

const STAT_TONES = {
  implemented: { bg: "var(--success-50)", fg: "var(--success-700)" },
  not_implemented: { bg: "var(--danger-50)", fg: "var(--danger-700)" },
  handled_at_other_stage: { bg: "var(--info-50)", fg: "var(--info-700)" },
  subsumed: { bg: "var(--surface-sunk)", fg: "var(--ink-600)" },
};

const RuleAuditCard = () => {
  const [audit, setAudit] = useState(null);
  const [open, setOpen] = useState(false);
  React.useEffect(() => {
    api.cleansingAudit().then(setAudit).catch(() => {});
  }, []);
  if (!audit) return null;
  const totals = audit.totals || {};
  const byStatus = totals.by_status || {};
  const kb5ByStatus = totals.kb_part_5_by_status || {};
  return (
    <div style={{ marginTop: 24 }}>
      <Card padding={20}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
             onClick={() => setOpen(!open)}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
              KB-vs-engine rule audit
            </div>
            <div style={{ marginTop: 6, fontSize: "var(--fs-13)", color: "var(--ink-700)" }}>
              <strong>Legacy YAML:</strong> {byStatus.implemented || 0} of {totals.yaml_rules_total} wired ·{" "}
              <span style={{ color: "var(--danger-700)" }}>{byStatus.not_implemented || 0} unimplemented</span> ·{" "}
              <span style={{ color: "var(--info-700)" }}>{byStatus.handled_at_other_stage || 0} elsewhere</span> ·{" "}
              <span style={{ color: "var(--ink-600)" }}>{byStatus.subsumed || 0} subsumed</span> ·{" "}
              +{totals.engine_only_total} engine-only
            </div>
            <div style={{ marginTop: 4, fontSize: "var(--fs-13)", color: "var(--ink-700)" }}>
              <strong>KB-PART-5:</strong> {kb5ByStatus.implemented || 0} of {totals.kb_part_5_total} wired ·{" "}
              <span style={{ color: "var(--danger-700)" }}>{kb5ByStatus.not_implemented || 0} unimplemented</span> ·{" "}
              <span style={{ color: "var(--info-700)" }}>{kb5ByStatus.handled_at_other_stage || 0} elsewhere</span> ·{" "}
              <span style={{ color: "var(--ink-600)" }}>{kb5ByStatus.subsumed || 0} subsumed</span>
            </div>
          </div>
          <span style={{ color: "var(--ink-500)" }}>{open ? "▾" : "▸"}</span>
        </div>
        {open && (
          <div style={{ marginTop: 16, maxHeight: 480, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-12)" }}>
              <thead>
                <tr>
                  {["KB rule id", "Status", "Engine emits", "Note"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(audit.yaml_rules || {}).map(([id, v]) => {
                  const tone = STAT_TONES[v.stat] || STAT_TONES.subsumed;
                  return (
                    <tr key={id}>
                      <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>{id}</td>
                      <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{ background: tone.bg, color: tone.fg, padding: "1px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>{v.stat}</span>
                      </td>
                      <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-600)" }}>{v.fires_as || "—"}</td>
                      <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{v.note || ""}</td>
                    </tr>
                  );
                })}
                {(audit.engine_only || []).map((r) => (
                  <tr key={r.rule_id}>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)", fontStyle: "italic" }}>(engine-only)</td>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ background: "var(--surface-sunk)", color: "var(--ink-600)", padding: "1px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>engine_only</span>
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-600)" }}>{r.rule_id}</td>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {audit.kb_part_5_coverage && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-500)", marginBottom: 6 }}>
                  KB-PART-5 coverage ({Object.keys(audit.kb_part_5_coverage).length} rules)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-12)" }}>
                  <thead>
                    <tr>
                      {["KB-PART-5 rule", "Status", "Engine emits", "Note"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(audit.kb_part_5_coverage).map(([id, v]) => {
                      const tone = STAT_TONES[v.stat] || STAT_TONES.subsumed;
                      return (
                        <tr key={id}>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>{id}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                            <span style={{ background: tone.bg, color: tone.fg, padding: "1px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>{v.stat}</span>
                          </td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-600)" }}>{v.fires_as || "—"}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{v.note || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
