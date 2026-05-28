import React, { useEffect, useState } from "react";
import { Card, Button, Input, Select, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 1 — Client profile.
   Displays + edits client name, industry, sub-segment, plants, spend, FTEs.
   These values flow into denominators (spend/FTE) + industry overlay selection. */

const SUB_SEGMENTS_BY_INDUSTRY = {
  steel: ["integrated_steel_mill_multi_plant", "integrated_steel_mill_single_plant", "long_products_mini_mill", "specialty_steel"],
  cement: ["integrated_cement_plant", "grinding_unit"],
};

const Client = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    setForm({
      client_name: engagement.client_name || "",
      industry: engagement.industry || "steel",
      sub_segment: engagement.sub_segment || SUB_SEGMENTS_BY_INDUSTRY[engagement.industry || "steel"][0],
      plants_str: (engagement.plants || []).join(", "),
      annual_spend_inr_cr: engagement.annual_spend_inr_cr ?? "",
      annual_revenue_inr_cr: engagement.annual_revenue_inr_cr ?? "",
      fte_count: engagement.fte_count ?? "",
    });
  }, [engagement]);

  if (engLoading || !engagement || !form) return <div>Loading…</div>;

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const payload = {
        client_name: form.client_name.trim(),
        industry: form.industry,
        sub_segment: form.sub_segment || null,
        plants: form.plants_str.split(",").map((p) => p.trim()).filter(Boolean),
        annual_spend_inr_cr: form.annual_spend_inr_cr === "" ? null : Number(form.annual_spend_inr_cr),
        annual_revenue_inr_cr: form.annual_revenue_inr_cr === "" ? null : Number(form.annual_revenue_inr_cr),
        fte_count: form.fte_count === "" ? null : Number(form.fte_count),
      };
      await api.updateEngagement(engagement.id, payload);
      setMsg("Client profile saved.");
    } catch (e) {
      setErr(e.body?.detail || e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header />
      <Card padding={24}>
        <div style={{ display: "grid", gap: 16 }}>
          <Field label="Client name">
            <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Industry">
              <Select value={form.industry} onChange={(e) => {
                update("industry", e.target.value);
                update("sub_segment", SUB_SEGMENTS_BY_INDUSTRY[e.target.value][0]);
              }}>
                <option value="steel">Steel</option>
                <option value="cement">Cement</option>
              </Select>
            </Field>
            <Field label="Sub-segment">
              <Select value={form.sub_segment} onChange={(e) => update("sub_segment", e.target.value)}>
                {SUB_SEGMENTS_BY_INDUSTRY[form.industry].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Plants (comma-separated)" hint="Drives multi-plant centralisation detection.">
            <Input value={form.plants_str} onChange={(e) => update("plants_str", e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Annual spend (₹ Cr)">
              <Input type="number" value={form.annual_spend_inr_cr}
                     onChange={(e) => update("annual_spend_inr_cr", e.target.value)} />
            </Field>
            <Field label="Annual revenue (₹ Cr)">
              <Input type="number" value={form.annual_revenue_inr_cr}
                     onChange={(e) => update("annual_revenue_inr_cr", e.target.value)} />
            </Field>
            <Field label="Procurement FTEs" hint="Spend / FTE benchmark uses this">
              <Input type="number" value={form.fte_count}
                     onChange={(e) => update("fte_count", e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {msg && <div style={{ marginTop: 16 }}><Callout tone="success" title={msg} icon={<I.Check size={16} />} /></div>}
      {err && <div style={{ marginTop: 16 }}><Callout tone="danger" title="Save failed" icon={<I.X size={16} />}>{err}</Callout></div>}

      <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 01</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Client profile
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Core engagement settings. FTE + spend are denominators in productivity benchmarks.
    </p>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <label style={{ display: "block", fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-600)", fontWeight: 600, marginBottom: 6 }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>{hint}</div>}
  </div>
);

export default Client;
