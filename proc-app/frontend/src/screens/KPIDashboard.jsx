import React, { useEffect, useMemo, useState } from "react";
import { Card, Badge, Callout, Input, Select, Button } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { MaturityGauge, DataQualityContext, KpiSummaryStrip, NeedsQreBanner, QreStatusChip } from "../design/patterns.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 30 — KPI Dashboard
   Runs all 4 pillars, assembles unified KPI list, then:
     - sidebar pillar filter (with counts + maturity scores)
     - topbar: search + status filter + sort + view toggle (grid/list)
     - main: KPI card grid OR table list
     - drawer: full drill-down on KPI click
*/

const PILLAR_META = {
  "op-model":       { label: "Op Model",        stageUrl: "op-model",        tone: "var(--brand-600)" },
  "org-structure":  { label: "Org Structure",   stageUrl: "org-structure",   tone: "var(--brand-500)" },
  "buying-channel": { label: "Buying Channel",  stageUrl: "buying-channel",  tone: "var(--brand-700)" },
  "doa":            { label: "DoA",             stageUrl: "doa",             tone: "var(--brand-800)" },
};

const STATUS_META = {
  in:      { label: "In band",        bg: "var(--success-50)", fg: "var(--success-700)", border: "var(--success-500)" },
  under:   { label: "Below band",     bg: "var(--warn-50)",    fg: "var(--warn-700)",    border: "var(--warn-500)" },
  over:    { label: "Above band",     bg: "var(--danger-50)",  fg: "var(--danger-700)",  border: "var(--danger-500)" },
  unknown: { label: "Unknown",        bg: "var(--surface-sunk)", fg: "var(--ink-600)",   border: "var(--ink-300)" },
};

