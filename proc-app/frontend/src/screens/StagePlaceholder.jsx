import React from "react";
import { useParams } from "react-router-dom";
import { Card, Badge, Callout, Button } from "../design/components.jsx";
import { STAGES } from "../data/stages.js";
import { I } from "../design/icons.jsx";

/* Placeholder for stages not yet implemented in V1.
   Shows which stage you're on + a "coming next" callout. */

const StagePlaceholder = () => {
  const { stageSlug } = useParams();
  const stage = STAGES.find((s) => s.slug === stageSlug);

  if (!stage) {
    return (
      <div>
        <h1>Unknown stage</h1>
        <p>Stage "{stageSlug}" is not in the workflow.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Badge tone="brand">{stage.phase}</Badge>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
          Stage {String(stage.id).padStart(2, "0")}
        </span>
      </div>

      <h1
        style={{
          fontSize: "var(--fs-36)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: "0 0 16px 0",
        }}
      >
        {stage.name}
      </h1>

      <Callout tone="info" title="Coming in a later chunk" icon={<I.Layers size={16} />}>
        This stage is part of the V1 scope but hasn't been wired yet. Foundational
        scaffolding (frontend + backend) is being built first; per-stage logic comes
        in subsequent chunks.
      </Callout>

      <div style={{ marginTop: 24 }}>
        <Card padding={32}>
          <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 8 }}>
            What this stage will do
          </div>
          <p style={{ fontSize: "var(--fs-15)", lineHeight: 1.55, color: "var(--ink-800)", margin: 0 }}>
            {DESCRIPTIONS[stage.slug] || "Description pending."}
          </p>
        </Card>
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
        <Button variant="outline" size="md">Back</Button>
        <Button size="md" iconRight={<I.Arrow size={14} />}>Continue</Button>
      </div>
    </div>
  );
};

const DESCRIPTIONS = {
  client: "Capture client profile — name, industry, sub-segment, plant list, annual revenue, procurement spend.",
  scope: "Define engagement scope — pillars in-scope, industries, time horizon, deliverables.",
  guidelines: "Engagement-specific ground rules — confidentiality, data-sharing, sign-off cadence.",
  upload: "Upload PO data, PR data, Vendor Master, Material Master, Org Structure, GRN/Invoice (optional).",
  "ai-validation": "AI parses uploaded files, validates against canonical schemas, flags issues.",
  "user-validation": "Consultant validates AI interpretation — column mapping, plant codes, vendor types, role classifications.",
  "bronze-data": "Cleansed data after universal data-quality rules pass.",
  "gold-data": "Final validated dataset — vendor dedup, currency normalisation, joins applied.",
  categorisation: "Stage 9 — reclassify PO categories using industry taxonomy (categories-master.yml).",
  kpis: "KPI computation with engagement-specific outlier methods, scoring weights, thresholds.",
  primer: "Engagement primer — pillar weights, scoring weights, benchmark cascade visualisation.",
  "op-model": "Op Model analysis (4 themes: Centralisation, Shared Services, CoE, Tail Spend).",
  "org-structure": "Org Structure analysis (4 themes: Posture, FTE Sizing, Distribution, Hierarchy).",
  "buying-channel": "Buying Channel analysis (13 components — archetype × frequency × value → recommended channel per MG).",
  "material-master": "Material Master quality — size, duplicates, classification accuracy, code creation process.",
  "pr-to-po": "PR-to-PO process — TAT, automation, RFQ process, negotiation, savings vs LPO.",
  "post-po": "Post-PO process — OTD, defect rate, GRN TAT, 3-way match, invoice TAT, DPO variance.",
  supplier: "Supplier management — onboarding TAT, vendor master quality, supplier performance.",
  "findings-deck": "Findings deck — quantified gaps + recommendations + cited sources.",
  "exec-summary": "Executive summary deck — narrative synthesis of findings + roadmap.",
  "kpi-dashboard": "Interactive KPI dashboard with 12 KPIs benchmark-cited.",
};

export default StagePlaceholder;
