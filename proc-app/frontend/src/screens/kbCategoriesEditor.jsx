/* Structured editor for categories-master.yml.
   Two-pane layout:
     - Left: sidebar of canonicals (search + archetype filter + add/delete)
     - Right: form for the selected canonical with all fields
   Serializes back to YAML via js-yaml on every change. */

import React, { useEffect, useMemo, useState } from "react";
import yaml from "js-yaml";
import { Card, Badge, Button, Callout, Input } from "../design/components.jsx";
import { I } from "../design/icons.jsx";

const ARCHETYPES = ["BULK", "DIRECT", "INDIRECT", "SERVICE", "CAPEX"];
const DIRECT_INDIRECT = ["D", "I"];
const MTART_OPTIONS = ["ROH", "HALB", "FERT", "ERSA", "HIBE", "DIEN", "ANLA", "VERP"];
const PSTYP_OPTIONS = ["B", "D", "K", "L", "A"];

const ARCH_TONES = {
  BULK:     { bg: "var(--brand-50)",   fg: "var(--brand-800)" },
  DIRECT:   { bg: "var(--brand-50)",   fg: "var(--brand-700)" },
  INDIRECT: { bg: "var(--success-50)", fg: "var(--success-700)" },
  SERVICE:  { bg: "var(--warn-50)",    fg: "var(--warn-700)" },
  CAPEX:    { bg: "var(--danger-50)",  fg: "var(--danger-700)" },
};

