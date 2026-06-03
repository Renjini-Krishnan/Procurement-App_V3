/* Domain patterns — ported from /tmp/design_system/ds-patterns.jsx.
   ScoreBadge, MaturityGauge, CitationChip, BenchmarkCascade, RCACard,
   VolumeValueQuadrant, PerCategoryMatrix. */
import React, { useState } from "react";
import { Link as _RouterLink } from "react-router-dom";
import { Card, Badge } from "./components.jsx";

export const MATURITY_DESCRIPTORS = [
  { v: 1, label: "Initial",    desc: "Ad-hoc, reactive." },
  { v: 2, label: "Developing", desc: "Partial coverage." },
  { v: 3, label: "Defined",    desc: "Standardised." },
  { v: 4, label: "Managed",    desc: "Measured & improved." },
  { v: 5, label: "Optimised",  desc: "Best in class." },
];

/* UnavailableBadge — shown wherever a score / metric is null because
   the required inputs (QRE answers, file, column) weren't provided.
   Replaces every silent fallback that used to show "0" or "Initial". */
export const UnavailableBadge = ({ size = "md", missingInputs }) => {
  const sizes = {
    sm: { fs: "var(--fs-11)", pad: "2px 8px" },
    md: { fs: "var(--fs-12)", pad: "4px 10px" },
    lg: { fs: "var(--fs-13)", pad: "6px 14px" },
  };
  const s = sizes[size];
  const title = Array.isArray(missingInputs) && missingInputs.length
    ? `Missing inputs: ${missingInputs.join(", ")}` : undefined;
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: s.pad, fontSize: s.fs, fontWeight: 600,
      background: "var(--surface-sunk)", color: "var(--ink-500)",
      border: "1px dashed var(--border-default)",
      borderRadius: "var(--r-md)", letterSpacing: "0.02em",
    }}>— Data not available</span>
  );
};

/* ScoreBadge — 1-5 maturity. Renders UnavailableBadge when value is null. */
export const ScoreBadge = ({ value, size = "md", showLabel = true, missingInputs }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <UnavailableBadge size={size} missingInputs={missingInputs} />;
  }
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

/* MaturityGauge — radial donut, 3/4 arc. Renders an unavailable placeholder
   when value is null. */
export const MaturityGauge = ({ value, max = 5, size = 132, tone = "brand", missingInputs }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    const subColor = tone === "light" ? "rgba(255,255,255,0.7)" : "var(--ink-500)";
    const textColor = tone === "light" ? "white" : "var(--ink-500)";
    return (
      <div style={{ position: "relative", width: size, height: size,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      borderRadius: "50%",
                      border: `2px dashed ${tone === "light" ? "rgba(255,255,255,0.4)" : "var(--ink-300)"}` }}
            title={Array.isArray(missingInputs) && missingInputs.length
                   ? `Missing inputs: ${missingInputs.join(", ")}` : undefined}>
        <div style={{ fontSize: size * 0.13, color: textColor, fontWeight: 600,
                        textAlign: "center", lineHeight: 1.3 }}>
          Data not<br/>available
        </div>
        <div style={{ fontSize: "var(--fs-10)", color: subColor, marginTop: 4, letterSpacing: 0.4 }}>
          / {max}
        </div>
      </div>
    );
  }
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


/* ===========================================================================
 * DataQualityContext — shared header strip showing DQS + dataset shape +
 * canonical classification. Drop at the top of any Analyze stage so the
 * consultant always knows the trustworthiness of the data behind the verdict.
 * Consumes the run_intel response shape from orchestrator.
 * ======================================================================== */

const DQS_BAND = {
  HIGH:       { bg: "var(--success-50)", fg: "var(--success-700)" },
  GOOD:       { bg: "var(--success-50)", fg: "var(--success-700)" },
  ACCEPTABLE: { bg: "var(--warn-50)",    fg: "var(--warn-700)" },
  LOW:        { bg: "var(--warn-50)",    fg: "var(--warn-700)" },
  VERY_LOW:   { bg: "var(--danger-50)",  fg: "var(--danger-700)" },
};

