"use client";

import React from "react";

/** Wemul checkbox — coral check, rounded box, label to the right. Ported from f56d87ed…. */
export function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  style = {},
  ...rest
}: {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLLabelElement>, "onChange">) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal((v) => !v);
    onChange?.(!on);
  };
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6rem",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-text)",
        fontSize: "0.9375rem",
        color: "var(--text-body)",
        ...style,
      }}
      {...rest}
    >
      <span
        onClick={toggle}
        role="checkbox"
        aria-checked={on}
        style={{
          width: 22,
          height: 22,
          flex: "none",
          borderRadius: 6,
          border: on ? "2px solid var(--coral-500)" : "2px solid var(--border-default)",
          background: on ? "var(--coral-500)" : "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          transition: "all var(--dur-fast) var(--ease-snap)",
        }}
      >
        {on && "✓"}
      </span>
      {label}
    </label>
  );
}
