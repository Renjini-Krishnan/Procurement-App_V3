import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Button } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 3 — Guidelines (engagement ground rules).

   Item content is hardcoded in the ITEMS array below. The content
   describes what V1 ACTUALLY does — not aspiration. When app behaviour
   changes, this file MUST be updated (see footer note).

   View-mode toggle lives at the top: Consultant view (full access) vs
   Client view (Findings Deck + Exec Summary only). State is persisted
   in engagement_overrides under key 'view.mode'. */

const ITEMS = [
  {
    title: "Confidentiality (host-controlled — not app-encrypted)",
    body: (
      <>
        Uploaded files land on the host filesystem under{" "}
        <code>proc-app/backend/data/uploads/</code>; SQLite engagement state
        lives at <code>proc-app/backend/data/procvault.db</code>. There is
        <strong> no application-level encryption at rest in V1</strong> —
        confidentiality relies on the host OS file permissions and disk
        encryption (FileVault / dm-crypt / similar). Host the app on a
        machine that meets your data-residency + encryption needs.
      </>
    ),
  },
  {
    title: "Access (no auth in V1)",
    body: (
      <>
        V1 has <strong>no authentication or user accounts</strong>. Anyone
        who can reach the URL (<code>http://localhost:5173</code> or the
        deployment URL) has full edit access to every engagement on that
        instance. The only access boundary is the host network. Per-user
        roles, signed sessions, and engagement-scoped access controls are
        on the V2 roadmap.
      </>
    ),
  },
  {
    title: "Consultant view vs Client view",
    body: (
      <>
        Switch the workspace into <strong>Client view</strong> from the
        toggle at the top of the left rail. Client view hides everything
        except <strong>Findings Deck (Stage 28)</strong> and <strong>Executive
        Summary (Stage 29)</strong>, and forces all other URLs to redirect
        to Findings Deck. Switch back to Consultant view via the same
        toggle. Because there is no auth, the toggle is honour-based —
        anyone with the URL can flip it. Treat it as a presentation mode,
        not a security boundary.
      </>
    ),
  },
  {
    title: "Sign-off (cadence-driven, persisted, single-approver)",
    body: (
      <>
        Sign-off is real — the widget appears on pillar screens (cadence{" "}
        <code>end-of-pillar</code>) or on the Exec Summary (cadence{" "}
        <code>end-of-phase</code>) and persists per scope in
        <code> engagement_overrides</code> with key <code>signoff.&lt;scope&gt;</code>{" "}
        <code>{`= {ts, signed: true}`}</code>. Cadence is set on Stage 2 (Scope).
        Sign-off is <strong>single-approver</strong> in V1 — no
        co-signer or audit trail of who clicked the button. Dual approval is
        a V2 item.
      </>
    ),
  },
  {
    title: "Citations + sources (genuinely traceable)",
    body: (
      <>
        Every benchmark, KPI, and finding cites <strong>source · year ·
        confidence</strong> on screen. Pull the citation by clicking any KPI
        card on the Dashboard, or look at the Stage 11 Primer for the full
        cascade view. Cited values resolve through{" "}
        <strong>function default → industry overlay → engagement override</strong>{" "}
        (most specific wins) via{" "}
        <code>backend/kb_loader.py:resolve_pillar_benchmarks</code>. Edit
        the underlying YAML in <code>/kb</code> to change a benchmark; the
        loader cache invalidates on save.
      </>
    ),
  },
  {
    title: "Overrides (immediate, single-click — no dual approval in V1)",
    body: (
      <>
        Engagement-level overrides (KPI bands, scope settings, source
        documents) save with a single button click and apply to the next
        pillar run. Function defaults in <code>kb/functions/procurement/</code>{" "}
        are editable via <code>/kb</code> but YAML-validated on save (broken
        YAML is rejected). Industry overlays in{" "}
        <code>shared-kb/industries/&lt;industry&gt;/</code> apply automatically
        when an engagement's <code>industry</code> field matches. <strong>Dual
        sign-off for overrides is a V2 item</strong> — V1 trusts whoever
        edited it.
      </>
    ),
  },
  {
    title: "AI usage (opt-in, fallbacks everywhere)",
    body: (
      <>
        Gemini 2.5 Pro on Vertex AI is wired into three places — column
        mapping (Stage 5), pillar finding narratives (KPI Dashboard / Exec
        Summary), and Client auto-fill (Stage 1). All three are{" "}
        <strong>opt-in via env vars</strong>{" "}
        (<code>PROCVAULT_LLM_FINDINGS</code>,
        <code> PROCVAULT_LLM_COLMAP</code>) and require Google Cloud ADC
        (<code>gcloud auth application-default login</code>). Without ADC,
        every call site falls back to deterministic templates — the app
        works identically minus the narrative quality. Diagnostic at{" "}
        <code>GET /api/llm/status</code>. Default Vertex AI region is{" "}
        <code>us-central1</code>; override via{" "}
        <code>GEMINI_VERTEX_LOCATION</code> for region-locked deployments.
      </>
    ),
  },
];


