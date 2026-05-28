/* Core UI components — adapted from /tmp/design_system/ds-components.jsx
   Stripped to V1 essentials. Use the design tokens (CSS variables). */
import React from "react";

/* ============================== BUTTON ============================== */

const btnSizes = {
  sm: { padding: "6px 12px", fontSize: "var(--fs-13)", borderRadius: "var(--r-md)" },
  md: { padding: "9px 16px", fontSize: "var(--fs-14)", borderRadius: "var(--r-md)" },
  lg: { padding: "12px 20px", fontSize: "var(--fs-15)", borderRadius: "var(--r-lg)" },
};

const btnVariants = {
  primary: {
    background: "var(--brand-600)",
    color: "white",
    border: "1px solid var(--brand-600)",
  },
  secondary: {
    background: "var(--surface-card)",
    color: "var(--ink-900)",
    border: "1px solid var(--border-default)",
  },
  outline: {
    background: "transparent",
    color: "var(--ink-900)",
    border: "1px solid var(--border-default)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ink-700)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--danger-500)",
    color: "white",
    border: "1px solid var(--danger-500)",
  },
};

export const Button = ({ variant = "primary", size = "md", icon, iconRight, children, style, disabled, ...rest }) => (
  <button
    disabled={disabled}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      fontWeight: 500,
      lineHeight: 1.2,
      transition: "all var(--dur-fast) var(--ease-out-soft)",
      ...btnSizes[size],
      ...btnVariants[variant],
      ...style,
    }}
    {...rest}
  >
    {icon}
    {children}
    {iconRight}
  </button>
);

/* ============================== INPUT ============================== */

export const Input = ({ icon, style, ...rest }) => (
  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
    {icon && (
      <span style={{ position: "absolute", left: 12, color: "var(--ink-500)", display: "flex" }}>
        {icon}
      </span>
    )}
    <input
      style={{
        width: "100%",
        padding: icon ? "9px 12px 9px 36px" : "9px 12px",
        fontSize: "var(--fs-14)",
        background: "var(--surface-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--r-md)",
        color: "var(--ink-900)",
        outline: "none",
        ...style,
      }}
      {...rest}
    />
  </div>
);

export const Select = ({ children, style, ...rest }) => (
  <select
    style={{
      padding: "9px 12px",
      fontSize: "var(--fs-14)",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--r-md)",
      color: "var(--ink-900)",
      outline: "none",
      ...style,
    }}
    {...rest}
  >
    {children}
  </select>
);

/* ============================== CARD ============================== */

export const Card = ({ children, style, elev = 0, padding = 24, ...rest }) => {
  const shadows = ["none", "var(--shadow-1)", "var(--shadow-2)", "var(--shadow-3)"];
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-xl)",
        padding,
        boxShadow: shadows[Math.min(elev, 3)],
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

/* ============================== BADGE ============================== */

const badgeTones = {
  neutral: { bg: "var(--ink-100)", fg: "var(--ink-700)" },
  brand:   { bg: "var(--brand-50)", fg: "var(--brand-700)" },
  success: { bg: "var(--success-50)", fg: "var(--success-700)" },
  warn:    { bg: "var(--warn-50)", fg: "var(--warn-700)" },
  danger:  { bg: "var(--danger-50)", fg: "var(--danger-700)" },
  info:    { bg: "var(--info-50)", fg: "var(--info-700)" },
  gold:    { bg: "var(--gold-50)", fg: "var(--gold-500)" },
};

export const Badge = ({ tone = "neutral", children, icon, style }) => {
  const t = badgeTones[tone] || badgeTones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        background: t.bg,
        color: t.fg,
        borderRadius: "var(--r-pill)",
        fontSize: "var(--fs-12)",
        fontWeight: 500,
        lineHeight: 1.4,
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
};

/* ============================== TABS ============================== */

export const Tabs = ({ items, value, onChange, variant = "underline" }) => {
  if (variant === "pill") {
    return (
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--surface-sunk)", borderRadius: "var(--r-lg)" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              padding: "6px 14px",
              fontSize: "var(--fs-13)",
              fontWeight: 500,
              border: "none",
              borderRadius: "var(--r-md)",
              background: value === item.id ? "var(--surface-card)" : "transparent",
              color: value === item.id ? "var(--ink-900)" : "var(--ink-500)",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--border-subtle)" }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          style={{
            padding: "10px 0",
            fontSize: "var(--fs-14)",
            fontWeight: value === item.id ? 600 : 500,
            border: "none",
            background: "transparent",
            color: value === item.id ? "var(--ink-900)" : "var(--ink-500)",
            cursor: "pointer",
            borderBottom: value === item.id ? "2px solid var(--brand-600)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

/* ============================== CALLOUT ============================== */

const calloutTones = {
  info:    { bg: "var(--info-50)", fg: "var(--info-700)", border: "var(--info-500)" },
  success: { bg: "var(--success-50)", fg: "var(--success-700)", border: "var(--success-500)" },
  warn:    { bg: "var(--warn-50)", fg: "var(--warn-700)", border: "var(--warn-500)" },
  danger:  { bg: "var(--danger-50)", fg: "var(--danger-700)", border: "var(--danger-500)" },
};

export const Callout = ({ tone = "info", title, children, icon }) => {
  const t = calloutTones[tone] || calloutTones.info;
  return (
    <div
      style={{
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}33`,
        borderLeft: `3px solid ${t.border}`,
        borderRadius: "var(--r-lg)",
        padding: "12px 16px",
      }}
    >
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "var(--fs-14)", marginBottom: children ? 4 : 0 }}>
          {icon}
          {title}
        </div>
      )}
      {children && <div style={{ fontSize: "var(--fs-13)", lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
};

/* ============================== DATATABLE ============================== */

export const DataTable = ({ columns, rows }) => (
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "var(--fs-13)",
    }}
  >
    <thead>
      <tr>
        {columns.map((c) => (
          <th
            key={c.key}
            style={{
              textAlign: c.align || "left",
              padding: "10px 12px",
              fontWeight: 600,
              color: "var(--ink-600)",
              fontSize: "var(--fs-12)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i}>
          {columns.map((c) => (
            <td
              key={c.key}
              style={{
                padding: "10px 12px",
                textAlign: c.align || "left",
                borderBottom: "1px solid var(--border-subtle)",
                color: "var(--ink-800)",
              }}
            >
              {c.render ? c.render(row) : row[c.key]}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/* ============================== BAR ============================== */

export const Bar = ({ value, max = 100, tone = "brand", height = 6 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = {
    brand: "var(--brand-600)",
    success: "var(--success-500)",
    warn: "var(--warn-500)",
    danger: "var(--danger-500)",
  };
  return (
    <div style={{ width: "100%", height, background: "var(--surface-sunk)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: colors[tone] || colors.brand, transition: "width var(--dur-med) var(--ease-out-soft)" }} />
    </div>
  );
};
