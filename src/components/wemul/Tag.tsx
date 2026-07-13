"use client";

import React from "react";

type Color = "navy" | "coral" | "blue" | "muted";

/** Wemul tag — outline chip for filters, categories and metadata. Ported from f56d87ed…. */
export function Tag({
  children,
  color = "navy",
  removable = false,
  onRemove,
  dot = false,
  style = {},
  ...rest
}: {
  children: React.ReactNode;
  color?: Color;
  removable?: boolean;
  onRemove?: () => void;
  dot?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const colors: Record<Color, string> = {
    navy: "var(--navy-500)",
    coral: "var(--coral-500)",
    blue: "var(--blue-600)",
    muted: "var(--text-muted)",
  };
  const c = colors[color] ?? colors.navy;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontFamily: "var(--font-text)",
        fontWeight: 500,
        fontSize: "0.8125rem",
        padding: "0.3rem 0.75rem",
        color: c,
        background: "#fff",
        border: "1.5px solid var(--border-default)",
        borderRadius: "var(--radius-pill)",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: 2, background: c }} />}
      {children}
      {removable && (
        <button
          onClick={onRemove}
          aria-label="remove"
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: c,
            padding: 0,
            margin: 0,
            fontSize: "0.9rem",
            lineHeight: 1,
            display: "inline-flex",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
