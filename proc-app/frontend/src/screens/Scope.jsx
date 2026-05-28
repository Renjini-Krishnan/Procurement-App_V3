import React from "react";
import { Card, Badge } from "../design/components.jsx";

/* Stage 2 — Scope. V1 keeps this lightweight: shows which pillars are in
   scope (hard-wired to the 4 V1 pillars) + time horizon + deliverables. */

const Scope = () => (
  <div>
    <Header />

    <Card padding={24} style={{ marginBottom: 16 }}>
      <Label>Pillars in scope</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
        {[
          { id: "op-model", label: "Op Model", themes: 4 },
          { id: "org-structure", label: "Org Structure", themes: 4 },
          { id: "buying-channel", label: "Buying Channel", themes: 1, components: 13 },
          { id: "doa", label: "Delegation of Authority", themes: 5 },
        ].map((p) => (
          <Card key={p.id} padding={16}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>
              {p.themes} themes{p.components ? ` · ${p.components} components` : ""}
            </div>
          </Card>
        ))}
      </div>
    </Card>

    <Card padding={24} style={{ marginBottom: 16 }}>
      <Label>Out of scope (V1)</Label>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {["Material Master", "PR-to-PO", "Post-PO", "Supplier"].map((x) => (
          <Card key={x} padding={14} style={{ opacity: 0.65 }}>
            <div style={{ fontSize: "var(--fs-13)" }}>{x}</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>Planned · Build 2</div>
          </Card>
        ))}
      </div>
    </Card>

    <Card padding={24}>
      <Label>Time horizon · Deliverables</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>Lookback window</div>
          <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 2 }}>Last 12 months PO data</div>
        </div>
        <div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>Output</div>
          <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 2 }}>Findings deck + KPI dashboard</div>
        </div>
      </div>
    </Card>
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 02</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Engagement scope
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Pillars in / out of scope, lookback window, deliverables.
    </p>
  </div>
);

export default Scope;
