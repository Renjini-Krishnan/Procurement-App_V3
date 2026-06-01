import React, { useEffect, useState } from "react";
import { Card, Badge, Callout, Button } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 3 — Engagement Guidelines. Client-facing ground rules + scope clarity
   + view-mode toggle. Avoid dev terminology (V1/V2/SQLite/env vars). */

const ITEMS = [
  {
    title: "How your data is protected",
    body: (
      <>
        Your uploaded files and engagement records stay on the machine
        running this application. Confidentiality relies on standard
        OS-level protections (FileVault on Mac, BitLocker on Windows, or
        the equivalent disk encryption your IT team has provisioned). For
        engagements involving sensitive procurement data, please ensure
        this application runs on a machine that meets your organisation's
        information-security policy.
      </>
    ),
  },
  {
    title: "Who can access this engagement",
    body: (
      <>
        Anyone with network access to this application instance can view
        and edit any engagement. There is no individual user login or
        per-user role today. If you need access boundaries between team
        members or between consultant and client, host the application on
        a network only authorised users can reach (a corporate VPN or
        firewalled subnet), or share screenshots / exports rather than
        the live URL.
      </>
    ),
  },
  {
    title: "Consultant view vs Client view",
    body: (
      <>
        Use the toggle below to switch the workspace between two
        presentation modes. <strong>Consultant view</strong> is the
        default — all stages, KPIs, and findings are visible and
        editable. <strong>Client view</strong> hides the working machinery
        and shows only the deliverables: the Findings Deck and the
        Executive Summary. This is a presentation convenience, not a
        security control — anyone with the URL can flip it back, so use
        it during walk-throughs rather than as a hand-off boundary.
      </>
    ),
  },
  {
    title: "Sign-off and approvals",
    body: (
      <>
        Sign-off prompts appear at the end of each pillar and at the end
        of each phase, depending on the cadence you choose on the next
        screen (Stage 2 — Scope). Each sign-off is single-approver and is
        recorded against the engagement. If your organisation requires
        dual approval or a formal audit trail of who approved what and
        when, capture that separately in your standard project
        documentation.
      </>
    ),
  },
  {
    title: "Citations and sources",
    body: (
      <>
        Every benchmark, KPI threshold, and finding is backed by a
        cited source — typically a published industry benchmark, a
        regulatory reference, or your client's own QRE responses. Click
        any KPI card to view its source citation. The Engagement Primer
        (Stage 11) shows the full benchmark library applicable to this
        engagement's industry. If you need to override a benchmark for a
        specific client, the Knowledge Base editor is available from the
        top navigation.
      </>
    ),
  },
  {
    title: "Engagement-level overrides",
    body: (
      <>
        Any benchmark, KPI band, or scope setting can be customised for
        this engagement. Overrides take effect on the next pillar run and
        are scoped to this engagement only — they don't affect other
        engagements or the default library. The default values are
        sourced from industry benchmarks published by the practice; you
        can review them on the Engagement Primer (Stage 11) before
        deciding whether to override.
      </>
    ),
  },
  {
    title: "AI usage in this engagement",
    body: (
      <>
        Procvault uses Google's Gemini model for three narrow,
        bounded tasks: <strong>(1)</strong> auto-populating the client
        profile on Stage 1 (you can override every field manually),
        <strong> (2)</strong> suggesting how columns in your uploaded data
        map to the canonical schema (you confirm every mapping on Stage 6),
        and <strong>(3)</strong> drafting the narrative paragraphs around
        each KPI finding. Every AI output is paired with a deterministic
        fallback — if the AI service is unavailable, the app keeps working
        with rule-based templates. AI is not used to generate scores,
        ratings, or maturity verdicts. Those are computed deterministically
        from your data against published benchmarks.
      </>
    ),
  },
  {
    title: "Data residency",
    body: (
      <>
        All client data uploaded to this engagement stays on the host
        machine. AI features (when enabled) send only the minimum context
        required — for example, a column header list when suggesting a
        mapping, or a finding label and its computed metric when drafting
        a narrative. Raw PO line items, vendor lists, and pricing data
        are never sent to the AI service. If your engagement requires
        air-gapped operation, switch off AI features and use the
        deterministic fallbacks for everything.
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
    if (next === "client" && !confirm("Switch to Client view? The left navigation will hide everything except the Findings Deck and Executive Summary. You can switch back from the same toggle.")) return;
    setSavingView(true);
    try {
      await api.upsertOverride(engagement.id, "view.mode", next, "view");
      setViewMode(next);
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
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginTop: 4 }}>
              {viewMode === "client"
                ? "Showing only Findings Deck + Executive Summary. Other stages are hidden."
                : "Full workspace. Switch to Client view for a presentation-ready experience."}
            </div>
          </div>
          <Button onClick={flipView} disabled={!engagement || savingView}>
            {savingView ? "Saving…" : viewMode === "consultant" ? "Switch to Client view" : "Switch to Consultant view"}
          </Button>
        </div>
      </Card>

      <Callout tone="info" title="What this page covers" icon={<I.Doc size={16} />}>
        Ground rules for this engagement — confidentiality, access, sign-off,
        citations, overrides, and AI usage. Review with your client before
        beginning the assessment.
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
      Confidentiality · access · sign-off · citations · overrides · AI usage
    </p>
  </div>
);

export default Guidelines;