const CategoriesMasterView = ({ yamlText, onChange }) => {
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [archFilter, setArchFilter] = useState("All");

  // Parse YAML on mount + when external text changes (e.g. after Save → reload)
  useEffect(() => {
    try {
      const parsed = yaml.load(yamlText) || {};
      setData({
        metadata: parsed.metadata || { id: "categories-master", industry: "" },
        canonicals: Array.isArray(parsed.canonicals) ? parsed.canonicals : [],
      });
      setParseError(null);
      if (!selectedId && parsed.canonicals?.length) {
        setSelectedId(parsed.canonicals[0].id);
      }
    } catch (e) {
      setParseError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-serialize whenever data changes
  const propagate = (next) => {
    setData(next);
    try {
      const text = yaml.dump(
        { metadata: next.metadata, canonicals: next.canonicals },
        { lineWidth: -1, noRefs: true, sortKeys: false, quotingType: '"' },
      );
      onChange(text);
    } catch (e) {
      setParseError(`Could not serialize YAML: ${e.message}`);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.canonicals;
    if (archFilter !== "All") list = list.filter((c) => c.archetype === archFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.id || "").toLowerCase().includes(q) ||
        (c.label || "").toLowerCase().includes(q) ||
        ((c.keywords || []).join(" ").toLowerCase().includes(q)) ||
        ((c.synonyms || []).join(" ").toLowerCase().includes(q)),
      );
    }
    return list;
  }, [data, archFilter, search]);

  if (parseError) {
    return (
      <Callout tone="danger" title="YAML parse error" icon={<I.X size={16} />}>
        {parseError}. Switch to Raw YAML view to fix.
      </Callout>
    );
  }
  if (!data) return <div style={{ padding: 24, color: "var(--ink-500)" }}>Loading…</div>;

  const selected = data.canonicals.find((c) => c.id === selectedId) || null;

  const updateCanonical = (id, patch) => {
    const next = {
      ...data,
      canonicals: data.canonicals.map((c) => c.id === id ? { ...c, ...patch } : c),
    };
    propagate(next);
  };

  const updateMetadata = (patch) => propagate({ ...data, metadata: { ...data.metadata, ...patch } });

  const addCanonical = () => {
    const baseId = "new_canonical";
    let id = baseId, n = 1;
    while (data.canonicals.some((c) => c.id === id)) {
      id = `${baseId}_${n++}`;
    }
    const newCanon = {
      id,
      label: "New Category",
      archetype: "INDIRECT",
      direct_indirect: "I",
      keywords: [],
      synonyms: [],
      hsn_codes: [],
      vendor_specialisation_examples: [],
      sap_signals: { mtart: [], pstyp_excluded: [] },
      typical_spend_share_pct: [0, 0],
      typical_kpis: [],
      notes: "",
    };
    propagate({ ...data, canonicals: [...data.canonicals, newCanon] });
    setSelectedId(id);
  };

  const duplicateCanonical = (id) => {
    const src = data.canonicals.find((c) => c.id === id);
    if (!src) return;
    let copyId = `${src.id}_copy`, n = 1;
    while (data.canonicals.some((c) => c.id === copyId)) {
      copyId = `${src.id}_copy_${n++}`;
    }
    const copy = { ...JSON.parse(JSON.stringify(src)), id: copyId,
                    label: `${src.label || src.id} (copy)` };
    propagate({ ...data, canonicals: [...data.canonicals, copy] });
    setSelectedId(copyId);
  };

  const deleteCanonical = (id) => {
    if (!confirm(`Delete canonical "${id}"? This cannot be undone (until you Reset on the editor toolbar).`)) return;
    const next = { ...data, canonicals: data.canonicals.filter((c) => c.id !== id) };
    propagate(next);
    if (selectedId === id) setSelectedId(next.canonicals[0]?.id || null);
  };

  const renameCanonical = (oldId, newId) => {
    if (!newId || newId === oldId) return;
    if (data.canonicals.some((c) => c.id === newId)) {
      alert(`Canonical id "${newId}" already exists.`);
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(newId)) {
      alert(`Canonical id must be snake_case starting with a letter (got "${newId}").`);
      return;
    }
    const next = {
      ...data,
      canonicals: data.canonicals.map((c) => c.id === oldId ? { ...c, id: newId } : c),
    };
    propagate(next);
    if (selectedId === oldId) setSelectedId(newId);
  };

  return (
    <div>
      <MetadataCard metadata={data.metadata} onChange={updateMetadata}
                     canonicalCount={data.canonicals.length} />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginTop: 16 }}>
        <SidebarList
          canonicals={filtered}
          totalCount={data.canonicals.length}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={addCanonical}
          search={search}
          onSearch={setSearch}
          archFilter={archFilter}
          onArchFilter={setArchFilter}
        />

        {selected ? (
          <CanonicalForm
            canonical={selected}
            onChange={(patch) => updateCanonical(selected.id, patch)}
            onRename={(newId) => renameCanonical(selected.id, newId)}
            onDuplicate={() => duplicateCanonical(selected.id)}
            onDelete={() => deleteCanonical(selected.id)}
          />
        ) : (
          <Card padding={32} style={{ textAlign: "center", color: "var(--ink-500)" }}>
            No canonical selected. Use "+ Add new" to create one.
          </Card>
        )}
      </div>
    </div>
  );
};


// ────────────────────────────────────────────────────────────────────────────
// Metadata card (top)
// ────────────────────────────────────────────────────────────────────────────

const MetadataCard = ({ metadata, onChange, canonicalCount }) => (
  <Card padding={16}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <Label>Taxonomy metadata</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 8 }}>
          <FormField label="Industry" value={metadata.industry || ""}
                       onChange={(v) => onChange({ industry: v })} />
          <FormField label="Version" value={metadata.version || ""}
                       onChange={(v) => onChange({ version: v })} />
          <FormField label="Last updated" value={metadata.last_updated || ""}
                       onChange={(v) => onChange({ last_updated: v })} placeholder="YYYY-MM-DD" />
          <FormField label="Confidence" value={metadata.confidence || ""}
                       onChange={(v) => onChange({ confidence: v })} placeholder="high / medium / low" />
        </div>
        <div style={{ marginTop: 10 }}>
          <FormField label="Source" value={metadata.source || ""}
                       onChange={(v) => onChange({ source: v })}
                       full />
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Canonicals</div>
        <div style={{ fontSize: "var(--fs-28)", fontWeight: 600, color: "var(--ink-900)" }}>{canonicalCount}</div>
      </div>
    </div>
  </Card>
);


// ────────────────────────────────────────────────────────────────────────────
// Sidebar list of canonicals
// ────────────────────────────────────────────────────────────────────────────

