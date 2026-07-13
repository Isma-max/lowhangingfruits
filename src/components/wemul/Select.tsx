"use client";

import React from "react";

type Option = string | { value: string; label: string };

/** Wemul select — native dropdown styled to match Input. Ported from f56d87ed…. */
export function Select({
  label,
  hint,
  error,
  id,
  options = [],
  children,
  style = {},
  ...rest
}: {
  label?: string;
  hint?: string;
  error?: string;
  options?: Option[];
  children?: React.ReactNode;
  style?: React.CSSProperties;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focus, setFocus] = React.useState(false);
  const generatedId = React.useId();
  const fid = id || `sel-${generatedId}`;
  const borderColor = error ? "var(--error)" : focus ? "var(--blue-500)" : "var(--border-default)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%" }}>
      {label && (
        <label htmlFor={fid} style={{ fontFamily: "var(--font-text)", fontWeight: 500, fontSize: "0.875rem", color: "var(--navy-500)" }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <select
          id={fid}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "1rem",
            color: "var(--text-body)",
            padding: "0.7rem 2.2rem 0.7rem 0.9rem",
            background: "#fff",
            border: `1.5px solid ${borderColor}`,
            borderRadius: "var(--radius-md)",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
            appearance: "none",
            cursor: "pointer",
            boxShadow: focus && !error ? "var(--shadow-focus)" : "none",
            transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
            ...style,
          }}
          {...rest}
        >
          {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
          {children}
        </select>
        <span style={{ position: "absolute", right: "0.9rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)", fontSize: "0.7rem" }}>▼</span>
      </div>
      {(hint || error) && (
        <span style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: error ? "var(--error)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
