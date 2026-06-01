import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useViewMode, CLIENT_VIEW_ALLOWED_STAGES } from "./hooks/useViewMode.js";
import Landing from "./screens/Landing.jsx";
import NewEngagement from "./screens/NewEngagement.jsx";
import KBEditor from "./screens/KBEditor.jsx";
import WorkspaceShell from "./screens/WorkspaceShell.jsx";
import StagePlaceholder from "./screens/StagePlaceholder.jsx";
import Upload from "./screens/Upload.jsx";
import UserValidation from "./screens/UserValidation.jsx";
import Client from "./screens/Client.jsx";
import Scope from "./screens/Scope.jsx";
import Guidelines from "./screens/Guidelines.jsx";
import AIValidation from "./screens/AIValidation.jsx";
import QRE from "./screens/QRE.jsx";
import { Bronze, Gold } from "./screens/DataPreview.jsx";
import Categorisation from "./screens/Categorisation.jsx";
import KPIs from "./screens/KPIs.jsx";
import Primer from "./screens/Primer.jsx";
import OpModel from "./screens/OpModel.jsx";
import DoA from "./screens/DoA.jsx";
import BuyingChannel from "./screens/BuyingChannel.jsx";
import OrgStructure from "./screens/OrgStructure.jsx";
import FindingsDeck from "./screens/FindingsDeck.jsx";
import { MaterialMaster, PrToPo, PostPo, Supplier } from "./screens/V2Pillar.jsx";
import ExecSummary from "./screens/ExecSummary.jsx";
import KPIDashboard from "./screens/KPIDashboard.jsx";
import Comparison from "./screens/Comparison.jsx";
import Jobs from "./screens/Jobs.jsx";
import ExportCenter from "./screens/ExportCenter.jsx";

/* Map stage slug → real screen component (when one exists).
   Stages without a real component fall through to StagePlaceholder. */
const STAGE_SCREENS = {
  client: Client,
  scope: Scope,
  guidelines: Guidelines,
  upload: Upload,
  "ai-validation": AIValidation,
  "user-validation": UserValidation,
  qre: QRE,
  "bronze-data": Bronze,
  "gold-data": Gold,
  categorisation: Categorisation,
  kpis: KPIs,
  primer: Primer,
  "op-model": OpModel,
  "org-structure": OrgStructure,
  "buying-channel": BuyingChannel,
  doa: DoA,
  "material-master": MaterialMaster,
  "pr-to-po": PrToPo,
  "post-po": PostPo,
  "supplier": Supplier,
  "findings-deck": FindingsDeck,
  "exec-summary": ExecSummary,
  "kpi-dashboard": KPIDashboard,
  comparison: Comparison,
  jobs: Jobs,
  "export-centre": ExportCenter,
};

const StageRouter = () => {
  const { engagementId, stageSlug } = useParams();
  const viewMode = useViewMode();

  // Wait for view mode to resolve before deciding to redirect (avoids flash)
  if (viewMode === null) return null;

  // Client view: redirect anything outside the allowed set to Findings Deck
  if (viewMode === "client" && !CLIENT_VIEW_ALLOWED_STAGES.has(stageSlug)) {
    return <Navigate to={`/engagement/${engagementId}/findings-deck`} replace />;
  }

  const ScreenComponent = STAGE_SCREENS[stageSlug] || StagePlaceholder;
  // key forces a fresh mount per slug so state isn't carried across screens.
  return <ScreenComponent key={stageSlug} />;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route
        path="/engagement/:engagementId/:stageSlug"
        element={
          <WorkspaceShell>
            <StageRouter />
          </WorkspaceShell>
        }
      />

      <Route path="/engagement/new" element={<NewEngagement />} />
      <Route path="/kb" element={<KBEditor />} />
      <Route path="/engagement/:engagementId" element={<Navigate to="client" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