const SidebarList = ({ canonicals, totalCount, selectedId, onSelect, onAdd,
                         search, onSearch, archFilter, onArchFilter }) => (
  <Card padding={0} style={{ display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Label>{canonicals.length} of {totalCount} canonicals</Label>
        <Button size="sm" onClick={onAdd}>+ Add new</Button>
      </div>
      <Input placeholder="Search id / label / keyword…" value={search}
              onChange={(e) => onSearch(e.target.value)} icon={<I.Search size={14} />} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
        {["All", ...ARCHETYPES].map((a) => (
          <button key={a} onClick={() => onArchFilter(a)}
                   style={{ padding: "3px 8px", fontSize: "var(--fs-11)", fontWeight: 600,
                             background: archFilter === a ? "var(--brand-700)" : "var(--surface-card)",
                             color: archFilter === a ? "white" : "var(--ink-700)",
                             border: "1px solid var(--border-default)",
                             borderRadius: "var(--r-pill)", cursor: "pointer" }}>{a}</button>
        ))}
      </div>
    </div>
    <div style={{ overflowY: "auto", padding: "6px 6px 8px" }}>
      {canonicals.map((c) => {
        const tone = ARCH_TONES[c.archetype] || { bg: "var(--surface-sunk)", fg: "var(--ink-600)" };
        const isSelected = c.id === selectedId;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)}
                   style={{
                     display: "block", width: "100%", textAlign: "left",
                     background: isSelected ? "var(--brand-50)" : "transparent",
                     border: "none", padding: "8px 10px", marginBottom: 2,
                     borderRadius: "var(--r-md)", cursor: "pointer",
                   }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)",
                              color: isSelected ? "var(--brand-700)" : "var(--ink-600)", fontWeight: 500 }}>
                {c.id}
              </div>
              <span style={{ background: tone.bg, color: tone.fg, padding: "1px 6px",
                              borderRadius: "var(--r-pill)", fontSize: "var(--fs-10)",
                              fontWeight: 700, whiteSpace: "nowrap" }}>{c.archetype}</span>
            </div>
            <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-900)", fontWeight: 500, marginTop: 2 }}>
              {c.label || "(no label)"}
            </div>
            {(c.hsn_codes?.length || c.vendor_specialisation_examples?.length) > 0 && (
              <div style={{ fontSize: "var(--fs-10)", color: "var(--ink-500)", marginTop: 3 }}>
                {c.hsn_codes?.length ? `${c.hsn_codes.length} HSN · ` : ""}
                {c.vendor_specialisation_examples?.length ? `${c.vendor_specialisation_examples.length} vendor anchors` : ""}
              </div>
            )}
          </button>
        );
      })}
      {canonicals.length === 0 && (
        <div style={{ padding: 16, fontSize: "var(--fs-12)", color: "var(--ink-500)", textAlign: "center" }}>
          No canonicals match filter.
        </div>
      )}
    </div>
  </Card>
);


// ────────────────────────────────────────────────────────────────────────────
// Canonical detail form
// ────────────────────────────────────────────────────────────────────────────

