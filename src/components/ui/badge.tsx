import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "green" | "yellow" | "red" | "blue" | "purple" | "muted";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]",
    green: "bg-[var(--green-soft)] text-[var(--green)] border border-[rgba(34,197,94,0.2)]",
    yellow: "bg-[var(--yellow-soft)] text-[var(--yellow)] border border-[rgba(234,179,8,0.2)]",
    red: "bg-[var(--red-soft)] text-[var(--red)] border border-[rgba(239,68,68,0.2)]",
    blue: "bg-[var(--blue-soft)] text-[var(--blue)] border border-[rgba(59,130,246,0.2)]",
    purple: "bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(124,106,247,0.2)]",
    muted: "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]",
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
