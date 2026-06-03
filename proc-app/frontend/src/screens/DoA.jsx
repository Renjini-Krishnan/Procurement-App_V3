import React, { useEffect, useState } from "react";
import { Card, Button, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { ScoreBadge, MaturityGauge, RCACard, DataQualityContext, NeedsQreBanner, AiNarrativeBlock, PillarAttributionStrip, ExplainBlock } from "../design/patterns.jsx";
import { useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";
import BenchmarkOverridePanel from "./BenchmarkOverridePanel.jsx";

/* Stage 14 — Delegation of Authority pillar */

const DoA = () => {
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
        const result = await api.runDoA(engagement.id, latest.id, engagement.industry);
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
            Running DoA engine — Stage 8 (Gold) → Stage 9 (Classify) → Stage 10 (KPIs) → Stage 14 (DoA)…
          </div>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Header />
        <Callout tone="danger" title="DoA pillar failed" icon={<I.X size={16} />}>{error}</Callout>
      </div>
    );
  }
  if (!data) return null;

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "document-audit",     label: `Document Audit · ${data.theme_scores["document-audit"].score}` },
    { id: "robustness",         label: `Robustness · ${data.theme_scores.robustness.score}` },
    { id: "po-compliance",      label: `PO Compliance · ${data.theme_scores["po-compliance"].score}` },
    { id: "system-enforcement", label: `System Enforcement · ${data.theme_scores["system-enforcement"].score}` },
    { id: "bucket-optimisation", label: `Bucket Optimisation · ${data.theme_scores["bucket-optimisation"].score}` },
    { id: "settings", label: "Benchmarks & criteria" },
  ];

  // Honest early-return: if engine returned needs_qre, render the banner
  // instead of fake maturity scores.
  if (data.needs_qre) {
    return (
      <div>
        <Header />
        <DataQualityContext intel={data.intel_context} />
        <NeedsQreBanner engagementId={engagement.id}
                          pillarLabel="DoA"
                          message={data.message}
                          qreStatus={data.qre_status} />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <DataQualityContext intel={data.intel_context} />
      <PillarHero data={data} />

      {data.ai_pillar_narrative && (
        <div style={{ marginTop: 16 }}>
          <AiNarrativeBlock title="AI verdict · DoA"
                              narrative={data.ai_pillar_narrative}
                              attribution={{ benchmark: null, data_scope: data.attribution?.data_scope }} />
        </div>
      )}
      <PillarAttributionStrip attribution={data.attribution} />

      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <Tabs items={tabItems} value={activeTheme} onChange={setActiveTheme} />
      </div>

      {activeTheme === "overview" && <Overview data={data} setActiveTheme={setActiveTheme} />}
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
          pillar="doa"
          title="Delegation of Authority benchmarks"
          kbHref={`/kb?root=function&file=doa/benchmarks.yml&return=${encodeURIComponent(`/engagement/${engagement.id}/doa`)}`} />
      )}

      {data.rca_cards.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={sectionHeaderStyle}>Root cause analysis · {data.rca_cards.length} rules fired</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {data.rca_cards.map((r) => (
              <div key={r.rule_id}>
                <RCACard id={r.rule_id} theme={r.theme || "doa"}
                  severity={r.confidence === "high" ? "high" : r.confidence === "medium" ? "medium" : "low"}
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
      <SignoffWidget engagementId={engagement.id} scope="doa" label="Delegation of Authority" expectedCadence="end-of-pillar" />
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 14</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Delegation of Authority
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      5 themes · governance maturity · no ₹ cost-out · QRE + PO + reference template
    </p>
  </div>
);

const PillarHero = ({ data }) => {
  const ps = data.pillar_score || {};
  const cov = ps.coverage_pct;
  return (
    <Card padding={28}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <MaturityGauge value={ps.score} max={5} size={140}
                          missingInputs={ps.missing_themes} />
          <div style={{ marginTop: 12, fontSize: "var(--fs-14)", color: "var(--ink-600)" }}>
            {ps.label || "—"}
          </div>
          {cov !== undefined && cov < 99 && cov > 0 && (
            <div style={{ marginTop: 4, fontSize: "var(--fs-11)", color: "var(--warn-700)" }}>
              {ps.themes_available}/{ps.themes_total} themes computed
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
            DoA pillar score · weighted (DocAudit 0.20 · Robust 0.25 · POCompl 0.25 · Sys 0.15 · Bucket 0.15)
          </div>
          <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5 }}>
            Governance, control, and compliance assessment of the procurement approval matrix.
            Outputs are maturity scores + diagnostics — no ₹ savings.
          </div>
          {Array.isArray(ps.missing_themes) && ps.missing_themes.length > 0 && (
            <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
              Themes without inputs: {ps.missing_themes.map((t, i) => (
                <code key={i} style={{ fontFamily: "var(--font-mono)", background: "var(--surface-sunk)",
                                          padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>{t}</code>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const Overview = ({ data, setActiveTheme }) => {
  const themes = [
    { id: "document-audit",     title: "Document Audit + Coverage", weight: 0.20 },
    { id: "robustness",         title: "Robustness vs Reference",    weight: 0.25 },
    { id: "po-compliance",      title: "PO Compliance & Distribution", weight: 0.25 },
    { id: "system-enforcement", title: "System Enforcement (QRE)",   weight: 0.15 },
    { id: "bucket-optimisation", title: "Bucket Optimisation",       weight: 0.15 },
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
                <h3 style={{ fontSize: "var(--fs-18)", fontWeight: 600, margin: "4px 0 0 0", letterSpacing: "-0.01em" }}>
                  Score
                </h3>
              </div>
              <ScoreBadge value={score?.score} size="lg" showLabel
                            missingInputs={td?.missing_inputs} />
            </div>
            <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5, margin: 0 }}>
              {td?.headline || td?.note || "—"}
            </p>
            <div style={{ marginTop: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
              {score?.rationale}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const ThemeView = ({ theme, score, themeId, explain }) => {
  const loc = useLocation();
  const returnPath = loc.pathname + (loc.search || "");
  const unavailable = theme?.available === false || score?.score == null;
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
          <ScoreBadge value={score?.score} size="lg" showLabel missingInputs={theme?.missing_inputs} />
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
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
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

const sectionHeaderStyle = {
  fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4,
  textTransform: "uppercase", color: "var(--ink-600)", margin: "28px 0 12px 0",
};

export default DoA;