const CanonicalForm = ({ canonical, onChange, onRename, onDuplicate, onDelete }) => {
  const [editingId, setEditingId] = useState(canonical.id);

  // Sync editingId when canonical changes (e.g. user navigates to another)
  useEffect(() => { setEditingId(canonical.id); }, [canonical.id]);

  const sapSignals = canonical.sap_signals || {};
  const updateSap = (patch) => onChange({ sap_signals: { ...sapSignals, ...patch } });

  return (
    <Card padding={20}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Label>Canonical ID (snake_case primary key)</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <Input value={editingId} onChange={(e) => setEditingId(e.target.value)}
                    onBlur={() => onRename(editingId)}
                    style={{ flex: 1, fontFamily: "var(--font-mono)" }} />
            {editingId !== canonical.id && (
              <span style={{ fontSize: "var(--fs-11)", color: "var(--warn-700)" }}>
                blur to rename
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm" variant="outline" onClick={onDuplicate}>Duplicate</Button>
          <Button size="sm" variant="outline" onClick={onDelete}
                   style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>Delete</Button>
        </div>
      </div>

      {/* Basic identity */}
      <Section title="Basic identity">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <FormField label="Label (human-readable)" value={canonical.label || ""}
                       onChange={(v) => onChange({ label: v })} full />
          <FormField label="Archetype" value={canonical.archetype || ""}
                       onChange={(v) => onChange({ archetype: v })}
                       select options={ARCHETYPES} />
          <FormField label="Direct / Indirect" value={canonical.direct_indirect || ""}
                       onChange={(v) => onChange({ direct_indirect: v })}
                       select options={DIRECT_INDIRECT} />
        </div>
      </Section>

      {/* Classification signals — keywords + synonyms */}
      <Section title="Text-classification signals (Tier C)">
        <TagList label="Keywords"
                  hint="Matched against material_group_desc + short_text (case-insensitive, word-boundary)"
                  values={canonical.keywords || []}
                  onChange={(v) => onChange({ keywords: v })} />
        <div style={{ height: 8 }} />
        <TagList label="Synonyms"
                  hint="Same matching as keywords. Use for abbreviations + acronyms (e.g. 'BRG' for bearing)"
                  values={canonical.synonyms || []}
                  onChange={(v) => onChange({ synonyms: v })} />
      </Section>

      {/* External anchors */}
      <Section title="External anchors (Tier A + D)">
        <TagList label="HSN codes"
                  hint="4 / 6 / 8-digit HSN codes (CBIC GST). Longest match wins at Tier A."
                  values={canonical.hsn_codes || []}
                  onChange={(v) => onChange({ hsn_codes: v })}
                  validator={(s) => /^\d{4,8}$/.test(s) ? null : "must be 4-8 digits"} />
        <div style={{ height: 8 }} />
        <TagList label="Vendor specialisation examples"
                  hint="Vendor-name substrings that indicate this category (e.g. 'BEARINGS' → bearings)"
                  values={canonical.vendor_specialisation_examples || []}
                  onChange={(v) => onChange({ vendor_specialisation_examples: v })} />
      </Section>

      {/* SAP signals */}
      <Section title="SAP signals (Tiers A/B partition + E)">
        <Label>MTART (Material Type partition — narrows candidate canonicals)</Label>
        <ChipSelect options={MTART_OPTIONS} values={sapSignals.mtart || []}
                     onChange={(v) => updateSap({ mtart: v })} />
        <div style={{ height: 10 }} />
        <Label>PSTYP excluded (item categories that should NEVER match this canonical)</Label>
        <ChipSelect options={PSTYP_OPTIONS} values={sapSignals.pstyp_excluded || []}
                     onChange={(v) => updateSap({ pstyp_excluded: v })} />
        <div style={{ height: 10 }} />
        <Label>PSTYP allowed (item categories valid for this canonical)</Label>
        <ChipSelect options={PSTYP_OPTIONS} values={sapSignals.pstyp_allowed || []}
                     onChange={(v) => updateSap({ pstyp_allowed: v })} />
      </Section>

      {/* Informational fields */}
      <Section title="Informational (not used by classifier)">
        <Label>Typical spend share %</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <Input type="number" value={canonical.typical_spend_share_pct?.[0] ?? ""}
                  onChange={(e) => onChange({ typical_spend_share_pct: [Number(e.target.value), canonical.typical_spend_share_pct?.[1] ?? 0] })}
                  placeholder="low" style={{ width: 100 }} />
          <span style={{ color: "var(--ink-500)" }}>to</span>
          <Input type="number" value={canonical.typical_spend_share_pct?.[1] ?? ""}
                  onChange={(e) => onChange({ typical_spend_share_pct: [canonical.typical_spend_share_pct?.[0] ?? 0, Number(e.target.value)] })}
                  placeholder="high" style={{ width: 100 }} />
          <span style={{ color: "var(--ink-500)" }}>%</span>
        </div>
        <div style={{ height: 10 }} />
        <TagList label="Typical KPIs"
                  hint="KPIs that consultants commonly flag for this category (e.g. rc_adoption, savings_over_lpo)"
                  values={canonical.typical_kpis || []}
                  onChange={(v) => onChange({ typical_kpis: v })} />
        <div style={{ height: 10 }} />
        <Label>Notes</Label>
        <textarea value={canonical.notes || ""}
                   onChange={(e) => onChange({ notes: e.target.value })}
                   placeholder="Free-text consultant notes — context, gotchas, sourcing levers"
                   style={{ width: "100%", minHeight: 60, padding: 10, marginTop: 4,
                             fontFamily: "var(--font-sans)", fontSize: "var(--fs-13)",
                             border: "1px solid var(--border-default)",
                             borderRadius: "var(--r-md)", resize: "vertical" }} />
      </Section>
    </Card>
  );
};


// ────────────────────────────────────────────────────────────────────────────
// Building-block components
// ────────────────────────────────────────────────────────────────────────────

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--ink-500)", fontWeight: 600, marginBottom: 10 }}>{title}</div>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "var(--ink-600)", fontWeight: 600 }}>{children}</div>
);

