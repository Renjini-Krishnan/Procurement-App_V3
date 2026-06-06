import React, { useMemo, useState } from "react";
import { Card, Badge, Callout, Input, Select, Tabs } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { useEngagement } from "../hooks/useEngagement.js";
import { useIntel } from "../hooks/useIntel.js";

/* Stage 9 — Category Classification (canonical taxonomy).
   Renders the 6-tier classifier output + 3-tab consultant review queue. */

const ARCHETYPE_TONES = {
  DIRECT: "var(--brand-600)",
  INDIRECT: "var(--success-600)",
  SERVICE: "var(--warn-600)",
  BULK: "var(--brand-800)",
  CAPEX: "var(--danger-600)",
  UNCLASSIFIED: "var(--ink-500)",
};

const CONF_TONE = {
  HIGH:         { bg: "var(--success-50)", fg: "var(--success-700)" },
  MEDIUM:       { bg: "var(--warn-50)",    fg: "var(--warn-700)" },
  LOW:          { bg: "var(--danger-50)",  fg: "var(--danger-700)" },
  UNCLASSIFIED: { bg: "var(--danger-50)",  fg: "var(--danger-700)" },
};

const Categorisation = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const { data, loading, error } = useIntel(engagement);
  const [tab, setTab] = useState("hero");

  if (engLoading || !engagement) return <div>Loading…</div>;
  if (loading) return <div><Header /><Card padding={32} style={{ marginTop: 24, textAlign: "center" }}><div style={{ color: "var(--ink-500)" }}>Running Stage 8 → 9 → 10…</div></Card></div>;
  if (error) return <div><Header /><Callout tone="danger" title="Categorisation failed" icon={<I.X size={16} />}>{error}</Callout></div>;
  if (!data) return null;

  const cc = data.canonical_classification;
  if (!cc) {
    return <div><Header /><Callout tone="warn" title="No canonical classification available">Run Stage 7/8 first to populate the gold dataset.</Callout></div>;
  }

  const tabs = [
    { id: "hero",   label: `Overview` },
    { id: "high",   label: `HIGH (${(cc.stats.confidence_distribution?.HIGH || 0).toLocaleString("en-IN")})` },
    { id: "medium", label: `MEDIUM (${(cc.stats.confidence_distribution?.MEDIUM || 0).toLocaleString("en-IN")})` },
    { id: "lowuncl",label: `LOW + UNCLASSIFIED (${((cc.stats.confidence_distribution?.LOW || 0) + (cc.stats.confidence_distribution?.UNCLASSIFIED || 0)).toLocaleString("en-IN")})` },
    { id: "mg",     label: `MG rollup (${cc.stats.clean_mgs} clean · ${cc.stats.mixed_mgs} mixed)` },
  ];

  return (
    <div>
      <Header />
      <div style={{ marginBottom: 16 }}>
        <Tabs items={tabs} value={tab} onChange={setTab} variant="pill" />
      </div>

      {tab === "hero" && <OverviewTab data={data} cc={cc} />}
      {tab === "high" && <ReviewTab cc={cc} confidence="HIGH" tone="success"
        prompt="Bulk-accept all HIGH-confidence assignments below. Each row was classified via Tier A (HSN), Tier C (text) + Tier D (vendor corroboration), or Tier B (clean-MG inheritance)." />}
      {tab === "medium" && <ReviewTab cc={cc} confidence="MEDIUM" tone="warn"
        prompt="MEDIUM-confidence assignments. Each row fired exactly one classification tier (text-only OR vendor-only). Spot-audit a sample; override anything questionable." />}
      {tab === "lowuncl" && <UnclassifiedTab cc={cc} />}
      {tab === "mg" && <MGRollupTab cc={cc} />}
    </div>
  );
};

// ─── Overview tab ─────────────────────────────────────────────────────────

