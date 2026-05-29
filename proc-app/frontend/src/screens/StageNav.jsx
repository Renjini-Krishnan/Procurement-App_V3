import React from "react";
import { Link, useParams } from "react-router-dom";
import { STAGES } from "../data/stages.js";
import { I } from "../design/icons.jsx";

/* Universal Previous / Next stage navigator.
   Mounted by WorkspaceShell so every stage screen gets it for free.
   Skips locked stages. */

const StageNav = () => {
  const { engagementId, stageSlug } = useParams();
  if (!engagementId || !stageSlug) return null;

  const unlocked = STAGES.filter((s) => !s.locked);
  const idx = unlocked.findIndex((s) => s.slug === stageSlug);
  if (idx === -1) return null;
  const prev = idx > 0 ? unlocked[idx - 1] : null;
  const next = idx < unlocked.length - 1 ? unlocked[idx + 1] : null;
  const current = unlocked[idx];

  const linkStyle = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 16px",
    fontSize: "var(--fs-14)", fontWeight: 500,
    borderRadius: "var(--r-md)",
    textDecoration: "none",
    border: "1px solid var(--border-default)",
    background: active ? "var(--brand-600)" : "var(--surface-card)",
    color: active ? "white" : "var(--ink-800)",
    cursor: "pointer",
  });

  return (
    <div style={{
      marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border-subtle)",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
    }}>
      <div>
        {prev && (
          <Link to={`/engagement/${engagementId}/${prev.slug}`} style={linkStyle(false)}>
            <span style={{ transform: "rotate(180deg)" }}><I.Arrow size={14} /></span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
              <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
                ← Stage {String(prev.id).padStart(2, "0")}
              </span>
              <span>{prev.name}</span>
            </span>
          </Link>
        )}
      </div>

      <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
        {idx + 1} / {unlocked.length}
      </div>

      <div>
        {next && (
          <Link to={`/engagement/${engagementId}/${next.slug}`} style={linkStyle(true)}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
              <span style={{ fontSize: "var(--fs-11)", opacity: 0.8 }}>
                Stage {String(next.id).padStart(2, "0")} →
              </span>
              <span>{next.name}</span>
            </span>
            <I.Arrow size={14} />
          </Link>
        )}
      </div>
    </div>
  );
};

export default StageNav;
