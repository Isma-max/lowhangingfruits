"use client";

import React from "react";

type Tone = "navy" | "coral" | "blue" | "sky" | "success" | "warning" | "error" | "info";

/** Wemul badge — small status/category marker. Ported from f56d87ed…. */
export function Badge({
  children,
  tone = "navy",
  seal = false,
  style = {},
  ...rest
}: {
  children: React.ReactNode;
  tone?: Tone;
  seal?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const tones: Record<Tone, [string, string]> = {
    navy: ["var(--navy-500)", "#fff"],
    coral: ["var(--coral-500)", "#fff"],
    blue: ["var(--blue-500)", "#fff"],
    sky: ["var(--wemul-sky)", "var(--navy-500)"],
    success: ["var(--success-bg)", "var(--success)"],
    warning: ["var(--warning-bg)", "#9A6300"],
    error: ["var(--error-bg)", "var(--error)"],
    info: ["var(--info-bg)", "var(--blue-700)"],
  };
  const [bg, fg] = tones[tone] ?? tones.navy;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontFamily: seal ? "var(--font-display)" : "var(--font-text)",
        fontWeight: seal ? 800 : 700,
        fontSize: seal ? "0.8125rem" : "0.6875rem",
        letterSpacing: seal ? "0.04em" : "0.02em",
        textTransform: seal ? "uppercase" : "none",
        padding: seal ? "0.35rem 0.85rem" : "0.2rem 0.55rem",
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
