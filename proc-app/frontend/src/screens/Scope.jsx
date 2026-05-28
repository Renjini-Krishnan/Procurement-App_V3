import React, { useEffect, useState } from "react";
import { Card, Badge, Button, Callout, Input, Select } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 2 — Scope. Real selection now persisted to engagement_overrides.
   Selected pillars filter the KPI Dashboard + Findings Deck. */

const V1_PILLARS = [
  { id: "op-model",       label: "Operating Model",          themes: 4, components: 24, status: "available" },
  { id: "org-structure",  label: "Organisation Structure",   themes: 4, components: 19, status: "available" },
  { id: "buying-channel", label: "Buying Channel Strategy",  themes: 1, components: 13, status: "available" },
  { id: "doa",            label: "Delegation of Authority",  themes: 5, components: 18, status: "available" },
];

const V2_PILLARS = [
  { id: "material-master", label: "Material Master", note: "Master-data quality + dedup + creation TAT", status: "v2" },
  { id: "pr-to-po",        label: "PR-to-PO",        note: "TAT, automation, RFQ, LPO savings",          status: "v2" },
  { id: "post-po",         label: "Post-PO",         note: "OTD, defect rate, 3-way match, DPO",         status: "v2" },
  { id: "supplier",        label: "Supplier",        note: "Onboarding TAT, performance scorecards",     status: "v2" },
];

const DELIVERABLES = [
  { id: "findings-deck",  label: "Findings deck (PPT)" },
  { id: "exec-summary",   label: "Executive summary (PPT)" },
  { id: "kpi-dashboard",  label: "KPI dashboard (interactive)" },
  { id: "kpi-excel",      label: "KPI export (Excel)" },
];

