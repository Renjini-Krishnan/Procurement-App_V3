import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import {
  ScoreBadge, MaturityGauge, RCACard, CitationChip,
  BenchmarkCascade, VolumeValueQuadrant, PerCategoryMatrix,
  DataQualityContext, AiNarrativeBlock, PillarAttributionStrip, ExplainBlock,
} from "../design/patterns.jsx";
import { useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";
import BenchmarkOverridePanel from "./BenchmarkOverridePanel.jsx";

/* Stage 12 — Op Model. Auto-runs the pillar on first visit if findings
   don't exist, then renders all 4 themes. */

const OpModel = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTheme, setActiveTheme] = useState("overview");
  const [reloadKey, setReloadKey] = useState(0);  // bump to re-run after override save

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Find latest upload
        const uploads = await api.listUploads(engagement.id);
        if (uploads.length === 0) {
          setError("No PO data uploaded. Go to Stage 4 first.");
          setLoading(false);
          return;
        }
        const latest = uploads[0];
        const result = await api.runOpModel(engagement.id, latest.id, engagement.industry);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement, reloadKey]);

  if (engLoading || !engagement) return <div>Loading engagement...</div>;

  if (loading) {
    return (
      <div>
        <Header phase="Analyze" stage={12} title="Op Model" />
        <Card padding={32} style={{ marginTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-500)" }}>
            Running engine — Stage 8 (Gold) → Stage 9 (Classify) → Stage 10 (KPIs) → Stage 12 (Op Model)…
          </div>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Header phase="Analyze" stage={12} title="Op Model" />
        <Callout tone="danger" title="Pillar run failed" icon={<I.X size={16} />}>
          {error}
        </Callout>
      </div>
    );
  }
  if (!data) return null;

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "centralisation", label: `Centralisation · ${data.theme_scores.centralisation.score}` },
    { id: "shared-services", label: `Shared Services · ${data.theme_scores["shared-services"].score}` },
    { id: "coe", label: `CoE · ${data.theme_scores.coe.score}` },
    { id: "tail-spend", label: `Tail Spend · ${data.theme_scores["tail-spend"].score}` },
    { id: "settings", label: "Benchmarks & criteria" },
  ];

  return (
    <div>
      <Header phase="Analyze" stage={12} title="Op Model" subtitle="4 themes · 24 components · Steel industry overlay applied" />

      <DataQualityContext intel={data.intel_context} />

      {/* Unclassified bucket — Stage 9 fix-it panel surfaced inline */}
      {data.unclassified_bucket && (
        <UnclassifiedBucketPanel
          engagementId={engagement.id}
          bucket={data.unclassified_bucket}
          taxonomy={data.intel_context?.canonical_classification?.taxonomy || []}
          onSaved={() => setReloadKey((k) => k + 1)} />
      )}

      {/* Hero row: pillar score + key metrics */}
      <PillarHero data={data} />

      {data.ai_pillar_narrative && (
        <div style={{ marginTop: 16 }}>
          <AiNarrativeBlock title="AI verdict · Op Model"
                              narrative={data.ai_pillar_narrative}
                              citations={data.ai_pillar_citations}
                              attribution={{ benchmark: null, data_scope: data.attribution?.data_scope }} />
        </div>
      )}
      <PillarAttributionStrip attribution={data.attribution} />

      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <Tabs items={tabItems} value={activeTheme} onChange={setActiveTheme} />
      </div>

      {activeTheme === "overview" && <Overview data={data} setActiveTheme={setActiveTheme} />}
      {activeTheme === "centralisation" && <CentralisationView data={data.themes.centralisation} score={data.theme_scores.centralisation} />}
      {activeTheme === "shared-services" && <SharedServicesView data={data.themes["shared-services"]} score={data.theme_scores["shared-services"]} portfolio={data.portfolio} />}
      {activeTheme === "coe" && <CoEView data={data.themes.coe} score={data.theme_scores.coe} />}
      {activeTheme === "tail-spend" && <TailSpendView data={data.themes["tail-spend"]} score={data.theme_scores["tail-spend"]} />}
      {activeTheme === "settings" && (
        <BenchmarkOverridePanel
          engagementId={engagement.id}
          pillar="op-model"
          title="Op Model benchmarks"
          kbHref={`/kb?root=function&file=op-model/benchmarks.yml&return=${encodeURIComponent(`/engagement/${engagement.id}/op-model`)}`} />
      )}

      {/* Explainability — derivation chain + sources + KB-file deep-links
          for the currently-active theme. Renders only for actual theme
          tabs (not overview / settings). */}
      {activeTheme !== "overview" && activeTheme !== "settings" && data.theme_explainability?.[activeTheme] && (
        <div style={{ marginTop: 12 }}>
          <ExplainBlock explain={data.theme_explainability[activeTheme]}
                          returnPath={`/engagement/${engagement.id}/op-model`} />
        </div>
      )}

      {/* Per-theme AI insight (when a theme tab is active) */}
      {activeTheme !== "overview" && activeTheme !== "settings" &&
       data.ai_theme_insights?.[activeTheme] && (
        <div style={{ marginTop: 16 }}>
          <AiNarrativeBlock title={`AI insight · ${activeTheme}`}
                              narrative={data.ai_theme_insights[activeTheme]}
                              attribution={data.ai_theme_attributions?.[activeTheme]} />
        </div>
      )}

      {/* RCA panel (always visible) */}
      <RCAPanel rca={data.rca_cards} themeFilter={activeTheme === "overview" ? null : activeTheme} />
      <SignoffWidget engagementId={engagement.id} scope="op-model" label="Operating Model" expectedCadence="end-of-pillar" />
    </div>
  );
};

