/* Reference documents shelf — embedded on Stage 1 (Client.jsx).
   - Drag-drop or click any of: PDF, DOCX, PNG, JPG, MD, TXT
   - Per row: filename, kind dropdown, page count, status badge, actions
   - Polls every 2 seconds while any doc is in pending/parsing/embedding
   - When engagement is null (Stage 1 in 'new' mode), upload is disabled
     with a clear message — save the engagement first to enable. */

import React, { useEffect, useRef, useState } from "react";
import { Card, Button } from "../design/components.jsx";
import { api } from "../api/client.js";

const KIND_OPTIONS = [
  { value: "sop",            label: "Procurement SOP" },
  { value: "dop",            label: "DoA / DoP matrix" },
  { value: "proc_policy",    label: "Procurement Policy" },
  { value: "org_chart",      label: "Org Chart / RACI" },
  { value: "asis_flow",      label: "As-Is Process Flow" },
  { value: "cat_strategy",   label: "Category Strategy" },
  { value: "contract_doc",   label: "Contract / RC" },
  { value: "past_report",    label: "Past Advisor Report" },
  { value: "annual_report",  label: "Annual Report / Investor" },
  { value: "other",          label: "Other" },
];
const KIND_LABEL = Object.fromEntries(KIND_OPTIONS.map((o) => [o.value, o.label]));

const ACCEPT = ".pdf,.docx,.doc,.md,.txt,.png,.jpg,.jpeg,.gif,.webp";
const TERMINAL = new Set(["ready", "failed"]);

