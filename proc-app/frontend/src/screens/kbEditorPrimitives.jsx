/* Shared primitives used by every structured KB editor.
   Promotes a consistent look-and-feel across all 8+ editors. */

import React, { useState } from "react";
import { Card, Input } from "../design/components.jsx";

/* ===========================================================================
 * EditorIntro — banner explaining WHAT the editor is for + WHY it matters.
 * Every structured editor should mount one of these at the top.
 * ======================================================================== */

export const EditorIntro = ({ title, what, why, when, exampleEdits, danger }) => (
  <Card padding={20} style={{
    marginBottom: 16,
    borderLeft: `4px solid ${danger ? "var(--danger-500)" : "var(--brand-500)"}`,
    background: danger ? "var(--danger-50)" : "var(--brand-50)",
  }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em",
                    color: danger ? "var(--danger-700)" : "var(--brand-700)",
                    fontWeight: 700, marginBottom: 6 }}>
      What you're editing
    </div>
    <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, color: "var(--ink-900)", marginBottom: 8 }}>
      {title}
    </div>
    <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-800)", lineHeight: 1.55 }}>
      {what}
    </div>
    {why && (
      <div style={{ marginTop: 10, fontSize: "var(--fs-12)", color: "var(--ink-700)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--ink-900)" }}>Why it matters: </strong>{why}
      </div>
    )}
    {when && (
      <div style={{ marginTop: 6, fontSize: "var(--fs-12)", color: "var(--ink-700)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--ink-900)" }}>When to edit: </strong>{when}
      </div>
    )}
    {exampleEdits && exampleEdits.length > 0 && (
      <div style={{ marginTop: 8 }}>
        <strong style={{ fontSize: "var(--fs-12)", color: "var(--ink-900)" }}>Example edits:</strong>
        <ul style={{ margin: "4px 0 0 18px", padding: 0, fontSize: "var(--fs-12)",
                       color: "var(--ink-700)", lineHeight: 1.5 }}>
          {exampleEdits.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    )}
  </Card>
);


/* ===========================================================================
 * Section — labeled block within an editor form
 * ======================================================================== */

export const Section = ({ title, subtitle, children, transparent }) => (
  <div style={{
    marginBottom: 16, paddingBottom: 16,
    borderBottom: "1px solid var(--border-subtle)",
  }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--ink-500)", fontWeight: 600, marginBottom: 4 }}>
      {title}
    </div>
    {subtitle && (
      <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginBottom: 10, lineHeight: 1.45 }}>
        {subtitle}
      </div>
    )}
    {!subtitle && <div style={{ height: 6 }} />}
    {children}
  </div>
);


/* ===========================================================================
 * Label — small uppercase label above a field
 * ======================================================================== */

export const Label = ({ children, hint }) => (
  <div>
    <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--ink-600)", fontWeight: 600 }}>
      {children}
    </div>
    {hint && (
      <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2, lineHeight: 1.4 }}>
        {hint}
      </div>
    )}
  </div>
);


/* ===========================================================================
 * TextField + SelectField + TextArea — labeled inputs
 * ======================================================================== */

export const TextField = ({ label, hint, value, onChange, placeholder, type = "text", style = {} }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <Input type={type} value={value ?? ""}
            onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
            placeholder={placeholder}
            style={{ marginTop: 4, ...style }} />
  </div>
);

export const SelectField = ({ label, hint, value, onChange, options, allowBlank = true }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "7px 10px",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--r-md)", fontSize: "var(--fs-13)",
                      background: "var(--surface-card)" }}>
      {allowBlank && <option value="">—</option>}
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const TextAreaField = ({ label, hint, value, onChange, placeholder, rows = 3 }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder} rows={rows}
              style={{ width: "100%", marginTop: 4, padding: 10, resize: "vertical",
                        fontFamily: "var(--font-sans)", fontSize: "var(--fs-13)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--r-md)", lineHeight: 1.5 }} />
  </div>
);


/* ===========================================================================
 * CheckboxField
 * ======================================================================== */

export const CheckboxField = ({ label, hint, value, onChange }) => (
  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
            style={{ marginTop: 3 }} />
    <div>
      <div style={{ fontSize: "var(--fs-13)", fontWeight: 500, color: "var(--ink-900)" }}>{label}</div>
      {hint && <div style={{ fontSize: "var(--fs-11)", color: "var(--ink-500)", marginTop: 2 }}>{hint}</div>}
    </div>
  </label>
);


