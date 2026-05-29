import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";

/* SignoffWidget — honours scope.sign_off_cadence from Stage 2.
   Persists per-scope sign-off via engagement_overrides key `signoff.<scope>`.

   Cadence mapping (read from kb scope-config + override):
     continuous     -> widget hidden
     end-of-pillar  -> widget shown on each pillar screen (scope = pillar id)
     end-of-phase   -> widget shown on Exec Summary (scope = phase id)
*/

const SignoffWidget = ({ engagementId, scope, label, expectedCadence }) => {
  const [cadence, setCadence] = useState(null);
  const [signoff, setSignoff] = useState(null);  // {ts, by} or null
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!engagementId) return;
    api.listOverrides(engagementId).then((r) => {
      const ov = (r.overrides || []).reduce((acc, o) => { acc[o.key] = o.value; return acc; }, {});
      setCadence(ov["scope.sign_off_cadence"] || "end-of-phase");
      setSignoff(ov[`signoff.${scope}`] || null);
    }).catch(() => {});
  }, [engagementId, scope]);

  if (!engagementId || cadence === null) return null;
  if (cadence !== expectedCadence) return null;   // wrong screen for this cadence

  const sign = async () => {
    setSaving(true);
    try {
      const entry = { ts: new Date().toISOString(), signed: true };
      await api.upsertOverride(engagementId, `signoff.${scope}`, entry, "signoff");
      setSignoff(entry);
    } catch (e) {
      alert("Sign-off failed: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const unsign = async () => {
    if (!confirm(`Clear sign-off for ${label}?`)) return;
    setSaving(true);
    try {
      await api.deleteOverride(engagementId, `signoff.${scope}`);
      setSignoff(null);
    } catch (e) {
      alert(e.message || e);
    } finally {
      setSaving(false);
    }
  };

  const isSigned = !!signoff?.signed;

  return (
    <Card padding={20} style={{
      marginTop: 32,
      borderLeft: `4px solid ${isSigned ? "var(--success-500)" : "var(--warn-500)"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Badge tone={isSigned ? "success" : "warn"}>
              {isSigned ? "Signed off" : "Awaiting sign-off"}
            </Badge>
            <span style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
              scope = {scope}
            </span>
          </div>
          <div style={{ fontSize: "var(--fs-14)", fontWeight: 600 }}>
            {isSigned ? `${label} signed off` : `${label} needs sign-off`}
          </div>
          {isSigned && signoff?.ts && (
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 4 }}>
              {new Date(signoff.ts).toLocaleString()}
            </div>
          )}
          {!isSigned && (
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 4 }}>
              Cadence <code style={{ fontFamily: "var(--font-mono)" }}>{cadence}</code> from Stage 2 requires consultant sign-off here before moving on.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isSigned
            ? <Button variant="outline" onClick={unsign} disabled={saving}>Clear sign-off</Button>
            : <Button onClick={sign} disabled={saving} iconRight={<I.Check size={14} />}>{saving ? "Saving…" : `Sign off ${label}`}</Button>}
        </div>
      </div>
    </Card>
  );
};

export default SignoffWidget;