const DocumentsShelf = ({ engagementId }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);

  const refresh = async () => {
    if (!engagementId) { setDocs([]); setLoading(false); return; }
    try {
      const r = await api.listDocuments(engagementId);
      setDocs(r.documents || []);
    } catch (e) {
      setError(e.body?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [engagementId]);

  // Auto-poll while any doc is being ingested
  useEffect(() => {
    if (!engagementId) return;
    const ingesting = docs.some((d) => !TERMINAL.has(d.status));
    if (!ingesting) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [engagementId, docs]);

  const uploadFiles = async (files) => {
    if (!engagementId) {
      alert("Please save the engagement first to enable document uploads.");
      return;
    }
    if (!files || files.length === 0) return;
    setUploading(true); setError(null);
    try {
      for (const f of files) {
        // Guess kind from filename, fall back to 'other'
        const guess = guessKind(f.name);
        try { await api.uploadDocument(engagementId, f, guess); }
        catch (e) { setError(`Failed: ${f.name}: ${e.message || e}`); }
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  };

  const updateKind = async (docId, kind) => {
    try { await api.updateDocumentKind(engagementId, docId, kind); await refresh(); }
    catch (e) { setError(e.message); }
  };

  const deleteDoc = async (docId) => {
    if (!confirm("Delete this document and its embeddings?")) return;
    try { await api.deleteDocument(engagementId, docId); await refresh(); }
    catch (e) { setError(e.message); }
  };

  const retry = async (docId) => {
    try { await api.reingestDocument(engagementId, docId); await refresh(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <SectionHeader title="Reference documents"
                     sub="Upload SOPs, DoA matrices, process flow PDFs, org charts. The AI uses them to ground every pillar's insights in this client's specifics." />

      {/* Drop zone */}
      <Card padding={20} style={{
        marginTop: 12,
        border: `2px dashed ${dragOver ? "var(--brand-500)" : "var(--border-default)"}`,
        background: dragOver ? "var(--brand-50)" : "var(--surface-card)",
        textAlign: "center",
        cursor: engagementId ? "pointer" : "not-allowed",
        opacity: engagementId ? 1 : 0.55,
      }}
        onDragOver={(e) => { if (engagementId) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => engagementId && fileInput.current?.click()}>
        <div style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--ink-900)" }}>
          {engagementId ? "Drop PDFs / DOCX / images here, or click to browse" : "Save the engagement first to enable uploads"}
        </div>
        <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4 }}>
          PDF · DOCX · MD · TXT · PNG / JPG / WEBP · max 50 MB each · cap 20 docs per engagement
        </div>
        <input ref={fileInput} type="file" accept={ACCEPT} multiple style={{ display: "none" }}
               onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      </Card>

      {error && (
        <div style={{ marginTop: 10, padding: 10, background: "var(--danger-50)",
                         color: "var(--danger-700)", borderRadius: "var(--r-md)",
                         fontSize: "var(--fs-12)" }}>
          {error}
        </div>
      )}

      {/* Document list */}
      {!loading && docs.length > 0 && (
        <Card padding={0} style={{ marginTop: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunk)" }}>
                {["Filename", "Kind", "Pages / Chunks", "Status", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td style={td}>
                    <a href={api.downloadDocumentUrl(engagementId, d.id)} target="_blank" rel="noreferrer"
                       style={{ color: "var(--brand-700)", textDecoration: "none", fontWeight: 500 }}>
                      📄 {d.original_filename}
                    </a>
                    <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>
                      {(d.size_bytes / 1024).toFixed(0)} KB
                    </div>
                  </td>
                  <td style={td}>
                    <select value={d.kind} onChange={(e) => updateKind(d.id, e.target.value)}
                            style={selectStyle}>
                      {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, color: "var(--ink-700)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
                    {d.page_count || "—"} p · {d.chunk_count || 0} chunks
                  </td>
                  <td style={td}>
                    <StatusBadge status={d.status} error={d.error_message} />
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {d.status === "failed" && (
                      <button onClick={() => retry(d.id)} style={btnLink}>Retry</button>
                    )}
                    <button onClick={() => deleteDoc(d.id)}
                            style={{ ...btnLink, color: "var(--danger-700)", marginLeft: 8 }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {uploading && (
        <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
          Uploading…
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status, error }) => {
  const map = {
    pending:    { bg: "var(--surface-sunk)", fg: "var(--ink-600)", label: "Pending" },
    parsing:    { bg: "var(--warn-50, #fff7e6)", fg: "var(--warn-700, #a06400)", label: "⚙ Parsing" },
    embedding:  { bg: "var(--warn-50, #fff7e6)", fg: "var(--warn-700, #a06400)", label: "⚙ Embedding" },
    ready:      { bg: "var(--success-50, #e7f6ec)", fg: "var(--success-700, #1f6b3f)", label: "✓ Ready" },
    failed:     { bg: "var(--danger-50)", fg: "var(--danger-700)", label: "❌ Failed" },
  };
  const m = map[status] || map.pending;
  return (
    <span title={error || ""} style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "var(--r-pill)",
      background: m.bg, color: m.fg, fontSize: "var(--fs-11)", fontWeight: 600,
      cursor: error ? "help" : "default",
    }}>{m.label}</span>
  );
};

// Filename → best-guess kind. Helps consultants since most files are obviously named.
const guessKind = (name) => {
  const n = (name || "").toLowerCase();
  if (/(^|[_\- ])sop([_\- .]|$)/.test(n)) return "sop";
  if (/(^|[_\- ])(doa|dop|delegation)([_\- .]|$)/.test(n)) return "dop";
  if (/policy/.test(n)) return "proc_policy";
  if (/(orgchart|raci|org_chart|reporting)/.test(n)) return "org_chart";
  if (/(asis|as-is|process[_\- ]flow|process_map)/.test(n)) return "asis_flow";
  if (/(category|strategy)/.test(n)) return "cat_strategy";
  if (/(contract|rc[_\- ])/.test(n)) return "contract_doc";
  if (/(annual|investor|10-?k|10k|q[1-4]fy)/.test(n)) return "annual_report";
  if (/report/.test(n)) return "past_report";
  return "other";
};

const SectionHeader = ({ title, sub }) => (
  <div>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", fontWeight: 600 }}>{title}</div>
    {sub && <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginTop: 4, maxWidth: "70ch" }}>{sub}</div>}
  </div>
);

const th = { textAlign: "left", padding: "10px 12px", fontSize: "var(--fs-11)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--ink-600)", borderBottom: "1px solid var(--border-default)" };
const td = { padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
              color: "var(--ink-800)", verticalAlign: "top" };
const selectStyle = { padding: "5px 10px", border: "1px solid var(--border-default)",
                       borderRadius: "var(--r-md)", fontSize: "var(--fs-12)",
                       background: "var(--surface-card)" };
const btnLink = { background: "transparent", border: "none", color: "var(--brand-700)",
                   fontSize: "var(--fs-12)", fontWeight: 600, cursor: "pointer", padding: 0 };

export default DocumentsShelf;
