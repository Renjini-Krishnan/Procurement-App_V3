import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { KpiSummaryStrip, DataQualityContext } from "../design/patterns.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 11 — Engagement Primer.
   Shows benchmark cascade per pillar: function defaults → industry overlays.
   Helps consultant defend "where does this number come from?" */

const PILLARS = [
  { id: "op-model",       label: "Op Model",       weight: 0.25 },
  { id: "buying-channel", label: "Buying Channel", weight: 0.30 },
  { id: "org-structure",  label: "Org Structure",  weight: 0.20 },
  { id: "doa",            label: "DoA",            weight: 0.25 },
];

const Primer = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data: intel } = useIntel(engagement);
  const [activePillar, setActivePillar] = useState("op-model");
  const [benchmarks, setBenchmarks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const r = await api.getPillarBenchmarks(activePillar, engagement.industry);
        if (!cancelled) setBenchmarks(r);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement, activePillar]);

  if (engLoading || !engagement) return <div>Loading…</div>;

  return (
    <div>
      <Header />
      <DataQualityContext intel={intel} />

      {intel?.methodology_kpis && (
        <Card padding={20} style={{ marginBottom: 24 }}>
          <Label>Methodology KPIs · benchmark cascade</Label>
          <div style={{ marginTop: 4, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
            Industry-typical ranges from <code style={{ fontFamily: "var(--font-mono)" }}>kb/_meta/kpi-calculation-rules.yml#benchmarks</code>.
            Your engagement values shown against each band.
          </div>
          <div style={{ marginTop: 12 }}>
            <KpiSummaryStrip kpis={intel.methodology_kpis.filter((k) => k.available)} />
          </div>
        </Card>
      )}

      <Card padding={24} style={{ marginBottom: 24 }}>
        <Label>Industry context</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
          <Stat title="Industry" value={engagement.industry} />
          <Stat title="Sub-segment" value={engagement.sub_segment?.replace(/_/g, " ") || "—"} />
          <Stat title="Annual spend" value={`₹${engagement.annual_spend_inr_cr || "—"} Cr`} />
        </div>
      </Card>

      <Card padding={24} style={{ marginBottom: 24 }}>
        <Label>Pillar weights · how the overall score is composed</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          {PILLARS.map((p) => (
            <Card key={p.id} padding={16}>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase" }}>{p.label}</div>
              <div style={{ fontSize: "var(--fs-22)", fontWeight: 600, marginTop: 4 }}>{Math.round(p.weight * 100)}%</div>
            </Card>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          Weights live in <code>kb/pillar-weights.yml</code>; edit there to override per engagement.
        </div>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <Tabs items={PILLARS.map((p) => ({ id: p.id, label: p.label }))}
              value={activePillar} onChange={setActivePillar} />
      </div>

      {loading && <Card padding={24} style={{ textAlign: "center", color: "var(--ink-500)" }}>Resolving cascade…</Card>}
      {error && <Callout tone="danger" title="Benchmark load failed" icon={<I.X size={16} />}>{error}</Callout>}

      {benchmarks && <CascadeView benchmarks={benchmarks} />}
    </div>
  );
};

const CascadeView = ({ benchmarks }) => {
  const entries = Object.entries(benchmarks.benchmarks || {});
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Callout tone="info" title={`${entries.length} benchmarks resolved`} icon={<I.Layers size={16} />}>
        Industry: <strong>{benchmarks.industry}</strong>. Each benchmark shows its source (function default vs industry overlay).
        Most specific source wins; engagement overrides (Build 2) will sit on top.
      </Callout>
      {entries.map(([id, b]) => (
        <Card key={id} padding={18}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{id}</div>
              <div style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--ink-900)", marginTop: 4 }}>
                {b.name || id}
              </div>
              {b.description && (
                <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", marginTop: 6, lineHeight: 1.5 }}>
                  {b.description.length > 240 ? b.description.slice(0, 240) + "…" : b.description}
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <SourceChip source={b.source || "function_default"} />
                {b.overridden_by && <OverrideChip by={b.overridden_by} />}
                {b.primary?.source && <CitationChip s={b.primary.source} y={b.primary.year} c={b.primary.confidence} />}
              </div>
            </div>
            <ValueBlock data={b} />
          </div>
        </Card>
      ))}
    </div>
  );
};

const ValueBlock = ({ data }) => {
  const primary = data.primary || {};
  const v = primary.value ?? primary.value_range ?? data.value ?? data.value_range;
  if (v === undefined || v === null) return null;
  const display = Array.isArray(v) ? `${v[0]} – ${v[1]}` : String(v);
  return (
    <div style={{ minWidth: 120, textAlign: "right" }}>
      <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Value</div>
      <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, color: "var(--ink-900)", marginTop: 2 }}>{display}</div>
      {primary.unit && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{primary.unit}</div>}
    </div>
  );
};

const SourceChip = ({ source }) => {
  const isOverlay = source === "industry_overlay";
  return (
    <span style={{
      background: isOverlay ? "var(--brand-100)" : "var(--surface-sunk)",
      color: isOverlay ? "var(--brand-800)" : "var(--ink-700)",
      padding: "2px 8px", borderRadius: "var(--r-pill)",
      fontSize: "var(--fs-11)", fontWeight: 600,
    }}>
      {source.replace(/_/g, " ")}
    </span>
  );
};

const OverrideChip = ({ by }) => (
  <span style={{
    background: "var(--warn-50)", color: "var(--warn-700)",
    padding: "2px 8px", borderRadius: "var(--r-pill)",
    fontSize: "var(--fs-11)", fontWeight: 600,
  }}>
    overridden by {by}
  </span>
);

const CitationChip = ({ s, y, c }) => (
  <span style={{
    background: "var(--surface-sunk)", color: "var(--ink-700)",
    padding: "2px 8px", borderRadius: "var(--r-pill)",
    fontSize: "var(--fs-11)",
  }}>
    {s}{y ? ` · ${y}` : ""}{c ? ` · ${c}` : ""}
  </span>
);

const Stat = ({ title, value }) => (
  <div>
    <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
    <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 4 }}>{value}</div>
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 11</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Engagement primer
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Pillar weights · benchmark cascade · industry overlay snapshot
    </p>
  </div>
);

export default Primer;