const FormField = ({ label, value, onChange, placeholder, select, options, full }) => (
  <div style={{ minWidth: 0 }}>
    <Label>{label}</Label>
    {select ? (
      <select value={value} onChange={(e) => onChange(e.target.value)}
              style={{ width: full ? "100%" : "100%", marginTop: 4, padding: "7px 10px",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--r-md)", fontSize: "var(--fs-13)",
                        background: "var(--surface-card)" }}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <Input value={value} onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder} style={{ marginTop: 4 }} />
    )}
  </div>
);

const ChipSelect = ({ options, values, onChange }) => {
  const toggle = (opt) => {
    if (values.includes(opt)) onChange(values.filter((v) => v !== opt));
    else onChange([...values, opt]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {options.map((opt) => {
        const selected = values.includes(opt);
        return (
          <button key={opt} onClick={() => toggle(opt)}
                   style={{ padding: "4px 10px", fontSize: "var(--fs-12)", fontWeight: 600,
                             background: selected ? "var(--brand-700)" : "var(--surface-card)",
                             color: selected ? "white" : "var(--ink-700)",
                             border: "1px solid var(--border-default)",
                             borderRadius: "var(--r-pill)", cursor: "pointer",
                             fontFamily: "var(--font-mono)" }}>{opt}</button>
        );
      })}
    </div>
  );
};

const TagList = ({ label, hint, values, onChange, validator }) => {
  const [input, setInput] = useState("");
  const [err, setErr] = useState(null);
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (values.includes(v)) {
      setErr("Already added"); return;
    }
    if (validator) {
      const e = validator(v);
      if (e) { setErr(e); return; }
    }
    onChange([...values, v]);
    setInput("");
    setErr(null);
  };
  const remove = (v) => onChange(values.filter((x) => x !== v));
  return (
    <div>
      <Label>{label}</Label>
      {hint && <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>{hint}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, padding: "6px 8px",
                      border: "1px solid var(--border-default)", borderRadius: "var(--r-md)",
                      background: "var(--surface-card)", minHeight: 36, alignItems: "center" }}>
        {values.map((v) => (
          <span key={v} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "var(--brand-50)", color: "var(--brand-700)",
            padding: "2px 4px 2px 8px", borderRadius: "var(--r-pill)",
            fontSize: "var(--fs-12)", fontFamily: label === "HSN codes" ? "var(--font-mono)" : undefined,
          }}>
            {v}
            <button onClick={() => remove(v)}
                     style={{ background: "transparent", border: "none", cursor: "pointer",
                                color: "var(--brand-700)", padding: "0 4px", fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input value={input} onChange={(e) => { setInput(e.target.value); setErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
                onBlur={add}
                placeholder={values.length === 0 ? "Type and press Enter or comma…" : ""}
                style={{ flex: 1, minWidth: 120, border: "none", outline: "none",
                          padding: "2px 4px", fontSize: "var(--fs-13)",
                          background: "transparent" }} />
      </div>
      {err && <div style={{ fontSize: "var(--fs-11)", color: "var(--danger-700)", marginTop: 4 }}>{err}</div>}
    </div>
  );
};

export default CategoriesMasterView;