const Scope = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [selectedPillars, setSelectedPillars] = useState(new Set(["op-model", "org-structure", "buying-channel", "doa"]));
  const [selectedDeliverables, setSelectedDeliverables] = useState(new Set(["findings-deck", "exec-summary", "kpi-dashboard", "kpi-excel"]));
  const [lookbackMonths, setLookbackMonths] = useState(12);
  const [signOffCadence, setSignOffCadence] = useState("end-of-phase");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Load existing scope from overrides
  useEffect(() => {
    if (!engagement) return;
    (async () => {
      try {
        const r = await api.listOverrides(engagement.id);
        const ov = (r.overrides || []).reduce((acc, o) => { acc[o.key] = o.value; return acc; }, {});
        if (Array.isArray(ov["scope.pillars"]))      setSelectedPillars(new Set(ov["scope.pillars"]));
        if (Array.isArray(ov["scope.deliverables"])) setSelectedDeliverables(new Set(ov["scope.deliverables"]));
        if (typeof ov["scope.lookback_months"] === "number")  setLookbackMonths(ov["scope.lookback_months"]);
        if (typeof ov["scope.sign_off_cadence"] === "string") setSignOffCadence(ov["scope.sign_off_cadence"]);
      } catch (e) { /* first-time engagement: defaults fine */ }
    })();
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading…</div>;

  const toggle = (set, setter) => (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
    setMsg(null);
  };
  const togglePillar = toggle(selectedPillars, setSelectedPillars);
  const toggleDeliverable = toggle(selectedDeliverables, setSelectedDeliverables);

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      await Promise.all([
        api.upsertOverride(engagement.id, "scope.pillars",       Array.from(selectedPillars),     "scope"),
        api.upsertOverride(engagement.id, "scope.deliverables",  Array.from(selectedDeliverables),"scope"),
        api.upsertOverride(engagement.id, "scope.lookback_months", Number(lookbackMonths),        "scope"),
        api.upsertOverride(engagement.id, "scope.sign_off_cadence", signOffCadence,               "scope"),
      ]);
      setMsg("Scope saved. KPI dashboard + Findings deck will respect this selection on next run.");
    } catch (e) {
      setErr(e.body?.detail || e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header />

      <Card padding={24} style={{ marginBottom: 16 }}>
        <SectionHeader title="Pillars in scope" count={`${selectedPillars.size} of ${V1_PILLARS.length} V1 pillars selected`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
          {V1_PILLARS.map((p) => {
            const checked = selectedPillars.has(p.id);
            return (
              <PillarCheckbox
                key={p.id}
                checked={checked}
                onChange={() => togglePillar(p.id)}
                label={p.label}
                sublabel={`${p.themes} themes · ${p.components} components`}
              />
            );
          })}
        </div>
      </Card>

      <Card padding={24} style={{ marginBottom: 16 }}>
        <SectionHeader title="Additional pillars (Build 2)" count="Engines pending — select to enable when shipped" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
          {V2_PILLARS.map((p) => (
            <PillarCheckbox
              key={p.id}
              checked={selectedPillars.has(p.id)}
              disabled
              onChange={() => {}}
              label={p.label}
              sublabel={p.note}
              tag="v2"
            />
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>
          Schemas + seed data for these pillars are already loaded (see Stage 4 → file-type dropdown). Engines arrive in Build 2.
        </div>
      </Card>

      <Card padding={24} style={{ marginBottom: 16 }}>
        <SectionHeader title="Deliverables" count={`${selectedDeliverables.size} selected`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
          {DELIVERABLES.map((d) => (
            <PillarCheckbox
              key={d.id}
              checked={selectedDeliverables.has(d.id)}
              onChange={() => toggleDeliverable(d.id)}
              label={d.label}
              sublabel={null}
            />
          ))}
        </div>
      </Card>

      <Card padding={24} style={{ marginBottom: 16 }}>
        <SectionHeader title="Time horizon & cadence" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          <div>
            <Sublabel>Lookback window (months)</Sublabel>
            <Input type="number" min={1} max={36} value={lookbackMonths}
                   onChange={(e) => { setLookbackMonths(e.target.value); setMsg(null); }} />
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>
              Restricts PO/PR data window. Engines today read everything available; this becomes enforceable when re-runs are scoped.
            </div>
          </div>
          <div>
            <Sublabel>Sign-off cadence</Sublabel>
            <Select value={signOffCadence} onChange={(e) => { setSignOffCadence(e.target.value); setMsg(null); }}>
              <option value="end-of-phase">End of each phase (default)</option>
              <option value="end-of-pillar">After each pillar run</option>
              <option value="continuous">Continuous (no formal gates)</option>
            </Select>
          </div>
        </div>
      </Card>

      {msg && <div style={{ marginBottom: 12 }}><Callout tone="success" title={msg} icon={<I.Check size={16} />} /></div>}
      {err && <div style={{ marginBottom: 12 }}><Callout tone="danger" title="Save failed" icon={<I.X size={16} />}>{err}</Callout></div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button onClick={save} disabled={saving || selectedPillars.size === 0}>
          {saving ? "Saving…" : "Save scope"}
        </Button>
      </div>
    </div>
  );
};

const PillarCheckbox = ({ checked, onChange, label, sublabel, disabled, tag }) => (
  <label style={{
    display: "flex", alignItems: "flex-start", gap: 12, padding: 14,
    border: `1px solid ${checked ? "var(--brand-500)" : "var(--border-default)"}`,
    background: checked ? "var(--brand-50)" : "var(--surface-card)",
    borderRadius: "var(--r-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  }}>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
           style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--brand-600)" }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-900)" }}>
        {label}
        {tag && (
          <span style={{
            marginLeft: 8, padding: "1px 6px", borderRadius: "var(--r-pill)",
            background: "var(--warn-50)", color: "var(--warn-700)",
            fontSize: "var(--fs-10)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>{tag}</span>
        )}
      </div>
      {sublabel && (
        <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 2 }}>{sublabel}</div>
      )}
    </div>
  </label>
);

const SectionHeader = ({ title, count }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{title}</div>
    {count && <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>{count}</div>}
  </div>
);

const Sublabel = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-600)", fontWeight: 600, marginBottom: 6 }}>{children}</div>
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
      Choose which pillars + deliverables are in scope. Filters the KPI dashboard, findings deck, and exec summary.
    </p>
  </div>
);

export default Scope;
