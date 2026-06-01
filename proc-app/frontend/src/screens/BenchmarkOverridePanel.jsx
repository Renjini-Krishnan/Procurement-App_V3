import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Badge, Button, Callout } from "../design/components.jsx";
import { api } from "../api/client.js";

/* BenchmarkOverridePanel — engagement-level benchmark cascade view.
   For each benchmark used by the pillar:
     - Shows the active value + which layer supplied it (Function / Industry / Engagement)
     - Shows the underlying base value when an override is in place
     - Lets the consultant override value_range / source / year / notes
     - Lets the consultant reset (delete) an override
     - Links straight to the KB file for permanent edits

   Mount this inside any pillar page that wants engagement-level benchmark control.

   Props:
     engagementId — current engagement
     pillar — slug used by /api/engagement/{id}/benchmarks/{pillar}
     kbHref — optional /kb?root=...&file=... deep-link for "Edit in KB" */

const BenchmarkOverridePanel = ({ engagementId, pillar, kbHref, title }) => {
  const [benchmarks, setBenchmarks] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);  // benchmark id under edit
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const r = await api.listPillarBenchmarks(engagementId, pillar);
      setBenchmarks(r.benchmarks || []);
      setError(null);
    } catch (e) {
      setError(e.body?.detail || e.message || String(e));
    }
  };

  useEffect(() => { if (engagementId) reload(); /* eslint-disable-next-line */ }, [engagementId, pillar]);

  const save = async (bid, patch) => {
    setBusy(true);
    try {
      await api.upsertOverride(engagementId, bid, patch, "benchmark");
      await reload();
      setEditing(null);
    } catch (e) {
      setError(e.body?.detail || e.message || String(e));
    } finally { setBusy(false); }
  };
  const reset = async (bid) => {
    if (!confirm(`Reset override for ${bid} back to the KB cascade value?`)) return;
    setBusy(true);
    try {
      await api.deleteOverride(engagementId, bid);
      await reload();
    } catch (e) {
      setError(e.body?.detail || e.message || String(e));
    } finally { setBusy(false); }
  };

  if (!benchmarks) {
    return error
      ? <Callout tone="danger" title="Benchmarks unavailable">{error}</Callout>
      : <div style={{ padding: 16, color: "var(--ink-500)" }}>Loading benchmarks…</div>;
  }
  if (benchmarks.length === 0) {
    return (
      <Card padding={16} style={{ background: "var(--surface-sunk)" }}>
        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-600)" }}>
          No benchmarks configured for this pillar.
          {kbHref && <> <Link to={kbHref}>Add some in the KB editor →</Link></>}
        </div>
      </Card>
    );
  }

  const overrideCount = benchmarks.filter((b) => b.overridden).length;

  return (
    <Card padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-500)", fontWeight: 600 }}>
            Benchmarks · cascade
          </div>
          <h3 style={{ fontSize: "var(--fs-18)", fontWeight: 600, margin: "4px 0 0 0" }}>
            {title || "Pillar benchmarks"}
            {overrideCount > 0 && (
              <Badge tone="warn" style={{ marginLeft: 10 }}>{overrideCount} overridden</Badge>
            )}
          </h3>
          <p style={{ fontSize: "var(--fs-12)", color: "var(--ink-600)", margin: "6px 0 0 0", lineHeight: 1.5 }}>
            Cascade: <strong>Function default → Industry overlay → Engagement override</strong>. Most
            specific wins. Override here for this engagement only; edit the KB file
            to change defaults across all engagements.
          </p>
        </div>
        {kbHref && (
          <Link to={kbHref}
                style={{ display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", border: "1px solid var(--brand-500)",
                          color: "var(--brand-700)", borderRadius: "var(--r-md)",
                          fontSize: "var(--fs-12)", fontWeight: 600,
                          textDecoration: "none", whiteSpace: "nowrap" }}>
            Edit in KB →
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {benchmarks.map((b) => (
          <BenchmarkRow
            key={b.id} b={b}
            isEditing={editing === b.id}
            onEditOpen={() => setEditing(b.id)}
            onEditClose={() => setEditing(null)}
            onSave={(patch) => save(b.id, patch)}
            onReset={() => reset(b.id)}
            busy={busy}
          />
        ))}
      </div>
    </Card>
  );
};


