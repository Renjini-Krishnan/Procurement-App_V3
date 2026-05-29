import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Input, Select, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 1 — Client profile + Primer (Company Overview, Financials, Procurement Categories). */

const SUB_SEGMENTS_BY_INDUSTRY = {
  steel: ["integrated_steel_mill_multi_plant", "integrated_steel_mill_single_plant",
           "long_products_mini_mill", "specialty_steel"],
  cement: ["integrated_cement_plant", "grinding_unit"],
};

const Client = () => {
  const nav = useNavigate();
  const { engagement, loading: engLoading } = useEngagement();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Autofill + primer state
  const [autofilling, setAutofilling] = useState(false);
  const [autofillResult, setAutofillResult] = useState(null);   // {company_overview, financials, ...}
  const [categories, setCategories] = useState(null);
  const [categoriesIndustry, setCategoriesIndustry] = useState(null);

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

  // Load categories whenever industry changes
  useEffect(() => {
    if (!form?.industry || form.industry === categoriesIndustry) return;
    api.industryCategories(form.industry)
      .then((c) => { setCategories(c); setCategoriesIndustry(form.industry); })
      .catch(() => setCategories(null));
  }, [form?.industry, categoriesIndustry]);

  // Load any saved autofill primer for this engagement
  useEffect(() => {
    if (!engagement) return;
    api.listOverrides(engagement.id).then((r) => {
      const entry = (r.overrides || []).find((o) => o.key === "client.primer");
      if (entry) setAutofillResult(entry.value);
    }).catch(() => {});
  }, [engagement]);

  if (engLoading || !engagement || !form) return <div>Loading…</div>;

  const update = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setMsg(null); };

  const handleAutofill = async () => {
    const name = form.client_name.trim();
    if (!name) { alert("Enter a client name first."); return; }
    setAutofilling(true); setErr(null); setMsg(null);
    try {
      const r = await api.clientAutofill(name);
      setAutofillResult(r);
      // Apply LLM suggestions to the form (user can override before save)
      setForm((f) => ({
        ...f,
        industry: r.industry || f.industry,
        sub_segment: r.sub_segment || f.sub_segment,
        plants_str: (r.plants && r.plants.length) ? r.plants.join(", ") : f.plants_str,
        annual_spend_inr_cr: r.annual_spend_inr_cr ?? f.annual_spend_inr_cr,
        annual_revenue_inr_cr: r.annual_revenue_inr_cr ?? f.annual_revenue_inr_cr,
        fte_count: r.fte_count ?? f.fte_count,
      }));
      // Persist the primer + source documents
      await api.upsertOverride(engagement.id, "client.primer", r, "primer");
      if (r.financials?.citation_url) {
        const existing = await api.listOverrides(engagement.id);
        const docs = existing.overrides.find((o) => o.key === "source_documents")?.value || [];
        const doc = {
          label: r.financials.citation_label || "Latest financials",
          url: r.financials.citation_url,
          type: "Annual / quarterly report",
          retrieved_at: new Date().toISOString(),
        };
        const next = [doc, ...docs.filter((d) => d.url !== doc.url)].slice(0, 25);
        await api.upsertOverride(engagement.id, "source_documents", next, "source_documents");
      }
    } catch (e) {
      setErr(e.body?.detail || e.message || String(e));
    } finally {
      setAutofilling(false);
    }
  };

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

  const deleteEng = async () => {
    if (!confirm(`Delete engagement "${engagement.client_name}"? Uploads, runs, QRE, findings, overrides will all be removed.`)) return;
    if (!confirm("Really delete? Type yes in the next box to confirm.")) return;
    try { await api.deleteEngagement(engagement.id); nav("/"); }
    catch (e) { alert("Delete failed: " + (e.message || e)); }
  };

  return (
    <div>
      <Header />

      <Card padding={24}>
        <div style={{ display: "grid", gap: 16 }}>
          <Field label="Client name">
            <div style={{ display: "flex", gap: 8 }}>
              <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)}
                     style={{ flex: 1 }} />
              <Button onClick={handleAutofill} disabled={autofilling || !form.client_name.trim()}
                       variant="outline" iconRight={<I.Arrow size={14} />}>
                {autofilling ? "Auto-filling…" : "✨ Auto-fill"}
              </Button>
            </div>
            <Hint>Click Auto-fill to populate industry, plants, financials + primer from public sources (AI-assisted).</Hint>
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

      <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "space-between" }}>
        <Button variant="outline" onClick={deleteEng}
                 style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
          Delete engagement
        </Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

      {/* Primer */}
      <Primer autofillResult={autofillResult} categories={categories} industry={form.industry} />
    </div>
  );
};


/* ============================================================
   Primer section
   ============================================================ */

