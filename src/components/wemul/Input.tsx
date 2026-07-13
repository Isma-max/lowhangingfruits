"use client";

import React from "react";

/** Wemul text input — label, optional hint/error, blue focus ring. Ported from f56d87ed…. */
export function Input({
  label,
  hint,
  error,
  id,
  style = {},
  ...rest
}: {
  label?: string;
  hint?: string;
  error?: string;
  style?: React.CSSProperties;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [focus, setFocus] = React.useState(false);
  const generatedId = React.useId();
  const fid = id || `in-${generatedId}`;
  const borderColor = error ? "var(--error)" : focus ? "var(--blue-500)" : "var(--border-default)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%" }}>
      {label && (
        <label htmlFor={fid} style={{ fontFamily: "var(--font-text)", fontWeight: 500, fontSize: "0.875rem", color: "var(--navy-500)" }}>
          {label}
        </label>
      )}
      <input
        id={fid}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          fontFamily: "var(--font-text)",
          fontSize: "1rem",
          color: "var(--text-body)",
          padding: "0.7rem 0.9rem",
          background: "#fff",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          boxShadow: focus && !error ? "var(--shadow-focus)" : "none",
          transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
          ...style,
        }}
        {...rest}
      />
      {(hint || error) && (
        <span style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: error ? "var(--error)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