const Header = ({ phase, stage, title, subtitle }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">{phase}</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
        Stage {String(stage).padStart(2, "0")}
      </span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      {title}
    </h1>
    {subtitle && (
      <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", marginTop: 6, margin: "6px 0 0 0" }}>
        {subtitle}
      </p>
    )}
  </div>
);

const PillarHero = ({ data }) => {
  const ps = data.pillar_score;
  const portfolio = data.portfolio || {};
  return (
    <Card padding={28}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <MaturityGauge value={ps.score} max={5} size={140} />
          <div style={{ marginTop: 12, fontSize: "var(--fs-14)", color: "var(--ink-600)" }}>
            {ps.label}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
            Pillar score · weighted average (Cent 0.35 · SSC 0.25 · CoE 0.20 · Tail 0.20)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <Metric label="Total spend (₹ Cr)" value={(portfolio.total_spend_inr / 1e7).toFixed(0)} />
            <Metric label="Material groups" value={portfolio.mg_count} />
            <Metric label="Total POs" value={(portfolio.total_po_count || 0).toLocaleString()} />
            <Metric label="Engine runtime" value={`${data.timings_seconds.total}s`} />
          </div>
        </div>
      </div>
    </Card>
  );
};

const Metric = ({ label, value }) => (
  <div>
    <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-500)" }}>
      {label}
    </div>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-24)", fontWeight: 600, marginTop: 4, color: "var(--ink-900)" }}>
      {value}
    </div>
  </div>
);

