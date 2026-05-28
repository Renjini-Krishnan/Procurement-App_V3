import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Button, Badge, Callout, Select } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 6: User Validation — column mapping HITL.
   Engine suggests raw column → canonical field mapping; consultant
   confirms / overrides. Required canonical fields must all be mapped
   before the file proceeds to Bronze. */

const confidenceTone = (c) => ({ high: "success", medium: "warn", low: "danger", none: "neutral" }[c] || "neutral");

const UserValidation = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [params] = useSearchParams();
  const uploadId = params.get("upload");
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});  // raw_column -> canonical_field
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    if (!engagement || !uploadId) return;
    setLoading(true);
    api.previewUpload(engagement.id, uploadId, 8)
      .then((data) => {
        setPreview(data);
        // Seed mapping state from suggestion OR previously-confirmed
        const seeded = {};
        const source = data.confirmed_mapping || data.suggested_mapping;
        for (const m of source || []) {
          seeded[m.raw_column] = m.canonical_field || m.suggested_field || "";
        }
        setMapping(seeded);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [engagement, uploadId]);

  if (engLoading || !engagement) return <div>Loading engagement...</div>;
  if (!uploadId) {
    return (
      <Callout tone="warn" title="No upload selected">
        Go back to{" "}
        <a href={`/engagement/${engagement.id}/upload`}>Data Upload</a>{" "}
        and upload a file first.
      </Callout>
    );
  }
  if (loading) return <div style={{ color: "var(--ink-500)" }}>Loading preview...</div>;
  if (error) return <Callout tone="danger" title="Failed to load upload">{error}</Callout>;
  if (!preview) return null;

  const canonicalFields = preview.schema.fields;
  const requiredFields = canonicalFields.filter((f) => f.required).map((f) => f.field);
  const mappedCanonical = new Set(Object.values(mapping).filter((v) => v));
  const missingRequired = requiredFields.filter((f) => !mappedCanonical.has(f));

  const handleMappingChange = (rawCol, canonical) => {
    setMapping((m) => ({ ...m, [rawCol]: canonical }));
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const confirmedArray = Object.entries(mapping).map(([raw_column, canonical_field]) => ({
        raw_column,
        canonical_field: canonical_field || null,
      }));
      const result = await api.confirmMapping(engagement.id, uploadId, confirmedArray);
      setSaveResult(result);
      if (result.ready_for_bronze) {
        setTimeout(() => navigate(`/engagement/${engagement.id}/bronze-data`), 800);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Badge tone="brand">Diagnostic</Badge>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
          Stage 06
        </span>
      </div>

      <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px 0" }}>
        Column mapping
      </h1>
      <p style={{ fontSize: "var(--fs-15)", color: "var(--ink-600)", maxWidth: "70ch", marginBottom: 24 }}>
        We've identified your file as <strong>{preview.file_type}</strong> with{" "}
        <strong>{preview.row_count.toLocaleString()}</strong> rows and{" "}
        <strong>{preview.columns.length}</strong> columns. Confirm the mapping below.
        High-confidence matches are pre-confirmed.
      </p>

      {missingRequired.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title="Required fields not yet mapped" icon={<I.X size={16} />}>
            <div style={{ marginTop: 4 }}>
              {missingRequired.map((f) => {
                const fld = canonicalFields.find((x) => x.field === f);
                return (
                  <div key={f} style={{ marginBottom: 2 }}>
                    <code style={{ background: "var(--surface-sunk)", padding: "1px 6px", borderRadius: 4 }}>
                      {f}
                    </code>{" "}
                    — {fld?.description}
                  </div>
                );
              })}
            </div>
          </Callout>
        </div>
      )}

      {saveResult && saveResult.ready_for_bronze && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="success" title="Mapping confirmed" icon={<I.Check size={16} />}>
            All required fields are mapped. Proceeding to Bronze Data...
          </Callout>
        </div>
      )}

      <Card padding={0} style={{ marginBottom: 24, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead>
            <tr style={{ background: "var(--surface-sunk)" }}>
              <th style={th}>Your column</th>
              <th style={th}>Sample value</th>
              <th style={th}>Suggested mapping</th>
              <th style={th}>Confidence</th>
              <th style={th}>Confirmed canonical field</th>
            </tr>
          </thead>
          <tbody>
            {preview.suggested_mapping.map((m, i) => {
              const sample = preview.sample_rows[0]?.[i] || "";
              return (
                <tr key={m.raw_column}>
                  <td style={td}><code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>{m.raw_column}</code></td>
                  <td style={{ ...td, color: "var(--ink-500)" }}>{String(sample).slice(0, 40)}</td>
                  <td style={td}>
                    {m.suggested_field ? (
                      <code style={{ background: "var(--surface-sunk)", padding: "1px 6px", borderRadius: 4 }}>
                        {m.suggested_field}
                      </code>
                    ) : (
                      <span style={{ color: "var(--ink-400)" }}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    <Badge tone={confidenceTone(m.confidence)}>{m.confidence}</Badge>
                  </td>
                  <td style={td}>
                    <Select
                      value={mapping[m.raw_column] || ""}
                      onChange={(e) => handleMappingChange(m.raw_column, e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", fontSize: "var(--fs-13)" }}
                    >
                      <option value="">— Ignore this column —</option>
                      {canonicalFields.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.field} {f.required ? "(required)" : ""}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>
          {mappedCanonical.size} of {canonicalFields.length} canonical fields mapped
          {missingRequired.length > 0 && (
            <span style={{ color: "var(--warn-500)", marginLeft: 8 }}>
              · {missingRequired.length} required missing
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={() => navigate(`/engagement/${engagement.id}/upload`)}>
            Back to Upload
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || missingRequired.length > 0}
            iconRight={<I.Arrow size={14} />}
          >
            {saving ? "Saving..." : "Confirm mapping → Bronze Data"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "var(--fs-11)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--ink-600)",
  borderBottom: "1px solid var(--border-default)",
};
const td = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--border-subtle)",
  color: "var(--ink-800)",
};

export default UserValidation;
