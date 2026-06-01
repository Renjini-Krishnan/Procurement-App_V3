import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Agent Trace — observability for every LLM call. Shows the last 100
   calls with call_site, prompt preview, response preview, latency, and
   fallback status. Refreshes every 3 s. */

const AgentTrace = () => {
  const { engagement } = useEngagement();
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterEngagement, setFilterEngagement] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

  const refresh = async () => {
    try {
      const r = await api.llmTrace(filterEngagement && engagement ? engagement.id : null, 100);
      setTrace(r);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [engagement, filterEngagement]);

  const clear = async () => {
    if (!confirm("Clear all trace entries on the server? This affects all engagements on this instance.")) return;
    await api.llmTraceClear();
    refresh();
  };

  const toggle = (id) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  if (loading) return <div><Header />Loading trace…</div>;

  const entries = trace?.entries || [];
  const aiEnabled = trace?.ai_enabled;
  const fallbackCount = entries.filter((e) => e.used_fallback).length;
  const liveCount = entries.length - fallbackCount;

  return (
    <div>
      <Header />

      <Card padding={20} style={{ marginBottom: 16,
                                       borderLeft: `4px solid ${aiEnabled ? "var(--success-500)" : "var(--warn-500)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)" }}>
              AI status
            </div>
            <div style={{ fontSize: "var(--fs-20)", fontWeight: 600, marginTop: 4 }}>
              {aiEnabled ? "Live — Vertex AI connected" : "Fallback mode (deterministic templates)"}
            </div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 4 }}>
              Model: <code>{trace?.model || "—"}</code>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>Last 100 calls</div>
            <div style={{ fontSize: "var(--fs-22)", fontWeight: 600, marginTop: 4 }}>
              <span style={{ color: "var(--success-700)" }}>{liveCount} live</span>
              <span style={{ color: "var(--ink-500)", margin: "0 8px" }}>·</span>
              <span style={{ color: "var(--warn-700)" }}>{fallbackCount} fallback</span>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <label style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)" }}>
          <input type="checkbox" checked={filterEngagement} onChange={(e) => setFilterEngagement(e.target.checked)} style={{ marginRight: 8 }} />
          Show only calls for this engagement
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
          <Button variant="outline" onClick={clear}>Clear all</Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
          {aiEnabled
            ? "No LLM calls recorded yet. Visit a pillar screen to trigger AI narratives."
            : "AI is in fallback mode (Vertex AI / ADC unavailable). All call sites are using deterministic templates. Set up ADC and refresh to see live calls."}
        </Card>
      ) : (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunk)" }}>
                {["", "Time", "Call site", "Status", "Latency", "Prompt → response"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isOpen = expanded.has(e.id);
                const isFallback = e.used_fallback;
                const tone = isFallback ? { bg: "var(--warn-50)", fg: "var(--warn-700)" }
                                        : { bg: "var(--success-50)", fg: "var(--success-700)" };
                return (
                  <React.Fragment key={e.id}>
                    <tr onClick={() => toggle(e.id)} style={{ cursor: "pointer" }}>
                      <td style={{ ...td, width: 24, color: "var(--ink-500)" }}>{isOpen ? "▾" : "▸"}</td>
                      <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-600)" }}>
                        {new Date(e.ts * 1000).toLocaleTimeString()}
                      </td>
                      <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{e.call_site}</td>
                      <td style={td}>
                        <span style={{ background: tone.bg, color: tone.fg, padding: "2px 8px",
                                         borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>
                          {isFallback ? "fallback" : "live"}
                        </span>
                      </td>
                      <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)", textAlign: "right" }}>
                        {e.latency_ms} ms
                      </td>
                      <td style={{ ...td, color: "var(--ink-700)", fontSize: "var(--fs-12)" }}>
                        {e.prompt_preview.split("\n")[0].slice(0, 80)}…
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: "var(--surface-sunk)", borderBottom: "1px solid var(--border-subtle)" }}>
                          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <Label>Prompt ({e.prompt_chars} chars)</Label>
                              <pre style={preStyle}>{e.prompt_preview}{e.prompt_chars > 280 ? `\n…(${e.prompt_chars - 280} more)` : ""}</pre>
                            </div>
                            <div>
                              <Label>{isFallback ? "Fallback used" : "Response"} ({e.response_chars} chars)</Label>
                              <pre style={preStyle}>{e.response_preview}{e.response_chars > 280 ? `\n…(${e.response_chars - 280} more)` : ""}</pre>
                            </div>
                          </div>
                          {e.error && (
                            <div style={{ padding: "0 16px 12px", fontSize: "var(--fs-12)", color: "var(--danger-700)" }}>
                              <strong>Error:</strong> {e.error}
                            </div>
                          )}
                          {e.engagement_id && (
                            <div style={{ padding: "0 16px 12px", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
                              engagement_id: <code style={{ fontFamily: "var(--font-mono)" }}>{e.engagement_id}</code>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

const th = { textAlign: "left", padding: "10px 12px", fontSize: "var(--fs-11)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--ink-500)", borderBottom: "1px solid var(--border-default)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
              color: "var(--ink-800)" };
const preStyle = { fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
                    background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--r-md)", padding: 10, margin: 0,
                    maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap" };

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "var(--ink-500)", marginBottom: 6 }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Observability</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
        Agent Trace
      </span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Agent activity
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Every LLM call recorded — call site · prompt preview · response · latency · live or fallback.
      Updates every 3 s. Use this to audit what the AI did during a session.
    </p>
  </div>
);

export default AgentTrace;
