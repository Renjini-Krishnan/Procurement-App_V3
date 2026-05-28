/* 30-stage workflow.
   Mirrors STAGES const in /tmp/design_system/ds-screens.jsx.
   `status` is engagement-level state — defaults set here; engagement
   state will override per-engagement when wired to backend. */

export const STAGES = [
  // Diagnostic phase (1-8)
  { id: 1,  phase: "Diagnostic", name: "Client",            slug: "client",            status: "todo" },
  { id: 2,  phase: "Diagnostic", name: "Scope",             slug: "scope",             status: "todo" },
  { id: 3,  phase: "Diagnostic", name: "Guidelines",        slug: "guidelines",        status: "todo" },
  { id: 4,  phase: "Diagnostic", name: "Data Upload",       slug: "upload",            status: "todo" },
  { id: 5,  phase: "Diagnostic", name: "AI Validation",     slug: "ai-validation",     status: "todo" },
  { id: 6,  phase: "Diagnostic", name: "User Validation",   slug: "user-validation",   status: "todo" },
  { id: 7,  phase: "Diagnostic", name: "Bronze Data",       slug: "bronze-data",       status: "todo" },
  { id: 8,  phase: "Diagnostic", name: "Gold Data",         slug: "gold-data",         status: "todo" },

  // Analyze phase (9-22)
  { id: 9,  phase: "Analyze",    name: "Category Class.",   slug: "categorisation",    status: "todo" },
  { id: 10, phase: "Analyze",    name: "KPI Calculation",   slug: "kpis",              status: "todo" },
  { id: 11, phase: "Analyze",    name: "Primer",            slug: "primer",            status: "todo" },
  { id: 12, phase: "Analyze",    name: "Op Model",          slug: "op-model",          status: "todo" },
  { id: 13, phase: "Analyze",    name: "Org Structure",     slug: "org-structure",     status: "todo" },
  { id: 16, phase: "Analyze",    name: "Buying Channel",    slug: "buying-channel",    status: "todo" },
  { id: 18, phase: "Analyze",    name: "Material Master",   slug: "material-master",   status: "todo", locked: true },
  { id: 20, phase: "Analyze",    name: "PR-to-PO",          slug: "pr-to-po",          status: "todo", locked: true },
  { id: 21, phase: "Analyze",    name: "Post-PO",           slug: "post-po",           status: "todo", locked: true },
  { id: 22, phase: "Analyze",    name: "Supplier",          slug: "supplier",          status: "todo", locked: true },

  // Output phase (28-30)
  { id: 28, phase: "Output",     name: "Findings deck",     slug: "findings-deck",     status: "todo", locked: true },
  { id: 29, phase: "Output",     name: "Exec summary",      slug: "exec-summary",      status: "todo", locked: true },
  { id: 30, phase: "Output",     name: "KPI dashboard",     slug: "kpi-dashboard",     status: "todo", locked: true },
];

export const PHASE_ORDER = ["Diagnostic", "Analyze", "Output"];

export const stagesByPhase = () => {
  const out = {};
  for (const phase of PHASE_ORDER) {
    out[phase] = STAGES.filter((s) => s.phase === phase);
  }
  return out;
};