const OverviewTab = ({ data, cc }) => {
  const conf = cc.stats.confidence_distribution || {};
  const tiers = cc.stats.tier_fired_counts || {};
  const total = cc.stats.total_rows || 0;
  const oldArchSummary = data.classify_summary?.by_archetype_rows || {};
  const oldArchSpend = data.classify_summary?.by_archetype_spend_inr || {};
  const grandTotal = Object.values(oldArchSpend).reduce((a, b) => a + b, 0);

  return (
    <>
      <Card padding={24}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>
              Canonical category classification · 6-tier accumulator
            </div>
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
              {cc.taxonomy_canonicals} canonicals in <code>shared-kb/industries/{cc.industry}/categories-master.yml</code>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "var(--fs-32)", fontWeight: 700, color: "var(--ink-900)", lineHeight: 1 }}>
              {(100 - (cc.stats.unclassified_pct || 0)).toFixed(1)}%
            </div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>
              {cc.stats.canonicals_assigned.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} rows assigned
            </div>
          </div>
        </div>

        <Label>Confidence distribution</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 8, marginBottom: 18 }}>
          {["HIGH", "MEDIUM", "LOW", "UNCLASSIFIED"].map((c) => {
            const n = conf[c] || 0;
            const pct = total ? ((100 * n) / total).toFixed(1) : 0;
            const tone = CONF_TONE[c];
            return (
              <div key={c} style={{ background: tone.bg, padding: 12, borderRadius: "var(--r-md)", borderLeft: `3px solid ${tone.fg}` }}>
                <div style={{ fontSize: "var(--fs-11)", color: tone.fg, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{c}</div>
                <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4, color: "var(--ink-900)" }}>{n.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-600)", marginTop: 2 }}>{pct}% of rows</div>
              </div>
            );
          })}
        </div>

        <Label>Tier fire counts</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 8 }}>
          {[
            ["A", "HSN/SAC"],
            ["B", "Clean-MG inherit"],
            ["C", "Text keywords"],
            ["D", "Vendor anchor"],
            ["F", "LLM (V2)"],
          ].map(([k, label]) => (
            <div key={k} style={{ background: "var(--surface-sunk)", padding: 10, borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase" }}>Tier {k}</div>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-700)", marginTop: 2 }}>{label}</div>
              <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 4 }}>{(tiers[k] || 0).toLocaleString("en-IN")}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={20} style={{ marginTop: 16 }}>
        <Label>Top 12 canonicals by row count</Label>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)", marginTop: 8 }}>
          <thead>
            <tr>
              {["Canonical", "Rows", "% of total"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(cc.canonical_distribution || {})
              .sort(([, a], [, b]) => b - a)
              .slice(0, 12)
              .map(([cid, n]) => {
                const meta = (cc.taxonomy || []).find((t) => t.id === cid);
                return (
                  <tr key={cid}>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontWeight: 500 }}>{meta?.label || cid}</span>
                      {meta && <ArchPill arch={meta.archetype} style={{ marginLeft: 8 }} />}
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{cid}</div>
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)" }}>{n.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{total ? ((100 * n) / total).toFixed(1) : 0}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>

      {/* Legacy archetype view kept visible for backward-compat */}
      {Object.keys(oldArchSummary).length > 0 && (
        <Card padding={20} style={{ marginTop: 16 }}>
          <Label>Archetype distribution (V1 classifier — pillar-facing)</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 8 }}>
            {Object.entries(oldArchSummary).map(([arch, count]) => {
              const spendCr = ((oldArchSpend[arch] || 0) / 1e7).toFixed(1);
              const pct = grandTotal ? (((oldArchSpend[arch] || 0) / grandTotal) * 100).toFixed(1) : 0;
              return (
                <div key={arch} style={{ borderTop: `3px solid ${ARCHETYPE_TONES[arch] || "var(--ink-300)"}`, background: "var(--surface-sunk)", padding: 10, borderRadius: "var(--r-md)" }}>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{arch}</div>
                  <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 4 }}>{count.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-600)", marginTop: 2 }}>POs · ₹{spendCr} Cr · {pct}%</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 8, fontStyle: "italic" }}>
            Downstream pillars (Stage 10+) currently key off archetype. Canonical_id is also on the gold df for future pillar refactors.
          </div>
        </Card>
      )}
    </>
  );
};

// ─── Review tab (HIGH or MEDIUM) ─────────────────────────────────────────

