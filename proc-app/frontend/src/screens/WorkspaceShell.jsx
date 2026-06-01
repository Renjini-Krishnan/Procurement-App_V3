import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Logo } from "../design/Logo.jsx";
import { Badge } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { STAGES, PHASE_ORDER } from "../data/stages.js";
import { useEngagement } from "../hooks/useEngagement.js";
import { useViewMode, CLIENT_VIEW_ALLOWED_STAGES } from "../hooks/useViewMode.js";
import { api } from "../api/client.js";
import StageNav from "./StageNav.jsx";

const INDUSTRIES = ["steel", "cement"];

/* WorkspaceShell — left stage rail + main canvas.
   Adapted from /tmp/design_system/ds-screens.jsx WorkspaceShell pattern.
   The current route's stage slug is highlighted. */

const PHASE_ICONS = {
  Diagnostic: <I.Layers size={12} />,
  Analyze: <I.Chart size={12} />,
  Output: <I.Doc size={12} />,
};

const STATUS_DOT = (s) => {
  if (s === "done") return "var(--success-500)";
  if (s === "active") return "var(--brand-600)";
  return "var(--ink-300)";
};

const Rail = () => {
  const loc = useLocation();
  const { engagementId } = useParams();
  const activeSlug = loc.pathname.split("/").pop();
  const { engagement } = useEngagement();
  const viewMode = useViewMode();
  const isClient = viewMode === "client";

  return (
    <aside
      aria-label="Engagement workflow"
      style={{
        width: 280,
        background: "var(--surface-card)",
        borderRight: "1px solid var(--border-subtle)",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        padding: "20px 0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* logo */}
      <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <Logo />
        </Link>
      </div>

      {/* engagement label */}
      <div style={{ padding: "16px 20px 8px" }}>
        <div
          style={{
            fontSize: "var(--fs-11)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--ink-500)",
            marginBottom: 4,
          }}
        >
          Engagement
        </div>
        <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-900)" }}>
          {engagement?.client_name || "Loading…"}
        </div>
        {isClient && (
          <div style={{ marginTop: 6 }}>
            <span style={{ display: "inline-block", padding: "3px 10px",
                            background: "var(--brand-600)", color: "white",
                            borderRadius: "var(--r-pill)",
                            fontSize: "var(--fs-10)", fontWeight: 700,
                            letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Client view
            </span>
            <Link to={`/engagement/${engagementId}/guidelines`}
                  style={{ marginLeft: 8, fontSize: "var(--fs-11)", color: "var(--brand-600)" }}>
              switch ↔
            </Link>
          </div>
        )}
        {engagement && !isClient && <IndustrySwitcher engagement={engagement} />}
      </div>

      {/* phases + stages */}
      {PHASE_ORDER.map((phase) => {
        const stages = STAGES
          .filter((s) => s.phase === phase)
          .filter((s) => !isClient || CLIENT_VIEW_ALLOWED_STAGES.has(s.slug));
        if (stages.length === 0) return null;
        return (
          <div key={phase} style={{ padding: "16px 20px 4px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--fs-11)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-500)",
                marginBottom: 8,
              }}
            >
              {PHASE_ICONS[phase]}
              {phase}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {stages.map((s) => {
                const isActive = activeSlug === s.slug;
                const isLocked = !!s.locked;
                const target = isLocked ? "#" : `/engagement/${engagementId}/${s.slug}`;
                return (
                  <Link
                    key={s.id}
                    to={target}
                    onClick={(e) => isLocked && e.preventDefault()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 8px",
                      borderRadius: "var(--r-md)",
                      background: isActive ? "var(--brand-50)" : "transparent",
                      color: isLocked ? "var(--ink-400)" : (isActive ? "var(--brand-700)" : "var(--ink-800)"),
                      fontSize: "var(--fs-13)",
                      fontWeight: isActive ? 600 : 400,
                      textDecoration: "none",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      opacity: isLocked ? 0.55 : 1,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: STATUS_DOT(isActive ? "active" : s.status),
                        flex: "0 0 auto",
                      }}
                    />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-400)", width: 22 }}>
                      {String(s.id).padStart(2, "0")}
                    </span>
                    <span>{s.name}</span>
                    {isLocked && (
                      <span style={{ marginLeft: "auto" }}>
                        <Badge tone="neutral" style={{ fontSize: "10px" }}>locked</Badge>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* KB editor — workflow-wide, not engagement-scoped */}
      <div style={{ padding: "20px 20px 16px", marginTop: "auto",
                       borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)",
                         textTransform: "uppercase", letterSpacing: "0.12em",
                         marginBottom: 8 }}>
          Knowledge Base
        </div>
        <Link to="/kb" style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", borderRadius: "var(--r-md)",
          background: "var(--brand-50)", color: "var(--brand-700)",
          textDecoration: "none", fontSize: "var(--fs-13)", fontWeight: 600,
        }}>
          <span style={{ fontSize: 16 }}>📚</span>
          <span>KB Editor</span>
          <span style={{ marginLeft: "auto", fontSize: "var(--fs-10)",
                           color: "var(--ink-500)", fontWeight: 400 }}>→</span>
        </Link>
        <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)",
                         marginTop: 6, lineHeight: 1.4 }}>
          Edit benchmarks, scoring descriptors, taxonomies, QRE questions, and cleansing rules.
        </div>
      </div>
    </aside>
  );
};

const IndustrySwitcher = ({ engagement }) => {
  const [switching, setSwitching] = useState(false);
  const switchTo = async (ind) => {
    if (ind === engagement.industry || switching) return;
    if (!confirm(`Switch industry to "${ind}"? Pillars will re-run with the ${ind} overlay on next visit.`)) return;
    setSwitching(true);
    try {
      await api.updateEngagement(engagement.id, { ...engagement, industry: ind });
      window.location.reload();
    } catch (e) {
      alert("Failed to switch: " + (e.message || e));
      setSwitching(false);
    }
  };
  return (
    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
        {(engagement.plants || []).length} plants · ₹{engagement.annual_spend_inr_cr ?? "—"} Cr
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {INDUSTRIES.map((ind) => (
          <button key={ind} onClick={() => switchTo(ind)} disabled={switching}
                  style={{
                    fontSize: "var(--fs-10)", padding: "2px 8px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--r-pill)",
                    background: engagement.industry === ind ? "var(--brand-600)" : "var(--surface-raised)",
                    color: engagement.industry === ind ? "white" : "var(--ink-600)",
                    cursor: switching ? "wait" : "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
            {ind}
          </button>
        ))}
      </div>
    </div>
  );
};

const WorkspaceShell = ({ children }) => (
  <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-page)" }}>
    <a href="#main" className="sr-only skip-link">Skip to main content</a>
    <Rail />
    <main id="main" tabIndex={-1} style={{ flex: 1, padding: "32px 40px" }}>
      {children}
      <StageNav />
    </main>
  </div>
);

export default WorkspaceShell;
