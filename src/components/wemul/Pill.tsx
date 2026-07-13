"use client";

import React from "react";

type Color = "blue" | "coral" | "navy" | "sky";
type Size = "sm" | "md" | "lg";

/** Wemul pill — capsule used to spotlight a key concept. Ported from f56d87ed…. */
export function Pill({
  children,
  color = "blue",
  soft = false,
  size = "md",
  style = {},
  ...rest
}: {
  children: React.ReactNode;
  color?: Color;
  soft?: boolean;
  size?: Size;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const palette: Record<Color, { solid: [string, string]; soft: [string, string] }> = {
    blue: { solid: ["var(--blue-500)", "#fff"], soft: ["var(--blue-50)", "var(--blue-700)"] },
    coral: { solid: ["var(--coral-500)", "#fff"], soft: ["var(--coral-50)", "var(--coral-700)"] },
    navy: { solid: ["var(--navy-500)", "#fff"], soft: ["var(--navy-50)", "var(--navy-500)"] },
    sky: { solid: ["var(--wemul-sky)", "var(--navy-500)"], soft: ["var(--blue-50)", "var(--navy-500)"] },
  };
  const [bg, fg] = palette[color][soft ? "soft" : "solid"];
  const sizes: Record<Size, [string, string]> = {
    sm: ["0.75rem", "0.25rem 0.7rem"],
    md: ["0.8125rem", "0.4rem 0.9rem"],
    lg: ["0.9375rem", "0.55rem 1.2rem"],
  };
  const [fs, pad] = sizes[size];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontFamily: "var(--font-text)",
        fontWeight: 600,
        fontSize: fs,
        padding: pad,
        background: bg,
        color: fg,
        borderRadius: "var(--radius-pill)",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
