/* Domain patterns — ported from /tmp/design_system/ds-patterns.jsx.
   ScoreBadge, MaturityGauge, CitationChip, BenchmarkCascade, RCACard,
   VolumeValueQuadrant, PerCategoryMatrix. */
import React from "react";
import { Card, Badge } from "./components.jsx";

export const MATURITY_DESCRIPTORS = [
  { v: 1, label: "Initial",    desc: "Ad-hoc, reactive." },
  { v: 2, label: "Developing", desc: "Partial coverage." },
  { v: 3, label: "Defined",    desc: "Standardised." },
  { v: 4, label: "Managed",    desc: "Measured & improved." },
  { v: 5, label: "Optimised",  desc: "Best in class." },
];

/* ScoreBadge — 1-5 maturity */
export const ScoreBadge = ({ value, size = "md", showLabel = true }) => {
  const idx = Math.max(1, Math.min(5, Math.round(value)));
  const color = `var(--m${idx})`;
  const lbl = MATURITY_DESCRIPTORS[idx - 1].label;
  const sizes = {
    sm: { num: 18, h: 22, lblFs: "var(--fs-11)" },
    md: { num: 24, h: 28, lblFs: "var(--fs-12)" },
    lg: { num: 30, h: 36, lblFs: "var(--fs-13)" },
  };
  const s = sizes[size];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{
        minWidth: s.h, height: s.h,
        padding: "0 8px",
        background: color, color: "white",
        borderRadius: "var(--r-md)",
        fontSize: s.num, fontWeight: 600, letterSpacing: "-0.02em",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontVariantNumeric: "tabular-nums", lineHeight: 1,
      }}>{typeof value === "number" ? value.toFixed(1) : value}</span>
      {showLabel && <span style={{ fontSize: s.lblFs, fontWeight: 500, color: "var(--ink-700)" }}>{lbl}</span>}
    </span>
  );
};

