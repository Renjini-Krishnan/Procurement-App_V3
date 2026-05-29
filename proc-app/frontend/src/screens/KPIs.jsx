import React, { useMemo, useState } from "react";
import { Card, Badge, Callout, Input, DataTable } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 10 — KPI Calculation.
   Top: 8 methodology KPIs per kb/_meta/kpi-calculation-rules.yml — TAT, RC, Savings,
        PAC, Tail Spend, Spend/FTE, OTD, Sourcing Tool Usage. Each carries its
        source path + columns used + calc note.
   Below: per-MG raw metrics drill-down (the building blocks). */

const KPIs = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data, loading, error } = useIntel(engagement);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total_spend_inr");

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.per_mg_table.slice();
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

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header /><Card padding={32} style={{ marginTop: 24, textAlign: "center", color: "var(--ink-500)" }}>Running Stage 8 → 9 → 10 + methodology KPIs…</Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="KPI calc failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const kpis = data.methodology_kpis || [];
  const available = kpis.filter((k) => k.available);
  const unavailable = kpis.filter((k) => !k.available);

  const perMgCols = [
    { key: "material_group", label: "MG", render: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.material_group}</code> },
    { key: "material_group_desc", label: "Category" },
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

  const port = data.portfolio_summary;

  return (
    <div>
      <Header />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <PortfolioStat title="Material Groups" value={port.mg_count} />
        <PortfolioStat title="Total POs" value={port.total_po_count?.toLocaleString("en-IN")} />
        <PortfolioStat title="Total spend" value={`₹${(port.total_spend_inr / 1e7).toFixed(1)} Cr`} />
        <PortfolioStat title="Unclassified" value={`${data.classify_summary.unclassified_pct}%`} tone={data.classify_summary.unclassified_pct > 15 ? "warn" : "ok"} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <SectionLabel title={`Methodology KPIs · ${available.length} computed`}
                       sub="From kb/_meta/kpi-calculation-rules.yml — every value carries its source + columns used." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginBottom: 16 }}>
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
                  Source: <code style={{ fontFamily: "var(--font-mono)" }}>{k.source}</code>
                </div>
              </Card>
            ))}
          </div>
        </details>
      )}

      <SectionLabel title="Per-category breakdown"
                     sub="Raw building blocks behind the methodology KPIs above — sortable + searchable." />
      <div style={{ display: "flex", gap: 12, marginTop: 12, marginBottom: 12, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} icon={<I.Search size={14} />} />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", fontSize: "var(--fs-13)" }}>
          <option value="total_spend_inr">Sort: spend</option>
          <option value="po_count">Sort: PO count</option>
          <option value="vendor_count">Sort: vendor count</option>
          <option value="plant_count">Sort: plant count</option>
        </select>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          Top {data.per_mg_table.length} of {data.mg_count} MGs
        </span>
      </div>
      <Card padding={0}>
        <div style={{ padding: "12px 16px", overflowX: "auto" }}>
          <DataTable columns={perMgCols} rows={rows} />
        </div>
      </Card>
    </div>
  );
};

const KPICard = ({ kpi }) => {
  const tone = kpi.direction === "higher_is_better" ? "var(--success-500)"
              : kpi.direction === "lower_is_better" ? "var(--warn-500)"
              : "var(--brand-500)";
  return (
    <Card padding={18} style={{ borderTop: `3px solid ${tone}` }}>
      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {kpi.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: "var(--fs-30)", fontWeight: 600, color: "var(--ink-900)" }}>
          {typeof kpi.value === "number" ? kpi.value.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : kpi.value}
        </span>
        <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>{kpi.unit}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: "var(--fs-12)", color: "var(--ink-700)", lineHeight: 1.45 }}>
        {kpi.notes}
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border-subtle)" }}>
        <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
          Columns used:&nbsp;
          {(kpi.source_columns_used || []).map((c, i) => (
            <code key={i} style={{ fontFamily: "var(--font-mono)", marginRight: 6 }}>{c}</code>
          ))}
        </div>
        <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 4 }}>
          Source: <code style={{ fontFamily: "var(--font-mono)" }}>{kpi.source}</code>
        </div>
      </div>
    </Card>
  );
};

const PortfolioStat = ({ title, value, tone = "ok" }) => (
  <Card padding={16}>
    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-24)", fontWeight: 600, marginTop: 4, color: tone === "warn" ? "var(--warn-700)" : "var(--ink-900)" }}>{value}</div>
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

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 10</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      KPI Calculation
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      8 methodology KPIs computed per kb/_meta/kpi-calculation-rules.yml · sources cited per KPI · per-category breakdown below.
    </p>
  </div>
);

export default KPIs;
