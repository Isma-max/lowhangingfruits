"use client";

import React from "react";

/**
 * Wemul base surface card — white, 22px radius, cool navy-tinted shadow.
 * Ported from the Wemul Design System (f56d87ed…).
 */
export function Card({
  children,
  padding = "var(--space-6)",
  interactive = false,
  accent = null,
  style = {},
  ...rest
}: {
  children: React.ReactNode;
  padding?: string;
  interactive?: boolean;
  accent?: "coral" | "blue" | "navy" | null;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [hover, setHover] = React.useState(false);
  const accentBar = accent && (
    <span
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        height: "100%",
        width: 6,
        background:
          accent === "coral" ? "var(--coral-500)" : accent === "blue" ? "var(--blue-500)" : "var(--navy-500)",
        borderTopLeftRadius: "var(--radius-lg)",
        borderBottomLeftRadius: "var(--radius-lg)",
      }}
    />
  );
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        padding,
        boxShadow: interactive && hover ? "var(--shadow-lg)" : "var(--shadow-md)",
        transform: interactive && hover ? "translateY(-4px)" : "none",
        transition: "transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      {accentBar}
      {children}
    </div>
  );
}
