import React, { useEffect, useState } from "react";
import { Card, Button, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { ScoreBadge, MaturityGauge, RCACard, DataQualityContext } from "../design/patterns.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";

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
  ];

  return (
    <div>
      <Header />
      <DataQualityContext intel={data.intel_context} />
      <PillarHero data={data} />

      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <Tabs items={tabItems} value={activeTheme} onChange={setActiveTheme} />
      </div>

      {activeTheme === "overview" && <Overview data={data} setActiveTheme={setActiveTheme} />}
      {activeTheme !== "overview" && <ThemeView theme={data.themes[activeTheme]} score={data.theme_scores[activeTheme]} themeId={activeTheme} />}

      {data.rca_cards.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={sectionHeaderStyle}>Root cause analysis · {data.rca_cards.length} rules fired</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {data.rca_cards.map((r) => (
              <RCACard
                key={r.rule_id}
                id={r.rule_id}
                theme={r.theme || "doa"}
                severity={r.confidence === "high" ? "high" : r.confidence === "medium" ? "medium" : "low"}
                cause={(r.root_causes || [])[0]}
                evidence={(r.root_causes || []).slice(1, 4)}
                recommendation={r.references?.recommendation}
              />
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
          DoA pillar score · weighted (DocAudit 0.20 · Robust 0.25 · POCompl 0.25 · Sys 0.15 · Bucket 0.15)
        </div>
        <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5 }}>
          Governance, control, and compliance assessment of the procurement approval matrix.
          Outputs are maturity scores + diagnostics — no ₹ savings.
        </div>
      </div>
    </div>
  </Card>
);

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
};

const ThemeView = ({ theme, score, themeId }) => (
  <div>
    <Card padding={22} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "var(--fs-24)", fontWeight: 600, margin: "0 0 8px 0", letterSpacing: "-0.015em" }}>
            {themeId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </h2>
          <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.55, color: "var(--ink-700)", margin: 0 }}>
            {theme.headline}
          </p>
          <div style={{ marginTop: 12, fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
            {score.rationale}
          </div>
        </div>
        <ScoreBadge value={score.score} size="lg" showLabel />
      </div>
    </Card>
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
  </div>
);

const sectionHeaderStyle = {
  fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4,
  textTransform: "uppercase", color: "var(--ink-600)", margin: "28px 0 12px 0",
};

export default DoA;
