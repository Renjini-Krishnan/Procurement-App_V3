import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { ScoreBadge, MaturityGauge, RCACard } from "../design/patterns.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import SignoffWidget from "./SignoffWidget.jsx";

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

  const themes = [
    { id: "organisation-posture",        title: "Organisation Posture", weight: 0.20 },
    { id: "fte-sizing-role-composition", title: "FTE Sizing & Roles",   weight: 0.35 },
    { id: "spend-fte-distribution",      title: "Spend-FTE Distribution", weight: 0.20 },
    { id: "hierarchy-span",              title: "Hierarchy & Span",     weight: 0.25 },
  ];

  const tabItems = [
    { id: "overview", label: "Overview" },
    ...themes.map((t) => ({ id: t.id, label: `${t.title} · ${data.theme_scores[t.id].score}` })),
  ];

  return (
    <div>
      <Header />
      <PillarHero data={data} />

      <Callout tone="info" title="V1 limitation" icon={<I.Doc size={16} />}>
        Full Org Structure analysis requires Employee Master + Org Chart uploads (planned for Build 2).
        V1 scores 4 themes from QRE responses + PO-derived proxies (plant count, spend distribution).
      </Callout>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Tabs items={tabItems} value={activeTheme} onChange={setActiveTheme} />
      </div>

      {activeTheme === "overview" && <Overview data={data} themes={themes} setActiveTheme={setActiveTheme} />}
      {activeTheme !== "overview" && (
        <ThemeView theme={data.themes[activeTheme]} score={data.theme_scores[activeTheme]} themeId={activeTheme} />
      )}

      {data.rca_cards.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={sectionHeader}>Root cause analysis · {data.rca_cards.length} rules fired</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {data.rca_cards.map((r) => (
              <RCACard key={r.rule_id} id={r.rule_id} theme={r.theme}
                       severity={r.confidence === "high" ? "high" : "medium"}
                       cause={(r.root_causes || [])[0]}
                       evidence={(r.root_causes || []).slice(1)} />
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
                {v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const sectionHeader = {
  fontSize: "var(--fs-14)", fontWeight: 600, letterSpacing: 0.4,
  textTransform: "uppercase", color: "var(--ink-600)", margin: "28px 0 12px 0",
};

export default OrgStructure;
