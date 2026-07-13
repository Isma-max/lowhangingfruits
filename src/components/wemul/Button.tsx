"use client";

import React from "react";

type Variant = "coral" | "blue" | "navy" | "outline" | "ghost" | "white";
type Size = "sm" | "md" | "lg";

/**
 * Wemul primary action. Coral = energy/CTA, blue = digital action,
 * navy = strategic/secondary-strong, ghost/outline for low emphasis.
 * Ported from the Wemul Design System (f56d87ed…).
 */
export function Button({
  children,
  variant = "coral",
  size = "md",
  iconLeft = null,
  iconRight = null,
  disabled = false,
  fullWidth = false,
  type = "button",
  onClick,
  style = {},
  ...rest
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "style">) {
  const sizes: Record<Size, React.CSSProperties> = {
    sm: { fontSize: "0.875rem", padding: "0.5rem 1rem", gap: "0.4rem" },
    md: { fontSize: "1rem", padding: "0.75rem 1.5rem", gap: "0.5rem" },
    lg: { fontSize: "1.125rem", padding: "1rem 2rem", gap: "0.6rem" },
  };

  const variants: Record<Variant, React.CSSProperties> = {
    coral: { background: "var(--coral-500)", color: "#fff", border: "2px solid transparent", boxShadow: "var(--shadow-coral)" },
    blue: { background: "var(--blue-500)", color: "#fff", border: "2px solid transparent", boxShadow: "var(--shadow-blue)" },
    navy: { background: "var(--navy-500)", color: "#fff", border: "2px solid transparent" },
    outline: { background: "transparent", color: "var(--navy-500)", border: "2px solid var(--navy-500)" },
    ghost: { background: "transparent", color: "var(--blue-600)", border: "2px solid transparent" },
    white: { background: "#fff", color: "var(--navy-500)", border: "2px solid transparent", boxShadow: "var(--shadow-sm)" },
  };

  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const hoverBg: Record<Variant, string> = {
    coral: "var(--coral-600)",
    blue: "var(--blue-600)",
    navy: "var(--navy-600)",
    outline: "var(--navy-500)",
    ghost: "var(--blue-50)",
    white: "#fff",
  };
  const hoverColor: Partial<Record<Variant, string>> = { outline: "#fff" };

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "-0.005em",
    borderRadius: "var(--radius-pill)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    transition:
      "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
    transform: press ? "scale(0.97)" : hover && !disabled ? "translateY(-1px)" : "none",
    ...sizes[size],
    ...variants[variant],
    ...(hover && !disabled ? { background: hoverBg[variant], color: hoverColor[variant] ?? variants[variant].color } : {}),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