const Guidelines = () => {
  const { engagement } = useEngagement();
  const [viewMode, setViewMode] = useState("consultant");
  const [savingView, setSavingView] = useState(false);

  useEffect(() => {
    if (!engagement) return;
    api.listOverrides(engagement.id).then((r) => {
      const mode = (r.overrides || []).find((o) => o.key === "view.mode")?.value;
      if (mode === "client" || mode === "consultant") setViewMode(mode);
    }).catch(() => {});
  }, [engagement]);

  const flipView = async () => {
    const next = viewMode === "consultant" ? "client" : "consultant";
    if (next === "client" && !confirm("Switch to Client view? Rail will hide everything except Findings Deck + Executive Summary. Toggle back from the rail top.")) return;
    setSavingView(true);
    try {
      await api.upsertOverride(engagement.id, "view.mode", next, "view");
      setViewMode(next);
      // Reload so the rail picks up the new mode
      window.location.reload();
    } catch (e) {
      alert("Failed: " + (e.message || e));
    } finally {
      setSavingView(false);
    }
  };

  return (
    <div>
      <Header />

      <Card padding={20} style={{ marginBottom: 16, borderLeft: `4px solid ${viewMode === "client" ? "var(--brand-500)" : "var(--ink-300)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)" }}>
              Current workspace mode
            </div>
            <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 4 }}>
              {viewMode === "client" ? "Client view" : "Consultant view"}
            </div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", marginTop: 4 }}>
              {viewMode === "client"
                ? "Rail shows only Findings Deck + Executive Summary. Other stages redirect to Findings Deck."
                : "All stages visible + editable. Use the toggle to switch into a client-facing presentation mode."}
            </div>
          </div>
          <Button onClick={flipView} disabled={!engagement || savingView}>
            {savingView ? "Saving…" : viewMode === "consultant" ? "Switch to Client view" : "Switch to Consultant view"}
          </Button>
        </div>
      </Card>

      <Callout tone="info" title="What this page describes" icon={<I.Doc size={16} />}>
        Honest description of what V1 actually does — confidentiality boundaries,
        access controls, sign-off, citations, overrides, AI usage. <strong>Not aspirational</strong>.
        When app behaviour changes, this page must be updated.
      </Callout>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {ITEMS.map((it, i) => (
          <Card key={i} padding={20}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--brand-700)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, marginBottom: 6 }}>{it.title}</div>
            <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-700)", lineHeight: 1.55 }}>
              {it.body}
            </div>
          </Card>
        ))}
      </div>

      <Card padding={20} style={{ marginTop: 24, background: "var(--surface-sunk)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Badge tone="neutral">META</Badge>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", lineHeight: 1.55 }}>
            <strong>These guidelines must track the app.</strong> Every change to
            authentication, encryption, override flow, AI integration, or
            view-mode behaviour requires a matching edit to{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>frontend/src/screens/Guidelines.jsx</code>.
            <br />
            <span style={{ color: "var(--ink-500)" }}>Last reviewed: 2026-05-29 · Reviewer: engagement consultant</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 03</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
      Engagement guidelines
    </h1>
    <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "6px 0 0 0" }}>
      What the app actually does · Consultant ↔ Client view toggle · Last reviewed 2026-05-29
    </p>
  </div>
);

export default Guidelines;
