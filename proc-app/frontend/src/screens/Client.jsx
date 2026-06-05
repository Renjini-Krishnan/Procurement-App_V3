import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button, Input, Select, Badge, Callout } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";
import DocumentsShelf from "./DocumentsShelf.jsx";

/* Stage 1 — Client profile.
   - When the URL is /engagement/new/client we render the create form
     (engagement === null). Save creates the row and redirects to the
     real engagement URL.
   - When the URL is /engagement/<id>/client we render the edit form
     against the loaded engagement.
   - Auto-fill calls the LLM and gets back per-field-cited values for
     plants, company_overview, and financials only. Procurement spend +
     FTE are NOT auto-filled (internal data, no public sources) and
     stay blank on the form for the consultant to type. */

const SUB_SEGMENTS_BY_INDUSTRY = {
  steel: ["integrated_steel_mill_multi_plant", "integrated_steel_mill_single_plant",
           "long_products_mini_mill", "specialty_steel"],
  cement: ["integrated_cement_plant", "grinding_unit"],
};

const Client = () => {
  const nav = useNavigate();
  const { engagementId } = useParams();
  const isNew = engagementId === "new";

  const { engagement, loading: engLoading } = useEngagement();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Autofill state
  const [autofilling, setAutofilling] = useState(false);
  const [autofillResult, setAutofillResult] = useState(null);
  const [categories, setCategories] = useState(null);
  const [categoriesIndustry, setCategoriesIndustry] = useState(null);

  // Initialise form — blank for new, populated from engagement for edit
  useEffect(() => {
    if (engLoading) return;
    if (isNew) {
      setForm(blankForm());
    } else if (engagement) {
      setForm({
        client_name: engagement.client_name || "",
        industry: engagement.industry || "steel",
        sub_segment: engagement.sub_segment || SUB_SEGMENTS_BY_INDUSTRY[engagement.industry || "steel"][0],
        plants_str: (engagement.plants || []).join(", "),
        annual_spend_inr_cr: engagement.annual_spend_inr_cr ?? "",
        annual_revenue_inr_cr: engagement.annual_revenue_inr_cr ?? "",
        fte_count: engagement.fte_count ?? "",
      });
    }
  }, [engagement, engLoading, isNew]);

  // Load typical-categories KB when industry changes
  useEffect(() => {
    if (!form?.industry || form.industry === categoriesIndustry) return;
    api.industryCategories(form.industry)
      .then((c) => { setCategories(c); setCategoriesIndustry(form.industry); })
      .catch(() => setCategories(null));
  }, [form?.industry, categoriesIndustry]);

  // Load saved autofill primer for existing engagements
  useEffect(() => {
    if (!engagement) return;
    api.listOverrides(engagement.id).then((r) => {
      const entry = (r.overrides || []).find((o) => o.key === "client.primer");
      if (entry) setAutofillResult(entry.value);
    }).catch(() => {});
  }, [engagement]);

  if (engLoading || !form) return <div>Loading…</div>;

  const update = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setMsg(null); };

  // --- Auto-fill ---------------------------------------------------------
  const handleAutofill = async () => {
    const name = form.client_name.trim();
    if (!name) { alert("Enter a client name first."); return; }
    setAutofilling(true); setErr(null); setMsg(null);
    try {
      const r = await api.clientAutofill(name);
      setAutofillResult(r);
      // Apply LLM suggestions to the form fields it actually filled.
      // Procurement spend + FTE are NOT filled — they stay whatever the
      // consultant typed (or blank).
      setForm((f) => ({
        ...f,
        industry: r.industry || f.industry,
        sub_segment: r.sub_segment || f.sub_segment,
        plants_str: (r.plants && r.plants.length) ? r.plants.join(", ") : f.plants_str,
        annual_revenue_inr_cr:
          r.financials?.revenue_inr_cr != null ? r.financials.revenue_inr_cr : f.annual_revenue_inr_cr,
      }));
      // Persist to engagement_overrides only for existing engagements
      if (!isNew) {
        await api.upsertOverride(engagement.id, "client.primer", r, "primer");
        // Mirror every cited source into the engagement-wide source-docs list
        const sources = r.sources || {};
        const newDocs = Object.entries(sources).map(([field, s]) => ({
          field, label: s.label, url: s.url, page: s.page,
          retrieved_at: new Date().toISOString(),
        })).filter((d) => d.label);
        if (newDocs.length) {
          const existing = await api.listOverrides(engagement.id);
          const old = existing.overrides.find((o) => o.key === "source_documents")?.value || [];
          const seen = new Set(old.map((d) => `${d.label}|${d.url}`));
          const merged = [...newDocs.filter((d) => !seen.has(`${d.label}|${d.url}`)), ...old].slice(0, 50);
          await api.upsertOverride(engagement.id, "source_documents", merged, "source_documents");
        }
      }
    } catch (e) {
      setErr(e.body?.detail || e.message || String(e));
    } finally {
      setAutofilling(false);
    }
  };

  // --- Save / Create -----------------------------------------------------
  const save = async () => {
    if (!form.client_name.trim()) { setErr("Client name is required."); return; }
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
      if (isNew) {
        const eng = await api.createEngagement(payload);
        // If we had an autofill result before saving, persist it now that
        // we have an engagement id.
        if (autofillResult) {
          try { await api.upsertOverride(eng.id, "client.primer", autofillResult, "primer"); } catch {}
        }
        nav(`/engagement/${eng.id}/scope`);
      } else {
        await api.updateEngagement(engagement.id, payload);
        setMsg("Client profile saved.");
      }
    } catch (e) {
      setErr(e.body?.detail || e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteEng = async () => {
    if (!engagement) return;
    if (!confirm(`Delete engagement "${engagement.client_name}"? Uploads, runs, QRE, findings, overrides will all be removed.`)) return;
    if (!confirm("Really delete? Click OK to confirm.")) return;
    try { await api.deleteEngagement(engagement.id); nav("/"); }
    catch (e) { alert("Delete failed: " + (e.message || e)); }
  };

  const sources = autofillResult?.sources || {};

  return (
    <div>
      <Header isNew={isNew} />

      <Card padding={24}>
        <div style={{ display: "grid", gap: 16 }}>
          <Field label="Client name">
            <div style={{ display: "flex", gap: 8 }}>
              <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)}
                     style={{ flex: 1 }} placeholder="e.g., Tata Steel" />
              <Button onClick={handleAutofill} disabled={autofilling || !form.client_name.trim()}
                       variant="outline" iconRight={<I.Arrow size={14} />}>
                {autofilling ? "Auto-filling…" : "✨ Auto-fill"}
              </Button>
            </div>
            <Hint>
              Auto-fill populates industry, plants, financials + overview from public sources.
              Procurement spend + FTE are NOT auto-filled — those are internal numbers; ask the client.
            </Hint>
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

          <Field label="Plants" hint="Drives multi-plant centralisation detection in the Op Model pillar.">
            <Input value={form.plants_str} onChange={(e) => update("plants_str", e.target.value)}
                   placeholder="Jamshedpur, Kalinganagar, Angul" />
            <SourceChip s={sources.plants} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Annual revenue (₹ Cr)" hint="Auto-fillable — annual report.">
              <Input type="number" value={form.annual_revenue_inr_cr}
                     onChange={(e) => update("annual_revenue_inr_cr", e.target.value)}
                     placeholder="50000" />
              <SourceChip s={sources["financials.revenue_inr_cr"]} />
            </Field>
            <Field label="FY label" hint="Reporting period the financials refer to.">
              <Input value={autofillResult?.financials?.fy_label || ""} readOnly
                     placeholder="(auto)" style={{ background: "var(--surface-sunk)" }} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Annual procurement spend (₹ Cr)"
                   hint="Internal data — not in any public document. Confirm with the client.">
              <Input type="number" value={form.annual_spend_inr_cr}
                     onChange={(e) => update("annual_spend_inr_cr", e.target.value)}
                     placeholder="Consultant input required" />
              <InternalChip />
            </Field>
            <Field label="Procurement function FTEs"
                   hint="Internal org-chart data. Confirm with the client.">
              <Input type="number" value={form.fte_count}
                     onChange={(e) => update("fte_count", e.target.value)}
                     placeholder="Consultant input required" />
              <InternalChip />
            </Field>
          </div>
        </div>
      </Card>

      {msg && <div style={{ marginTop: 16 }}><Callout tone="success" title={msg} icon={<I.Check size={16} />} /></div>}
      {err && <div style={{ marginTop: 16 }}><Callout tone="danger" title="Save failed" icon={<I.X size={16} />}>{err}</Callout></div>}

      <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "space-between" }}>
        {isNew ? (
          <Button variant="outline" onClick={() => nav("/")}>Cancel</Button>
        ) : (
          <Button variant="outline" onClick={deleteEng}
                   style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
            Delete engagement
          </Button>
        )}
        <Button onClick={save} disabled={saving} iconRight={isNew ? <I.Arrow size={14} /> : undefined}>
          {saving ? "Saving…" : isNew ? "Create + go to Stage 2" : "Save changes"}
        </Button>
      </div>

      {/* Primer (overview + categories) */}
      <Primer autofillResult={autofillResult} categories={categories} industry={form.industry} sources={sources} />

      {/* Reference documents shelf — Phase 1 of the document-grounded
          insights feature. Engagement must exist (not 'new') to enable
          uploads. */}
      <DocumentsShelf engagementId={isNew ? null : engagement.id} />
    </div>
  );
};