/* ===========================================================================
 * TagList — chip-input for editing string arrays. Enter / comma to add.
 * Optional validator returns error string or null per token.
 * ======================================================================== */

export const TagList = ({ label, hint, values = [], onChange, validator,
                            monoChips = false, placeholder }) => {
  const [input, setInput] = useState("");
  const [err, setErr] = useState(null);
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (values.includes(v)) { setErr("Already added"); return; }
    if (validator) {
      const e = validator(v);
      if (e) { setErr(e); return; }
    }
    onChange([...values, v]);
    setInput(""); setErr(null);
  };
  const remove = (v) => onChange(values.filter((x) => x !== v));
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6,
                       padding: "6px 8px", border: "1px solid var(--border-default)",
                       borderRadius: "var(--r-md)", background: "var(--surface-card)",
                       minHeight: 38, alignItems: "center" }}>
        {values.map((v) => (
          <span key={v} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "var(--brand-50)", color: "var(--brand-700)",
            padding: "2px 4px 2px 8px", borderRadius: "var(--r-pill)",
            fontSize: "var(--fs-12)",
            fontFamily: monoChips ? "var(--font-mono)" : undefined,
          }}>
            {v}
            <button onClick={() => remove(v)}
                     style={{ background: "transparent", border: "none", cursor: "pointer",
                                color: "var(--brand-700)", padding: "0 4px",
                                fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input value={input} onChange={(e) => { setInput(e.target.value); setErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
                onBlur={add}
                placeholder={values.length === 0 ? (placeholder || "Type and press Enter or comma…") : ""}
                style={{ flex: 1, minWidth: 100, border: "none", outline: "none",
                          padding: "2px 4px", fontSize: "var(--fs-13)",
                          background: "transparent" }} />
      </div>
      {err && <div style={{ fontSize: "var(--fs-11)", color: "var(--danger-700)", marginTop: 4 }}>{err}</div>}
    </div>
  );
};


/* ===========================================================================
 * ChipSelect — multi-select chips with fixed options (e.g. MTART values)
 * ======================================================================== */

export const ChipSelect = ({ label, hint, options, values = [], onChange, monoChips = false }) => {
  const toggle = (opt) => {
    if (values.includes(opt)) onChange(values.filter((v) => v !== opt));
    else onChange([...values, opt]);
  };
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {options.map((opt) => {
          const selected = values.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)}
                     style={{ padding: "4px 10px", fontSize: "var(--fs-12)", fontWeight: 600,
                               background: selected ? "var(--brand-700)" : "var(--surface-card)",
                               color: selected ? "white" : "var(--ink-700)",
                               border: "1px solid var(--border-default)",
                               borderRadius: "var(--r-pill)", cursor: "pointer",
                               fontFamily: monoChips ? "var(--font-mono)" : undefined }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
};


/* ===========================================================================
 * ItemCard — wraps a list item with id + delete + duplicate actions
 * ======================================================================== */

export const ItemCard = ({ children, id, onDelete, onDuplicate, color = "var(--brand-500)" }) => (
  <Card padding={16} style={{ borderLeft: `3px solid ${color}`, marginBottom: 10 }}>
    {children}
    {(onDelete || onDuplicate) && (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 12,
                       paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
        {onDuplicate && (
          <button onClick={onDuplicate} style={ghostBtn}>Duplicate</button>
        )}
        {onDelete && (
          <button onClick={() => confirm(`Delete ${id || "this item"}?`) && onDelete()}
                   style={{ ...ghostBtn, color: "var(--danger-700)" }}>Delete</button>
        )}
      </div>
    )}
  </Card>
);

const ghostBtn = {
  padding: "6px 12px", fontSize: "var(--fs-12)", fontWeight: 600,
  background: "transparent", color: "var(--ink-700)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--r-md)", cursor: "pointer",
};


/* ===========================================================================
 * ParseErrorBanner — when YAML can't be loaded
 * ======================================================================== */

export const ParseErrorBanner = ({ error }) => (
  <Card padding={20} style={{ borderLeft: "4px solid var(--danger-500)",
                                  background: "var(--danger-50)" }}>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--danger-700)", fontWeight: 700, marginBottom: 6 }}>
      Cannot parse this file
    </div>
    <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-900)", lineHeight: 1.5 }}>
      {error}. Switch to <strong>Raw YAML</strong> view (top-right toggle) to inspect and fix manually.
    </div>
  </Card>
);
