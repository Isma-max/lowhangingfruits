"use client";

import React from "react";

type Color = "coral" | "blue" | "navy" | "white";

/** Wemul metric block — big Gabarito number with a label. Ported from f56d87ed…. */
export function MetricBlock({
  value,
  label,
  color = "coral",
  align = "left",
  trend = null,
  style = {},
  ...rest
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  color?: Color;
  align?: "left" | "center";
  trend?: React.ReactNode;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const c = { coral: "var(--coral-500)", blue: "var(--blue-500)", navy: "var(--navy-500)", white: "#fff" }[color];
  const labelColor = color === "white" ? "rgba(255,255,255,0.78)" : "var(--text-muted)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        textAlign: align,
        alignItems: align === "center" ? "center" : "flex-start",
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(2.25rem, 5vw, 3rem)", lineHeight: 1, letterSpacing: "-0.02em", color: c }}>
          {value}
        </span>
        {trend && <span style={{ fontFamily: "var(--font-text)", fontWeight: 700, fontSize: "0.875rem", color: "var(--success)" }}>{trend}</span>}
      </div>
      <span style={{ fontFamily: "var(--font-text)", fontWeight: 500, fontSize: "0.9375rem", color: labelColor, lineHeight: 1.4, maxWidth: "20ch" }}>{label}</span>
    </div>
  );
}