const KPIDashboard = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data: intel } = useIntel(engagement);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters / view state
  const [activePillar, setActivePillar] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("pillar");
  const [view, setView] = useState("grid");        // "grid" | "list" | "trend"
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [scopedPillars, setScopedPillars] = useState(null); // null = no scope filter

  // Drill-down filters that get re-applied at the backend (recomputes KPIs
  // against a subset of the PO data). { plants: [], material_groups: [],
  // period_start: "YYYY-MM-DD", period_end: "YYYY-MM-DD" }.
  const [drillFilters, setDrillFilters] = useState({
    plants: [], material_groups: [], period_start: null, period_end: null,
  });
  const [filterBusy, setFilterBusy] = useState(false);

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    const hasDrill = drillFilters.plants.length > 0 ||
                     drillFilters.material_groups.length > 0 ||
                     drillFilters.period_start || drillFilters.period_end;
    (async () => {
      try {
        // First load uses the full spinner; subsequent drill-down re-fetches
        // use a lighter "filterBusy" flag so the dashboard stays visible.
        if (data) setFilterBusy(true);
        else setLoading(true);
        setError(null);
        const uploads = await api.listUploads(engagement.id);
        if (uploads.length === 0) {
          setError("No PO data uploaded. Go to Stage 4 first.");
          setLoading(false); return;
        }
        try {
          const ov = await api.listOverrides(engagement.id);
          const pillars = (ov.overrides || []).find((o) => o.key === "scope.pillars")?.value;
          if (Array.isArray(pillars) && pillars.length > 0) {
            if (!cancelled) setScopedPillars(new Set(pillars));
          }
        } catch { /* defaults: no scope filter */ }

        const latest = uploads[0];
        const result = await api.runKpiDashboard(
          engagement.id, latest.id, engagement.industry,
          hasDrill ? drillFilters : {}
        );
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) { setLoading(false); setFilterBusy(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [engagement, drillFilters]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.kpis.slice();
    if (scopedPillars && scopedPillars.size > 0) list = list.filter((k) => scopedPillars.has(k.pillar));
    if (activePillar !== "all") list = list.filter((k) => k.pillar === activePillar);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((k) =>
        k.label.toLowerCase().includes(q) ||
        k.pillar.toLowerCase().includes(q) ||
        k.theme.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === "name")   return a.label.localeCompare(b.label);
      if (sortBy === "pillar") return a.pillar.localeCompare(b.pillar) || a.label.localeCompare(b.label);
      if (sortBy === "value")  return (b.value ?? -Infinity) - (a.value ?? -Infinity);
      return 0;
    });
    return list;
  }, [data, activePillar, search, sortBy, scopedPillars]);

  if (engLoading || !engagement) return <div>Loading engagement...</div>;
  if (loading) {
    return (
      <div>
        <Header />
        <Card padding={32} style={{ marginTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-500)" }}>
            Building KPI dashboard — running all 4 pillars (Op Model · Org Structure · Buying Channel · DoA)…
          </div>
          <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-400)", marginTop: 8 }}>
            (Stage 8 Gold → Stage 9 Classify → Stage 10 KPIs → 4 pillar engines → Stage 30 KPI assembly)
          </div>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Header />
        <Callout tone="danger" title="KPI dashboard failed" icon={<I.X size={16} />}>{error}</Callout>
      </div>
    );
  }
  if (!data) return null;

  // Surface QRE-missing pillars at the top so the consultant knows why
  // some KPIs are absent. The pillar runners return needs_qre=true when
  // zero QRE answers exist.
  const needsQrePillars = Object.entries(data.pillar_results || data.pillar_summary || {})
    .filter(([, r]) => r && r.needs_qre)
    .map(([pid]) => pid);

  return (
    <div>
      <Header />
      <DataQualityContext intel={intel} />
      <PortfolioHero data={data} />

      {needsQrePillars.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <NeedsQreBanner engagementId={engagement.id}
                            pillarLabel={needsQrePillars.join(" + ")}
                            message={`The following pillar(s) require QRE responses before KPIs can compute: ${needsQrePillars.join(", ")}. Until you answer the QRE, KPIs sourced from these pillars are hidden from the dashboard.`}
                            qreStatus={data.qre_status} />
        </div>
      )}

      {/* Stage 10 methodology KPIs strip removed from this page — it
          rendered 'vs typ X-Y' benchmark bands. KPIs are visible in the
          main grid below as data-only cards. */}

      {/* Drill-down filters — re-run the KPI engine against a filtered
          subset of the PO data. Plant / Category / Period. */}
      <div style={{ marginTop: 20 }}>
        <FilterChipBar
          options={data.filter_options}
          value={drillFilters}
          onChange={setDrillFilters}
          applied={data.filter_applied}
          busy={filterBusy}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, marginTop: 16 }}>
        <Sidebar
          data={data}
          activePillar={activePillar}
          setActivePillar={setActivePillar}
        />

        <div>
          <TopBar
            search={search} setSearch={setSearch}
            sortBy={sortBy} setSortBy={setSortBy}
            view={view} setView={setView}
            count={filtered.length}
            total={data.kpis.length}
            kpis={filtered}
          />

          {view === "grid" && <KPIGrid kpis={filtered} onSelect={setSelectedKpi} portfolio={data.portfolio} />}
          {view === "list" && <KPIList kpis={filtered} onSelect={setSelectedKpi} />}
          {view === "trend" && <TrendView kpis={filtered} breakdowns={data.breakdowns} />}

          {filtered.length === 0 && (
            <Card padding={32} style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ color: "var(--ink-500)" }}>No KPIs match the current filters.</div>
            </Card>
          )}
        </div>
      </div>

      {selectedKpi && <Drawer kpi={selectedKpi} onClose={() => setSelectedKpi(null)} engagementId={engagement.id} />}
    </div>
  );
};

/* =========================================================== */

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Synthesise</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 30</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      KPI Dashboard
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Unified KPI view across 4 pillars — computed from your uploaded data. Drill down by plant, category, or period.
    </p>
  </div>
);