// ────────────────────────────────────────────────────────────────────────
// Primer panel (renders overview + financials breakdown + categories)
// ────────────────────────────────────────────────────────────────────────

const Primer = ({ autofillResult, categories, industry, sources }) => {
  if (!autofillResult && !categories) return null;
  const fin = autofillResult?.financials || {};
  const hasFin = fin.revenue_inr_cr != null || fin.ebitda_inr_cr != null || fin.profit_after_tax_inr_cr != null;
  return (
    <div style={{ marginTop: 40 }}>
      <SectionHeader title="Engagement primer"
                     sub="Auto-assembled from public sources. Every value below carries the document it was extracted from." />

      {autofillResult && autofillResult.llm_used === false && (
        <Callout tone="warn" title="AI auto-fill unavailable" icon={<I.X size={16} />}>
          {autofillResult.reason || "Set up Vertex AI ADC (gcloud auth application-default login) to enable AI-assisted primer."}
        </Callout>
      )}

      {autofillResult?.company_overview && (
        <Card padding={20} style={{ marginTop: 16 }}>
          <Header2 title="Company overview" badge={conf(autofillResult.overall_confidence)} />
          <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.6, color: "var(--ink-800)", marginTop: 8 }}>
            {autofillResult.company_overview}
          </p>
          <SourceChip s={sources?.company_overview} />
        </Card>
      )}

      {hasFin && (
        <Card padding={20} style={{ marginTop: 12 }}>
          <Header2 title="Latest financials" badge={fin.fy_label || ""} />
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <FinStat label="Revenue (₹ Cr)" value={fin.revenue_inr_cr} src={sources?.["financials.revenue_inr_cr"]} />
            <FinStat label="EBITDA (₹ Cr)"  value={fin.ebitda_inr_cr}  src={sources?.["financials.ebitda_inr_cr"]} />
            <FinStat label="PAT (₹ Cr)"      value={fin.profit_after_tax_inr_cr} src={sources?.["financials.profit_after_tax_inr_cr"]} />
          </div>
        </Card>
      )}

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
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>
                    <span style={{ background: "var(--surface-sunk)", padding: "1px 6px",
                                    borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)",
                                    fontWeight: 600 }}>{c.archetype}</span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--ink-700)" }}>
                    {c.typical_spend_share_pct ? `${c.typical_spend_share_pct[0]}–${c.typical_spend_share_pct[1]}%` : "—"}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--ink-600)", maxWidth: 360 }}>{c.notes || "—"}</td>
                  <td style={{ ...tdStyle, fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
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


// ────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────

const SourceChip = ({ s }) => {
  if (!s || !s.label) return null;
  const text = s.page ? `${s.label} · ${s.page}` : s.label;
  if (s.url) {
    return (
      <a href={s.url} target="_blank" rel="noreferrer"
         title={s.url}
         style={{
           display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
           padding: "2px 8px", borderRadius: "var(--r-pill)",
           background: "var(--success-50, #e7f6ec)", color: "var(--success-700, #1f6b3f)",
           fontSize: "var(--fs-11)", fontWeight: 600, textDecoration: "none",
           border: "1px solid var(--success-200, #b9e0c6)", maxWidth: "100%",
         }}>
        <span>📄</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
      </a>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
      padding: "2px 8px", borderRadius: "var(--r-pill)",
      background: "var(--surface-sunk)", color: "var(--ink-700)",
      fontSize: "var(--fs-11)", fontWeight: 600,
      border: "1px solid var(--border-default)",
    }}>
      <span>📄</span><span>{text}</span>
    </span>
  );
};

const InternalChip = () => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
    padding: "2px 8px", borderRadius: "var(--r-pill)",
    background: "var(--warn-50, #fff7e6)", color: "var(--warn-700, #a06400)",
    fontSize: "var(--fs-11)", fontWeight: 600,
    border: "1px solid var(--warn-200, #f5d390)",
  }}>
    <span>🔒</span><span>Internal — not auto-filled</span>
  </span>
);

const FinStat = ({ label, value, src }) => (
  <div>
    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontSize: "var(--fs-22)", fontWeight: 600, marginTop: 4 }}>
      {value === null || value === undefined ? "—" : Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
    </div>
    <SourceChip s={src} />
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

const Hint = ({ children, style }) => (
  <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4, ...style }}>{children}</div>
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

const tdStyle = { padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", verticalAlign: "top" };
const conf = (c) => c ? `${c} confidence` : "";

const Header = ({ isNew }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 01</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      {isNew ? "New engagement" : "Client profile"}
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      Core engagement settings · ✨ Auto-fill from public sources · primer below.
    </p>
  </div>
);

const blankForm = () => ({
  client_name: "",
  industry: "steel",
  sub_segment: "integrated_steel_mill_multi_plant",
  plants_str: "",
  annual_spend_inr_cr: "",
  annual_revenue_inr_cr: "",
  fte_count: "",
});

export default Client;
