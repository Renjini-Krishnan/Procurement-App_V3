import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Badge, Callout, DataTable, Select } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 4: Data Upload.
   - Single-file mode (with explicit file-type selector)
   - Batch mode (drag-drop multiple files; auto-classifier picks each file_type)
   - Per-file-type template download (.csv + .xlsx)
   - Reports dedup hits + size rejections + classification confidence inline. */

const Upload = () => {
  const navigate = useNavigate();
  const { engagement, loading: engLoading } = useEngagement();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [seeds, setSeeds] = useState([]);
  const [selectedType, setSelectedType] = useState("PO");
  const [batchResults, setBatchResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (engagement) {
      api.listUploads(engagement.id).then(setUploads).catch(() => {});
      api.listUploadSchemas().then((r) => setSchemas(r.schemas || [])).catch(() => {});
      api.listSeeds().then((r) => setSeeds(r.seeds || [])).catch(() => {});
    }
  }, [engagement]);

  if (engLoading || !engagement) return <div>Loading engagement…</div>;

  const refreshUploads = async () => {
    const fresh = await api.listUploads(engagement.id);
    setUploads(fresh);
  };

  const handleSeedUpload = async (fileType = "PO") => {
    setUploading(true); setError(null);
    try {
      const result = await api.uploadSeed(engagement.id, fileType);
      await refreshUploads();
      navigate(`/engagement/${engagement.id}/user-validation?upload=${result.upload_id}`);
    } catch (e) {
      setError(e.body?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAllSeeds = async () => {
    setUploading(true); setError(null); setBatchResults(null);
    try {
      const result = await api.uploadAllSeeds(engagement.id);
      await refreshUploads();
      // Reuse the batch results table to show what loaded
      setBatchResults((result.files || []).map((f) => ({
        original_filename: f.filename || `${f.file_type}.csv`,
        size_bytes: 0,
        status: f.status === "loaded" ? "uploaded" : f.status,
        file_type: f.file_type,
        row_count: f.row_count,
        reason: f.reason,
      })));
    } catch (e) {
      setError(e.body?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const result = await api.uploadFile(engagement.id, file, selectedType);
      await refreshUploads();
      navigate(`/engagement/${engagement.id}/user-validation?upload=${result.upload_id}`);
    } catch (err) {
      // Surface dedup + size errors usefully
      const msg = err.body?.detail?.message || err.body?.detail || err.message;
      setError(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleBatch = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true); setError(null); setBatchResults(null);
    try {
      const r = await api.uploadBatch(engagement.id, files);
      setBatchResults(r.files || []);
      await refreshUploads();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    handleBatch(files);
  };

  const currentSchema = schemas.find((s) => s.file_type === selectedType);
  const currentSeed = seeds.find((s) => s.file_type === selectedType);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Badge tone="brand">Diagnostic</Badge>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 04</span>
      </div>
      <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px 0" }}>
        Data Upload
      </h1>
      <p style={{ fontSize: "var(--fs-15)", color: "var(--ink-600)", maxWidth: "70ch", marginBottom: 24 }}>
        Upload procurement data files. Drag multiple files into the batch zone for auto-classification, or pick a file type below for a single upload.
      </p>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="danger" title="Upload failed" icon={<I.X size={16} />}>{error}</Callout>
        </div>
      )}

      {/* Batch drag-drop zone */}
      <Card padding={28} style={{
        marginBottom: 16,
        border: `2px dashed ${dragOver ? "var(--brand-500)" : "var(--border-default)"}`,
        background: dragOver ? "var(--brand-50)" : "var(--surface-card)",
        transition: "all var(--dur-fast) var(--ease-out-soft)",
      }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--brand-700)", marginBottom: 8 }}>
            1 · Upload all data — batch + auto-classification
          </div>
          <div style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginBottom: 4 }}>
            Drop multiple files here (CSV / Excel)
          </div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)", marginBottom: 14 }}>
            Each file is classified by header overlap with the 8 schemas. Duplicates are detected by SHA256. Files {">"} 100 MB are rejected.
          </div>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 16px", fontSize: "var(--fs-14)", fontWeight: 500,
            background: "var(--brand-600)", color: "white",
            borderRadius: "var(--r-md)", cursor: uploading ? "wait" : "pointer",
            opacity: uploading ? 0.55 : 1,
          }}>
            <I.Upload size={16} />
            {uploading ? "Uploading…" : "Or click to pick multiple files"}
            <input type="file" multiple accept=".csv,.tsv,.txt,.xls,.xlsx"
                   style={{ display: "none" }}
                   onChange={(e) => handleBatch(Array.from(e.target.files || []))}
                   disabled={uploading} />
          </label>
        </div>
      </Card>

      {/* Batch results */}
      {batchResults && (
        <Card padding={20} style={{ marginBottom: 16 }}>
          <SectionLabel>Batch results · {batchResults.length} file(s)</SectionLabel>
          <table style={{ width: "100%", marginTop: 12, fontSize: "var(--fs-13)", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["File", "Size", "Status", "Detected type", "Confidence", "Rows / reason"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {batchResults.map((b, i) => {
                const tone = STATUS_TONES[b.status] || STATUS_TONES.unknown;
                return (
                  <tr key={i}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 500 }}>{b.original_filename}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)" }}>{((b.size_bytes || 0) / 1024).toFixed(0)} KB</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ background: tone.bg, color: tone.fg, padding: "2px 8px", borderRadius: "var(--r-pill)", fontSize: "var(--fs-11)", fontWeight: 600 }}>
                        {b.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{b.file_type || b.suggested_file_type || "—"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                      {b.classification && `${b.classification.confidence} (${(b.classification.score * 100).toFixed(0)}%)`}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--ink-600)", fontSize: "var(--fs-12)" }}>
                      {b.row_count ? `${b.row_count.toLocaleString("en-IN")} rows` : (b.reason || "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Continue button — advances to Stage 5 AI Validation. Only shows
              when at least one file uploaded successfully. */}
          {batchResults.some((b) => b.status === "uploaded") && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--success-50)",
                            borderRadius: "var(--r-md)", display: "flex",
                            justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "var(--fs-13)", color: "var(--success-700)" }}>
                <strong>{batchResults.filter((b) => b.status === "uploaded").length} of {batchResults.length} file(s) uploaded.</strong>
                {" "}Review the classifications above, then continue to AI Validation to confirm column mappings.
              </div>
              <Button onClick={() => navigate(`/engagement/${engagement.id}/ai-validation`)}
                       iconRight={<I.Arrow size={14} />}>
                Continue to AI Validation
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* 2 — Single-file upload (file-type selector + picker, combined) */}
      <Card padding={24} style={{ marginBottom: 16 }}>
        <Badge tone="brand">2 · Upload a single file</Badge>
        <h2 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "12px 0 8px 0" }}>
          Upload {currentSchema?.label || selectedType}
        </h2>
        <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
          Pick the file type, then choose one CSV or Excel file.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "center", marginBottom: 16 }}>
          <div>
            <SectionLabel>File type</SectionLabel>
            <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ marginTop: 6, width: "100%" }}>
              {schemas.map((s) => <option key={s.file_type} value={s.file_type}>{s.label}</option>)}
            </Select>
          </div>
          {currentSchema && (
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>
              <strong>{currentSchema.label}</strong> · {currentSchema.field_count} canonical fields ({currentSchema.required_count} required)
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={api.templateXlsxUrl(selectedType)} download
                   style={{ display: "inline-flex", gap: 6, padding: "4px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", fontSize: "var(--fs-12)", color: "var(--brand-700)", textDecoration: "none" }}>
                  <I.Doc size={12} /> XLSX template
                </a>
                <a href={api.templateCsvUrl(selectedType)} download
                   style={{ display: "inline-flex", gap: 6, padding: "4px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", fontSize: "var(--fs-12)", color: "var(--brand-700)", textDecoration: "none" }}>
                  <I.Doc size={12} /> CSV template
                </a>
              </div>
            </div>
          )}
        </div>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", fontSize: "var(--fs-14)", fontWeight: 500,
          background: "var(--surface-card)", border: "1px solid var(--border-default)",
          borderRadius: "var(--r-md)", cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.55 : 1,
        }}>
          <I.Upload size={16} />
          {uploading ? "Uploading…" : `Choose ${selectedType} file`}
          <input type="file" accept=".csv,.tsv,.txt,.xls,.xlsx"
                 style={{ display: "none" }} onChange={handleFileUpload} disabled={uploading} />
        </label>
      </Card>

      {/* 3 — Combined Excel template (for mailing to the client) */}
      <Card padding={20} style={{ marginBottom: 16, background: "var(--brand-50)",
                                     borderLeft: "3px solid var(--brand-500)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <Badge tone="brand">3 · Client-ready template</Badge>
            <h2 style={{ fontSize: "var(--fs-18)", fontWeight: 600, margin: "8px 0 4px 0" }}>
              Download all 8 templates in one Excel workbook
            </h2>
            <p style={{ fontSize: "var(--fs-13)", color: "var(--ink-700)", margin: 0, lineHeight: 1.5 }}>
              Single .xlsx with one tab per file type (PO, PR, GRN, Invoice, Vendor, Material,
              Org, Contract). Mail it to the client; they fill the tabs and send back.
            </p>
          </div>
          <a href={api.combinedSampleXlsxUrl()} download
             style={{ display: "inline-flex", alignItems: "center", gap: 8,
                       background: "var(--brand-600)", color: "white",
                       padding: "10px 18px", borderRadius: "var(--r-md)",
                       fontSize: "var(--fs-14)", fontWeight: 600,
                       textDecoration: "none", whiteSpace: "nowrap" }}>
            <I.Doc size={14} /> Download combined .xlsx
          </a>
        </div>
      </Card>

      {/* 4 — Schemas table (per-type templates + V1/V2 status) */}
      <Card padding={20} style={{ marginBottom: 16 }}>
        <SectionLabel>4 · Supported file types · per-type templates</SectionLabel>
        <table style={{ width: "100%", marginTop: 12, fontSize: "var(--fs-13)", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["File type", "Label", "Fields", "Required", "Template", "Schema YAML"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--ink-600)", fontSize: "var(--fs-11)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {schemas.map((s) => (
              <tr key={s.file_type} style={{ background: s.file_type === selectedType ? "var(--brand-50)" : "transparent", cursor: "pointer" }}
                  onClick={() => setSelectedType(s.file_type)}>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{s.file_type}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  {s.label}
                  {s.v1_status === "consumed_in_v1" && (
                    <span style={{ marginLeft: 8, padding: "1px 8px", background: "var(--success-50)", color: "var(--success-700)", borderRadius: "var(--r-pill)", fontSize: "var(--fs-10)", fontWeight: 700, letterSpacing: "0.08em" }} title={s.v1_status_note}>V1</span>
                  )}
                  {s.v1_status === "captured_for_v2" && (
                    <span style={{ marginLeft: 8, padding: "1px 8px", background: "var(--warn-50)", color: "var(--warn-700)", borderRadius: "var(--r-pill)", fontSize: "var(--fs-10)", fontWeight: 700, letterSpacing: "0.08em" }} title={s.v1_status_note}>V2</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{s.field_count}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{s.required_count}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <a href={api.templateXlsxUrl(s.file_type)} download onClick={(e) => e.stopPropagation()}
                     style={{ marginRight: 10, fontSize: "var(--fs-11)", color: "var(--brand-600)" }}>XLSX</a>
                  <a href={api.templateCsvUrl(s.file_type)} download onClick={(e) => e.stopPropagation()}
                     style={{ fontSize: "var(--fs-11)", color: "var(--brand-600)" }}>CSV</a>
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>{s.yaml_path}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 5 — Sample data (demo path) — kept at the bottom as a fallback for
          consultants who don't have client data yet. */}
      <Card padding={20} style={{ marginBottom: 24, background: "var(--surface-sunk)",
                                     borderLeft: "3px solid var(--ink-400)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <Badge tone="neutral">5 · No data yet? Use the demo dataset</Badge>
            <h2 style={{ fontSize: "var(--fs-16)", fontWeight: 600, margin: "8px 0 4px 0" }}>
              Load all 8 sample files in one click
            </h2>
            <p style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", margin: 0, lineHeight: 1.5 }}>
              Loads PO + PR + GRN + Invoice + Vendor / Material / Org / Contract masters
              (~36k rows). Mappings auto-confirmed; routes straight to QRE.
            </p>
          </div>
          <Button size="md" variant="outline" onClick={handleAllSeeds} disabled={uploading} iconRight={<I.Arrow size={14} />}>
            {uploading ? "Loading…" : "Load sample data"}
          </Button>
        </div>
      </Card>

      {/* Uploads list */}
      {uploads.length > 0 && (
        <div>
          <h3 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: "0 0 12px 0", color: "var(--ink-700)" }}>
            Uploads · {uploads.length}
          </h3>
          <Card padding={0}>
            <DataTable
              columns={[
                { key: "original_filename", label: "File" },
                { key: "file_type", label: "Type" },
                { key: "row_count", label: "Rows", align: "right" },
                { key: "size_bytes", label: "Size", align: "right",
                  render: (r) => r.size_bytes ? `${(r.size_bytes / 1024).toFixed(0)} KB` : "—" },
                { key: "auto_classified", label: "Source",
                  render: (r) => r.auto_classified ? <Badge tone="brand">auto</Badge> : <span style={{ color: "var(--ink-500)" }}>manual</span> },
                { key: "uploaded_at", label: "Uploaded" },
                {
                  key: "actions", label: "", align: "right",
                  render: (row) => (
                    <Button size="sm" variant="ghost"
                            onClick={() => navigate(`/engagement/${engagement.id}/user-validation?upload=${row.id}`)}>
                      Open mapping →
                    </Button>
                  ),
                },
              ]}
              rows={uploads}
            />
          </Card>
        </div>
      )}
    </div>
  );
};

const STATUS_TONES = {
  uploaded:       { bg: "var(--success-50)", fg: "var(--success-700)" },
  duplicate:      { bg: "var(--warn-50)",    fg: "var(--warn-700)" },
  low_confidence: { bg: "var(--warn-50)",    fg: "var(--warn-700)" },
  rejected:       { bg: "var(--danger-50)",  fg: "var(--danger-700)" },
  unknown:        { bg: "var(--surface-sunk)", fg: "var(--ink-700)" },
};

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", fontWeight: 600 }}>
    {children}
  </div>
);

export default Upload;
