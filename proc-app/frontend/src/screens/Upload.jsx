import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Badge, Callout, DataTable, Select } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 4: Data Upload.
   Supports 8 file types: PO, PR, Vendor Master, Material Master, Org Structure,
   Contract Master, GRN, Invoice. Each has a canonical schema (editable via KB
   editor → data-templates/<type>.yml). */

const Upload = () => {
  const navigate = useNavigate();
  const { engagement, loading: engLoading } = useEngagement();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [selectedType, setSelectedType] = useState("PO");

  useEffect(() => {
    if (engagement) {
      api.listUploads(engagement.id).then(setUploads).catch(() => {});
      api.listUploadSchemas().then((r) => setSchemas(r.schemas || [])).catch(() => {});
    }
  }, [engagement]);

  if (engLoading || !engagement) {
    return <div style={{ color: "var(--ink-500)" }}>Loading engagement...</div>;
  }

  const handleSeedUpload = async () => {
    setUploading(true); setError(null);
    try {
      const result = await api.uploadSeed(engagement.id);
      navigate(`/engagement/${engagement.id}/user-validation?upload=${result.upload_id}`);
    } catch (e) {
      setError(e.message);
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
      const refreshed = await api.listUploads(engagement.id);
      setUploads(refreshed);
      navigate(`/engagement/${engagement.id}/user-validation?upload=${result.upload_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const currentSchema = schemas.find((s) => s.file_type === selectedType);

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
        Upload procurement data files. 8 file types supported — each mapped to a canonical schema
        defined in <code>kb/_meta/data-templates/</code> (editable via KB editor).
      </p>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="danger" title="Upload failed" icon={<I.X size={16} />}>{error}</Callout>
        </div>
      )}

      {/* File-type picker */}
      <Card padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "center" }}>
          <div>
            <Label>File type</Label>
            <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ marginTop: 6, width: "100%" }}>
              {schemas.map((s) => (
                <option key={s.file_type} value={s.file_type}>{s.label}</option>
              ))}
            </Select>
          </div>
          {currentSchema && (
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>
              <strong>{currentSchema.label}</strong> · {currentSchema.field_count} canonical fields ({currentSchema.required_count} required)<br />
              Schema: <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>{currentSchema.yaml_path}</code> —{" "}
              <a href="/kb" style={{ color: "var(--brand-600)" }}>edit in KB editor</a>
            </div>
          )}
        </div>
      </Card>

      {/* Upload + seed actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card padding={28}>
          <Badge tone="gold">Demo</Badge>
          <h2 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "12px 0 8px 0" }}>Use sample PO dataset</h2>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
            ~9,200 PO lines · 6 plants · 55 vendors · 56 MGs (18-month window).
          </p>
          <Button size="md" onClick={handleSeedUpload} disabled={uploading} iconRight={<I.Arrow size={14} />}>
            {uploading ? "Loading sample..." : "Load PO sample"}
          </Button>
        </Card>

        <Card padding={28}>
          <Badge tone="brand">Your data</Badge>
          <h2 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "12px 0 8px 0" }}>
            Upload {currentSchema?.label || selectedType}
          </h2>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
            CSV or Excel. Column mapping happens in Stage 6 (User Validation).
          </p>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 16px", fontSize: "var(--fs-14)", fontWeight: 500,
            background: "var(--surface-card)", border: "1px solid var(--border-default)",
            borderRadius: "var(--r-md)", cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.55 : 1,
          }}>
            <I.Upload size={16} />
            {uploading ? "Uploading..." : `Choose ${selectedType} file`}
            <input type="file" accept=".csv,.tsv,.txt,.xls,.xlsx"
                   style={{ display: "none" }} onChange={handleFileUpload} disabled={uploading} />
          </label>
        </Card>
      </div>

      {/* Schemas table */}
      <Card padding={20} style={{ marginBottom: 24 }}>
        <Label>Supported file types · click to edit schema</Label>
        <table style={{ width: "100%", marginTop: 12, fontSize: "var(--fs-13)", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["File type", "Label", "Fields", "Required", "Schema YAML"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--ink-600)", fontSize: "var(--fs-11)", textTransform: "uppercase", borderBottom: "1px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schemas.map((s) => (
              <tr key={s.file_type} style={{ background: s.file_type === selectedType ? "var(--brand-50)" : "transparent", cursor: "pointer" }}
                  onClick={() => setSelectedType(s.file_type)}>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{s.file_type}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>{s.label}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{s.field_count}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right" }}>{s.required_count}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>{s.yaml_path}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Prior uploads */}
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

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)" }}>{children}</div>
);

export default Upload;