export const DataQualityContext = ({ intel }) => {
  if (!intel) return null;
  const dqs = intel.data_quality_score || {};
  const cc = intel.canonical_classification || {};
  const port = intel.portfolio_summary || {};
  const band = DQS_BAND[dqs.band] || { bg: "var(--surface-sunk)", fg: "var(--ink-600)" };
  const items = [];
  if (dqs.score !== undefined) {
    items.push({
      label: "Data quality",
      value: `${dqs.score} · ${dqs.band || "—"}`,
      tone: band,
      tip: dqs.band_interpretation,
    });
  }
  if (port.total_po_count) {
    items.push({ label: "POs", value: port.total_po_count.toLocaleString("en-IN") });
  }
  if (port.total_spend_inr) {
    items.push({ label: "Spend", value: `₹${(port.total_spend_inr / 1e7).toFixed(1)} Cr` });
  }
  if (cc.taxonomy_canonicals) {
    items.push({
      label: "Canonicals",
      value: `${cc.taxonomy_canonicals} (${cc.stats?.canonicals_assigned?.toLocaleString("en-IN") || 0} rows assigned)`,
    });
  }
  if (cc.stats?.unclassified_pct !== undefined) {
    items.push({
      label: "Unclassified",
      value: `${cc.stats.unclassified_pct}%`,
      tone: cc.stats.unclassified_pct > 15
        ? { bg: "var(--warn-50)", fg: "var(--warn-700)" } : undefined,
    });
  }
  const feasibility = intel.pillar_feasibility || {};
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 8, padding: 12,
      background: "var(--surface-sunk)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--r-md)", marginBottom: 16,
    }}>
      {items.map((it) => {
        const tone = it.tone || { bg: "transparent", fg: "var(--ink-700)" };
        return (
          <div key={it.label} title={it.tip || ""}
                style={{ display: "flex", flexDirection: "column", padding: "2px 12px",
                          borderRight: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)",
                            textTransform: "uppercase", letterSpacing: "0.08em" }}>{it.label}</span>
            <span style={{ fontSize: "var(--fs-13)", fontWeight: 600,
                            color: tone.fg, background: tone.bg === "transparent" ? "none" : tone.bg,
                            padding: tone.bg !== "transparent" ? "1px 6px" : 0,
                            borderRadius: tone.bg !== "transparent" ? 4 : 0,
                            marginTop: 2, display: "inline-block" }}>
              {it.value}
            </span>
          </div>
        );
      })}
      {Object.keys(feasibility).length > 0 && (
        <details style={{ marginLeft: "auto" }}>
          <summary style={{ cursor: "pointer", fontSize: "var(--fs-11)", color: "var(--ink-600)", padding: "4px 8px" }}>
            Pillar feasibility ▾
          </summary>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {Object.entries(feasibility).map(([p, v]) => {
              const tone = v.tier === "high" ? { bg: "var(--success-50)", fg: "var(--success-700)" }
                          : v.tier === "medium" ? { bg: "var(--warn-50)", fg: "var(--warn-700)" }
                          : v.tier === "skip" ? { bg: "var(--danger-50)", fg: "var(--danger-700)" }
                          : { bg: "var(--surface-card)", fg: "var(--ink-600)" };
              return (
                <span key={p} style={{ background: tone.bg, color: tone.fg, padding: "1px 8px",
                                          borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600,
                                          textTransform: "uppercase" }}>
                  {p}: {v.tier}
                </span>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
};


/* ===========================================================================
 * KpiSummaryStrip — compact KPI scorecard. One pill per KPI showing value
 * + benchmark verdict. Used by FindingsDeck and ExecSummary.
 * ======================================================================== */

export const KpiSummaryStrip = ({ kpis }) => {
  if (!Array.isArray(kpis) || kpis.length === 0) return null;
  const tone = (pos) => {
    if (pos === "above_typical_good" || pos === "below_typical_good") return { bg: "var(--success-50)", fg: "var(--success-700)" };
    if (pos === "within_typical") return { bg: "var(--surface-sunk)", fg: "var(--ink-700)" };
    if (pos === "above_typical_bad" || pos === "below_typical") return { bg: "var(--warn-50)", fg: "var(--warn-700)" };
    return { bg: "var(--surface-card)", fg: "var(--ink-500)" };
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
      {kpis.map((k) => {
        const b = k.benchmark || {};
        const t = tone(b.your_position);
        const v = k.value == null ? "—" : (typeof k.value === "number" ? k.value.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : k.value);
        return (
          <div key={k.id} style={{
            background: t.bg, padding: "10px 12px", borderRadius: "var(--r-md)",
            border: `1px solid ${t.fg}22`,
          }}>
            <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", textTransform: "uppercase",
                            letterSpacing: "0.08em" }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: "var(--fs-18)", fontWeight: 600, color: t.fg }}>{v}</span>
              <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{k.unit}</span>
            </div>
            {b.typical_low != null && (
              <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", marginTop: 2 }}>
                vs typ {b.typical_low}–{b.typical_high}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};


/* ===========================================================================
 * NeedsQreBanner — pillar screens render this when the engine returns
 * needs_qre=true. Replaces fake/default maturity scores with a clear
 * "answer QRE first" message + link.
 * ======================================================================== */

import { Link } from "react-router-dom";

export const NeedsQreBanner = ({ engagementId, pillarLabel, message, qreStatus }) => {
  const answered = qreStatus?.answered ?? 0;
  const total = qreStatus?.total ?? 52;
  return (
    <div style={{
      padding: "20px 24px",
      background: "var(--warn-50)",
      border: "1px solid var(--warn-500)",
      borderLeft: "4px solid var(--warn-500)",
      borderRadius: "var(--r-lg)",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em",
                          color: "var(--warn-700)", fontWeight: 700, marginBottom: 6 }}>
            QRE responses required
          </div>
          <div style={{ fontSize: "var(--fs-15)", color: "var(--ink-900)", fontWeight: 500, lineHeight: 1.45 }}>
            {message || `The ${pillarLabel} pillar needs QRE responses to produce a maturity score.`}
          </div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", marginTop: 8 }}>
            Currently answered: <strong>{answered}</strong> of {total} questions
          </div>
        </div>
        {engagementId && (
          <Link to={`/engagement/${engagementId}/qre`}
                 style={{ background: "var(--warn-700)", color: "white",
                           padding: "10px 18px", borderRadius: "var(--r-md)",
                           fontSize: "var(--fs-13)", fontWeight: 600,
                           textDecoration: "none", whiteSpace: "nowrap" }}>
            Answer QRE →
          </Link>
        )}
      </div>
    </div>
  );
};


/* ===========================================================================
 * QreStatusChip — shows compact "X of 52 QRE answered" pill on any pillar.
 * Use alongside DataQualityContext to keep the data-quality story honest.
 * ======================================================================== */

export const QreStatusChip = ({ qreStatus, engagementId }) => {
  if (!qreStatus) return null;
  const answered = qreStatus.answered ?? 0;
  const total = qreStatus.total ?? 52;
  const pct = total ? Math.round(100 * answered / total) : 0;
  const tone = answered === 0 ? { bg: "var(--danger-50)", fg: "var(--danger-700)" }
              : answered < 10 ? { bg: "var(--warn-50)", fg: "var(--warn-700)" }
              : { bg: "var(--success-50)", fg: "var(--success-700)" };
  return (
    <Link to={engagementId ? `/engagement/${engagementId}/qre` : "#"}
           style={{ display: "inline-flex", alignItems: "center", gap: 6,
                     background: tone.bg, color: tone.fg, padding: "4px 10px",
                     borderRadius: "var(--r-pill)", fontSize: "var(--fs-12)",
                     fontWeight: 600, textDecoration: "none" }}>
      QRE: {answered}/{total} ({pct}%)
    </Link>
  );
};


/* ===========================================================================
 * AiNarrativeBlock — renders an LLM-generated paragraph with a clear "AI"
 * badge. Used for theme insights + pillar narrative + RCA narratives.
 * ======================================================================== */

export const AiNarrativeBlock = ({ title, narrative, isLive = true, attribution }) => {
  if (!narrative) return null;
  return (
    <div style={{
      padding: 14, borderRadius: "var(--r-md)",
      background: "var(--brand-50)", border: "1px solid var(--brand-200, #d4d4f7)",
      borderLeft: "3px solid var(--brand-700)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase",
                        letterSpacing: "0.1em", color: "var(--brand-700)",
                        fontWeight: 600 }}>
          ✨ {title || "AI insight"}
        </div>
        <span style={{
          fontSize: "var(--fs-10)",
          background: isLive ? "var(--success-50)" : "var(--surface-card)",
          color: isLive ? "var(--success-700)" : "var(--ink-500)",
          padding: "1px 8px", borderRadius: "var(--r-pill)", fontWeight: 600,
        }}>
          {isLive ? "Gemini" : "Fallback"}
        </span>
      </div>
      <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-900)", lineHeight: 1.55 }}>
        {narrative}
      </div>
      <AttributionFooter attribution={attribution} />
    </div>
  );
};

/* Small grey strip rendered under any AiNarrativeBlock when attribution
   is available. Format: "Benchmark: APQC-2024 typical 2-4% (n=500+) ·
   Data: 36,412 PO lines · 41/52 QRE answered". Renders nothing when no
   benchmark + no data scope are passed. */
const AttributionFooter = ({ attribution }) => {
  if (!attribution) return null;
  const bench = attribution.benchmark;
  const scope = attribution.data_scope;
  const parts = [];
  if (bench && (bench.source || bench.value_range)) {
    const band = Array.isArray(bench.value_range) && bench.value_range.length === 2
      ? `${bench.value_range[0]}-${bench.value_range[1]}${bench.unit || ""}`
      : null;
    const srcBits = [];
    if (bench.source) srcBits.push(bench.year ? `${bench.source}-${bench.year}` : bench.source);
    if (bench.sample_size) srcBits.push(`n=${bench.sample_size}`);
    const src = srcBits.join(" · ");
    if (band && src) parts.push(`Benchmark: ${src} typical ${band}`);
    else if (band) parts.push(`Benchmark: typical ${band}`);
    else if (src) parts.push(`Benchmark: ${src}`);
  }
  if (scope) {
    const dataBits = [];
    if (scope.po_rows) dataBits.push(`${Number(scope.po_rows).toLocaleString("en-IN")} PO lines`);
    if (scope.vendor_count) dataBits.push(`${Number(scope.vendor_count).toLocaleString("en-IN")} vendors`);
    if (scope.qre_total) dataBits.push(`${scope.qre_answered ?? 0}/${scope.qre_total} QRE answered`);
    if (dataBits.length) parts.push(`Data: ${dataBits.join(" · ")}`);
  }
  if (parts.length === 0) return null;
  return (
    <div style={{
      marginTop: 10, paddingTop: 8,
      borderTop: "1px dashed var(--brand-200, #d4d4f7)",
      fontSize: "var(--fs-11)", color: "var(--ink-500)",
      fontFamily: "var(--font-mono)", lineHeight: 1.5,
    }}>
      {parts.join(" · ")}
    </div>
  );
};

/* PillarAttributionStrip — shows the full benchmark list + data scope for
   a pillar response on the maturity page. Distinct from the per-narrative
   footer because it surfaces ALL benchmark sources used by the pillar,
   not just the one the LLM cited in its paragraph. */
export const PillarAttributionStrip = ({ attribution }) => {
  if (!attribution) return null;
  const benchmarks = attribution.benchmarks_used || [];
  const scope = attribution.data_scope || {};
  if (benchmarks.length === 0 && Object.keys(scope).length === 0) return null;
  return (
    <div style={{
      marginTop: 12, padding: "10px 14px",
      background: "var(--surface-sunk)", borderRadius: "var(--r-md)",
      fontSize: "var(--fs-11)", color: "var(--ink-600)", lineHeight: 1.55,
    }}>
      <div style={{
        fontSize: "var(--fs-10)", textTransform: "uppercase",
        letterSpacing: "0.1em", color: "var(--ink-500)",
        fontWeight: 600, marginBottom: 6,
      }}>
        Sources · industry: {attribution.industry || "—"}
      </div>
      {benchmarks.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Benchmarks: </span>
          {benchmarks.slice(0, 6).map((b, i) => {
            const src = b.source ? (b.year ? `${b.source}-${b.year}` : b.source) : "—";
            const band = Array.isArray(b.value_range) && b.value_range.length === 2
              ? ` ${b.value_range[0]}-${b.value_range[1]}${b.unit || ""}` : "";
            return (
              <span key={b.id || i} style={{ marginRight: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>{src}</span>
                {band && <span style={{ color: "var(--ink-500)" }}>{band}</span>}
                {i < Math.min(benchmarks.length, 6) - 1 ? "," : ""}
              </span>
            );
          })}
          {benchmarks.length > 6 && (
            <span style={{ color: "var(--ink-500)" }}>+{benchmarks.length - 6} more</span>
          )}
        </div>
      )}
      {Object.keys(scope).length > 0 && (
        <div>
          <span style={{ fontWeight: 600 }}>Data scope: </span>
          {scope.po_rows ? `${Number(scope.po_rows).toLocaleString("en-IN")} PO lines · ` : ""}
          {scope.vendor_count ? `${Number(scope.vendor_count).toLocaleString("en-IN")} vendors · ` : ""}
          {scope.qre_total ? `${scope.qre_answered ?? 0}/${scope.qre_total} QRE answered` : ""}
        </div>
      )}
    </div>
  );
};


/* ===========================================================================
 * ExplainBlock — collapsible "How was this computed?" panel rendered under
 * every theme card / KPI card / RCA card. Reads the explainability payload
 * stamped by backend/engine/explain.py:
 *   {
 *     theme_id, status ("computed" | "data_not_available"),
 *     method (1 sentence),
 *     data_columns_used: [...],
 *     thresholds: { 'c1.threshold_min_plants': 2, ... },
 *     derivation: ["c1 — Detect multi-plant MGs: threshold ≥2 plants ...", ...],
 *     benchmark: { source, year, value_range, unit, sample_size, confidence, layer },
 *     kb_files_consulted: ["op-model/benchmarks.yml", ...],
 *     pending_inputs: [{type, id, reason}, ...],
 *   }
 *
 * Every section is rendered only if its data is present. KB file paths
 * become deep-links to the KB editor.
 * ======================================================================== */

export const ExplainBlock = ({ explain, returnPath, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  if (!explain) return null;
  const isUnavail = explain.status === "data_not_available";
  return (
    <details open={open} onToggle={(e) => setOpen(e.target.open)}
             style={{ marginTop: 10, fontSize: "var(--fs-12)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--r-md)",
                        background: "var(--surface-sunk)" }}>
      <summary style={{ cursor: "pointer", padding: "8px 12px",
                          fontSize: "var(--fs-12)", fontWeight: 600,
                          color: "var(--ink-700)", listStyle: "none",
                          display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11 }}>{open ? "▾" : "▸"}</span>
        How was this computed?
        {isUnavail && (
          <span style={{ marginLeft: "auto", fontSize: "var(--fs-10)", color: "var(--warn-700)",
                            background: "var(--warn-50, #fff5e6)", padding: "1px 6px",
                            borderRadius: "var(--r-pill)" }}>
            Data not available
          </span>
        )}
      </summary>
      <div style={{ padding: "0 14px 14px 14px", display: "grid", gap: 10 }}>

        {/* Method — what algorithm */}
        {explain.method && (
          <ExplainRow label="Method">
            <span style={{ color: "var(--ink-800)", lineHeight: 1.5 }}>{explain.method}</span>
          </ExplainRow>
        )}

        {/* Input data — which columns the engine read */}
        {(explain.data_columns_used || explain.data_columns_required || []).length > 0 && (
          <ExplainRow label={isUnavail ? "Required data columns" : "Data columns used"}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(explain.data_columns_used || explain.data_columns_required).map((c) => (
                <code key={c} style={chipStyle}>{c}</code>
              ))}
            </div>
          </ExplainRow>
        )}

        {/* Required QRE answers */}
        {(explain.qre_required || []).length > 0 && (
          <ExplainRow label={isUnavail ? "Required QRE answers" : "QRE answers used"}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {explain.qre_required.map((q) => (
                <code key={q} style={chipStyle}>{q}</code>
              ))}
            </div>
          </ExplainRow>
        )}

        {/* Required engagement fields */}
        {(explain.engagement_required || []).length > 0 && (
          <ExplainRow label="Required engagement fields">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {explain.engagement_required.map((f) => (
                <code key={f} style={chipStyle}>{f}</code>
              ))}
            </div>
          </ExplainRow>
        )}

        {/* Required files (V2 pillars) */}
        {(explain.file_required || []).length > 0 && (
          <ExplainRow label="Required file uploads">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {explain.file_required.map((f) => (
                <code key={f} style={chipStyle}>{f}</code>
              ))}
            </div>
          </ExplainRow>
        )}

        {/* Thresholds the engine applied */}
        {Object.keys(explain.thresholds || {}).length > 0 && (
          <ExplainRow label="Thresholds applied">
            <div style={{ display: "grid", gap: 2 }}>
              {Object.entries(explain.thresholds).map(([k, v]) => (
                <div key={k}>
                  <code style={chipStyle}>{k}</code> = <strong>{String(v)}</strong>
                </div>
              ))}
            </div>
          </ExplainRow>
        )}

        {/* Derivation chain */}
        {(explain.derivation || []).length > 0 && (
          <ExplainRow label="Derivation">
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {explain.derivation.map((step, i) => (
                <li key={i} style={{ color: "var(--ink-800)", lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </ExplainRow>
        )}

        {/* Benchmark cited */}
        {explain.benchmark && (explain.benchmark.source || explain.benchmark.value_range) && (
          <ExplainRow label="Benchmark cited">
            <BenchmarkLine b={explain.benchmark} />
          </ExplainRow>
        )}

        {/* KB files consulted — deep-links to the editor */}
        {(explain.kb_files_consulted || []).length > 0 && (
          <ExplainRow label="KB files consulted">
            <div style={{ display: "grid", gap: 3 }}>
              {explain.kb_files_consulted.map((path) => (
                <KBLink key={path} path={path} returnPath={returnPath} />
              ))}
            </div>
          </ExplainRow>
        )}

        {/* Pending inputs that would refine the score */}
        {(explain.pending_inputs || []).length > 0 && (
          <ExplainRow label="Pending inputs · would refine this score">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3, color: "var(--ink-700)" }}>
              {explain.pending_inputs.map((p, i) => (
                <li key={i}>
                  {p.type === "qre" && p.id && <code style={chipStyle}>{p.id}</code>}
                  {p.type === "qre" && p.component && <code style={chipStyle}>{p.component}</code>}
                  <span style={{ marginLeft: 6 }}>{p.reason}</span>
                </li>
              ))}
            </ul>
          </ExplainRow>
        )}

        {/* For unavailable themes — surface the note explaining why */}
        {isUnavail && explain.note && (
          <ExplainRow label="Why this is unavailable">
            <span style={{ color: "var(--ink-700)", lineHeight: 1.5 }}>{explain.note}</span>
          </ExplainRow>
        )}
      </div>
    </details>
  );
};

const ExplainRow = ({ label, children }) => (
  <div>
    <div style={{ fontSize: "var(--fs-10)", textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--ink-500)", fontWeight: 600, marginBottom: 4 }}>
      {label}
    </div>
    <div>{children}</div>
  </div>
);

const BenchmarkLine = ({ b }) => {
  const band = Array.isArray(b.value_range) && b.value_range.length === 2
    ? `${b.value_range[0]}–${b.value_range[1]}${b.unit || ""}` : null;
  const src = b.source
    ? `${b.source}${b.year ? ` (${b.year})` : ""}${b.sample_size ? `, n=${b.sample_size}` : ""}${b.confidence ? `, ${b.confidence} confidence` : ""}`
    : null;
  const layer = b.layer && b.layer !== "function" ? b.layer : null;
  return (
    <div style={{ color: "var(--ink-800)", lineHeight: 1.5 }}>
      {band && <strong>typical {band}</strong>}
      {band && src && <span> · </span>}
      {src && <span>{src}</span>}
      {layer && (
        <span style={{ marginLeft: 8, fontSize: "var(--fs-10)", padding: "1px 6px",
                          background: "var(--brand-50)", color: "var(--brand-700)",
                          borderRadius: "var(--r-pill)", fontWeight: 600,
                          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {layer} overlay
        </span>
      )}
      {b.overridden && (
        <span style={{ marginLeft: 8, fontSize: "var(--fs-10)", padding: "1px 6px",
                          background: "var(--warn-50)", color: "var(--warn-700)",
                          borderRadius: "var(--r-pill)", fontWeight: 600,
                          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          engagement override
        </span>
      )}
    </div>
  );
};

const KBLink = ({ path, returnPath }) => {
  // Build /kb?root=&file=&return= URL. Heuristic: function-kb paths start
  // with the pillar slug (op-model/, doa/, etc.); industry overlays start
  // with industries/.
  let root = "function", rel = path;
  if (path.startsWith("industries/")) {
    root = "industries";
    rel = path.substring("industries/".length);
  } else if (path.startsWith("data-templates/") || path.startsWith("standards/")) {
    root = path.split("/")[0];
    rel = path.substring(root.length + 1);
  }
  const url = `/kb?root=${root}&file=${encodeURIComponent(rel)}${returnPath ? `&return=${encodeURIComponent(returnPath)}` : ""}`;
  return (
    <_RouterLink to={url} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
      color: "var(--brand-700)", textDecoration: "none",
    }}>
      <span>📄</span>
      <span>{path}</span>
      <span style={{ color: "var(--ink-400)", fontSize: 10 }}>→</span>
    </_RouterLink>
  );
};

const chipStyle = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: "var(--fs-11)",
  fontFamily: "var(--font-mono)",
  background: "var(--surface-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 3,
  color: "var(--ink-800)",
};
