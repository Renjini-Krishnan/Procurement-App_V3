/* Minimal icon set — stroke-based, inherit currentColor */
import React from "react";

const baseSvgProps = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const Arrow = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Check = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}><path d="M4 12l5 5L20 6" /></svg>
);

export const X = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export const Upload = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}>
    <path d="M12 4v12M6 10l6-6 6 6M4 20h16" />
  </svg>
);

export const Chart = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}>
    <path d="M4 20V8M10 20V4M16 20v-8M22 20H2" />
  </svg>
);

export const Layers = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}>
    <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
  </svg>
);

export const Doc = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6" />
  </svg>
);

export const Search = ({ size = 16 }) => (
  <svg {...baseSvgProps(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const Dot = ({ size = 8, color = "currentColor" }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color }} />
);

export const Caret = ({ size = 14 }) => (
  <svg {...baseSvgProps(size)}><path d="M6 9l6 6 6-6" /></svg>
);

export const I = { Arrow, Check, X, Upload, Chart, Layers, Doc, Search, Dot, Caret };
export default I;
