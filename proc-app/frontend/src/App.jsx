import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./screens/Landing.jsx";
import WorkspaceShell from "./screens/WorkspaceShell.jsx";
import StagePlaceholder from "./screens/StagePlaceholder.jsx";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Engagement workspace — left rail + dynamic stage view */}
      <Route
        path="/engagement/:engagementId/:stageSlug"
        element={
          <WorkspaceShell>
            <StagePlaceholder />
          </WorkspaceShell>
        }
      />

      {/* Default — redirect to demo engagement upload stage */}
      <Route path="/engagement/new" element={<Navigate to="/engagement/demo/upload" replace />} />
      <Route path="/engagement/:engagementId" element={<Navigate to="upload" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
