import React, { useEffect, useMemo, useState } from "react";
import { Card, Badge, Button, Callout, Input } from "../design/components.jsx";
import { I } from "../design/icons.jsx";
import { Logo } from "../design/Logo.jsx";
import { api } from "../api/client.js";
import { pickStructuredView } from "./kbStructuredEditors.jsx";

/* KB Editor — in-app browser + editor for YAML + Markdown files.
   Left pane: file tree (grouped by root: function / standards / references / industries).
   Right pane: file content textarea with save + reset + dirty indicator.
   YAML files are validated server-side; loader cache is invalidated on save. */

const ROOT_LABELS = {
  function: "Function · Procurement",
  standards: "Standards (universal)",
  references: "References",
  industries: "Industries (overlays)",
};

const KBEditor = () => {
  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeRoot, setActiveRoot] = useState("function");
  const [selected, setSelected] = useState(null);     // { root, rel_path }
  const [content, setContent] = useState("");
  const [origContent, setOrigContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [viewMode, setViewMode] = useState("structured");  // 'structured' | 'raw'

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listKbFiles();
        setTree(r);
      } catch (e) {
        setTreeError(e.message || String(e));
      }
    })();
  }, []);

  // Default to structured view if a renderer is available for this file
  useEffect(() => {
    if (selected) {
      setViewMode(pickStructuredView(selected.rel_path) ? "structured" : "raw");
    }
  }, [selected?.rel_path]);

  const StructuredView = selected ? pickStructuredView(selected.rel_path) : null;

  const openFile = async (root, rel_path) => {
    setLoadingFile(true); setSaveError(null); setSaveMsg(null);
    try {
      const r = await api.readKbFile(root, rel_path);
      setSelected({ root, rel_path });
      setContent(r.content);
      setOrigContent(r.content);
    } catch (e) {
      setSaveError(e.message || String(e));
    } finally {
      setLoadingFile(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true); setSaveError(null); setSaveMsg(null);
    try {
      const r = await api.writeKbFile(selected.root, selected.rel_path, content);
      setOrigContent(content);
      setSaveMsg(`Saved · ${r.bytes_written} bytes. KB cache invalidated.`);
    } catch (e) {
      setSaveError(e.body?.detail || e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setContent(origContent); setSaveError(null); setSaveMsg(null); };

  const filtered = useMemo(() => {
    if (!tree) return [];
    let list = tree.files[activeRoot] || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.rel_path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
    }
    return list;
  }, [tree, activeRoot, search]);

  const dirty = content !== origContent;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-page)" }}>
      {/* Sidebar */}
      <aside style={{ width: 340, background: "var(--surface-card)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", maxHeight: "100vh", position: "sticky", top: 0 }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
          <div style={{ marginTop: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            KB Editor
          </div>
        </div>

        <div style={{ padding: "12px 16px 8px" }}>
          <Input placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)} icon={<I.Search size={14} />} />
        </div>

        <div style={{ padding: "0 16px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
          {tree && Object.keys(tree.files).map((r) => (
            <button key={r} onClick={() => setActiveRoot(r)}
                    style={{
                      padding: "4px 10px", fontSize: "var(--fs-11)",
                      background: activeRoot === r ? "var(--brand-600)" : "var(--surface-raised)",
                      color: activeRoot === r ? "white" : "var(--ink-700)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--r-pill)", cursor: "pointer",
                    }}>
              {r} · {tree.files[r]?.length || 0}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
          {treeError && <Callout tone="danger" title="Tree load failed" icon={<I.X size={14} />}>{treeError}</Callout>}
          {!tree && !treeError && <div style={{ padding: 12, color: "var(--ink-500)" }}>Loading…</div>}
          {filtered.map((f) => (
            <FileRow key={`${f.root}|${f.rel_path}`} file={f}
                     active={selected?.root === f.root && selected?.rel_path === f.rel_path}
                     onClick={() => openFile(f.root, f.rel_path)} />
          ))}
          {filtered.length === 0 && tree && <div style={{ padding: 12, fontSize: "var(--fs-12)", color: "var(--ink-500)" }}>No files match.</div>}
        </div>
      </aside>

      {/* Editor */}
      <main style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column" }}>
        {!selected && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Card padding={32} style={{ maxWidth: 500, textAlign: "center" }}>
              <Badge tone="brand">KB Editor</Badge>
              <h2 style={{ fontSize: "var(--fs-24)", fontWeight: 600, margin: "12px 0 8px 0", letterSpacing: "-0.01em" }}>
                Choose a file from the sidebar
              </h2>
              <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-600)", lineHeight: 1.5, margin: 0 }}>
                Edit YAML benchmarks, scoring descriptors, RCA rules, and Markdown analysis frameworks.
                YAML files are syntax-checked on save; the loader cache invalidates so changes take effect on the next pillar run.
              </p>
            </Card>
          </div>
        )}

        {selected && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {ROOT_LABELS[selected.root] || selected.root}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-16)", fontWeight: 600, marginTop: 4, color: "var(--ink-900)" }}>
                  {selected.rel_path}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {StructuredView && (
                  <div style={{ display: "flex", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                    <button onClick={() => setViewMode("structured")}
                            style={{ padding: "6px 12px", fontSize: "var(--fs-12)", fontWeight: 600,
                                     background: viewMode === "structured" ? "var(--brand-600)" : "var(--surface-card)",
                                     color: viewMode === "structured" ? "white" : "var(--ink-700)",
                                     border: "none", cursor: "pointer" }}>Structured</button>
                    <button onClick={() => setViewMode("raw")}
                            style={{ padding: "6px 12px", fontSize: "var(--fs-12)", fontWeight: 600,
                                     background: viewMode === "raw" ? "var(--brand-600)" : "var(--surface-card)",
                                     color: viewMode === "raw" ? "white" : "var(--ink-700)",
                                     border: "none", cursor: "pointer" }}>Raw YAML</button>
                  </div>
                )}
                {dirty && <Badge tone="warn">unsaved</Badge>}
                <Button variant="outline" disabled={!dirty || saving} onClick={reset}>Reset</Button>
                <Button disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>

            {saveError && <div style={{ marginBottom: 12 }}><Callout tone="danger" title="Save failed" icon={<I.X size={14} />}>{saveError}</Callout></div>}
            {saveMsg && <div style={{ marginBottom: 12 }}><Callout tone="success" title={saveMsg} icon={<I.Check size={14} />} /></div>}

            {viewMode === "structured" && StructuredView ? (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <StructuredView yamlText={content} onChange={setContent} />
              </div>
            ) : (
              <Card padding={0} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 480 }}>
                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
                  <span>{loadingFile ? "Loading…" : `${content.split("\n").length} lines · ${content.length} chars`}</span>
                  <span>{selected.rel_path.endsWith(".md") ? "Markdown" : "YAML"}</span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  spellCheck={false}
                  style={{
                    flex: 1, width: "100%", border: "none", resize: "none",
                    padding: 14, fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)",
                    lineHeight: 1.55, color: "var(--ink-900)", background: "var(--surface-card)",
                    outline: "none", minHeight: 480,
                  }}
                />
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const FileRow = ({ file, active, onClick }) => (
  <button onClick={onClick}
          style={{
            display: "block", width: "100%", textAlign: "left",
            background: active ? "var(--brand-50)" : "transparent",
            border: "none", padding: "6px 10px", cursor: "pointer",
            borderRadius: "var(--r-md)", marginBottom: 1,
          }}>
    <div style={{ fontSize: "var(--fs-12)", fontWeight: active ? 600 : 500, color: active ? "var(--brand-700)" : "var(--ink-800)", fontFamily: "var(--font-mono)" }}>
      {file.rel_path}
    </div>
    <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", marginTop: 1 }}>
      {file.ext.toUpperCase()} · {(file.size_bytes / 1024).toFixed(1)} KB
    </div>
  </button>
);

export default KBEditor;