const PortfolioHero = ({ data }) => {
  const pillars = Object.entries(data.pillar_summary);
  // Plant + period scope strings derived purely from filter_options /
  // filter_applied — no benchmark, no "in/under/over" counts.
  const fo = data.filter_options || {};
  const period = (fo.period_min && fo.period_max)
    ? `${fo.period_min} → ${fo.period_max}` : "—";
  return (
    <Card padding={24}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, alignItems: "center" }}>
        <div style={{ gridColumn: "span 2" }}>
          <Label>Portfolio</Label>
          <div style={{ marginTop: 4, fontSize: "var(--fs-22)", fontWeight: 600 }}>
            {data.kpis.length} KPIs from uploaded data
          </div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
            ₹{data.portfolio?.total_spend_inr_cr ?? "—"} Cr · {data.portfolio?.po_count ?? "—"} POs · {data.portfolio?.mg_count ?? "—"} categories
          </div>
        </div>
        <Mini value={(fo.plants || []).length} label="Plants" tone="neutral" />
        <Mini value={(fo.material_groups || []).length || (data.portfolio?.mg_count ?? 0)} label="Categories" tone="neutral" />
        <div>
          <Label>Period</Label>
          <div style={{ marginTop: 4, fontSize: "var(--fs-13)", color: "var(--ink-800)", fontFamily: "var(--font-mono)" }}>
            {period}
          </div>
        </div>
      </div>
    </Card>
  );
};

const avgScore = (pillars) => {
  if (!pillars.length) return 0;
  const s = pillars.reduce((acc, [, v]) => acc + (v.pillar_score?.score || 0), 0);
  return s / pillars.length;
};

const Mini = ({ value, label, tone }) => {
  const fg = tone === "success" ? "var(--success-700)" : tone === "warn" ? "var(--warn-700)" : tone === "danger" ? "var(--danger-700)" : "var(--ink-900)";
  return (
    <div>
      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontSize: "var(--fs-28)", fontWeight: 600, color: fg, marginTop: 4 }}>{value}</div>
    </div>
  );
};

/* =========================================================== */

