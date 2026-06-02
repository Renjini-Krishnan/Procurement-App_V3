import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Tabs, DataTable } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { ScoreBadge, MaturityGauge, RCACard, DataQualityContext, AiNarrativeBlock, PillarAttributionStrip } from "../design/patterns.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";
import BenchmarkOverridePanel from "./BenchmarkOverridePanel.jsx";

/* Stage 16 — Buying Channel pillar (single theme, 13 components) */

const CHANNEL_LABELS = {
  rc_long_term_contract: "RC — Long-term Contract",
  rc_outline_agreement:  "RC — Outline Agreement",
  rc_rop_catalogue:      "RC — ROP / Catalogue",
  asl:                   "ASL — Approved Supplier List",
  rfq_tendering:         "RFQ / Tendering",
  single_tender_pac:     "Single Tender (PAC)",
  spot_uncontracted:     "Spot / Uncontracted",
};

const channelLabel = (c) => CHANNEL_LABELS[c] || c;

const BuyingChannel = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

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
        const result = await api.runBuyingChannel(engagement.id, latest.id, engagement.industry);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading engagement...</div>;
  if (loading) {
    return (
      <div>
        <Header />
        <Card padding={32} style={{ marginTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-500)" }}>
            Running Buying Channel engine — Stage 8 → 9 → 10 → 16 (13 rules per category)…
          </div>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Header />
        <Callout tone="danger" title="Buying Channel pillar failed" icon={<I.X size={16} />}>{error}</Callout>
      </div>
    );
  }
  if (!data) return null;

  const theme = data.themes["buying-channel-strategy"];
  const comp = theme.components;

  const tabs = [
    { id: "overview",      label: "Overview" },
    { id: "mix",           label: "Channel Mix" },
    { id: "match-status",  label: `Match Status · ${comp.bc5_match_status.misrouted_count} misrouted` },
    { id: "migrations",    label: "Migrations" },
    { id: "sole-source",   label: `Sole Source · ${comp.bc8_sole_source_risk.sole_source_count}` },
    { id: "per-mg",        label: "Per Category" },
    { id: "settings",      label: "Benchmarks & criteria" },
  ];

  return (
    <div>
      <Header />
      <DataQualityContext intel={data.intel_context} />
      <PillarHero data={data} />

      {/* AI pillar verdict */}
      {data.ai_pillar_narrative && (
        <div style={{ marginTop: 16 }}>
          <AiNarrativeBlock title="AI verdict · Buying Channel"
                              narrative={data.ai_pillar_narrative}
                              attribution={{ benchmark: null, data_scope: data.attribution?.data_scope }} />
        </div>
      )}
      <PillarAttributionStrip attribution={data.attribution} />

      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "overview" && (
        <>
          <OverviewView theme={theme} />
          {data.ai_theme_insights?.["buying-channel-strategy"] && (
            <div style={{ marginTop: 16 }}>
              <AiNarrativeBlock title="AI insight · buying-channel-strategy"
                                  narrative={data.ai_theme_insights["buying-channel-strategy"]}
                                  attribution={data.ai_theme_attributions?.["buying-channel-strategy"]} />
            </div>
          )}
        </>
      )}
      {activeTab === "mix" && <MixView bc1={comp.bc1_portfolio_channel_mix} bc3={comp.bc3_archetype_channel_heatmap} bc13={comp.bc13_contract_coverage_lift} />}
      {activeTab === "match-status" && <MatchStatusView bc5={comp.bc5_match_status} bc6={comp.bc6_migration_opportunities} />}
      {activeTab === "migrations" && <MigrationsView bc6={comp.bc6_migration_opportunities} />}
      {activeTab === "sole-source" && <SoleSourceView bc8={comp.bc8_sole_source_risk} bc7={comp.bc7_cross_plant_aggregation} />}
      {activeTab === "per-mg" && <PerMGView rows={theme.per_mg_table} />}
      {activeTab === "settings" && (
        <BenchmarkOverridePanel
          engagementId={engagement.id}
          pillar="buying-channel"
          title="Buying Channel benchmarks"
          kbHref={`/kb?root=function&file=buying-channel/benchmarks.yml&return=${encodeURIComponent(`/engagement/${engagement.id}/buying-channel`)}`} />
      )}

      {data.rca_cards.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={sectionHeader}>Root cause analysis · {data.rca_cards.length} rules fired</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {data.rca_cards.map((r) => (
              <div key={r.rule_id}>
                <RCACard id={r.rule_id} theme={r.theme}
                         severity={r.confidence === "high" ? "high" : "medium"}
                         cause={(r.root_causes || [])[0]}
                         evidence={(r.root_causes || []).slice(1, 4)}
                         recommendation={r.references?.recommendation} />
                {r.ai_narrative && (
                  <div style={{ marginTop: 6, marginLeft: 16 }}>
                    <AiNarrativeBlock title="AI consultant note"
                                        narrative={r.ai_narrative}
                                        attribution={r.ai_attribution} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <SignoffWidget engagementId={engagement.id} scope="buying-channel" label="Buying Channel" expectedCadence="end-of-pillar" />
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 16</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Buying Channel Strategy
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      13 IF-THEN rules · channel match per category · contract coverage lift
    </p>
  </div>
);

const PillarHero = ({ data }) => {
  const score = data.pillar_score;
  const bc1 = data.themes["buying-channel-strategy"].components.bc1_portfolio_channel_mix;
  return (
    <Card padding={28}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 24, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <MaturityGauge value={score.score} max={5} size={140} />
          <div style={{ marginTop: 12, fontSize: "var(--fs-14)", color: "var(--ink-600)" }}>{score.label}</div>
        </div>
        <div>
          <Label>Contracted spend</Label>
          <BigNumber value={`${bc1.contracted_spend_pct}%`} sub="across RC-LT / OLA / Catalogue" />
        </div>
        <div>
          <Label>Total spend analysed</Label>
          <BigNumber value={`₹${bc1.total_spend_inr_cr} Cr`} sub={score.rationale} />
        </div>
      </div>
    </Card>
  );
};

const OverviewView = ({ theme }) => {
  const m = theme.metrics;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card padding={22}>
        <Label>Headline</Label>
        <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.55, color: "var(--ink-800)", margin: "8px 0 0 0" }}>
          {theme.headline}
        </p>
      </Card>
      <Card padding={22}>
        <Label>Key metrics</Label>
        <table style={{ width: "100%", marginTop: 8, fontSize: "var(--fs-13)" }}>
          <tbody>
            <MetricRow k="Contracted spend %" v={`${m.contracted_spend_pct}%`} />
            <MetricRow k="Misrouted MGs" v={`${m.misrouted_mg_count} · ₹${m.misrouted_spend_inr_cr} Cr`} />
            <MetricRow k="Catalogue candidates" v={m.catalogue_migration_candidates} />
            <MetricRow k="OLA candidates" v={m.ola_migration_candidates} />
            <MetricRow k="RC-LT candidates" v={m.rc_lt_migration_candidates} />
            <MetricRow k="Sole-source risk" v={m.sole_source_count} />
            <MetricRow k="Unclassified %" v={`${m.unclassified_pct}%`} />
            <MetricRow k="Projected contract lift" v={`+${m.contract_lift_pp} pp`} />
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const MixView = ({ bc1, bc3, bc13 }) => (
  <div style={{ display: "grid", gap: 16 }}>
    <Card padding={22}>
      <Label>Portfolio channel mix</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div>
          {Object.entries(bc1.channel_mix_pct).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "var(--fs-13)" }}>
              <span style={{ color: "var(--ink-700)" }}>{channelLabel(k)}</span>
              <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>{v}%</span>
            </div>
          ))}
        </div>
        <div>
          {Object.entries(bc1.spend_by_channel_inr_cr).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "var(--fs-13)" }}>
              <span style={{ color: "var(--ink-700)" }}>{channelLabel(k)}</span>
              <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>₹{v} Cr</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
    <Card padding={22}>
      <Label>Archetype × Channel heatmap (% of archetype spend)</Label>
      <table style={{ width: "100%", marginTop: 12, fontSize: "var(--fs-13)" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--ink-600)" }}>Archetype</th>
            {Object.keys(CHANNEL_LABELS).map((c) => (
              <th key={c} style={{ padding: "8px 12px", color: "var(--ink-600)", fontSize: "var(--fs-11)" }}>{channelLabel(c).split(" — ")[0]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(bc3).map(([arch, row]) => (
            <tr key={arch}>
              <td style={{ padding: "8px 12px", fontWeight: 600 }}>{arch}</td>
              {Object.keys(CHANNEL_LABELS).map((c) => {
                const v = row[c] || 0;
                const bg = v > 50 ? "var(--brand-100)" : v > 25 ? "var(--brand-50)" : "transparent";
                return (
                  <td key={c} style={{ padding: "8px 12px", background: bg, textAlign: "right" }}>{v ? `${v}%` : "—"}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
    <Card padding={22}>
      <Label>Contract coverage lift projection</Label>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Stat title="As-is contracted" value={`${bc13.as_is_contracted_pct}%`} />
        <Stat title="Projected lift" value={`+${bc13.lift_pp} pp`} sub={bc13.ceiling_applied ? "Ceiling applied (25pp)" : "Direct from misrouted spend"} />
        <Stat title="To-be contracted" value={`${bc13.to_be_contracted_pct}%`} />
      </div>
    </Card>
  </div>
);

const MatchStatusView = ({ bc5, bc6 }) => (
  <div style={{ display: "grid", gap: 16 }}>
    <Card padding={22}>
      <Label>Match status distribution</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
        <Stat title="Already right" value={bc5.already_right_count} tone="success" />
        <Stat title="Misrouted" value={bc5.misrouted_count} sub={`₹${bc5.misrouted_spend_inr_cr} Cr`} tone="warn" />
        <Stat title="Over-engineered" value={bc5.over_engineered_count} tone="info" />
        <Stat title="Unrecoverable" value={bc5.unrecoverable_count} tone="danger" />
      </div>
    </Card>
    <Card padding={22}>
      <Label>Migration opportunities by target channel</Label>
      <table style={{ width: "100%", marginTop: 12, fontSize: "var(--fs-13)" }}>
        <tbody>
          <MetricRow k="→ Catalogue" v={bc6.catalogue_count} />
          <MetricRow k="→ Outline Agreement" v={bc6.ola_count} />
          <MetricRow k="→ RC-LT" v={bc6.rc_lt_count} />
          <MetricRow k="→ ASL" v={bc6.asl_count} />
          <MetricRow k="→ RFQ" v={bc6.rfq_count} />
          <MetricRow k="→ Single Tender" v={bc6.single_tender_count} />
        </tbody>
      </table>
    </Card>
  </div>
);

const MigrationsView = ({ bc6 }) => {
  const cols = [
    { key: "material_group_desc", label: "Category" },
    { key: "archetype", label: "Archetype" },
    { key: "current_channel", label: "Current", render: (r) => channelLabel(r.current_channel) },
    { key: "recommended_channel", label: "Recommended", render: (r) => channelLabel(r.recommended_channel) },
    { key: "rule_fired", label: "Rule" },
    { key: "total_spend_inr_cr", label: "₹ Cr", align: "right", render: (r) => r.total_spend_inr_cr },
  ];
  return (
    <Card padding={22}>
      <Label>Top {bc6.top_candidates?.length || 0} misrouted candidates</Label>
      <div style={{ marginTop: 12 }}>
        <DataTable columns={cols} rows={bc6.top_candidates || []} />
      </div>
    </Card>
  );
};

const SoleSourceView = ({ bc8, bc7 }) => {
  const cols = [
    { key: "material_group_desc", label: "Category" },
    { key: "archetype", label: "Archetype" },
    { key: "vendor_count", label: "Vendors", align: "right" },
    { key: "top_vendor_share_pct", label: "Top vendor %", align: "right", render: (r) => `${Math.round(r.top_vendor_share_pct)}%` },
    { key: "total_spend_inr_cr", label: "₹ Cr", align: "right" },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card padding={22}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Stat title="Single-vendor MGs" value={bc8.single_vendor_count} sub={`₹${bc8.single_vendor_spend_inr_cr} Cr`} />
          <Stat title="Concentrated (>80%)" value={bc8.concentrated_count} />
          <Stat title="PAC justified" value={bc8.pac_justified_count} />
          <Stat title="Cross-plant aggregation" value={bc7.multi_plant_mg_count} sub={`₹${bc7.multi_plant_spend_inr_cr} Cr`} />
        </div>
      </Card>
      <Card padding={22}>
        <Label>Top sole-source exposures</Label>
        <div style={{ marginTop: 12 }}>
          <DataTable columns={cols} rows={bc8.top_sole_source || []} />
        </div>
      </Card>
    </div>
  );
};

const PerMGView = ({ rows }) => {
  const cols = [
    { key: "material_group", label: "MG" },
    { key: "material_group_desc", label: "Category" },
    { key: "archetype", label: "Archetype" },
    { key: "po_count", label: "POs", align: "right" },
    { key: "vendor_count", label: "Vendors", align: "right" },
    { key: "contracted_pct", label: "Contract %", align: "right", render: (r) => `${Math.round(r.contracted_pct)}%` },
    { key: "current_channel", label: "Current", render: (r) => channelLabel(r.current_channel) },
    { key: "recommended_channel", label: "Recommended", render: (r) => channelLabel(r.recommended_channel) },
    { key: "match_status", label: "Status", render: (r) => <StatusChip s={r.match_status} /> },
  ];
  return (
    <Card padding={22}>
      <Label>Top {rows?.length || 0} categories (by spend)</Label>
      <div style={{ marginTop: 12 }}>
        <DataTable columns={cols} rows={rows || []} />
      </div>
    </Card>
  );
};

const StatusChip = ({ s }) => {
  const toneMap = {
    already_right: { bg: "var(--success-50)", fg: "var(--success-700)" },
    misrouted: { bg: "var(--warn-50)", fg: "var(--warn-700)" },
    over_engineered: { bg: "var(--brand-50)", fg: "var(--brand-700)" },
    unrecoverable: { bg: "var(--danger-50)", fg: "var(--danger-700)" },
  };
  const t = toneMap[s] || { bg: "var(--surface-sunk)", fg: "var(--ink-700)" };
  return (
    <span style={{ background: t.bg, color: t.fg, padding: "2px 8px", borderRadius: 12, fontSize: "var(--fs-12)", fontWeight: 500 }}>
      {s.replace(/_/g, " ")}
    </span>
  );
};

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
    {children}
  </div>
);
const BigNumber = ({ value, sub }) => (
  <div style={{ marginTop: 6 }}>
    <div style={{ fontSize: "var(--fs-28)", fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>{value}</div>
    {sub && <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>{sub}</div>}
  </div>
);
const Stat = ({ title, value, sub, tone = "default" }) => {
  const tones = {
    success: "var(--success-700)", warn: "var(--warn-700)",
    danger: "var(--danger-700)", info: "var(--brand-700)", default: "var(--ink-900)",
  };
  return (
    <div>
      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
      <div style={{ fontSize: "var(--fs-22)", fontWeight: 600, color: tones[tone], marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
};
const MetricRow = ({ k, v }) => (
  <tr>
    <td style={{ padding: "6px 0", color: "var(--ink-600)" }}>{k}</td>
    <td style={{ padding: "6px 0", textAlign: "right", color: "var(--ink-900)", fontWeight: 500 }}>{v}</td>
  </tr>
);
const sectionHeader = {
  fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4,
  textTransform: "uppercase", color: "var(--ink-600)", margin: "28px 0 12px 0",
};

export default BuyingChannel;