/* MaturityGauge — radial donut, 3/4 arc */
export const MaturityGauge = ({ value = 2.8, max = 5, size = 132, tone = "brand" }) => {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcSpan = 0.75;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = c * arcSpan * pct;
  const gap = c - dash;
  const ring = `${dash} ${gap}`;
  const rot = -90 - arcSpan * 180;
  const color = tone === "light" ? "white" : "var(--brand-600)";
  const trackColor = tone === "light" ? "rgba(255,255,255,0.18)" : "var(--ink-100)";
  const textColor = tone === "light" ? "white" : "var(--ink-900)";
  const subColor  = tone === "light" ? "rgba(255,255,255,0.7)" : "var(--ink-500)";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${rot}deg)` }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} strokeDasharray={`${c * arcSpan} ${c}`} strokeLinecap="round" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={ring} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.32, fontWeight: 600, letterSpacing: "-0.03em", color: textColor, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "var(--fs-12)", color: subColor, marginTop: 2, letterSpacing: 0.4 }}>/ {max}</div>
      </div>
    </div>
  );
};

/* CitationChip */
export const CitationChip = ({ source, year, confidence = "high" }) => {
  const confColor = { high: "var(--success-500)", medium: "var(--warn-500)", low: "var(--danger-500)" }[confidence];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px 3px 7px",
      background: "var(--surface-sunk)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--r-pill)", fontSize: "var(--fs-12)",
      color: "var(--ink-700)", fontFamily: "var(--font-mono)",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: confColor, flex: "none" }} />
      <span style={{ fontWeight: 500 }}>{source}</span>
      {year && <span style={{ color: "var(--ink-500)" }}>· {year}</span>}
    </span>
  );
};

/* BenchmarkCascade — visualises Function → Industry → Engagement */
export const BenchmarkCascade = ({ entries }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {entries.map((e, i) => (
      <div key={i} style={{
        display: "grid", gridTemplateColumns: "140px 1fr 140px",
        alignItems: "center", gap: 12,
        padding: "8px 10px",
        borderRadius: "var(--r-md)",
        background: e.active ? "var(--brand-50)" : "transparent",
        border: e.active ? "1px solid var(--brand-100)" : "1px solid transparent",
      }}>
        <div style={{ fontSize: "var(--fs-12)", fontWeight: 500, color: e.active ? "var(--brand-700)" : "var(--ink-500)", textTransform: "uppercase", letterSpacing: 0.6 }}>
          {e.layer}
        </div>
        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)" }}>{e.note}</div>
        <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-900)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{e.value}</div>
      </div>
    ))}
  </div>
);

/* RCACard — Cause → Evidence → Recommendation */
export const RCACard = ({ id, title, theme, severity = "medium", cause, evidence = [], recommendation, savings, citations = [] }) => {
  const sevMap = {
    low:    { bd: "var(--info-500)",    lbl: "Low" },
    medium: { bd: "var(--warn-500)",    lbl: "Medium" },
    high:   { bd: "var(--danger-500)",  lbl: "High" },
  };
  const sv = sevMap[severity];
  return (
    <Card padding={0} elev={1} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                    borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-sunk)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>{id}</span>
        <Badge tone="neutral">{theme}</Badge>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
                       fontSize: "var(--fs-12)", fontWeight: 500, color: sv.bd }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: sv.bd }} /> {sv.lbl} severity
        </span>
      </div>
      <div style={{ padding: 18 }}>
        {title && (
          <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink-900)", marginBottom: 12 }}>
            {title}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: 12, columnGap: 14, fontSize: "var(--fs-14)" }}>
          {cause && (<>
            <div style={lblStyle}>Cause</div>
            <div style={{ color: "var(--ink-700)", lineHeight: 1.55 }}>{cause}</div>
          </>)}
          {evidence.length > 0 && (<>
            <div style={lblStyle}>Evidence</div>
            <ul style={{ margin: 0, paddingLeft: 16, color: "var(--ink-700)", lineHeight: 1.55 }}>
              {evidence.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </>)}
          {recommendation && (<>
            <div style={lblStyle}>Action</div>
            <div style={{ color: "var(--ink-700)", lineHeight: 1.55 }}>{recommendation}</div>
          </>)}
        </div>
        {(savings || citations.length > 0) && (
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {savings && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px",
                background: "var(--gold-50)", border: "1px solid rgba(184,115,51,0.25)",
                borderRadius: "var(--r-pill)",
                fontSize: "var(--fs-13)", fontWeight: 600, color: "#7a5a17",
              }}>{savings}</span>
            )}
            {citations.map((c, i) => <CitationChip key={i} {...c} />)}
          </div>
        )}
      </div>
    </Card>
  );
};

const lblStyle = {
  fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--ink-500)",
  textTransform: "uppercase", letterSpacing: 0.6, paddingTop: 2,
};

/* VolumeValueQuadrant */
export const VolumeValueQuadrant = ({ points, width = 460, height = 320 }) => {
  const pad = { l: 36, r: 18, t: 18, b: 36 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const labels = [
    { q: "Q1 — SSC candidate", cx: 0.25, cy: 0.75 },
    { q: "Q2 — Hybrid",         cx: 0.75, cy: 0.75 },
    { q: "Q3 — Tail",           cx: 0.25, cy: 0.25 },
    { q: "Q4 — CoE candidate",  cx: 0.75, cy: 0.25 },
  ];
  return (
    <svg width={width} height={height} style={{ background: "var(--surface-card)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)" }}>
      <line x1={pad.l + w/2} y1={pad.t} x2={pad.l + w/2} y2={pad.t + h} stroke="var(--border-default)" strokeDasharray="3 4" />
      <line x1={pad.l} y1={pad.t + h/2} x2={pad.l + w} y2={pad.t + h/2} stroke="var(--border-default)" strokeDasharray="3 4" />
      <line x1={pad.l} y1={pad.t + h} x2={pad.l + w} y2={pad.t + h} stroke="var(--ink-300)" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + h} stroke="var(--ink-300)" />
      {labels.map((l) => (
        <text key={l.q} x={pad.l + l.cx * w} y={pad.t + (1 - l.cy) * h}
              fontSize="11" fill="var(--ink-400)" textAnchor="middle"
              fontFamily="var(--font-sans)" fontWeight={500} letterSpacing="0.5">
          {l.q.toUpperCase()}
        </text>
      ))}
      {points.map((p, i) => (
        <g key={i} transform={`translate(${pad.l + p.x * w}, ${pad.t + (1 - p.y) * h})`}>
          <circle r={6 + p.size * 12} fill="var(--brand-500)" fillOpacity="0.18"
                  stroke="var(--brand-600)" strokeWidth="1.5" />
          {p.label && (
            <text y={-12 - p.size * 12} textAnchor="middle" fontSize="10"
                  fill="var(--ink-800)" fontWeight={500} fontFamily="var(--font-sans)">
              {p.label}
            </text>
          )}
        </g>
      ))}
      <text x={pad.l + w/2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--ink-500)">PO count →</text>
      <text x={10} y={pad.t + h/2} fontSize="11" fill="var(--ink-500)"
            transform={`rotate(-90 10 ${pad.t + h/2})`} textAnchor="middle">Avg PO value →</text>
    </svg>
  );
};

/* PerCategoryMatrix — top-N categories with verdict */
export const PerCategoryMatrix = ({ rows, decisionPalette }) => {
  const palette = decisionPalette || {
    Centralise: { bg: "var(--success-50)", fg: "var(--success-700)" },
    "Centre-Led": { bg: "var(--info-50)", fg: "var(--info-700)" },
    "Keep Local": { bg: "var(--ink-100)", fg: "var(--ink-700)" },
    Review: { bg: "var(--warn-50)", fg: "var(--warn-700)" },
  };
  return (
    <div style={{ overflow: "auto", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
        <thead>
          <tr style={{ background: "var(--surface-sunk)" }}>
            <th style={tdHead}>Material group</th>
            <th style={tdHead}>Description</th>
            <th style={{ ...tdHead, textAlign: "right" }}>Spend (₹ Cr)</th>
            <th style={{ ...tdHead, textAlign: "right" }}>Plants</th>
            <th style={tdHead}>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = palette[r.verdict] || palette.Review;
            return (
              <tr key={i}>
                <td style={tdCell}>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                    {r.material_group}
                  </code>
                </td>
                <td style={{ ...tdCell, color: "var(--ink-600)" }}>{r.material_group_desc}</td>
                <td style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                  {Number(r.total_spend_inr_cr).toFixed(1)}
                </td>
                <td style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {r.plant_count ?? "—"}
                </td>
                <td style={tdCell}>
                  <span style={{
                    padding: "3px 9px", borderRadius: "var(--r-pill)",
                    fontSize: "var(--fs-12)", fontWeight: 500,
                    background: p.bg, color: p.fg,
                  }}>{r.verdict}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const tdHead = {
  textAlign: "left", padding: "10px 12px",
  fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.06em",
  color: "var(--ink-600)", borderBottom: "1px solid var(--border-default)",
};
const tdCell = { padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-800)" };
