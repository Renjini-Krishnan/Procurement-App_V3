import React from "react";
import { Card, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";

/* Stage 3 — Guidelines. Engagement-specific ground rules. */

const ITEMS = [
  { title: "Confidentiality", body: "All uploaded data is encrypted at rest. Synthetic anonymisation applied to PO copies sent to the analytics engine. No data leaves Indian-region storage." },
  { title: "Data sharing", body: "Engagement-scoped access only. Consultant + client owner can view findings; KB authors can edit thresholds but not raw data." },
  { title: "Sign-off cadence", body: "Findings deck reviewed at end of Diagnostic phase. Each pillar's outputs require consultant confirmation before propagating to KPI dashboard." },
  { title: "Citations", body: "Every benchmark, threshold, and recommendation traces to a source + year + confidence. No vague consulting-speak." },
  { title: "Override authority", body: "Function defaults are immutable per engagement. Industry overlays apply automatically. Engagement-level overrides (Build 2) require dual sign-off." },
];

const Guidelines = () => (
  <div>
    <Header />
    <Callout tone="info" title="Procvault is built around defensibility" icon={<I.Doc size={16} />}>
      These guidelines apply automatically — there is no opt-out for cited sources or scoped access.
    </Callout>
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      {ITEMS.map((it, i) => (
        <Card key={i} padding={20}>
          <div style={{ fontSize: "var(--fs-12)", color: "var(--brand-700)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, marginBottom: 6 }}>{it.title}</div>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.5, margin: 0 }}>{it.body}</p>
        </Card>
      ))}
    </div>
  </div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 03</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Engagement guidelines
    </h1>
  </div>
);

export default Guidelines;
