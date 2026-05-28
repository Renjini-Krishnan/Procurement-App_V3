import React, { useEffect, useMemo, useState } from "react";
import { Card, Badge, Callout, Input, Select, Button } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { MaturityGauge } from "../design/patterns.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters / view state
  const [activePillar, setActivePillar] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [view, setView] = useState("grid");
  const [selectedKpi, setSelectedKpi] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const uploads = await api.listUploads(engagement.id);
        if (uploads.length === 0) {
          setError("No PO data uploaded. Go to Stage 4 first.");
          setLoading(false); return;
        }
        const latest = uploads[0];
        const result = await api.runKpiDashboard(engagement.id, latest.id, engagement.industry);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.kpis.slice();
    if (activePillar !== "all") list = list.filter((k) => k.pillar === activePillar);
    if (statusFilter !== "all") list = list.filter((k) => k.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((k) =>
        k.label.toLowerCase().includes(q) ||
        (k.finding || "").toLowerCase().includes(q) ||
        k.pillar.toLowerCase().includes(q) ||
        k.theme.toLowerCase().includes(q)
      );
    }
    const sevRank = { over: 0, under: 1, unknown: 2, in: 3 };
    list.sort((a, b) => {
      if (sortBy === "severity") return sevRank[a.status] - sevRank[b.status];
      if (sortBy === "name")     return a.label.localeCompare(b.label);
      if (sortBy === "pillar")   return a.pillar.localeCompare(b.pillar) || a.label.localeCompare(b.label);
      if (sortBy === "value")    return (b.value ?? -Infinity) - (a.value ?? -Infinity);
      return 0;
    });
    return list;
  }, [data, activePillar, statusFilter, search, sortBy]);

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

  return (
    <div>
      <Header />
      <PortfolioHero data={data} />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, marginTop: 24 }}>
        <Sidebar
          data={data}
          activePillar={activePillar}
          setActivePillar={setActivePillar}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        <div>
          <TopBar
            search={search} setSearch={setSearch}
            sortBy={sortBy} setSortBy={setSortBy}
            view={view} setView={setView}
            count={filtered.length}
            total={data.kpis.length}
          />

          {view === "grid" ? (
            <KPIGrid kpis={filtered} onSelect={setSelectedKpi} />
          ) : (
            <KPIList kpis={filtered} onSelect={setSelectedKpi} />
          )}

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
      Unified KPI view across 4 pillars · benchmark bands · drill-down per metric
    </p>
  </div>
);

const PortfolioHero = ({ data }) => {
  const pillars = Object.entries(data.pillar_summary);
  const totalIn   = data.kpis.filter((k) => k.status === "in").length;
  const totalUnder = data.kpis.filter((k) => k.status === "under").length;
  const totalOver = data.kpis.filter((k) => k.status === "over").length;
  return (
    <Card padding={28}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 16, alignItems: "center" }}>
        <div style={{ gridColumn: "span 3" }}>
          <Label>Portfolio</Label>
          <div style={{ marginTop: 4, fontSize: "var(--fs-22)", fontWeight: 600 }}>
            {data.kpis.length} KPIs across 4 pillars
          </div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
            Spend ₹{data.portfolio?.total_spend_inr_cr ?? "—"} Cr · {data.portfolio?.po_count ?? "—"} POs · {data.portfolio?.mg_count ?? "—"} MGs
          </div>
        </div>
        <Mini value={totalIn}    label="In band"   tone="success" />
        <Mini value={totalUnder} label="Below"     tone="warn" />
        <Mini value={totalOver}  label="Above"     tone="danger" />
        <div style={{ gridColumn: "span 1" }}>
          <Label>Avg pillar maturity</Label>
          <div style={{ marginTop: 6 }}>
            <MaturityGauge value={avgScore(pillars)} max={5} size={70} />
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