const BenchmarkRow = ({ b, isEditing, onEditOpen, onEditClose, onSave, onReset, busy }) => {
  const layer = b.layer || "function";
  const layerTone = layer === "engagement" ? "warn"
                    : layer === "industry" ? "brand" : "neutral";
  const layerLabel = layer === "engagement" ? "Engagement override"
                     : layer === "industry" ? "Industry overlay"
                     : "Function default";
  const formatRange = (vr, unit) =>
    Array.isArray(vr) && vr.length === 2
      ? `${vr[0]}–${vr[1]}${unit || ""}` : "—";

  return (
    <div style={{
      padding: 12,
      background: b.overridden ? "var(--warn-50)" : "var(--surface-card)",
      border: "1px solid " + (b.overridden ? "var(--warn-300, #ead8a8)" : "var(--border-subtle)"),
      borderRadius: "var(--r-md)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-11)", color: "var(--ink-500)", wordBreak: "break-all" }}>
              {b.id}
            </code>
            <Badge tone={layerTone}>{layerLabel}</Badge>
          </div>
          <div style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--ink-900)" }}>{b.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6,
                          fontSize: "var(--fs-12)", color: "var(--ink-700)" }}>
            <span>
              <span style={{ color: "var(--ink-500)" }}>Band:</span>{" "}
              <strong>{formatRange(b.value_range, b.unit)}</strong>
            </span>
            <span>
              <span style={{ color: "var(--ink-500)" }}>Source:</span>{" "}
              {b.source ? `${b.source}${b.year ? ` (${b.year})` : ""}` : "—"}
            </span>
            {b.sample_size && (
              <span><span style={{ color: "var(--ink-500)" }}>n:</span> {b.sample_size}</span>
            )}
          </div>
          {b.overridden && b.base && (
            <div style={{ marginTop: 6, fontSize: "var(--fs-11)", color: "var(--ink-500)" }}>
              Base cascade value: {formatRange(b.base.value_range, b.base.unit)}
              {b.base.source && ` · ${b.base.source}`}
              {b.base.year && ` (${b.base.year})`}
            </div>
          )}
          {b.notes && (
            <div style={{ marginTop: 6, fontSize: "var(--fs-12)", color: "var(--warn-700)", fontStyle: "italic" }}>
              Override note: {b.notes}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={onEditOpen} disabled={busy}>
              {b.overridden ? "Edit override" : "Override"}
            </Button>
          )}
          {!isEditing && b.overridden && (
            <Button size="sm" variant="outline" onClick={onReset} disabled={busy}
                     style={{ color: "var(--danger-700)", borderColor: "var(--danger-500)" }}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <OverrideForm b={b} onSave={onSave} onCancel={onEditClose} busy={busy} />
      )}
    </div>
  );
};


const OverrideForm = ({ b, onSave, onCancel, busy }) => {
  const initial = b.overridden ? b : (b.base || {});
  const initLo = Array.isArray(initial.value_range) ? initial.value_range[0] : "";
  const initHi = Array.isArray(initial.value_range) ? initial.value_range[1] : "";
  const [lo, setLo] = useState(initLo ?? "");
  const [hi, setHi] = useState(initHi ?? "");
  const [source, setSource] = useState(initial.source || "");
  const [year, setYear] = useState(initial.year || new Date().getFullYear());
  const [notes, setNotes] = useState(b.notes || "");

  const submit = () => {
    const patch = {
      value_range: [Number(lo), Number(hi)],
      source: source || null,
      year: Number(year) || null,
      notes: notes || null,
    };
    onSave(patch);
  };

  return (
    <div style={{ marginTop: 12, padding: 12, background: "var(--surface-card)",
                    border: "1px solid var(--border-default)", borderRadius: "var(--r-md)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 10, alignItems: "end" }}>
        <Field label={`Low (${b.unit || ""})`}>
          <input type="number" value={lo} onChange={(e) => setLo(e.target.value)} style={inp} />
        </Field>
        <Field label={`High (${b.unit || ""})`}>
          <input type="number" value={hi} onChange={(e) => setHi(e.target.value)} style={inp} />
        </Field>
        <Field label="Source (override citation)">
          <input value={source} onChange={(e) => setSource(e.target.value)}
                 placeholder="e.g. Client-confirmed 2025" style={inp} />
        </Field>
        <Field label="Year">
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={inp} />
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Why this override? (audit trail)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Client-confirmed value during workshop on 2026-05-30."
                    style={{ ...inp, fontFamily: "var(--font-sans)", resize: "vertical" }} />
        </Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save override"}
        </Button>
      </div>
    </div>
  );
};


const Field = ({ label, children }) => (
  <div>
    <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--ink-600)", fontWeight: 600, marginBottom: 4 }}>
      {label}
    </div>
    {children}
  </div>
);

const inp = {
  width: "100%", padding: "6px 10px", fontSize: "var(--fs-12)",
  border: "1px solid var(--border-default)", borderRadius: "var(--r-md)",
  background: "var(--surface-card)",
};

export default BenchmarkOverridePanel;
