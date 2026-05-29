import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Input, Select, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { Logo } from "../design/Logo.jsx";
import { api } from "../api/client.js";

/* New engagement form. Persists via POST /api/engagement, then redirects
   to the Upload stage for the new engagement. */

const SUB_SEGMENTS_BY_INDUSTRY = {
  steel: ["integrated_steel_mill_multi_plant", "integrated_steel_mill_single_plant", "long_products_mini_mill", "specialty_steel"],
  cement: ["integrated_cement_plant", "grinding_unit"],
};

const NewEngagement = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({
    client_name: "",
    industry: "steel",
    sub_segment: "integrated_steel_mill_multi_plant",
    plants_str: "",
    annual_spend_inr_cr: "",
    annual_revenue_inr_cr: "",
    fte_count: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.client_name.trim()) { setError("Client name is required."); return; }
    setSubmitting(true);
    try {
      const plants = form.plants_str.split(",").map((p) => p.trim()).filter(Boolean);
      const payload = {
        client_name: form.client_name.trim(),
        industry: form.industry,
        sub_segment: form.sub_segment || null,
        plants,
        annual_spend_inr_cr: form.annual_spend_inr_cr ? Number(form.annual_spend_inr_cr) : null,
        annual_revenue_inr_cr: form.annual_revenue_inr_cr ? Number(form.annual_revenue_inr_cr) : null,
        fte_count: form.fte_count ? Number(form.fte_count) : null,
      };
      const eng = await api.createEngagement(payload);
      nav(`/engagement/${eng.id}/client`);
    } catch (e) {
      setError(e.body?.detail || e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", padding: 32 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Logo />
          <span style={{ marginLeft: "auto", color: "var(--ink-500)", fontSize: "var(--fs-13)" }}>
            <a href="/" style={{ color: "var(--brand-600)", textDecoration: "none" }}>← Back to landing</a>
          </span>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Badge tone="brand">Diagnostic · Stage 1</Badge>
          <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: "12px 0 6px 0" }}>
            New engagement
          </h1>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: 0 }}>
            Capture the client profile. Spend + FTE are used as denominators in productivity benchmarks.
          </p>
        </div>

        <form onSubmit={submit}>
          <Card padding={24}>
            <div style={{ display: "grid", gap: 16 }}>
              <Field label="Client name *">
                <Input
                  placeholder="e.g., Tata Steel"
                  value={form.client_name}
                  onChange={(e) => update("client_name", e.target.value)}
                  required
                />
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

              <Field label="Plants (comma-separated)" hint="Used to detect multi-plant centralisation opportunities">
                <Input
                  placeholder="Jamshedpur, Kalinganagar, Angul"
                  value={form.plants_str}
                  onChange={(e) => update("plants_str", e.target.value)}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <Field label="Annual spend (₹ Cr)">
                  <Input type="number" placeholder="5000"
                    value={form.annual_spend_inr_cr}
                    onChange={(e) => update("annual_spend_inr_cr", e.target.value)} />
                </Field>
                <Field label="Annual revenue (₹ Cr)">
                  <Input type="number" placeholder="50000"
                    value={form.annual_revenue_inr_cr}
                    onChange={(e) => update("annual_revenue_inr_cr", e.target.value)} />
                </Field>
                <Field label="Procurement FTEs" hint="Drives spend-per-FTE">
                  <Input type="number" placeholder="80"
                    value={form.fte_count}
                    onChange={(e) => update("fte_count", e.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          {error && (
            <div style={{ marginTop: 16 }}>
              <Callout tone="danger" title="Could not create engagement" icon={<I.X size={16} />}>{error}</Callout>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="outline" type="button" onClick={() => nav("/")}>Cancel</Button>
            <Button type="submit" disabled={submitting} iconRight={<I.Arrow size={14} />}>
              {submitting ? "Creating…" : "Create + go to Stage 1"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <label style={{ display: "block", fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-600)", fontWeight: 600, marginBottom: 6 }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>{hint}</div>}
  </div>
);

export default NewEngagement;
