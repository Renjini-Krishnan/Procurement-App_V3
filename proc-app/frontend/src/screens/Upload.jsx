import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Badge, Callout, DataTable } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 4: Data Upload.
   Two paths:
     - Upload your own CSV/XLSX (drag-drop / file picker)
     - Use the seed demo dataset (one-click for the V1 demo) */

const Upload = () => {
  const navigate = useNavigate();
  const { engagement, loading: engLoading } = useEngagement();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    if (engagement) {
      api.listUploads(engagement.id).then(setUploads).catch(() => {});
    }
  }, [engagement]);

  if (engLoading || !engagement) {
    return <div style={{ color: "var(--ink-500)" }}>Loading engagement...</div>;
  }

  const handleSeedUpload = async () => {
    setUploading(true);
    setError(null);
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
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadFile(engagement.id, file, "PO");
      navigate(`/engagement/${engagement.id}/user-validation?upload=${result.upload_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Badge tone="brand">Diagnostic</Badge>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
          Stage 04
        </span>
      </div>

      <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px 0" }}>
        Data Upload
      </h1>
      <p style={{ fontSize: "var(--fs-15)", color: "var(--ink-600)", maxWidth: "70ch", marginBottom: 32 }}>
        Upload your Purchase Order data. We'll auto-detect the column structure and ask
        you to confirm the mapping in the next step. For this demo, you can also use
        our pre-built sample dataset.
      </p>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="danger" title="Upload failed" icon={<I.X size={16} />}>
            {error}
          </Callout>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Demo seed card */}
        <Card padding={28}>
          <Badge tone="gold">Demo</Badge>
          <h2 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "12px 0 8px 0", letterSpacing: "-0.01em" }}>
            Use sample dataset
          </h2>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
            ~9,200 PO lines across 6 plants, 55 vendors, 56 material groups
            (18-month window of an integrated Indian steel mill).
          </p>
          <Button
            size="md"
            onClick={handleSeedUpload}
            disabled={uploading}
            iconRight={<I.Arrow size={14} />}
          >
            {uploading ? "Loading sample..." : "Load sample data"}
          </Button>
        </Card>

        {/* File upload card */}
        <Card padding={28}>
          <Badge tone="brand">Your data</Badge>
          <h2 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "12px 0 8px 0", letterSpacing: "-0.01em" }}>
            Upload PO file
          </h2>
          <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
            CSV or Excel (.xlsx). One row per PO line item. We'll match your column
            names to our canonical schema next.
          </p>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              fontSize: "var(--fs-14)",
              fontWeight: 500,
              background: "var(--surface-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--r-md)",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.55 : 1,
            }}
          >
            <I.Upload size={16} />
            {uploading ? "Uploading..." : "Choose file"}
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xls,.xlsx"
              style={{ display: "none" }}
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </Card>
      </div>

      {/* Prior uploads */}
      {uploads.length > 0 && (
        <div>
          <h3 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: "32px 0 12px 0", color: "var(--ink-700)" }}>
            Prior uploads
          </h3>
          <Card padding={0}>
            <DataTable
              columns={[
                { key: "original_filename", label: "File" },
                { key: "file_type", label: "Type" },
                { key: "row_count", label: "Rows", align: "right" },
                { key: "uploaded_at", label: "Uploaded" },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        navigate(`/engagement/${engagement.id}/user-validation?upload=${row.id}`)
                      }
                    >
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

export default Upload;