const Sidebar = ({ data, activePillar, setActivePillar, statusFilter, setStatusFilter }) => {
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
              sub={`Maturity ${summary.pillar_score?.score ?? "—"} · ${summary.in_band} in / ${summary.under} below / ${summary.over} above`}
            />
          ))}
        </div>
      </Card>

      <Card padding={16} style={{ marginTop: 12 }}>
        <Label>Status</Label>
        <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
          {["all", "in", "under", "over", "unknown"].map((s) => (
            <SidebarRow
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={s === "all" ? "All statuses" : STATUS_META[s].label}
              accent={s === "all" ? null : STATUS_META[s].border}
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

const TopBar = ({ search, setSearch, sortBy, setSortBy, view, setView, count, total }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
    <div style={{ flex: 1 }}>
      <Input
        placeholder="Search KPIs by label, theme, pillar, or finding…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<I.Search size={14} />}
      />
    </div>
    <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
      <option value="severity">Sort: severity</option>
      <option value="name">Sort: name</option>
      <option value="pillar">Sort: pillar</option>
      <option value="value">Sort: value</option>
    </Select>
    <div style={{ display: "flex", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
      <ToggleBtn active={view === "grid"} onClick={() => setView("grid")}>Grid</ToggleBtn>
      <ToggleBtn active={view === "list"} onClick={() => setView("list")}>List</ToggleBtn>
    </div>
    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", whiteSpace: "nowrap" }}>
      {count} / {total}
    </div>
  </div>
);

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

const KPIGrid = ({ kpis, onSelect }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
    {kpis.map((k) => <KPICard key={k.id} kpi={k} onClick={() => onSelect(k)} />)}
  </div>
);

const KPICard = ({ kpi, onClick }) => {
  const meta = STATUS_META[kpi.status];
  return (
    <Card padding={16} style={{ cursor: "pointer", borderLeft: `3px solid ${meta.border}` }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {PILLAR_META[kpi.pillar]?.label} · {kpi.theme}
          </div>
          <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-900)", marginTop: 4 }}>
            {kpi.label}
          </div>
        </div>
        <StatusPill status={kpi.status} />
      </div>

      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-24)", fontWeight: 600, color: "var(--ink-900)" }}>
          {fmtValue(kpi.value, kpi.unit)}
        </span>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{kpi.unit}</span>
      </div>
      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 2 }}>
        Band: {kpi.band.low}–{kpi.band.high} {kpi.unit} · {kpi.delta}
      </div>

      {kpi.spark.length > 0 && <Sparkline data={kpi.spark} />}

      {kpi.finding && (
        <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-700)", lineHeight: 1.45 }}>
          {kpi.finding}
        </div>
      )}
    </Card>
  );
};

const KPIList = ({ kpis, onSelect }) => (
  <Card padding={0}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
      <thead>
        <tr>
          {["KPI", "Pillar / Theme", "Value", "Band", "Status", "Delta", ""].map((c) => (
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
              {fmtValue(k.value, k.unit)} {k.unit}
            </td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>
              {k.band.low}–{k.band.high}
            </td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
              <StatusPill status={k.status} />
            </td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{k.delta}</td>
            <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", color: "var(--brand-600)" }}>›</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
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
  const [overrideLow, setOverrideLow] = useState(kpi.band.low);
  const [overrideHigh, setOverrideHigh] = useState(kpi.band.high);
  useEffect(() => { setOverrideLow(kpi.band.low); setOverrideHigh(kpi.band.high); }, [kpi.id]);

  const liveBand = { low: Number(overrideLow), high: Number(overrideHigh) };
  const liveStatus = computeStatus(kpi.value, liveBand, kpi.band_meaning);
  const liveMeta = STATUS_META[liveStatus];
  const bandDirty = liveBand.low !== kpi.band.low || liveBand.high !== kpi.band.high;

  const meta = STATUS_META[kpi.status];
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

        <Card padding={20} style={{ borderLeft: `3px solid ${meta.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "var(--fs-32)", fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
                {fmtValue(kpi.value, kpi.unit)} <span style={{ fontSize: "var(--fs-15)", color: "var(--ink-500)", fontWeight: 400 }}>{kpi.unit}</span>
              </div>
              <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
                Benchmark band: {kpi.band.low}–{kpi.band.high} · {kpi.delta}
              </div>
            </div>
            <StatusPill status={kpi.status} large />
          </div>
          {kpi.spark.length > 0 && <Sparkline data={kpi.spark} height={36} />}
        </Card>

        {kpi.finding && (
          <div style={{ marginTop: 16 }}>
            <SectionLabel>Finding</SectionLabel>
            <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-800)", lineHeight: 1.55, marginTop: 6 }}>
              {kpi.finding}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <SectionLabel>Benchmark source</SectionLabel>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", marginTop: 6 }}>
            {kpi.benchmark.source} · {kpi.benchmark.year} · confidence: {kpi.benchmark.confidence}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SectionLabel>Band semantics</SectionLabel>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", marginTop: 6 }}>
            {kpi.band_meaning === "higher_is_better" && "Higher is better — values below the floor indicate underperformance."}
            {kpi.band_meaning === "lower_is_better" && "Lower is better — values above the ceiling indicate excess / waste."}
            {kpi.band_meaning === "neutral" && "Range-bound — outside the band in either direction is a signal."}
          </div>
        </div>

        {/* Band override (preview-only — not yet persisted) */}
        <div style={{ marginTop: 16 }}>
          <SectionLabel>Band override (preview)</SectionLabel>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
            <Input type="number" value={overrideLow} onChange={(e) => setOverrideLow(e.target.value)} />
            <Input type="number" value={overrideHigh} onChange={(e) => setOverrideHigh(e.target.value)} />
            <StatusPill status={liveStatus} />
          </div>
          {bandDirty && (
            <div style={{ marginTop: 8, padding: 8, background: "var(--warn-50)", color: "var(--warn-700)", borderRadius: "var(--r-md)", fontSize: "var(--fs-12)" }}>
              Preview only — persisted band overrides are Build 2. To make this permanent today, edit{" "}
              <code style={{ fontFamily: "var(--font-mono)" }}>kb/functions/procurement/{kpi.pillar}/benchmarks.yml</code>.
            </div>
          )}
        </div>

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

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
    {children}
  </div>
);

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