const ReviewTab = ({ cc, confidence, tone, prompt }) => {
  const samples = cc.samples_by_confidence?.[confidence] || [];
  const total = cc.stats.confidence_distribution?.[confidence] || 0;
  const [search, setSearch] = useState("");
  const [archFilter, setArchFilter] = useState("All");
  const [expanded, setExpanded] = useState(new Set());

  const rows = useMemo(() => {
    let r = samples;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        (x.material_group_desc || "").toLowerCase().includes(q) ||
        (x.canonical_label || "").toLowerCase().includes(q) ||
        (x.vendor_name || "").toLowerCase().includes(q) ||
        (x.po_number || "").toLowerCase().includes(q));
    }
    if (archFilter !== "All") {
      r = r.filter((x) => {
        const t = (cc.taxonomy || []).find((c) => c.id === x.canonical_id);
        return t?.archetype === archFilter;
      });
    }
    return r;
  }, [samples, search, archFilter, cc]);

  const toggle = (key) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  return (
    <>
      <Callout tone={tone === "success" ? "info" : tone} title={`${confidence}-confidence review queue`} icon={<I.Layers size={16} />}>
        {prompt}
        <div style={{ marginTop: 6 }}>
          Showing first <strong>{samples.length.toLocaleString("en-IN")}</strong> of <strong>{total.toLocaleString("en-IN")}</strong> rows (sample cap {cc.sample_cap}).
        </div>
      </Callout>

      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 12, alignItems: "center" }}>
        <Select value={archFilter} onChange={(e) => setArchFilter(e.target.value)}>
          <option>All</option>
          {["BULK", "DIRECT", "INDIRECT", "SERVICE", "CAPEX"].map((a) => <option key={a}>{a}</option>)}
        </Select>
        <div style={{ flex: 1 }}>
          <Input placeholder="Search MG desc / canonical / vendor / PO…" value={search}
                 onChange={(e) => setSearch(e.target.value)} icon={<I.Search size={14} />} />
        </div>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          {rows.length.toLocaleString("en-IN")} shown
        </span>
      </div>

      <Card padding={0}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr style={{ background: "var(--surface-sunk)" }}>
              {["", "PO", "MG / Desc", "Vendor", "Net value", "Canonical → archetype", "Tier(s)"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = `${r.po_number}/${r.po_item}/${i}`;
              const isOpen = expanded.has(key);
              const arch = (cc.taxonomy || []).find((t) => t.id === r.canonical_id)?.archetype;
              const tiers = [...new Set((r.signal_trace || []).map((s) => s.tier))].join(" + ");
              return (
                <React.Fragment key={key}>
                  <tr onClick={() => toggle(key)} style={{ cursor: "pointer" }}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-500)", width: 24 }}>
                      {isOpen ? "▾" : "▸"}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                      {r.po_number}/{r.po_item}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontWeight: 500 }}>{r.material_group_desc || <span style={{ color: "var(--ink-500)" }}>—</span>}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>MG: {r.material_group || "—"} · MTART: {r.material_type || "—"}</div>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-12)", color: "var(--ink-700)" }}>
                      {r.vendor_name || "—"}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
                      ₹{(r.net_value / 1e5).toFixed(1)} L
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontWeight: 500 }}>{r.canonical_label}</div>
                      {arch && <ArchPill arch={arch} />}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                      {tiers}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0, borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-sunk)" }}>
                        <SignalTrace row={r} cc={cc} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
};

// ─── Signal trace drawer ──────────────────────────────────────────────────

