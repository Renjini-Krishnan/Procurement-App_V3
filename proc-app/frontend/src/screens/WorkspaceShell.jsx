import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Logo } from "../design/Logo.jsx";
import { Badge } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { STAGES, PHASE_ORDER } from "../data/stages.js";
import { useEngagement } from "../hooks/useEngagement.js";

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

  return (
    <aside
      style={{
        width: 280,
        background: "var(--surface-card)",
        borderRight: "1px solid var(--border-subtle)",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        padding: "20px 0",
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
        <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 2 }}>
          {engagement
            ? `${engagement.industry} · ${(engagement.plants || []).length} plants · ₹${engagement.annual_spend_inr_cr ?? "—"} Cr`
            : ""}
        </div>
      </div>

      {/* phases + stages */}
      {PHASE_ORDER.map((phase) => {
        const stages = STAGES.filter((s) => s.phase === phase);
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
    </aside>
  );
};

const WorkspaceShell = ({ children }) => (
  <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-page)" }}>
    <Rail />
    <main style={{ flex: 1, padding: "32px 40px" }}>{children}</main>
  </div>
);

export default WorkspaceShell;
