import React from "react";

/* Vault logo — references SVG in /public/logos/.
   Use `inverted` for dark backgrounds. */
export const Logo = ({ inverted = false, size = 28, withWordmark = true }) => {
  const markSrc = inverted ? "/logos/vault-mark-white.svg" : "/logos/vault-mark.svg";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <img src={markSrc} alt="" width={size} height={size} />
      {withWordmark && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: "var(--fs-18)",
            letterSpacing: "-0.02em",
            color: inverted ? "white" : "var(--ink-900)",
          }}
        >
          Procvault
        </span>
      )}
    </div>
  );
};

export default Logo;