const SignalTrace = ({ row, cc }) => {
  const trace = row.signal_trace || [];
  const alts = row.alternatives || [];
  return (
    <div style={{ padding: "12px 24px" }}>
      <Label>Signal trace · score {row.winner_score}</Label>
      <table style={{ width: "100%", marginTop: 8, fontSize: "var(--fs-12)" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-500)", textTransform: "uppercase", fontSize: "var(--fs-11)", borderBottom: "1px solid var(--border-subtle)" }}>Tier</th>
            <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-500)", textTransform: "uppercase", fontSize: "var(--fs-11)", borderBottom: "1px solid var(--border-subtle)" }}>Signal</th>
            <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-500)", textTransform: "uppercase", fontSize: "var(--fs-11)", borderBottom: "1px solid var(--border-subtle)" }}>Weight</th>
          </tr>
        </thead>
        <tbody>
          {trace.length === 0 && <tr><td colSpan={3} style={{ padding: "8px", color: "var(--ink-500)", fontStyle: "italic" }}>No tier fired — UNCLASSIFIED</td></tr>}
          {trace.map((s, i) => (
            <tr key={i}>
              <td style={{ padding: "4px 8px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{s.tier}</td>
              <td style={{ padding: "4px 8px", color: "var(--ink-700)" }}>{s.signal}</td>
              <td style={{ padding: "4px 8px" }}>
                <span style={{ background: s.weight === "primary" ? "var(--brand-50)" : "var(--surface-card)",
                                color: s.weight === "primary" ? "var(--brand-700)" : "var(--ink-600)",
                                padding: "1px 8px", borderRadius: "var(--r-pill)",
                                fontSize: "var(--fs-11)", fontWeight: 600 }}>{s.weight}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {alts.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Label>Top alternative candidates</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {alts.map((a) => {
              const meta = (cc.taxonomy || []).find((t) => t.id === a.canonical_id);
              return (
                <span key={a.canonical_id} style={{
                  background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
                  padding: "3px 10px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)",
                  fontFamily: "var(--font-mono)", color: "var(--ink-700)",
                }}>
                  {meta?.label || a.canonical_id} · score {a.score}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── LOW + UNCLASSIFIED queue ─────────────────────────────────────────────

const UnclassifiedTab = ({ cc }) => {
  const lowRows = cc.samples_by_confidence?.LOW || [];
  const unclRows = cc.samples_by_confidence?.UNCLASSIFIED || [];
  const all = [...lowRows, ...unclRows];
  if (all.length === 0) {
    return (
      <Callout tone="success" title="Nothing to review" icon={<I.Check size={16} />}>
        Every row was classified with at least MEDIUM confidence. No LOW or UNCLASSIFIED rows in the queue.
      </Callout>
    );
  }
  return <ReviewTab cc={{ ...cc, samples_by_confidence: { ...cc.samples_by_confidence, MEDIUM: all } }}
                   confidence="MEDIUM"
                   tone="danger"
                   prompt="LOW or UNCLASSIFIED rows. Manual canonical assignment required. Signal trace shows why the engine couldn't classify." />;
};

// ─── MG rollup tab ────────────────────────────────────────────────────────

const MGRollupTab = ({ cc }) => {
  const clean = cc.clean_mg_roster || [];
  const mixed = cc.mixed_mg_roster || [];
  return (
    <>
      <Callout tone="info" title="MG rollup (Step 3 of framework)" icon={<I.Layers size={16} />}>
        For each material_group, count canonical assignments across its rows. Clean = ≥95% rows agree on one canonical (record MG→canonical map for reuse). Mixed = below threshold (keep row-level decisions only).
      </Callout>

      <Card padding={20} style={{ marginTop: 16 }}>
        <Label>Clean MGs ({clean.length}) · ≥95% agreement</Label>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)", marginTop: 8 }}>
          <thead>
            <tr>
              {["Material Group", "→ Canonical", "Share %", "Row count"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clean.slice(0, 30).map((r) => (
              <tr key={r.material_group}>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.material_group}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>{r.canonical_label} <span style={{ color: "var(--ink-500)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>({r.canonical_id})</span></td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)" }}>{r.share_pct}%</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)" }}>{r.row_count.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {mixed.length > 0 && (
        <Card padding={20} style={{ marginTop: 16 }}>
          <Label>Mixed MGs ({mixed.length}) · &lt;95% — row-level decisions kept</Label>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)", marginTop: 8 }}>
            <thead>
              <tr>
                {["Material Group", "Leading canonical", "Leading share %", "Row count"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mixed.slice(0, 30).map((r) => (
                <tr key={r.material_group}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{r.material_group}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>{r.leading_canonical_label} <span style={{ color: "var(--ink-500)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>({r.leading_canonical_id})</span></td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)" }}>{r.leading_share_pct}%</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)" }}>{r.row_count.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────

const ArchPill = ({ arch, style }) => (
  <span style={{
    background: `${ARCHETYPE_TONES[arch] || "var(--ink-300)"}22`,
    color: ARCHETYPE_TONES[arch] || "var(--ink-700)",
    padding: "2px 8px", borderRadius: "var(--r-pill)",
    fontSize: "var(--fs-11)", fontWeight: 600, display: "inline-block",
    ...(style || {}),
  }}>
    {arch}
  </span>
);

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Analyze</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 09</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Category Classification
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      6-tier canonical classifier (HSN · clean-MG · text · vendor · G/L · LLM) against industry taxonomy. Review by tier; drill in for the signal trace per row.
    </p>
  </div>
);

export default Categorisation;
