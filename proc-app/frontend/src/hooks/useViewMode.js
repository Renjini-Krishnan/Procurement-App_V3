/* useViewMode — reads the engagement's view.mode override.

   View modes:
     consultant (default) - full access to every stage
     client                - rail shows only Findings Deck + Exec Summary;
                            other URLs redirect to Findings Deck

   Honour-based — no auth. Documented in Stage 3 Guidelines. */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";

export const CLIENT_VIEW_ALLOWED_STAGES = new Set([
  "findings-deck",
  "exec-summary",
  "guidelines",  // always reachable so the user can toggle back
]);

export function useViewMode() {
  const { engagementId } = useParams();
  const [mode, setMode] = useState(null);  // null = still loading

  useEffect(() => {
    if (!engagementId || engagementId === "demo" || engagementId === "new") {
      setMode("consultant");
      return;
    }
    let cancelled = false;
    api.listOverrides(engagementId).then((r) => {
      if (cancelled) return;
      const m = (r.overrides || []).find((o) => o.key === "view.mode")?.value;
      setMode(m === "client" ? "client" : "consultant");
    }).catch(() => { if (!cancelled) setMode("consultant"); });
    return () => { cancelled = true; };
  }, [engagementId]);

  return mode;
}