const Overview = ({ data, setActiveTheme }) => {
  const themes = [
    { id: "centralisation", title: "Centralisation", weight: 0.35 },
    { id: "shared-services", title: "Shared Services", weight: 0.25 },
    { id: "coe", title: "Centre of Excellence", weight: 0.20 },
    { id: "tail-spend", title: "Tail Spend", weight: 0.20 },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {themes.map((t) => {
        const td = data.themes[t.id];
        const score = data.theme_scores[t.id];
        return (
          <Card key={t.id} padding={24} style={{ cursor: "pointer" }} onClick={() => setActiveTheme(t.id)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)" }}>
                  {t.title} · weight {t.weight}
                </div>
                <h3 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "4px 0 0 0", letterSpacing: "-0.01em" }}>
                  Score
                </h3>
              </div>
              <ScoreBadge value={score.score} size="lg" showLabel />
            </div>
            <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5, margin: 0 }}>
              {td.headline}
            </p>
            <div style={{ marginTop: 14, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
              {score.rationale}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const CentralisationView = ({ data, score }) => {
  const c1 = data.components.c1_multi_plant_detection;
  const c3 = data.components.c3_recommendation_tag || data.components.c3_industry_knowledge_filter;
  const c4 = data.components.c4_savings_quantification;

  const tagPalette = {
    centralise: { bg: "var(--brand-50)", fg: "var(--brand-700)", label: "Centralise" },
    centre_led: { bg: "var(--info-50)", fg: "var(--info-700)", label: "Centre-Led" },
    keep_local: { bg: "var(--surface-sunk)", fg: "var(--ink-700)", label: "Keep Local" },
    review: { bg: "var(--warn-50)", fg: "var(--warn-700)", label: "Review" },
  };

  const tags = (c3?.tags || []).slice(0, 25);

  return (
    <div>
      <ThemeHeader title="Centralisation" headline={data.headline} score={score} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPICard label="Multi-plant candidates" value={c1.candidate_count} sub="canonical categories" />
        <KPICard label="Addressable spend" value={`₹${c3.addressable_spend_inr_cr} Cr`} />
        <KPICard label="Savings range" value={`₹${c4.savings_range_inr_cr[0]}–${c4.savings_range_inr_cr[1]} Cr/yr`} />
        <KPICard label="Tag breakdown" value={`${c3.centralise_count} Cent · ${c3.centre_led_count} Led · ${c3.keep_local_count} Local`} />
      </div>

      <SectionHeader title="Benchmark cascade — Centralisation savings rate" />
      <Card padding={18}>
        <BenchmarkCascade entries={[
          { layer: "Function default", note: "Op Model — Centralisation savings rate", value: "2–4%", active: !c4.benchmark_overridden_by },
          { layer: "Industry · Steel", note: "Steel benchmark overlay (overrides function default)", value: `${c4.centralisation_rate_pct_range[0]}–${c4.centralisation_rate_pct_range[1]}%`, active: c4.benchmark_overridden_by === "industry_overlay" },
          { layer: "Engagement", note: "No engagement-level override applied", value: "—", active: false },
        ]} />
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CitationChip source={c4.benchmark_source || "Steel benchmark"} year={2024} confidence="high" />
        </div>
      </Card>

      <SectionHeader title={`Recommendations — ${tags.length} canonical categories (expand to see member MATKLs)`} />
      <Card padding={0}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr>
              {["Canonical category", "Archetype", "Spend (₹ Cr)", "Plants", "Verdict", "Source", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px",
                                        fontSize: "var(--fs-11)", color: "var(--ink-500)",
                                        textTransform: "uppercase", borderBottom: "1px solid var(--border-default)",
                                        background: "var(--surface-sunk)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <CanonicalRowWithMembers
                key={t.canonical_id}
                row={t}
                columns={[
                  { render: (r) => (
                      <>
                        <div style={{ fontWeight: 600 }}>{r.canonical_label}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{r.canonical_id}</div>
                      </>
                    ) },
                  { render: (r) => <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>{r.archetype || "—"}</span> },
                  { key: "total_spend_inr_cr", style: { fontFamily: "var(--font-mono)" } },
                  { render: (r) => <span>{r.plant_count ?? "—"}</span> },
                  { render: (r) => {
                      const p = tagPalette[r.tag] || tagPalette.review;
                      return (
                        <span style={{ background: p.bg, color: p.fg, padding: "3px 8px",
                                          borderRadius: "var(--r-sm)", fontSize: "var(--fs-12)", fontWeight: 600 }}>
                          {p.label}
                        </span>
                      );
                    } },
                  { render: (r) => (
                      <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
                        {r.tag_source === "kb_canonical_recommendation" ? "KB" :
                         r.tag_source === "filter_pattern_match" ? "Filter" :
                         r.tag_source === "archetype_default" ? "Archetype" : "—"}
                      </span>
                    ) },
                ]}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const SharedServicesView = ({ data, score, portfolio }) => {
  const ss1 = data.components.ss1_volume_value_quadrant;
  const ss3 = data.components.ss3_coverage_gap;
  const ss4 = data.components.ss4_fte_productivity;

  // Build quadrant points: normalise per the percentile thresholds
  const allCats = [
    ...ss1.q1_categories.map((c) => ({ ...c, q: "Q1" })),
    ...ss1.q2_categories.map((c) => ({ ...c, q: "Q2" })),
    ...ss1.q3_categories.map((c) => ({ ...c, q: "Q3" })),
    ...ss1.q4_categories.map((c) => ({ ...c, q: "Q4" })),
  ];
  const maxPo = Math.max(1, ...allCats.map((c) => c.po_count));
  const maxVal = Math.max(1, ...allCats.map((c) => c.avg_po_value));
  const maxSpend = Math.max(1, ...allCats.map((c) => c.total_spend_inr));
  const points = allCats.slice(0, 24).map((c) => ({
    x: Math.min(0.95, c.po_count / maxPo),
    y: Math.min(0.95, c.avg_po_value / maxVal),
    size: Math.min(1, c.total_spend_inr / maxSpend),
    label: (c.canonical_label || c.canonical_id || "").slice(0, 16),
  }));

  return (
    <div>
      <ThemeHeader title="Shared Services" headline={data.headline} score={score} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPICard label="Q1 transactional" value={ss1.q1_categories.length} />
        <KPICard label="SSC-suitable" value={data.metrics.ssc_suitable_count} />
        <KPICard label="Addressable POs" value={ss3.addressable_po_count.toLocaleString()} />
        <KPICard label="Operational savings" value={`₹${ss4.operational_savings_inr_cr} Cr/yr`} sub={`${ss4.fte_equivalent_freed} FTE freed`} />
      </div>

      <SectionHeader title="Volume × Value quadrant" />
      <Card padding={18}>
        <VolumeValueQuadrant points={points} width={640} height={360} />
        <div style={{ marginTop: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          Thresholds (75th-percentile): PO count ≥ {Math.round(ss1.thresholds.high_po_count)} · Avg PO value ≥ ₹{(ss1.thresholds.high_avg_value_inr / 1e5).toFixed(1)} L
        </div>
      </Card>

      <SectionHeader title="FTE productivity benchmark" />
      <Card padding={18}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Metric label="Current cost / PO" value={`₹${ss4.current_cost_per_po_inr.toLocaleString()}`} />
          <Metric label="SSC target / PO" value={`₹${ss4.ssc_target_cost_per_po_inr.toLocaleString()}`} />
          <Metric label="Saving / PO" value={`₹${ss4.saving_per_po_inr.toLocaleString()}`} />
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <CitationChip source={ss4.benchmark_source || "ACN-Proc-Benchmark-DB"} year={2024} confidence="high" />
        </div>
      </Card>
    </div>
  );
};

const CoEView = ({ data, score }) => {
  const ce1 = data.components.ce1_strategic_identification;
  const ce2 = data.components.ce2_industry_filter;
  const ce4 = data.components.ce4_value_quantification;

  return (
    <div>
      <ThemeHeader title="Centre of Excellence" headline={data.headline} score={score} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPICard label="Strategic candidates" value={ce1.candidate_count} />
        <KPICard label="High vendor concentration" value={ce1.high_concentration_count} />
        <KPICard label="CoE-suitable" value={ce2.suitable_count} />
        <KPICard label="Incremental savings" value={`₹${ce4.savings_range_inr_cr[0]}–${ce4.savings_range_inr_cr[1]} Cr/yr`} />
      </div>

      <SectionHeader title="Strategic candidates" />
      <PerCategoryMatrix
        rows={(ce1.strategic_candidates || []).slice(0, 20).map((c) => ({
          material_group: c.canonical_id,
          material_group_desc: c.canonical_label,
          total_spend_inr_cr: c.total_spend_inr_cr,
          plant_count: null,
          verdict: c.high_concentration ? "High concentration" : (c.from_q4 ? "Q4 strategic" : "Strategic by nature"),
        }))}
        decisionPalette={{
          "High concentration": { bg: "var(--danger-50)", fg: "var(--danger-700)" },
          "Q4 strategic": { bg: "var(--brand-50)", fg: "var(--brand-700)" },
          "Strategic by nature": { bg: "var(--info-50)", fg: "var(--info-700)" },
        }}
      />

      <SectionHeader title="Benchmark cascade — CoE savings rate" />
      <Card padding={18}>
        <BenchmarkCascade entries={[
          { layer: "Function default", note: "Op Model — CoE savings rate", value: "2–5%", active: !ce4.benchmark_overridden_by },
          { layer: "Industry · Steel", note: "Steel benchmark overlay", value: `${ce4.coe_savings_rate_pct_range[0]}–${ce4.coe_savings_rate_pct_range[1]}%`, active: ce4.benchmark_overridden_by === "industry_overlay" },
          { layer: "Engagement", note: "No engagement-level override applied", value: "—", active: false },
        ]} />
        <Callout tone="info" title="Cross-theme caveat" icon={<I.Layers size={16} />}>
          {ce4.note}
        </Callout>
      </Card>
    </div>
  );
};

const TailSpendView = ({ data, score }) => {
  const ts1 = data.components.ts1_quantification;
  const ts2 = data.components.ts2_vendor_footprint;
  return (
    <div>
      <ThemeHeader title="Tail Spend" headline={data.headline} score={score} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPICard label="Tail spend share" value={`${ts1.tail_spend_share_pct}%`} />
        <KPICard label="Combined tail spend" value={`₹${ts1.combined_tail_spend_inr_cr} Cr`} />
        <KPICard label="Long-tail vendors" value={`${ts2.long_tail_vendor_share_pct}%`} sub={`${ts2.vendor_count} total vendors`} />
        <KPICard label="Pareto check" value={ts2.pareto_holds ? "✓ Top-20 = 75%+" : "✗ Top-20 below 75%"} />
      </div>

      <SectionHeader title="Quantification methods" />
      <Card padding={18}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)" }}>
              Method A — PO threshold
            </div>
            <div style={{ fontSize: "var(--fs-15)", marginTop: 4, color: "var(--ink-700)" }}>
              POs below ₹{ts1.method_a_threshold_inr_lakh} L each
            </div>
            <div style={{ marginTop: 12 }}>
              <Metric label="POs counted" value={ts1.method_a_po_count.toLocaleString()} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Metric label="Spend (₹ Cr)" value={ts1.method_a_spend_inr_cr} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)" }}>
              Method B — Q3 quadrant from SS1
            </div>
            <div style={{ fontSize: "var(--fs-15)", marginTop: 4, color: "var(--ink-700)" }}>
              Categories with low PO count AND low avg PO value
            </div>
            <div style={{ marginTop: 12 }}>
              <Metric label="Q3 canonicals" value={ts1.method_b_q3_count} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Metric label="Spend (₹ Cr)" value={ts1.method_b_spend_inr_cr} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

const KPICard = ({ label, value, sub }) => (
  <Card padding={18}>
    <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-500)" }}>
      {label}
    </div>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-24)", fontWeight: 600, marginTop: 6, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>{sub}</div>}
  </Card>
);

const SectionHeader = ({ title }) => (
  <h3 style={{ fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--ink-600)", margin: "28px 0 12px 0" }}>
    {title}
  </h3>
);

const ThemeHeader = ({ title, headline, score }) => (
  <Card padding={22} style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: "var(--fs-24)", fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 8px 0" }}>
          {title}
        </h2>
        <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.55, color: "var(--ink-700)", margin: 0 }}>
          {headline}
        </p>
        <div style={{ marginTop: 12, fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
          {score.rationale}
        </div>
      </div>
      <ScoreBadge value={score.score} size="lg" showLabel />
    </div>
  </Card>
);

const RCAPanel = ({ rca, themeFilter }) => {
  const filtered = themeFilter
    ? rca.filter((r) => (r.theme || "").replace(/_/g, "-") === themeFilter)
    : rca;
  if (filtered.length === 0) return null;
  return (
    <div style={{ marginTop: 32 }}>
      <SectionHeader title={`Root cause analysis · ${filtered.length} ${filtered.length === 1 ? "rule" : "rules"} fired`} />
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((r) => (
          <div key={r.rule_id}>
            <RCACard
              id={r.rule_id}
              theme={r.theme || "op-model"}
              severity={r.confidence === "high" ? "high" : r.confidence === "medium" ? "medium" : "low"}
              cause={(r.root_causes || [])[0]}
              evidence={(r.root_causes || []).slice(1, 4)}
              recommendation={(r.diagnostic_actions || []).join(" · ")}
              citations={[]}
            />
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
  );
};

// =============================================================================
// Unclassified bucket — inline Stage 9 fix-it panel
// =============================================================================
const UnclassifiedBucketPanel = ({ engagementId, bucket, taxonomy, onSaved }) => {
  const [expanded, setExpanded] = useState(false);
  const [assignments, setAssignments] = useState({});  // { material_group: canonical_id }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!bucket || bucket.matkl_count === 0) return null;

  const pct = bucket.spend_share_pct?.toFixed(1) || "0";
  const spendCr = (bucket.total_spend_inr / 1e7).toFixed(1);

  const onChange = (mg, canonId) => setAssignments((a) => ({ ...a, [mg]: canonId }));

  const onSave = async () => {
    const items = Object.entries(assignments)
      .filter(([_, cid]) => cid && cid !== "")
      .map(([mg, cid]) => ({
        scope_type: "material_group", scope_value: mg, canonical_id: cid,
      }));
    if (!items.length) return;
    setSaving(true); setError(null);
    try {
      await api.bulkUpsertStage9Overrides(engagementId, items);
      setAssignments({});
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = Object.values(assignments).filter((v) => v && v !== "").length;

  return (
    <div style={{ marginBottom: 16 }}>
      <Callout tone="warn"
                title={`Unclassified spend: ${pct}% (₹${spendCr} Cr · ${bucket.matkl_count} material group${bucket.matkl_count === 1 ? "" : "s"})`}
                icon={<I.Dot size={16} />}>
        <div style={{ fontSize: "var(--fs-13)", marginBottom: 6 }}>
          Stage 9 couldn't classify these material groups into a canonical category.
          They're excluded from Op Model recommendations until assigned.
        </div>
        <button onClick={() => setExpanded((e) => !e)}
                  style={{ background: "transparent", border: 0, color: "var(--brand-700)",
                              fontWeight: 600, fontSize: "var(--fs-13)", cursor: "pointer", padding: 0 }}>
          {expanded ? "Hide" : "Review & assign"} top {bucket.top_matkls?.length || 0} by spend →
        </button>
      </Callout>

      {expanded && (
        <Card padding={18} style={{ marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead>
              <tr>
                {["MATKL", "Description", "Spend (₹ Cr)", "Top vendor", "Assign canonical"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 10px",
                                          fontSize: "var(--fs-11)", color: "var(--ink-500)",
                                          textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(bucket.top_matkls || []).map((m) => (
                <tr key={m.material_group}>
                  <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono)" }}>{m.material_group}</td>
                  <td style={{ padding: "8px 10px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.material_group_desc || "—"}
                  </td>
                  <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono)" }}>
                    {(m.spend_inr / 1e7).toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--ink-600)" }}>
                    {m.top_vendor_name || "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <select value={assignments[m.material_group] || ""}
                              onChange={(e) => onChange(m.material_group, e.target.value)}
                              style={{ padding: "4px 8px", fontSize: "var(--fs-12)",
                                          border: "1px solid var(--border-default)",
                                          borderRadius: "var(--r-sm)", minWidth: 220 }}>
                      <option value="">— pick canonical —</option>
                      {(taxonomy || []).map((t) => (
                        <option key={t.id} value={t.id}>{t.label || t.id}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {error && (
            <Callout tone="danger" title="Save failed" icon={<I.X size={16} />}>{error}</Callout>
          )}

          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={onSave} disabled={saving || pendingCount === 0}>
              {saving ? "Saving…" : `Save ${pendingCount} assignment${pendingCount === 1 ? "" : "s"} & re-run`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};


// =============================================================================
// Canonical row with MATKL members drill-down
// =============================================================================
const CanonicalRowWithMembers = ({ row, columns, paletteFn }) => {
  const [open, setOpen] = useState(false);
  const palette = paletteFn ? paletteFn(row) : {};
  const matklCount = row.matkl_count ?? (row.members || []).length;
  return (
    <>
      <tr style={{ cursor: matklCount > 0 ? "pointer" : "default" }}
            onClick={() => matklCount > 0 && setOpen((o) => !o)}>
        {columns.map((col, i) => (
          <td key={i} style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)",
                                  ...(col.style || {}), ...(palette.cellStyle || {}) }}>
            {col.render ? col.render(row) : row[col.key]}
          </td>
        ))}
        <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--ink-500)", fontSize: "var(--fs-11)",
                       borderTop: "1px solid var(--border-subtle)" }}>
          {matklCount > 0 && (open ? "▾" : "▸")}
          {matklCount > 0 && <span style={{ marginLeft: 6 }}>{matklCount} MATKL{matklCount === 1 ? "" : "s"}</span>}
        </td>
      </tr>
      {open && (row.members || []).map((m) => (
        <tr key={m.material_group} style={{ background: "var(--surface-sunk)" }}>
          <td colSpan={columns.length + 1} style={{ padding: "6px 10px 6px 36px", fontSize: "var(--fs-12)" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>{m.material_group}</span>
            <span style={{ marginLeft: 10, color: "var(--ink-600)" }}>{m.material_group_desc || "—"}</span>
            <span style={{ marginLeft: 10, color: "var(--ink-500)" }}>
              ₹{(m.spend_inr / 1e7).toFixed(2)} Cr · {m.po_count} POs · {m.vendor_count} vendors
              {m.top_vendor_name ? ` · top: ${m.top_vendor_name}` : ""}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
};


export default OpModel;
