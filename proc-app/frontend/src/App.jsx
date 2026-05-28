import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./screens/Landing.jsx";
import WorkspaceShell from "./screens/WorkspaceShell.jsx";
import StagePlaceholder from "./screens/StagePlaceholder.jsx";
import Upload from "./screens/Upload.jsx";
import UserValidation from "./screens/UserValidation.jsx";

/* Map stage slug → real screen component (when one exists).
   Stages without a real component fall through to StagePlaceholder. */
const STAGE_SCREENS = {
  upload: Upload,
  "user-validation": UserValidation,
};

const StageRouter = () => {
  const path = window.location.pathname;
  const slug = path.split("/").pop();
  const ScreenComponent = STAGE_SCREENS[slug] || StagePlaceholder;
  return <ScreenComponent />;
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

      <Route path="/engagement/new" element={<Navigate to="/engagement/demo/upload" replace />} />
      <Route path="/engagement/:engagementId" element={<Navigate to="upload" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
