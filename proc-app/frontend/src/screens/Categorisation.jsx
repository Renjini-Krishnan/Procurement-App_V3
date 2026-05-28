import React, { useMemo, useState } from "react";
import { Card, Badge, Callout, Input, Select, DataTable } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 9 — Category Classification.
   Shows archetype distribution + per-MG reclassification confidence + table. */

const ARCHETYPE_TONES = {
  DIRECT: "var(--brand-600)",
  INDIRECT: "var(--success-600)",
  SERVICE: "var(--warn-600)",
  BULK: "var(--brand-800)",
  CAPEX: "var(--danger-600)",
  UNCLASSIFIED: "var(--ink-500)",
};

const Categorisation = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data, loading, error } = useIntel(engagement);
  const [archFilter, setArchFilter] = useState("All");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.per_mg_table;
    if (archFilter !== "All") r = r.filter((x) => x.archetype === archFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        (x.material_group || "").toLowerCase().includes(q) ||
        (x.material_group_desc || "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [data, archFilter, search]);

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header /><Card padding={32} style={{ marginTop: 24, textAlign: "center" }}><div style={{ color: "var(--ink-500)" }}>Running Stage 8 → 9 → 10…</div></Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="Categorisation failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const totalRows = data.classify_summary.by_archetype_rows;
  const totalSpend = data.classify_summary.by_archetype_spend_inr;
  const grandTotal = Object.values(totalSpend).reduce((a, b) => a + b, 0);

  const cols = [
    { key: "material_group", label: "MG" },
    { key: "material_group_desc", label: "Category" },
    { key: "archetype", label: "Archetype", render: (r) => <ArchPill arch={r.archetype} /> },
    { key: "total_spend_inr_cr", label: "₹ Cr", align: "right" },
    { key: "po_count", label: "POs", align: "right" },
    { key: "vendor_count", label: "Vendors", align: "right" },
    { key: "plant_count", label: "Plants", align: "right" },
    { key: "contracted_pct", label: "Contract %", align: "right", render: (r) => `${Math.round(r.contracted_pct || 0)}%` },
  ];

  return (
    <div>
      <Header />

      {/* Archetype breakdown hero */}
      <Card padding={24}>
        <Label>Archetype distribution</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 12 }}>
          {Object.entries(totalRows).map(([arch, count]) => {
            const spendCr = ((totalSpend[arch] || 0) / 1e7).toFixed(1);
            const pct = grandTotal ? (((totalSpend[arch] || 0) / grandTotal) * 100).toFixed(1) : 0;
            return (
              <Card key={arch} padding={14} style={{ borderTop: `3px solid ${ARCHETYPE_TONES[arch] || "var(--ink-300)"}` }}>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{arch}</div>
                <div style={{ fontSize: "var(--fs-22)", fontWeight: 600, marginTop: 4 }}>{count}</div>
                <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 2 }}>POs · ₹{spendCr} Cr · {pct}%</div>
              </Card>
            );
          })}
        </div>
        <Callout tone={data.classify_summary.unclassified_pct > 15 ? "warn" : "info"}
                 title={`Unclassified: ${data.classify_summary.unclassified_pct}% of rows`}
                 icon={<I.Layers size={16} />}>
          {data.classify_summary.unclassified_pct > 15
            ? "High unclassified rate — review master data + add aliases to categories-master.yml."
            : "Within acceptable bounds."}
        </Callout>
      </Card>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, marginBottom: 12, alignItems: "center" }}>
        <Select value={archFilter} onChange={(e) => setArchFilter(e.target.value)}>
          <option>All</option>
          {Object.keys(totalRows).map((a) => <option key={a}>{a}</option>)}
        </Select>
        <div style={{ flex: 1 }}>
          <Input placeholder="Search MG code or description…" value={search}
                 onChange={(e) => setSearch(e.target.value)} icon={<I.Search size={14} />} />
        </div>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          {rows.length} / {data.per_mg_table.length} (top {data.per_mg_table.length} of {data.mg_count} MGs)
        </span>
      </div>

      <Card padding={0}>
        <div style={{ padding: "12px 16px" }}>
          <DataTable columns={cols} rows={rows} />
        </div>
      </Card>
    </div>
  );
};

const ArchPill = ({ arch }) => (
  <span style={{
    background: `${ARCHETYPE_TONES[arch] || "var(--ink-300)"}22`,
    color: ARCHETYPE_TONES[arch] || "var(--ink-700)",
    padding: "2px 8px", borderRadius: "var(--r-pill)",
    fontSize: "var(--fs-11)", fontWeight: 600,
  }}>
    {arch}
  </span>
);

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 09</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Category Classification
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Reclassify PO categories using industry taxonomy + alias matching.
    </p>
  </div>
);

export default Categorisation;
