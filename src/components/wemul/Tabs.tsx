"use client";

import React from "react";

export interface WemulTab {
  label: string;
  content?: React.ReactNode;
}

/** Wemul tabs — pill-style segmented control. Ported from f56d87ed…. */
export function Tabs({
  tabs = [],
  defaultIndex = 0,
  onChange,
  style = {},
}: {
  tabs?: WemulTab[];
  defaultIndex?: number;
  onChange?: (index: number) => void;
  style?: React.CSSProperties;
}) {
  const [active, setActive] = React.useState(defaultIndex);
  const select = (i: number) => {
    setActive(i);
    onChange?.(i);
  };
  return (
    <div style={style}>
      <div
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          background: "var(--ink-50)",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => select(i)}
            style={{
              fontFamily: "var(--font-text)",
              fontWeight: 600,
              fontSize: "0.9375rem",
              padding: "0.5rem 1.1rem",
              borderRadius: "var(--radius-pill)",
              border: "none",
              cursor: "pointer",
              background: active === i ? "var(--navy-500)" : "transparent",
              color: active === i ? "#fff" : "var(--text-muted)",
              transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs[active] && tabs[active].content !== undefined && <div style={{ marginTop: "var(--space-5)" }}>{tabs[active].content}</div>}
    </div>
  );
}
