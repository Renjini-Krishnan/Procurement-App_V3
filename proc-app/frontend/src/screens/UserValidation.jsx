import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Button, Badge, Callout, Select } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { useEngagement } from "../hooks/useEngagement.js";

/* Stage 6: User Validation — column mapping HITL.
   Engine suggests raw column → canonical field mapping; consultant
   confirms / overrides. Required canonical fields must all be mapped
   before the file proceeds to Bronze. Multi-file aware: the page only
   advances the engagement to Stage 7 once every upload has its mapping
   confirmed. */

const confidenceTone = (c) => ({ high: "success", medium: "warn", low: "danger", none: "neutral" }[c] || "neutral");

const UserValidation = () => {
  const { engagement, loading: engLoading } = useEngagement();
  const [params, setParams] = useSearchParams();
  const uploadId = params.get("upload");
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});  // raw_column -> canonical_field
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [tracker, setTracker] = useState(null);  // validation-status response

  // Load the multi-file tracker (independent of which upload is open)
  const reloadTracker = async () => {
    if (!engagement) return null;
    try {
      const t = await api.validationStatus(engagement.id);
      setTracker(t);
      return t;
    } catch (e) {
      // tracker failure is non-fatal
      return null;
    }
  };

  useEffect(() => { reloadTracker(); /* eslint-disable-next-line */ }, [engagement]);

  // Auto-select first unconfirmed upload if no ?upload= param is set
  useEffect(() => {
    if (!engagement || uploadId || !tracker) return;
    const firstUnconfirmed = tracker.uploads.find((u) => !u.is_confirmed)
                          || tracker.uploads[0];
    if (firstUnconfirmed) {
      setParams({ upload: firstUnconfirmed.upload_id }, { replace: true });
    }
  }, [engagement, uploadId, tracker, setParams]);

  // Load the preview for the selected upload
  useEffect(() => {
    if (!engagement || !uploadId) return;
    setLoading(true); setSaveResult(null);
    api.previewUpload(engagement.id, uploadId, 8)
      .then((data) => {
        setPreview(data);
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

  // Build per-canonical-field sample values (first non-empty value across the file)
  const sampleByCanonical = useMemo(() => {
    if (!preview) return {};
    const map = {};
    (preview.suggested_mapping || []).forEach((m, idx) => {
      if (!m.suggested_field) return;
      for (const row of preview.sample_rows || []) {
        const v = row[idx];
        if (v != null && String(v).trim() !== "") {
          map[m.suggested_field] = String(v).slice(0, 24);
          break;
        }
      }
    });
    return map;
  }, [preview]);

  if (engLoading || !engagement) return <div>Loading engagement...</div>;
  if (loading) return <div style={{ color: "var(--ink-500)" }}>Loading preview...</div>;
  if (error) return <Callout tone="danger" title="Failed to load upload">{error}</Callout>;
  if (!uploadId || !preview) {
    return (
      <div>
        <Header />
        {tracker && tracker.total > 0 ? (
          <FileTracker tracker={tracker} currentUploadId={uploadId} onJump={(uid) => setParams({ upload: uid })} />
        ) : (
          <Callout tone="warn" title="No upload selected">
            Go back to{" "}
            <a href={`/engagement/${engagement.id}/upload`}>Data Upload</a>{" "}
            and upload a file first.
          </Callout>
        )}
      </div>
    );
  }

  const canonicalFields = preview.schema.fields;
  const requiredFields = canonicalFields.filter((f) => f.required).map((f) => f.field);
  const mappedCanonical = new Set(Object.values(mapping).filter((v) => v));
  const missingRequired = requiredFields.filter((f) => !mappedCanonical.has(f));

  // Detect raw columns that map to the same canonical field (collision)
  const canonicalCounts = {};
  Object.entries(mapping).forEach(([raw, canon]) => {
    if (canon) canonicalCounts[canon] = (canonicalCounts[canon] || 0) + 1;
  });
  const collisions = new Set(Object.entries(canonicalCounts).filter(([_, n]) => n > 1).map(([c]) => c));

  const handleMappingChange = (rawCol, canonical) => {
    setMapping((m) => ({ ...m, [rawCol]: canonical }));
  };

  // Bulk actions
  const acceptAllAI = () => {
    const next = {};
    for (const m of preview.suggested_mapping || []) {
      next[m.raw_column] = m.suggested_field || "";
    }
    setMapping(next);
  };
  const clearAll = () => {
    const next = {};
    for (const m of preview.suggested_mapping || []) next[m.raw_column] = "";
    setMapping(next);
  };

  const handleConfirm = async () => {
    setSaving(true); setError(null);
    try {
      const confirmedArray = Object.entries(mapping).map(([raw_column, canonical_field]) => ({
        raw_column,
        canonical_field: canonical_field || null,
      }));
      const result = await api.confirmMapping(engagement.id, uploadId, confirmedArray);
      setSaveResult(result);
      const t = await reloadTracker();
      if (result.all_ready_for_bronze) {
        // Route to QRE first — DoA + Org Structure pillars need it before
        // Bronze processing is meaningful. Consultant can still navigate
        // to Bronze from the left rail.
        setTimeout(() => navigate(`/engagement/${engagement.id}/qre`), 800);
      } else if (t) {
        // Auto-jump to next unconfirmed file after a brief pause
        const next = t.uploads.find((u) => !u.is_confirmed && u.upload_id !== uploadId);
        if (next) setTimeout(() => setParams({ upload: next.upload_id }), 600);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header />
      {tracker && <FileTracker tracker={tracker} currentUploadId={uploadId} onJump={(uid) => setParams({ upload: uid })} />}

      <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", maxWidth: "70ch", margin: "16px 0 16px 0" }}>
        We've identified <code style={{ background: "var(--surface-sunk)", padding: "1px 6px", borderRadius: 4 }}>{preview.original_filename}</code>{" "}
        as <strong>{preview.file_type}</strong> with{" "}
        <strong>{preview.row_count.toLocaleString()}</strong> rows and{" "}
        <strong>{preview.columns.length}</strong> columns. Confirm the mapping below.
        High-confidence matches are pre-selected.
      </p>

      {missingRequired.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title="Required fields not yet mapped" icon={<I.X size={16} />}>
            <div style={{ marginTop: 4 }}>
              {missingRequired.map((f) => {
                const fld = canonicalFields.find((x) => x.field === f);
                return (
                  <div key={f} style={{ marginBottom: 2 }}>
                    <code style={{ background: "var(--surface-sunk)", padding: "1px 6px", borderRadius: 4 }}>{f}</code>{" "}
                    — {fld?.description}
                  </div>
                );
              })}
            </div>
          </Callout>
        </div>
      )}

      {collisions.size > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title="Duplicate canonical mappings" icon={<I.X size={16} />}>
            More than one raw column is mapped to:{" "}
            {[...collisions].map((c) => (
              <code key={c} style={{ background: "var(--surface-sunk)", padding: "1px 6px", borderRadius: 4, marginRight: 6 }}>{c}</code>
            ))}
            . Only one will be used downstream.
          </Callout>
        </div>
      )}

      {saveResult && saveResult.all_ready_for_bronze && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="success" title="All uploads mapped — proceeding to QRE" icon={<I.Check size={16} />}>
            {saveResult.confirmed_count} of {saveResult.total_uploads} files confirmed.
            Answer the 52 QRE questions next; Bronze + downstream pillars run after that.
          </Callout>
        </div>
      )}
      {saveResult && !saveResult.all_ready_for_bronze && saveResult.ready_for_bronze && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="info" title="File mapped — jumping to next file" icon={<I.Check size={16} />}>
            {saveResult.confirmed_count} of {saveResult.total_uploads} files confirmed.
            Bronze starts once every file is mapped.
          </Callout>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>
          Bulk actions:
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={acceptAllAI}>Accept all AI suggestions</Button>
          <Button variant="outline" onClick={clearAll}>Clear all</Button>
        </div>
      </div>

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
              const currentCanonical = mapping[m.raw_column];
              const isCollision = currentCanonical && collisions.has(currentCanonical);
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
                    <span title={m.match_reason || ""} style={{ cursor: m.match_reason ? "help" : "default" }}>
                      <Badge tone={confidenceTone(m.confidence)}>{m.confidence}</Badge>
                    </span>
                  </td>
                  <td style={{ ...td, background: isCollision ? "var(--warn-50)" : "transparent" }}>
                    <Select
                      value={currentCanonical || ""}
                      onChange={(e) => handleMappingChange(m.raw_column, e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", fontSize: "var(--fs-13)" }}
                    >
                      <option value="">— Ignore this column —</option>
                      {canonicalFields.map((f) => {
                        const ex = sampleByCanonical[f.field];
                        const tag = f.required ? "(required)" : "(optional)";
                        const label = ex
                          ? `${f.field} ${tag} — e.g. ${ex}`
                          : `${f.field} ${tag}`;
                        return <option key={f.field} value={f.field}>{label}</option>;
                      })}
                    </Select>
                    {isCollision && (
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--warn-700)", marginTop: 2 }}>
                        Same canonical also mapped elsewhere
                      </div>
                    )}
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
            {saving ? "Saving..." : "Confirm mapping"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <Badge tone="brand">Diagnostic</Badge>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--ink-500)" }}>Stage 06</span>
    </div>
    <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px 0" }}>
      Column mapping
    </h1>
  </div>
);

const FileTracker = ({ tracker, currentUploadId, onJump }) => {
  if (!tracker || tracker.total === 0) return null;
  return (
    <Card padding={16} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-500)" }}>
          Files to validate
        </div>
        <div style={{ fontSize: "var(--fs-13)", color: tracker.all_ready_for_bronze ? "var(--success-700)" : "var(--ink-700)", fontWeight: 600 }}>
          {tracker.confirmed} / {tracker.total} confirmed
          {tracker.all_ready_for_bronze && " · Bronze unlocked"}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tracker.uploads.map((u) => {
          const isCurrent = u.upload_id === currentUploadId;
          const done = u.is_confirmed;
          return (
            <button
              key={u.upload_id}
              type="button"
              onClick={() => onJump(u.upload_id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                border: `1px solid ${isCurrent ? "var(--brand-700)" : "var(--border-default)"}`,
                background: done ? "var(--success-50)" : isCurrent ? "var(--brand-50)" : "var(--surface-elev)",
                color: done ? "var(--success-700)" : "var(--ink-900)",
                padding: "6px 10px", borderRadius: "var(--r-md)",
                fontSize: "var(--fs-12)", cursor: "pointer",
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              <span style={{ fontSize: "var(--fs-13)" }}>{done ? "✓" : "○"}</span>
              <span style={{ fontWeight: 500 }}>{u.file_type}</span>
              <span style={{ color: "var(--ink-500)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)" }}>
                {u.original_filename}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

const th = {
  textAlign: "left", padding: "10px 12px", fontSize: "var(--fs-11)",
  textTransform: "uppercase", letterSpacing: "0.06em",
  color: "var(--ink-600)", borderBottom: "1px solid var(--border-default)",
};
const td = {
  padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
  color: "var(--ink-800)",
};

export default UserValidation;
