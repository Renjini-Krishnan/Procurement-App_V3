import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { ScoreBadge, MaturityGauge, RCACard, DataQualityContext, NeedsQreBanner, AiNarrativeBlock, PillarAttributionStrip, ExplainBlock } from "../design/patterns.jsx";
import { useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";
import BenchmarkOverridePanel from "./BenchmarkOverridePanel.jsx";

/* Stage 13 — Org Structure pillar (4 themes, V1 QRE-driven). */

const OrgStructure = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTheme, setActiveTheme] = useState("overview");

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
        const result = await api.runOrgStructure(engagement.id, latest.id, engagement.industry);
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
            Running Org Structure engine — Stage 8 → 9 → 10 → 13 (QRE-driven for V1)…
          </div>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Header />
        <Callout tone="danger" title="Org Structure pillar failed" icon={<I.X size={16} />}>{error}</Callout>
      </div>
    );
  }
  if (!data) return null;

  // Render the "needs QRE" stub before any computed-data assumptions
  if (data.needs_qre) {
    return (
      <div>
        <Header />
        <DataQualityContext intel={data.intel_context} />
        <NeedsQreBanner engagementId={engagement.id}
                          pillarLabel="Org Structure"
                          message={data.message}
                          qreStatus={data.qre_status} />
      </div>
    );
  }

  const themes = [
    { id: "organisation-posture",        title: "Organisation Posture", weight: 0.20 },
    { id: "fte-sizing-role-composition", title: "FTE Sizing & Roles",   weight: 0.35 },
    { id: "spend-fte-distribution",      title: "Spend-FTE Distribution", weight: 0.20 },
    { id: "hierarchy-span",              title: "Hierarchy & Span",     weight: 0.25 },
  ];

  const tabItems = [
    { id: "overview", label: "Overview" },
    ...themes.map((t) => ({ id: t.id, label: `${t.title} · ${data.theme_scores[t.id].score}` })),
    { id: "settings", label: "Benchmarks & criteria" },
  ];

  return (
    <div>
      <Header />
      <DataQualityContext intel={data.intel_context} />
      <PillarHero data={data} />

      {data.ai_pillar_narrative && (
        <div style={{ marginTop: 16 }}>
          <AiNarrativeBlock title="AI verdict · Org Structure"
                              narrative={data.ai_pillar_narrative}
                              citations={data.ai_pillar_citations}
                              attribution={{ benchmark: null, data_scope: data.attribution?.data_scope }} />
        </div>
      )}
      <PillarAttributionStrip attribution={data.attribution} />

      <Callout tone="info" title="V1 limitation" icon={<I.Doc size={16} />}>
        Full Org Structure analysis requires Employee Master + Org Chart uploads (planned for Build 2).
        V1 scores 4 themes from QRE responses + PO-derived proxies (plant count, spend distribution).
      </Callout>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Tabs items={tabItems} value={activeTheme} onChange={setActiveTheme} />
      </div>

      {activeTheme === "overview" && <Overview data={data} themes={themes} setActiveTheme={setActiveTheme} />}
      {activeTheme !== "overview" && activeTheme !== "settings" && (
        <>
          <ThemeView theme={data.themes[activeTheme]} score={data.theme_scores[activeTheme]} themeId={activeTheme}
                       explain={data.theme_explainability?.[activeTheme]} />
          {data.ai_theme_insights?.[activeTheme] && (
            <div style={{ marginTop: 16 }}>
              <AiNarrativeBlock title={`AI insight · ${activeTheme}`}
                                  narrative={data.ai_theme_insights[activeTheme]}
                                  attribution={data.ai_theme_attributions?.[activeTheme]} />
            </div>
          )}
        </>
      )}
      {activeTheme === "settings" && (
        <BenchmarkOverridePanel
          engagementId={engagement.id}
          pillar="org-structure"
          title="Org Structure benchmarks"
          kbHref={`/kb?root=function&file=org-structure/benchmarks.yml&return=${encodeURIComponent(`/engagement/${engagement.id}/org-structure`)}`} />
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
                         evidence={(r.root_causes || []).slice(1)} />
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
      <SignoffWidget engagementId={engagement.id} scope="org-structure" label="Organisation Structure" expectedCadence="end-of-pillar" />
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 13</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Organisation Structure
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      4 themes · posture / FTE sizing / spend distribution / hierarchy
    </p>
  </div>
);

const PillarHero = ({ data }) => (
  <Card padding={28}>
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <MaturityGauge value={data.pillar_score.score} max={5} size={140} />
        <div style={{ marginTop: 12, fontSize: "var(--fs-14)", color: "var(--ink-600)" }}>
          {data.pillar_score.label}
        </div>
      </div>
      <div>
        <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
          Org Structure pillar score · weighted (Posture 0.20 · FTE 0.35 · Distribution 0.20 · Hierarchy 0.25)
        </div>
        <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5 }}>
          QRE-driven maturity assessment. Identifies organisational posture (centralised vs federated),
          FTE sizing benchmarks (spend per FTE), governance forums, and span-of-control gaps.
        </div>
      </div>
    </div>
  </Card>
);

