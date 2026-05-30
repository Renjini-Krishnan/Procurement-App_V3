import React, { useMemo, useState } from "react";
import { Card, Badge, Callout, Input, DataTable, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";
import { api } from "../api/client.js";

/* Stage 10 — KPI Calculation.
   8 methodology KPIs with per-canonical + per-archetype breakdowns,
   data-quality coverage, and Indian-context benchmark comparisons.
   Per-canonical breakdown table replaces the raw-MG roll-up. */

const ARCH_TONE = {
  DIRECT: "var(--brand-600)",
  INDIRECT: "var(--success-600)",
  SERVICE: "var(--warn-600)",
  BULK: "var(--brand-800)",
  CAPEX: "var(--danger-600)",
  UNCLASSIFIED: "var(--ink-500)",
};

const POSITION_TONE = {
  above_typical_good:   { bg: "var(--success-50)", fg: "var(--success-700)", label: "Above typical (good)" },
  below_typical_good:   { bg: "var(--success-50)", fg: "var(--success-700)", label: "Below typical (good)" },
  within_typical:       { bg: "var(--surface-sunk)", fg: "var(--ink-700)",     label: "Within typical" },
  above_typical_bad:    { bg: "var(--warn-50)",    fg: "var(--warn-700)",    label: "Above typical (bad)" },
  below_typical:        { bg: "var(--warn-50)",    fg: "var(--warn-700)",    label: "Below typical" },
};

const KPIs = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data, loading, error } = useIntel(engagement);
  const [tableTab, setTableTab] = useState("canonical");

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header /><Card padding={32} style={{ marginTop: 24, textAlign: "center", color: "var(--ink-500)" }}>Running KPI engine…</Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="KPI calc failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const kpis = data.methodology_kpis || [];
  const available = kpis.filter((k) => k.available);
  const unavailable = kpis.filter((k) => !k.available);
  const port = data.portfolio_summary || {};
  const dqs = data.data_quality_score || {};

  return (
    <div>
      <Header engagementId={engagement.id} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <PortfolioStat title="Canonicals" value={data.canonical_classification?.taxonomy_canonicals || "—"} />
        <PortfolioStat title="Total POs" value={port.total_po_count?.toLocaleString("en-IN")} />
        <PortfolioStat title="Total spend" value={`₹${(port.total_spend_inr / 1e7).toFixed(1)} Cr`} />
        <PortfolioStat title="DQS" value={dqs.score ? `${dqs.score} · ${dqs.band}` : "—"} />
        <PortfolioStat title="Unclassified" value={`${data.classify_summary?.unclassified_pct || 0}%`}
                        tone={(data.classify_summary?.unclassified_pct || 0) > 15 ? "warn" : "ok"} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <SectionLabel title={`Methodology KPIs · ${available.length} computed · ${unavailable.length} unavailable`}
                       sub="Each card: value · benchmark · per-archetype breakdown · DQ coverage. Click to expand per-canonical." />
        <a href={api.kpisExportCsvUrl(engagement.id)} download
           style={{ fontSize: "var(--fs-12)", color: "var(--brand-700)", textDecoration: "underline" }}>
          ↓ Export all KPIs (portfolio + archetype + canonical) — CSV
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12, marginBottom: 16 }}>
        {available.map((k) => <KPICard key={k.id} kpi={k} />)}
      </div>

      {unavailable.length > 0 && (
        <details style={{ marginBottom: 24 }}>
          <summary style={{ cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>
            {unavailable.length} KPI(s) unavailable — click to see why
          </summary>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {unavailable.map((k) => (
              <Card key={k.id} padding={14} style={{ opacity: 0.85, borderLeft: "3px solid var(--ink-300)" }}>
                <div style={{ fontSize: "var(--fs-13)", fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 4 }}>{k.notes}</div>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 4 }}>
                  Required: <code style={{ fontFamily: "var(--font-mono)" }}>{(k.source_columns_used || []).join(", ")}</code>
                </div>
              </Card>
            ))}
          </div>
        </details>
      )}

      <SectionLabel title="Per-category breakdown"
                     sub="Raw building blocks behind the methodology KPIs above." />
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <Tabs items={[
          { id: "canonical", label: `By canonical (${(data.per_canonical_table || []).length})` },
          { id: "mg",        label: `By raw MG (${(data.per_mg_table || []).length})` },
        ]} value={tableTab} onChange={setTableTab} variant="pill" />
      </div>
      {tableTab === "canonical" ? <CanonicalTable data={data} /> : <MGTable data={data} />}
    </div>
  );
};

