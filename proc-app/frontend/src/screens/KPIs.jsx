import React, { useMemo, useState } from "react";
import { Card, Badge, Callout, Input, DataTable } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 10 — KPI Calculation (raw per-MG metrics).
   Distinct from Stage 30 KPI Dashboard which is benchmark-cited. */

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
  if (loading) return <div><Header /><Card padding={32} style={{ marginTop: 24, textAlign: "center", color: "var(--ink-500)" }}>Running Stage 8 → 9 → 10…</Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="KPI calc failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const cols = [
    { key: "material_group", label: "MG", render: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.material_group}</code> },
    { key: "material_group_desc", label: "Category" },
    { key: "archetype", label: "Type" },
    { key: "total_spend_inr_cr", label: "₹ Cr", align: "right" },
    { key: "po_count", label: "POs", align: "right" },
    { key: "po_count_6mo", label: "POs (6mo)", align: "right" },
    { key: "distinct_months", label: "Months", align: "right" },
    { key: "avg_po_value", label: "Avg PO ₹", align: "right", render: (r) => `${(r.avg_po_value/1000).toFixed(0)}k` },
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

      {/* Portfolio overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Stat title="Material Groups" value={port.mg_count} />
        <Stat title="Total POs" value={port.total_po_count?.toLocaleString("en-IN")} />
        <Stat title="Total spend" value={`₹${(port.total_spend_inr / 1e7).toFixed(1)} Cr`} />
        <Stat title="Unclassified" value={`${data.classify_summary.unclassified_pct}%`} tone={data.classify_summary.unclassified_pct > 15 ? "warn" : "ok"} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24, marginBottom: 12, alignItems: "center" }}>
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
          <DataTable columns={cols} rows={rows} />
        </div>
      </Card>
    </div>
  );
};

const Stat = ({ title, value, tone = "ok" }) => (
  <Card padding={16}>
    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-24)", fontWeight: 600, marginTop: 4, color: tone === "warn" ? "var(--warn-700)" : "var(--ink-900)" }}>{value}</div>
  </Card>
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
      Per-MG raw metrics — feed all 4 pillar engines. Benchmark-cited dashboard is Stage 30.
    </p>
  </div>
);

export default KPIs;
