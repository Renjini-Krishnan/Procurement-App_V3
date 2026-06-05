import React, { useEffect, useState } from "react";
import { Card, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { ScoreBadge, MaturityGauge, RCACard, DataQualityContext, AiNarrativeBlock, PillarAttributionStrip, ExplainBlock } from "../design/patterns.jsx";
import { useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Generic V2 pillar screen — used by Material Master, PR-to-PO, Post-PO,
   Supplier. Each instance passes a pillarId + runner function. */

const PILLAR_META = {
  "material-master": {
    label: "Material Master",
    stage: 18,
    subtitle: "3 themes · PO coverage of material code · master quality · canonical classification rate",
    runner: api.runMaterialMaster,
  },
  "pr-to-po": {
    label: "PR-to-PO",
    stage: 20,
    subtitle: "3 themes · PR→PO conversion · mean TAT · value consistency",
    runner: api.runPrToPo,
  },
  "post-po": {
    label: "Post-PO",
    stage: 21,
    subtitle: "3 themes · GRN coverage · three-way match · On-Time Delivery %",
    runner: api.runPostPo,
  },
  "supplier": {
    label: "Supplier",
    stage: 22,
    subtitle: "3 themes · vendor concentration · master utilization · MSME share",
    runner: api.runSupplier,
  },
};

const V2Pillar = ({ pillarId }) => {
  const _loc = useLocation();
  const _returnPath = _loc.pathname + (_loc.search || "");
  const meta = PILLAR_META[pillarId];
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!engagement || !meta) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const uploads = await api.listUploads(engagement.id);
        if (uploads.length === 0) {
          setError("No PO data uploaded. Go to Stage 4 first.");
          setLoading(false); return;
        }
        const po = uploads.find((u) => u.file_type === "PO") || uploads[0];
        const r = await meta.runner(engagement.id, po.id, engagement.industry);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement, pillarId]);

  if (!meta) return <div>Unknown pillar: {pillarId}</div>;
  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header meta={meta} /><Card padding={32} style={{ marginTop: 24, textAlign: "center", color: "var(--ink-500)" }}>Running {meta.label}…</Card></div>;
  if (error) return <div><Header meta={meta} /><Callout tone="danger" title="Pillar run failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const score = data.pillar_score?.score;  // null when no themes available
  const themes = data.themes || {};
  const rca = data.rca_cards || [];

  return (
    <div>
      <Header meta={meta} />
      <DataQualityContext intel={data.intel_context} />

      <Card padding={28}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <MaturityGauge value={score} max={5} size={140} />
            <div style={{ marginTop: 10, fontSize: "var(--fs-13)", color: "var(--ink-700)", fontWeight: 600 }}>
              {data.pillar_score?.label || "—"}
            </div>
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-28)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.01em" }}>
              {meta.label} maturity sits at <em style={{ fontWeight: 500 }}>{data.pillar_score?.label || "—"}</em>.
            </h2>
            <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.55, marginTop: 10 }}>
              {Object.keys(themes).length} themes computed · {rca.length} RCA insight{rca.length === 1 ? "" : "s"}.
              {rca.length === 0 && " No major issues flagged at the configured thresholds."}
            </p>
          </div>
        </div>
      </Card>

      {/* AI pillar narrative */}
      {data.ai_pillar_narrative && (
        <div style={{ marginTop: 16 }}>
          <AiNarrativeBlock title={`AI verdict · ${meta.label}`}
                              narrative={data.ai_pillar_narrative}
                              citations={data.ai_pillar_citations}
                              attribution={{
                                benchmark: null,
                                data_scope: data.attribution?.data_scope,
                              }} />
        </div>
      )}

      {/* Pillar-level attribution strip — full benchmark list + data scope */}
      <PillarAttributionStrip attribution={data.attribution} />

      {/* Theme cards + per-theme insights */}
      <div style={{ marginTop: 24 }}>
        <Label>Theme scores</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 8 }}>
          {Object.entries(themes).map(([id, t]) => (
            <ThemeCard key={id} id={id} t={t}
                       insight={data.ai_theme_insights?.[id]}
                       attribution={data.ai_theme_attributions?.[id]}
                       explain={data.theme_explainability?.[id]}
                       returnPath={_returnPath} />
          ))}
        </div>
      </div>

      {/* RCA */}
      {rca.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Label>Root-cause analysis · {rca.length}</Label>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {rca.map((card, i) => (
              <div key={i}>
                <RCACard
                  id={`${pillarId}-rca-${i}`}
                  title={card.headline}
                  theme={card.theme}
                  severity={card.severity}
                  cause={card.cause}
                  recommendation={card.recommendation}
                />
                {card.ai_narrative && (
                  <div style={{ marginTop: 6, marginLeft: 16 }}>
                    <AiNarrativeBlock title="AI consultant note"
                                       narrative={card.ai_narrative}
                                       attribution={card.ai_attribution} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ThemeCard = ({ id, t, insight, attribution, explain, returnPath }) => {
  const unavailable = t.score === null || t.score === undefined;
  const tone = unavailable
    ? "var(--ink-300)"
    : t.score >= 3.5 ? "var(--success-500)"
      : t.score >= 2.5 ? "var(--brand-500)" : "var(--warn-500)";
  return (
    <Card padding={16} style={{ borderTop: `3px solid ${tone}`,
                                   background: unavailable ? "var(--surface-sunk)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{id}</div>
          <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, marginTop: 4 }}>{t.label}</div>
        </div>
        <ScoreBadge value={t.score} size="sm" missingInputs={t.missing_inputs} />
      </div>
      {unavailable && t.note && (
        <div style={{ marginTop: 8, fontSize: "var(--fs-12)", color: "var(--ink-600)",
                        fontStyle: "italic", lineHeight: 1.5 }}>
          {t.note}
        </div>
      )}
      {!unavailable && t.metric_value !== undefined && t.metric_value !== null && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: "var(--fs-22)", fontWeight: 600, color: "var(--ink-900)" }}>
            {typeof t.metric_value === "number" ? t.metric_value.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : t.metric_value}
          </span>
          <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{t.metric_unit}</span>
        </div>
      )}
      {t.note && (
        <div style={{ marginTop: 8, fontSize: "var(--fs-12)", color: "var(--ink-700)", lineHeight: 1.45 }}>{t.note}</div>
      )}
      {insight && (
        <div style={{ marginTop: 10 }}>
          <AiNarrativeBlock title="AI insight" narrative={insight} attribution={attribution} />
        </div>
      )}
      <ExplainBlock explain={explain} returnPath={returnPath} />
    </Card>
  );
};

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = ({ meta }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
        Stage {String(meta.stage).padStart(2, "0")}
      </span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      {meta.label}
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      {meta.subtitle}
    </p>
  </div>
);

// Pre-bound instances for routing
export const MaterialMaster = () => <V2Pillar pillarId="material-master" />;
export const PrToPo         = () => <V2Pillar pillarId="pr-to-po" />;
export const PostPo         = () => <V2Pillar pillarId="post-po" />;
export const Supplier       = () => <V2Pillar pillarId="supplier" />;

export default V2Pillar;
