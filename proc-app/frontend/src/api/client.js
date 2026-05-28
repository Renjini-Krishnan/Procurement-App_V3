/* API client — thin fetch wrapper around backend /api/*.
   Dev: vite proxies /api → http://localhost:8000. */

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let body;
    try { body = await res.json(); } catch { body = await res.text(); }
    const err = new Error(`API error ${res.status}: ${path}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  // Some endpoints (file upload) may return non-JSON; default to JSON
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  // Health
  health: () => request("/health"),
  ready: () => request("/ready"),

  // Engagement
  createEngagement: (data) => request("/engagement", { method: "POST", body: JSON.stringify(data) }),
  listEngagements: () => request("/engagement"),
  getEngagement: (id) => request(`/engagement/${id}`),
  updateEngagement: (id, data) => request(`/engagement/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getStages: (id) => request(`/engagement/${id}/stages`),
  setStageStatus: (id, stageId, payload) =>
    request(`/engagement/${id}/stages/${stageId}`, { method: "POST", body: JSON.stringify(payload) }),

  // Upload (Stage 4 / 5 / 6)
  uploadSeed: (id) => request(`/engagement/${id}/upload-seed`, { method: "POST", body: "{}" }),
  uploadFile: async (id, file, fileType = "PO") => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/engagement/${id}/upload?file_type=${fileType}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
  listUploads: (id) => request(`/engagement/${id}/uploads`),
  previewUpload: (id, uploadId, limit = 20) =>
    request(`/engagement/${id}/uploads/${uploadId}/preview?limit=${limit}`),
  confirmMapping: (id, uploadId, confirmedMapping) =>
    request(`/engagement/${id}/uploads/${uploadId}/confirm-mapping`, {
      method: "POST",
      body: JSON.stringify({ confirmed_mapping: confirmedMapping }),
    }),

  // Pillar
  runOpModel: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/op-model`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runDoA: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/doa`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runBuyingChannel: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/buying-channel`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runOrgStructure: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/org-structure`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runKpiDashboard: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-kpi-dashboard`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runIntel: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-intel`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  listFindings: (id, pillar) =>
    request(`/engagement/${id}/findings${pillar ? `?pillar=${pillar}` : ""}`),
  listPillarRuns: (id, pillar) =>
    request(`/engagement/${id}/pillar-runs${pillar ? `?pillar=${pillar}` : ""}`),

  // QRE
  getQRE: (id) => request(`/engagement/${id}/qre`),
  saveQRE: (id, responses) =>
    request(`/engagement/${id}/qre`, { method: "POST", body: JSON.stringify({ responses }) }),

  // KB
  getStagesKB: () => request("/kb/stages"),
  listPillars: () => request("/kb/pillars"),
  getPillarConfig: (pillar) => request(`/kb/pillars/${pillar}/config`),
  getPillarBenchmarks: (pillar, industry) =>
    request(`/kb/pillars/${pillar}/benchmarks${industry ? `?industry=${industry}` : ""}`),
  getPillarRcaRules: (pillar) => request(`/kb/pillars/${pillar}/rca-rules`),
  getPillarScoringDescriptors: (pillar) => request(`/kb/pillars/${pillar}/scoring-descriptors`),
  getPillarMd: (pillar, name) => request(`/kb/pillars/${pillar}/md/${name}`),

  // KB file editor
  listKbFiles: () => request("/kb/files/tree"),
  readKbFile: (root, path) =>
    request(`/kb/files/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`),
  writeKbFile: (root, path, content) =>
    request("/kb/files/write", { method: "POST", body: JSON.stringify({ root, path, content }) }),
};