const Sidebar = ({ data, activePillar, setActivePillar }) => {
  const pillars = Object.entries(data.pillar_summary);
  return (
    <div>
      <Card padding={16}>
        <Label>Pillars</Label>
        <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
          <SidebarRow
            active={activePillar === "all"}
            onClick={() => setActivePillar("all")}
            label="All pillars"
            right={`${data.kpis.length}`}
          />
          {pillars.map(([pid, summary]) => (
            <SidebarRow
              key={pid}
              active={activePillar === pid}
              onClick={() => setActivePillar(pid)}
              label={PILLAR_META[pid]?.label || pid}
              accent={PILLAR_META[pid]?.tone}
              right={`${summary.kpi_count}`}
              sub={`${summary.kpi_count} KPI${summary.kpi_count===1?"":"s"}`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
};

const SidebarRow = ({ active, onClick, label, right, sub, accent }) => (
  <button
    onClick={onClick}
    style={{
      display: "block", textAlign: "left", width: "100%",
      background: active ? "var(--brand-50)" : "transparent",
      border: "none", borderRadius: "var(--r-md)",
      padding: "8px 10px", cursor: "pointer",
      borderLeft: accent ? `3px solid ${accent}` : "3px solid transparent",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "var(--fs-13)", fontWeight: active ? 600 : 500, color: "var(--ink-900)" }}>{label}</span>
      {right !== undefined && (
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>{right}</span>
      )}
    </div>
    {sub && <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>{sub}</div>}
  </button>
);

/* =========================================================== */

const TopBar = ({ search, setSearch, sortBy, setSortBy, view, setView, count, total, kpis }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
    <div style={{ flex: 1 }}>
      <Input
        placeholder="Search KPIs by label, theme, or pillar…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<I.Search size={14} />}
      />
    </div>
    <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
      <option value="pillar">Sort: pillar</option>
      <option value="name">Sort: name</option>
      <option value="value">Sort: value</option>
    </Select>
    <div style={{ display: "flex", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
      <ToggleBtn active={view === "grid"}  onClick={() => setView("grid")}>Grid</ToggleBtn>
      <ToggleBtn active={view === "list"}  onClick={() => setView("list")}>List</ToggleBtn>
      <ToggleBtn active={view === "trend"} onClick={() => setView("trend")}>Trend</ToggleBtn>
    </div>
    <Button variant="outline" onClick={() => exportKpisCsv(kpis)}>Export CSV</Button>
    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", whiteSpace: "nowrap" }}>
      {count} / {total}
    </div>
  </div>
);

const exportKpisCsv = (kpis) => {
  const cols = ["id", "label", "pillar", "theme", "value", "unit"];
  const rows = kpis.map((k) => [k.id, k.label, k.pillar, k.theme, k.value, k.unit]);
  const csv = [cols.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `procvault-kpis-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const ToggleBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 14px", fontSize: "var(--fs-13)",
      background: active ? "var(--brand-600)" : "var(--surface-raised)",
      color: active ? "white" : "var(--ink-700)",
      border: "none", cursor: "pointer", fontWeight: 500,
    }}
  >{children}</button>
);

/* =========================================================== */

const KPIGrid = ({ kpis, onSelect, portfolio }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
    {kpis.map((k) => <KPICard key={k.id} kpi={k} onClick={() => onSelect(k)} portfolio={portfolio} />)}
  </div>
);

/* KPICard — data-only render. No benchmark band, no "vs typical", no
   source citation, no in-band/over-band status. Just the computed value
   from the uploaded data + a small data-scope footer. */
const KPICard = ({ kpi, onClick, portfolio }) => {
  return (
    <Card padding={16} style={{ cursor: "pointer", borderLeft: "3px solid var(--brand-500)" }} onClick={onClick}>
      <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {PILLAR_META[kpi.pillar]?.label} · {kpi.theme}
      </div>
      <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-900)", marginTop: 4 }}>
        {kpi.label}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: "var(--fs-28)", fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
          {fmtValue(kpi.value, kpi.unit)}
        </span>
        <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>{kpi.unit}</span>
      </div>

      {kpi.spark.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Sparkline data={kpi.spark} />
        </div>
      )}

      {/* Data-only footer: where does this number actually come from? */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border-subtle)",
                      fontSize: "var(--fs-11)", color: "var(--ink-500)", lineHeight: 1.4 }}>
        Computed from {portfolio?.po_count?.toLocaleString("en-IN") ?? "—"} POs ·
        ₹{portfolio?.total_spend_inr_cr ?? "—"} Cr ·
        {portfolio?.mg_count ?? "—"} categories
      </div>
    </Card>
  );
};

const Citation = ({ b }) => {
  if (!b) return null;
  const confTone = { high: "var(--success-700)", medium: "var(--warn-700)", low: "var(--danger-700)" }[b.confidence] || "var(--ink-500)";
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border-subtle)",
                   fontSize: "var(--fs-11)", color: "var(--ink-500)",
                   display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>Source</span>
      <span style={{ color: "var(--ink-700)" }}>{b.source}{b.year ? ` · ${b.year}` : ""}</span>
      {b.confidence && (
        <span style={{ marginLeft: "auto", color: confTone, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {b.confidence} confidence
        </span>
      )}
    </div>
  );
};

const KPIList = ({ kpis, onSelect }) => (
  <Card padding={0}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
      <thead>
        <tr>
          {["KPI", "Pillar / Theme", "Value", ""].map((c) => (
            <th key={c} style={{ textAlign: "left", padding: "10px 14px", color: "var(--ink-600)", fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-default)" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {kpis.map((k) => (
          <tr key={k.id} onClick={() => onSelect(k)} style={{ cursor: "pointer" }}>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-900)", fontWeight: 500 }}>{k.label}</td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-700)" }}>
              {PILLAR_META[k.pillar]?.label} · {k.theme}
            </td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-900)", fontWeight: 600 }}>
              {fmtValue(k.value, k.unit)} <span style={{ color: "var(--ink-500)", fontWeight: 400 }}>{k.unit}</span>
            </td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--brand-600)" }}>›</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);


/* =========================================================== */
/* FilterChipBar — drill-down filters that re-call the backend. */
/* =========================================================== */

const FilterChipBar = ({ options, value, onChange, applied, busy }) => {
  const [plantOpen, setPlantOpen] = useState(false);
  const [mgOpen, setMgOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);

  const togglePick = (list, item) => list.includes(item)
    ? list.filter((x) => x !== item)
    : [...list, item];

  const clearAll = () => onChange({ plants: [], material_groups: [], period_start: null, period_end: null });

  const hasAny = value.plants.length || value.material_groups.length || value.period_start || value.period_end;
  const rowsAfter = applied?.rows_after;
  const rowsBefore = applied?.rows_before;

  return (
    <Card padding={14}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
          Drill-down
        </span>

        {/* Plant chip */}
        <ChipDropdown
          label="Plant"
          values={value.plants}
          options={options?.plants || []}
          open={plantOpen}
          setOpen={setPlantOpen}
          onToggle={(p) => onChange({ ...value, plants: togglePick(value.plants, p) })}
          emptyMsg="No plant column in upload"
        />

        {/* Category chip */}
        <ChipDropdown
          label="Category"
          values={value.material_groups}
          options={options?.material_groups || []}
          open={mgOpen}
          setOpen={setMgOpen}
          onToggle={(p) => onChange({ ...value, material_groups: togglePick(value.material_groups, p) })}
          emptyMsg="No category data"
        />

        {/* Period chip */}
        <PeriodChip
          start={value.period_start}
          end={value.period_end}
          min={options?.period_min}
          max={options?.period_max}
          open={periodOpen}
          setOpen={setPeriodOpen}
          onChange={(s, e) => onChange({ ...value, period_start: s, period_end: e })}
        />

        {hasAny && (
          <button onClick={clearAll}
                  style={{ marginLeft: 8, padding: "4px 10px", fontSize: "var(--fs-11)",
                              background: "transparent", border: "1px solid var(--border-default)",
                              borderRadius: "var(--r-pill)", cursor: "pointer", color: "var(--ink-600)" }}>
            Clear all
          </button>
        )}

        <div style={{ marginLeft: "auto", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          {busy
            ? "Re-computing KPIs against filtered subset…"
            : applied?.applied
              ? `${rowsAfter} of ${rowsBefore} PO rows after drill-down`
              : `${rowsBefore ?? "—"} PO rows (no drill-down)`}
        </div>
      </div>
    </Card>
  );
};

const ChipDropdown = ({ label, values, options, open, setOpen, onToggle, emptyMsg }) => {
  const summary = values.length === 0 ? "all" :
                  values.length === 1 ? values[0] :
                  `${values.length} selected`;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
              style={{
                padding: "5px 12px", fontSize: "var(--fs-12)", fontWeight: 500,
                background: values.length > 0 ? "var(--brand-600)" : "var(--surface-raised)",
                color: values.length > 0 ? "white" : "var(--ink-700)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--r-pill)", cursor: "pointer",
              }}>
        {label}: {summary} ▾
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10,
          minWidth: 240, maxHeight: 320, overflowY: "auto",
          background: "var(--surface-card)", border: "1px solid var(--border-default)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)", padding: 8,
        }}>
          {options.length === 0 ? (
            <div style={{ padding: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{emptyMsg}</div>
          ) : (
            options.map((opt) => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8,
                                         padding: "5px 8px", cursor: "pointer",
                                         fontSize: "var(--fs-12)" }}>
                <input type="checkbox" checked={values.includes(opt)} onChange={() => onToggle(opt)} />
                <span style={{ color: "var(--ink-800)" }}>{opt}</span>
              </label>
            ))
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 8px 0" }}>
            <button onClick={() => setOpen(false)}
                    style={{ fontSize: "var(--fs-11)", color: "var(--brand-700)",
                                background: "transparent", border: "none", cursor: "pointer" }}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PeriodChip = ({ start, end, min, max, open, setOpen, onChange }) => {
  const summary = (start || end)
    ? `${start || min || "…"} → ${end || max || "…"}`
    : "all";
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
              style={{
                padding: "5px 12px", fontSize: "var(--fs-12)", fontWeight: 500,
                background: (start || end) ? "var(--brand-600)" : "var(--surface-raised)",
                color: (start || end) ? "white" : "var(--ink-700)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--r-pill)", cursor: "pointer",
              }}>
        Period: {summary} ▾
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10,
          background: "var(--surface-card)", border: "1px solid var(--border-default)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)",
          padding: 12, minWidth: 280,
        }}>
          <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginBottom: 8 }}>
            Range from upload: {min || "—"} → {max || "—"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "block" }}>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-600)", marginBottom: 4 }}>From</div>
              <input type="date" value={start || ""} min={min || undefined} max={max || undefined}
                     onChange={(e) => onChange(e.target.value || null, end)}
                     style={{ width: "100%", padding: "5px 8px", fontSize: "var(--fs-12)",
                                border: "1px solid var(--border-default)", borderRadius: "var(--r-md)" }} />
            </label>
            <label style={{ display: "block" }}>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-600)", marginBottom: 4 }}>To</div>
              <input type="date" value={end || ""} min={min || undefined} max={max || undefined}
                     onChange={(e) => onChange(start, e.target.value || null)}
                     style={{ width: "100%", padding: "5px 8px", fontSize: "var(--fs-12)",
                                border: "1px solid var(--border-default)", borderRadius: "var(--r-md)" }} />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <button onClick={() => { onChange(null, null); setOpen(false); }}
                    style={{ fontSize: "var(--fs-11)", color: "var(--ink-600)",
                                background: "transparent", border: "none", cursor: "pointer" }}>
              Reset
            </button>
            <button onClick={() => setOpen(false)}
                    style={{ fontSize: "var(--fs-11)", color: "var(--brand-700)",
                                background: "transparent", border: "none", cursor: "pointer" }}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


/* =========================================================== */
/* TrendView — graphs derived purely from uploaded data.       */
/* No benchmarks. Shows: spend by month, spend by plant,       */
/* spend by category. Plus per-KPI sparklines.                 */
/* =========================================================== */

const TrendView = ({ kpis, breakdowns }) => {
  const byMonth = breakdowns?.by_month || [];
  const byPlant = breakdowns?.by_plant || [];
  const byMG = breakdowns?.by_material_group || [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {byMonth.length > 0 && (
        <Card padding={20}>
          <SectionLabel>Spend over time · monthly</SectionLabel>
          <BarChart
            data={byMonth.map((m) => ({ label: m.month, value: m.total_spend_inr_cr, sub: `${m.po_count} POs` }))}
            unit="₹ Cr"
            height={160}
          />
        </Card>
      )}
      {byPlant.length > 0 && (
        <Card padding={20}>
          <SectionLabel>Spend by plant</SectionLabel>
          <BarChart
            data={byPlant.map((p) => ({ label: p.plant, value: p.total_spend_inr_cr, sub: `${p.po_count} POs` }))}
            unit="₹ Cr"
            height={180}
            orientation="horizontal"
          />
        </Card>
      )}
      {byMG.length > 0 && (
        <Card padding={20}>
          <SectionLabel>Spend by category · top {byMG.length}</SectionLabel>
          <BarChart
            data={byMG.map((m) => ({ label: m.material_group, value: m.total_spend_inr_cr, sub: `${m.po_count} POs` }))}
            unit="₹ Cr"
            height={Math.min(420, byMG.length * 28 + 20)}
            orientation="horizontal"
          />
        </Card>
      )}
      {/* Per-KPI sparkline strip */}
      {kpis.length > 0 && (
        <Card padding={20}>
          <SectionLabel>KPI sparklines · {kpis.length} metrics</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
            {kpis.map((k) => (
              <div key={k.id} style={{ padding: 10, background: "var(--surface-sunk)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {k.theme}
                </div>
                <div style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--ink-900)", marginTop: 2 }}>
                  {k.label}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: "var(--fs-18)", fontWeight: 600 }}>{fmtValue(k.value, k.unit)}</span>
                  <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{k.unit}</span>
                </div>
                {k.spark?.length > 0 && (
                  <div style={{ marginTop: 6 }}><Sparkline data={k.spark} /></div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

/* Simple inline bar chart (no charting lib dependency). Vertical for
   short categorical lists (months), horizontal for longer ones (plants,
   categories) so the labels stay legible. */
const BarChart = ({ data, unit, height = 180, orientation = "vertical" }) => {
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  if (orientation === "horizontal") {
    const rowH = Math.max(20, Math.floor((height - 8) / Math.max(data.length, 1)));
    return (
      <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
        {data.map((d, i) => {
          const w = (d.value || 0) / max * 100;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 110px", gap: 8, alignItems: "center", minHeight: rowH }}>
              <div title={d.label} style={{ fontSize: "var(--fs-12)", color: "var(--ink-800)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.label}
              </div>
              <div style={{ background: "var(--surface-sunk)", borderRadius: 3, height: 14, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w}%`,
                                background: "var(--brand-500)", borderRadius: 3 }} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-700)", textAlign: "right" }}>
                {d.value?.toLocaleString("en-IN", { maximumFractionDigits: 2 })} {unit}
                {d.sub && <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)" }}>{d.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // vertical
  const cw = Math.max(36, Math.floor(880 / Math.max(data.length, 1)));
  return (
    <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", gap: 6, height, paddingBottom: 30, position: "relative" }}>
      {data.map((d, i) => {
        const h = (d.value || 0) / max * (height - 50);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: cw, flex: "0 0 auto" }}>
            <div title={`${d.label}: ${d.value} ${unit}`}
                 style={{ background: "var(--brand-500)", width: "100%", height: Math.max(2, h),
                            borderRadius: "3px 3px 0 0" }} />
            <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-600)", whiteSpace: "nowrap" }}>
              {d.label}
            </div>
            <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
              {d.value?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
    {children}
  </div>
);

/* =========================================================== */

const computeStatus = (v, band, meaning) => {
  if (v === null || v === undefined) return "unknown";
  if (meaning === "higher_is_better") return v >= band.low ? "in" : "under";
  if (meaning === "lower_is_better") return v <= band.high ? "in" : "over";
  if (v < band.low) return "under";
  if (v > band.high) return "over";
  return "in";
};

const Drawer = ({ kpi, onClose, engagementId }) => {
  const navTo = PILLAR_META[kpi.pillar]?.stageUrl;
  const deepLink = navTo
    ? `/engagement/${engagementId}/${navTo}?theme=${encodeURIComponent(kpi.theme)}&metric=${encodeURIComponent(kpi.drill_down.metric_key)}`
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, height: "100vh", width: "min(520px, 90vw)",
        background: "var(--surface-raised)", boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
        zIndex: 60, overflowY: "auto", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {PILLAR_META[kpi.pillar]?.label} · {kpi.theme}
            </div>
            <h2 style={{ fontSize: "var(--fs-22)", fontWeight: 600, margin: "6px 0 0 0", letterSpacing: "-0.01em" }}>
              {kpi.label}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "var(--ink-500)" }}>
            <I.X size={18} />
          </button>
        </div>

        <Card padding={20} style={{ borderLeft: "3px solid var(--brand-500)" }}>
          <div style={{ fontSize: "var(--fs-32)", fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
            {fmtValue(kpi.value, kpi.unit)} <span style={{ fontSize: "var(--fs-15)", color: "var(--ink-500)", fontWeight: 400 }}>{kpi.unit}</span>
          </div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
            Computed from uploaded PO data. Source: pillar engine → theme &lsquo;{kpi.theme}&rsquo;.
          </div>
          {kpi.spark.length > 0 && <Sparkline data={kpi.spark} height={36} />}
        </Card>

        <div style={{ marginTop: 16 }}>
          <SectionLabel>Drill-down reference</SectionLabel>
          <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-600)", background: "var(--surface-sunk)", padding: 10, borderRadius: "var(--r-md)" }}>
            pillar: {kpi.drill_down.pillar}<br />
            theme: {kpi.drill_down.theme}<br />
            metric: {kpi.drill_down.metric_key}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
          {deepLink && (
            <Button onClick={() => { window.location.href = deepLink; }}>
              Open {PILLAR_META[kpi.pillar]?.label} · {kpi.theme}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </>
  );
};

/* =========================================================== */

const StatusPill = ({ status, large }) => {
  const m = STATUS_META[status];
  return (
    <span style={{
      background: m.bg, color: m.fg, padding: large ? "6px 14px" : "2px 10px",
      borderRadius: "var(--r-pill)", fontSize: large ? "var(--fs-13)" : "var(--fs-11)",
      fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {m.label}
    </span>
  );
};

const Sparkline = ({ data, height = 24 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100, h = height;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ marginTop: 8, display: "block" }}>
      <polyline points={pts} fill="none" stroke="var(--brand-500)" strokeWidth="1.5" />
    </svg>
  );
};

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
    {children}
  </div>
);

const fmtValue = (v, unit) => {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number") return String(v);
  if (unit && unit.startsWith("₹")) return v.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  if (Number.isInteger(v)) return v.toLocaleString("en-IN");
  return v.toFixed(1);
};

export default KPIDashboard;