const Overview = ({ data, themes, setActiveTheme }) => (
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
              <h3 style={{ fontSize: "var(--fs-18)", fontWeight: 600, margin: "4px 0 0 0", letterSpacing: "-0.01em" }}>
                Score
              </h3>
            </div>
            <ScoreBadge value={score.score} size="lg" showLabel />
          </div>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5, margin: 0 }}>
            {td.headline}
          </p>
          <div style={{ marginTop: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
            {score.rationale}
          </div>
        </Card>
      );
    })}
  </div>
);

const ThemeView = ({ theme, score, themeId, explain }) => {
  const unavailable = theme?.available === false || score?.score == null;
  const loc = useLocation();
  const returnPath = loc.pathname + (loc.search || "");
  return (
  <div>
    <Card padding={22} style={{ marginBottom: 20,
                                   background: unavailable ? "var(--surface-sunk)" : undefined }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "var(--fs-24)", fontWeight: 600, margin: "0 0 8px 0", letterSpacing: "-0.015em" }}>
            {themeId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </h2>
          <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.55, color: "var(--ink-700)", margin: 0 }}>
            {theme?.headline || theme?.note || "—"}
          </p>
          {unavailable && Array.isArray(theme?.missing_inputs) && theme.missing_inputs.length > 0 && (
            <div style={{ marginTop: 12, fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>
              Required inputs not provided:{" "}
              {theme.missing_inputs.map((m, i) => (
                <code key={i} style={{ fontFamily: "var(--font-mono)", marginRight: 6,
                                          background: "var(--surface-card)", padding: "1px 6px",
                                          borderRadius: 3 }}>{m}</code>
              ))}
            </div>
          )}
          {!unavailable && (
            <div style={{ marginTop: 12, fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
              {score?.rationale}
            </div>
          )}
        </div>
        <ScoreBadge value={score?.score} size="lg" showLabel
                    missingInputs={theme?.missing_inputs} />
      </div>
    </Card>
    {!unavailable && (
      <Card padding={20}>
        <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", marginBottom: 12 }}>
          Metrics
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <tbody>
            {Object.entries(theme.metrics || {}).map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: "8px 0", color: "var(--ink-600)", width: "40%" }}>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{k}</code>
                </td>
                <td style={{ padding: "8px 0", color: "var(--ink-900)", fontWeight: 500 }}>
                  {v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    )}
    <ExplainBlock explain={explain} returnPath={returnPath} defaultOpen={false} />
  </div>
  );
};

const sectionHeader = {
  fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4,
  textTransform: "uppercase", color: "var(--ink-600)", margin: "28px 0 12px 0",
};

export default OrgStructure;