// ─── KPI card ─────────────────────────────────────────────────────────────

const KPICard = ({ kpi }) => {
  const [expanded, setExpanded] = useState(false);
  const tone = kpi.direction === "lower_is_better" ? "var(--warn-500)" : "var(--success-500)";
  const bench = kpi.benchmark || {};
  const pos = POSITION_TONE[bench.your_position];
  const dq = kpi.data_quality || {};
  const perCanon = (kpi.per_canonical || []).filter((p) => p.value != null);
  const perArch = (kpi.per_archetype || []).filter((p) => p.value != null);

  return (
    <Card padding={18} style={{ borderTop: `3px solid ${tone}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {kpi.label}
        </div>
        <span title={`Data quality: ${dq.coverage_pct}% of rows (${dq.rows_used?.toLocaleString("en-IN")}/${dq.rows_available?.toLocaleString("en-IN")})`}
              style={{ background: "var(--surface-sunk)", padding: "2px 8px", borderRadius: "var(--r-pill)",
                        fontSize: "var(--fs-11)", color: "var(--ink-600)", cursor: "help" }}>
          DQ {dq.coverage_pct ?? 0}%
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: "var(--fs-30)", fontWeight: 600, color: "var(--ink-900)" }}>
          {typeof kpi.value === "number" ? kpi.value.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : kpi.value}
        </span>
        <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>{kpi.unit}</span>
      </div>

      {/* Benchmark band */}
      {bench.typical_low !== undefined && bench.typical_low !== null && (
        <div style={{ marginTop: 8, fontSize: "var(--fs-12)", color: "var(--ink-700)" }}>
          Typical: <strong>{bench.typical_low}–{bench.typical_high} {bench.unit}</strong>
          {pos && <span style={{ marginLeft: 8, background: pos.bg, color: pos.fg, padding: "1px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>{pos.label}</span>}
        </div>
      )}

      {/* Per-archetype mini-bar */}
      {perArch.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {perArch.map((p) => (
            <span key={p.archetype} title={`${p.row_count.toLocaleString("en-IN")} rows`}
                  style={{
                    background: `${ARCH_TONE[p.archetype] || "var(--ink-300)"}22`,
                    color: ARCH_TONE[p.archetype] || "var(--ink-700)",
                    padding: "2px 8px", borderRadius: "var(--r-pill)",
                    fontSize: "var(--fs-11)", fontWeight: 600,
                  }}>
              {p.archetype}: {p.value}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-700)", lineHeight: 1.45 }}>
        {kpi.notes}
      </div>

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border-subtle)" }}>
        <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
          Columns: {(kpi.source_columns_used || []).map((c, i) => (
            <code key={i} style={{ fontFamily: "var(--font-mono)", marginRight: 6 }}>{c}</code>
          ))}
        </div>
        <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 4 }}>
          Source: <code style={{ fontFamily: "var(--font-mono)" }}>{kpi.source}</code>
        </div>

        {perCanon.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setExpanded(!expanded)}
                    style={{ background: "transparent", border: "none", padding: 0,
                              cursor: "pointer", color: "var(--brand-700)", fontSize: "var(--fs-11)" }}>
              {expanded ? "▾" : "▸"} Per-canonical breakdown ({perCanon.length})
            </button>
            {expanded && (
              <div style={{ marginTop: 6, maxHeight: 260, overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-12)" }}>
                  <tbody>
                    {perCanon
                      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
                      .map((p) => (
                        <tr key={p.canonical_id}>
                          <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-subtle)" }}>{p.canonical_label}</td>
                          <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
                            {p.archetype && <ArchPill arch={p.archetype} />}
                          </td>
                          <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
                            {p.value}{kpi.unit}
                          </td>
                          <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-500)", textAlign: "right" }}>
                            {p.row_count?.toLocaleString("en-IN")} rows
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Per-canonical breakdown table ────────────────────────────────────────

const CanonicalTable = ({ data }) => {
  const [search, setSearch] = useState("");
  const [archFilter, setArchFilter] = useState("All");
  const rows = useMemo(() => {
    let r = (data.per_canonical_table || []).slice();
    if (archFilter !== "All") r = r.filter((x) => x.archetype === archFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => (x.canonical_label || "").toLowerCase().includes(q) ||
                            (x.canonical_id || "").toLowerCase().includes(q));
    }
    return r;
  }, [data, search, archFilter]);

  const cols = [
    { key: "canonical_label", label: "Canonical" },
    { key: "archetype", label: "Archetype", render: (r) => r.archetype ? <ArchPill arch={r.archetype} /> : "—" },
    { key: "total_spend_inr_cr", label: "₹ Cr", align: "right" },
    { key: "row_count", label: "Rows", align: "right", render: (r) => r.row_count.toLocaleString("en-IN") },
    { key: "po_count", label: "POs", align: "right", render: (r) => r.po_count.toLocaleString("en-IN") },
    { key: "vendor_count", label: "Vendors", align: "right" },
    { key: "plant_count", label: "Plants", align: "right" },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <select value={archFilter} onChange={(e) => setArchFilter(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", fontSize: "var(--fs-13)" }}>
          <option>All</option>
          {["BULK", "DIRECT", "INDIRECT", "SERVICE", "CAPEX"].map((a) => <option key={a}>{a}</option>)}
        </select>
        <div style={{ flex: 1 }}>
          <Input placeholder="Search canonical label or id…" value={search} onChange={(e) => setSearch(e.target.value)} icon={<I.Search size={14} />} />
        </div>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{rows.length} of {(data.per_canonical_table || []).length}</span>
      </div>
      <Card padding={0}>
        <div style={{ padding: "12px 16px", overflowX: "auto" }}>
          <DataTable columns={cols} rows={rows} />
        </div>
      </Card>
    </>
  );
};

// ─── Per-MG table (legacy) ────────────────────────────────────────────────

const MGTable = ({ data }) => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total_spend_inr");
  const rows = useMemo(() => {
    if (!data) return [];
    let r = (data.per_mg_table || []).slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        (x.material_group || "").toLowerCase().includes(q) ||
        (x.material_group_desc || "").toLowerCase().includes(q),
      );
    }
    r.sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));
    return r;
  }, [data, search, sortBy]);

  const cols = [
    { key: "material_group", label: "MG", render: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.material_group}</code> },
    { key: "material_group_desc", label: "Description" },
    { key: "archetype", label: "Type" },
    { key: "total_spend_inr_cr", label: "₹ Cr", align: "right" },
    { key: "po_count", label: "POs", align: "right" },
    { key: "po_count_6mo", label: "POs (6mo)", align: "right" },
    { key: "vendor_count", label: "Vendors", align: "right" },
    { key: "top_vendor_share_pct", label: "Top vend %", align: "right", render: (r) => `${Math.round(r.top_vendor_share_pct || 0)}%` },
    { key: "plant_count", label: "Plants", align: "right" },
    { key: "contracted_pct", label: "Contract %", align: "right", render: (r) => `${Math.round(r.contracted_pct || 0)}%` },
    { key: "pac_pct", label: "PAC %", align: "right", render: (r) => `${Math.round(r.pac_pct || 0)}%` },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <Input placeholder="Search MG / description…" value={search} onChange={(e) => setSearch(e.target.value)} icon={<I.Search size={14} />} />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", fontSize: "var(--fs-13)" }}>
          <option value="total_spend_inr">Sort: spend</option>
          <option value="po_count">Sort: PO count</option>
          <option value="vendor_count">Sort: vendor count</option>
          <option value="plant_count">Sort: plant count</option>
        </select>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>Top {data.per_mg_table?.length} of {data.mg_count}</span>
      </div>
      <Card padding={0}>
        <div style={{ padding: "12px 16px", overflowX: "auto" }}>
          <DataTable columns={cols} rows={rows} />
        </div>
      </Card>
    </>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const ArchPill = ({ arch }) => (
  <span style={{
    background: `${ARCH_TONE[arch] || "var(--ink-300)"}22`,
    color: ARCH_TONE[arch] || "var(--ink-700)",
    padding: "2px 8px", borderRadius: "var(--r-pill)",
    fontSize: "var(--fs-11)", fontWeight: 600,
  }}>{arch}</span>
);

const PortfolioStat = ({ title, value, tone = "ok" }) => (
  <Card padding={16}>
    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4, color: tone === "warn" ? "var(--warn-700)" : "var(--ink-900)" }}>{value}</div>
  </Card>
);

const SectionLabel = ({ title, sub }) => (
  <div>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
      {title}
    </div>
    {sub && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 2 }}>{sub}</div>}
  </div>
);

const Header = ({ engagementId }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 10</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      KPI Calculation
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      8 methodology KPIs · per-canonical + per-archetype breakdowns · benchmark comparison · data-quality coverage per KPI.
    </p>
  </div>
);

export default KPIs;
