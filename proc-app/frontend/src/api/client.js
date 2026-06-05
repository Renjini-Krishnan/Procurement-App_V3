/* API client — thin fetch wrapper around backend /api/*.
   Dev: vite proxies /api → http://localhost:8000. */

/* Download a binary response from a POST endpoint. */
export async function postDownload(path, body, suggestedFilename) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = await res.text(); }
    throw new Error(`Export failed: ${res.status} — ${typeof err === "string" ? err : err.detail}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  const filename = m ? m[1] : suggestedFilename || "download.bin";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  deleteEngagement: (id) => request(`/engagement/${id}`, { method: "DELETE" }),
  listOverrides: (id) => request(`/engagement/${id}/overrides`),
  upsertOverride: (id, key, value, override_type = "kpi_band") =>
    request(`/engagement/${id}/overrides`, { method: "POST", body: JSON.stringify({ key, value, override_type }) }),
  deleteOverride: (id, key) =>
    request(`/engagement/${id}/overrides/${encodeURIComponent(key)}`, { method: "DELETE" }),
  listPillarBenchmarks: (id, pillar) =>
    request(`/engagement/${id}/benchmarks/${pillar}`),

  // Reference documents (SOP / DoA / process flows / etc.)
  listDocuments: (id) => request(`/engagement/${id}/documents`),
  uploadDocument: async (id, file, kind) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const res = await fetch(`/api/engagement/${id}/documents`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  deleteDocument: (id, docId) =>
    request(`/engagement/${id}/documents/${docId}`, { method: "DELETE" }),
  updateDocumentKind: (id, docId, kind) =>
    request(`/engagement/${id}/documents/${docId}`, {
      method: "PATCH", body: JSON.stringify({ kind }),
    }),
  reingestDocument: (id, docId) =>
    request(`/engagement/${id}/documents/${docId}/reingest`, { method: "POST", body: "{}" }),
  downloadDocumentUrl: (id, docId) => `/api/engagement/${id}/documents/${docId}/download`,
  listDocumentChunks: (id, docId) =>
    request(`/engagement/${id}/documents/${docId}/chunks`),
  getStages: (id) => request(`/engagement/${id}/stages`),
  setStageStatus: (id, stageId, payload) =>
    request(`/engagement/${id}/stages/${stageId}`, { method: "POST", body: JSON.stringify(payload) }),

  // Upload (Stage 4 / 5 / 6)
  uploadSeed: (id, fileType = "PO") =>
    request(`/engagement/${id}/upload-seed?file_type=${fileType}`, { method: "POST", body: "{}" }),
  uploadAllSeeds: (id) =>
    request(`/engagement/${id}/upload-all-seeds`, { method: "POST", body: "{}" }),
  combinedSampleXlsxUrl: () => `/api/upload-samples/combined.xlsx`,
  llmStatus: () => request(`/llm/status`),
  llmTrace: (engagementId, limit = 100) =>
    request(`/llm/trace?limit=${limit}${engagementId ? `&engagement_id=${engagementId}` : ""}`),
  llmTraceClear: () => request(`/llm/trace`, { method: "DELETE" }),
  listSeeds: () => request("/seeds"),
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
  uploadsSummary: (id) => request(`/engagement/${id}/uploads/summary`),
  validationStatus: (id) => request(`/engagement/${id}/validation-status`),
  cleansingAudit: () => request(`/cleansing/audit`),
  cleansingReportCsvUrl: (id, scope = "all") =>
    `/api/engagement/${id}/cleansing-report.csv?scope=${encodeURIComponent(scope)}`,
  kpisExportCsvUrl: (id) => `/api/engagement/${id}/kpis/export.csv`,
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
  runMaterialMaster: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/material-master`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runPrToPo: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/pr-to-po`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runPostPo: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/post-po`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runSupplier: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/run-pillar/supplier`, {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  runKpiDashboard: (id, uploadId, industry = "steel", filters = {}) =>
    request(`/engagement/${id}/run-kpi-dashboard`, {
      method: "POST",
      body: JSON.stringify({
        upload_id: uploadId, industry,
        filter_plants: filters.plants && filters.plants.length ? filters.plants : null,
        filter_material_groups: filters.material_groups && filters.material_groups.length ? filters.material_groups : null,
        filter_period_start: filters.period_start || null,
        filter_period_end: filters.period_end || null,
      }),
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

  // Upload schemas (all file types)
  listUploadSchemas: () => request("/upload-schemas"),
  getUploadSchema: (file_type) => request(`/upload-schemas/${file_type}`),
  templateCsvUrl: (file_type) => `/api/upload-templates/${file_type}/blank.csv`,
  templateXlsxUrl: (file_type) => `/api/upload-templates/${file_type}/blank.xlsx`,
  uploadBatch: async (id, files) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const res = await fetch(`/api/engagement/${id}/upload-batch`, {
      method: "POST", body: form,
    });
    if (!res.ok) throw new Error(`Batch upload failed: ${res.status}`);
    return res.json();
  },

  // Exports
  exportFindingsDeckUrl: (id) => `/api/engagement/${id}/export/findings-deck.pptx`,
  exportExecSummaryUrl: (id) => `/api/engagement/${id}/export/exec-summary.pptx`,
  exportKpisXlsxUrl: (id) => `/api/engagement/${id}/export/kpis.xlsx`,
  exportBronzeCsvPath: (id) => `/engagement/${id}/export/bronze.csv`,
  exportGoldCsvPath: (id) => `/engagement/${id}/export/gold.csv`,
  exportFindingsDeckPath: (id) => `/engagement/${id}/export/findings-deck.pptx`,
  exportExecSummaryPath: (id) => `/engagement/${id}/export/exec-summary.pptx`,
  exportKpisXlsxPath: (id) => `/engagement/${id}/export/kpis.xlsx`,

  // Comparison
  getComparison: (id, pillar) =>
    request(`/engagement/${id}/comparison${pillar ? `?pillar=${pillar}` : ""}`),

  // Jobs (background)
  submitPillarJob: (id, pillar, uploadId, industry = "steel") =>
    request(`/engagement/${id}/jobs/run-pillar/${pillar}`, {
      method: "POST", body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  submitKpiJob: (id, uploadId, industry = "steel") =>
    request(`/engagement/${id}/jobs/run-kpi-dashboard`, {
      method: "POST", body: JSON.stringify({ upload_id: uploadId, industry }),
    }),
  listJobs: (id) => request(`/engagement/${id}/jobs`),
  getJob: (id, jobId) => request(`/engagement/${id}/jobs/${jobId}`),

  // LLM
  llmStatus: () => request("/llm/status"),
  clientAutofill: (client_name) =>
    request("/llm/client-autofill", { method: "POST", body: JSON.stringify({ client_name }) }),
  industryCategories: (industry) =>
    request(`/kb/industries/${industry}/procurement-categories`),
  getScopeConfig: () => request("/kb/scope-config"),

  // KB file editor
  listKbFiles: () => request("/kb/files/tree"),
  readKbFile: (root, path) =>
    request(`/kb/files/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`),
  writeKbFile: (root, path, content) =>
    request("/kb/files/write", { method: "POST", body: JSON.stringify({ root, path, content }) }),
};