const Primer = ({ autofillResult, categories, industry }) => {
  if (!autofillResult && !categories) return null;
  return (
    <div style={{ marginTop: 40 }}>
      <SectionHeader title="Engagement primer"
                     sub="Background context auto-assembled from public sources + KB. Edit / override above; categories load from kb/shared-kb/industries/." />

      {autofillResult && autofillResult.llm_used === false && (
        <Callout tone="warn" title="AI auto-fill unavailable" icon={<I.X size={16} />}>
          {autofillResult.reason || "Set up Vertex AI ADC (gcloud auth application-default login) to enable AI-assisted primer."}
        </Callout>
      )}

      {/* Company Overview */}
      {autofillResult?.company_overview && (
        <Card padding={20} style={{ marginTop: 16 }}>
          <Header2 title="Company Overview" badge={conf(autofillResult.overall_confidence)} />
          <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.6, color: "var(--ink-800)", marginTop: 8 }}>
            {autofillResult.company_overview}
          </p>
        </Card>
      )}

      {/* Financials */}
      {autofillResult?.financials && (
        <Card padding={20} style={{ marginTop: 12 }}>
          <Header2 title="Latest financials" badge={autofillResult.financials.fy_label || ""} />
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <Stat label="Revenue (₹ Cr)" value={fmt(autofillResult.financials.revenue_inr_cr)} />
            <Stat label="EBITDA (₹ Cr)"  value={fmt(autofillResult.financials.ebitda_inr_cr)} />
            <Stat label="PAT (₹ Cr)"      value={fmt(autofillResult.financials.profit_after_tax_inr_cr)} />
          </div>
          {(autofillResult.financials.citation_label || autofillResult.financials.citation_url) && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px dashed var(--border-subtle)",
                           fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
              Source:{" "}
              {autofillResult.financials.citation_url ? (
                <a href={autofillResult.financials.citation_url} target="_blank" rel="noreferrer"
                   style={{ color: "var(--brand-600)" }}>
                  {autofillResult.financials.citation_label || autofillResult.financials.citation_url}
                </a>
              ) : (
                <span>{autofillResult.financials.citation_label}</span>
              )}
              <span style={{ marginLeft: 12, color: "var(--ink-500)" }}>
                → also available in Export Centre under "Source documents".
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Typical Procurement Categories */}
      {categories && categories.categories && categories.categories.length > 0 && (
        <Card padding={20} style={{ marginTop: 12 }}>
          <Header2 title={`Typical procurement categories — ${industry}`}
                   badge={`${categories.categories.length} categories`} />
          <Hint style={{ marginTop: 4 }}>
            Source: <code style={{ fontFamily: "var(--font-mono)" }}>{categories.source}</code>{" "}
            ({categories.source_year}) · confidence: {categories.confidence}.
            Edit at <code>shared-kb/industries/{industry}/typical-procurement-categories.yml</code>.
          </Hint>
          <table style={{ width: "100%", marginTop: 14, borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead>
              <tr>
                {["Category", "Archetype", "Typical share %", "Notes", "Typical KPIs"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px",
                                        fontSize: "var(--fs-11)", color: "var(--ink-500)",
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        borderBottom: "1px solid var(--border-default)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.categories.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ background: "var(--surface-sunk)", padding: "1px 6px",
                                    borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)",
                                    fontWeight: 600 }}>{c.archetype}</span>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-700)" }}>
                    {c.typical_spend_share_pct ? `${c.typical_spend_share_pct[0]}–${c.typical_spend_share_pct[1]}%` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)", maxWidth: 360 }}>
                    {c.notes || "—"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
                    {(c.typical_kpis || []).slice(0, 3).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {categories.tail_spend_principle && (
            <div style={{ marginTop: 16, padding: 12, background: "var(--brand-50)",
                            borderRadius: "var(--r-md)", fontSize: "var(--fs-13)", color: "var(--ink-700)" }}>
              <strong>Tail-spend principle for {industry}:</strong> {categories.tail_spend_principle}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};


/* ============================================================
   Primitives
   ============================================================ */

const Field = ({ label, hint, children }) => (
  <div>
    <label style={{ display: "block", fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-600)", fontWeight: 600, marginBottom: 6 }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>{hint}</div>}
  </div>
);

const Hint = ({ children, style }) => (
  <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4, ...style }}>{children}</div>
);

const Stat = ({ label, value }) => (
  <div>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontSize: "var(--fs-22)", fontWeight: 600, marginTop: 4 }}>{value}</div>
  </div>
);

const Header2 = ({ title, badge }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, color: "var(--ink-900)" }}>{title}</div>
    {badge && <Badge tone="neutral">{badge}</Badge>}
  </div>
);

const SectionHeader = ({ title, sub }) => (
  <div>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", fontWeight: 600 }}>{title}</div>
    {sub && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4, maxWidth: "70ch" }}>{sub}</div>}
  </div>
);

const fmt = (v) => v === null || v === undefined ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const conf = (c) => c ? `${c} confidence` : "";

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
      Core engagement settings · ✨ Auto-fill from public sources · primer below.
    </p>
  </div>
);

export default Client;
