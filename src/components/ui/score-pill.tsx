import { cn } from "@/lib/utils";
import { Category } from "@/lib/types";

interface ScorePillProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showCategory?: boolean;
  category?: Category;
}

export function scoreColor(score: number): string {
  if (score >= 90) return "text-[var(--green)]";
  if (score >= 75) return "text-[var(--accent)]";
  if (score >= 60) return "text-[var(--yellow)]";
  return "text-[var(--text-muted)]";
}

export function scoreBg(score: number): string {
  if (score >= 90) return "bg-[var(--green-soft)] border-[rgba(34,197,94,0.2)]";
  if (score >= 75) return "bg-[var(--accent-soft)] border-[rgba(124,106,247,0.2)]";
  if (score >= 60) return "bg-[var(--yellow-soft)] border-[rgba(234,179,8,0.2)]";
  return "bg-[var(--surface)] border-[var(--border)]";
}

export function categoryColor(cat: Category): string {
  const map: Record<Category, string> = {
    A: "text-[var(--green)] bg-[var(--green-soft)] border-[rgba(34,197,94,0.2)]",
    B: "text-[var(--accent)] bg-[var(--accent-soft)] border-[rgba(124,106,247,0.2)]",
    C: "text-[var(--yellow)] bg-[var(--yellow-soft)] border-[rgba(234,179,8,0.2)]",
    D: "text-[var(--text-muted)] bg-[var(--surface)] border-[var(--border)]",
  };
  return map[cat];
}

export function ScorePill({ score, size = "md", showCategory, category }: ScorePillProps) {
  const sizes = { sm: "text-xs px-1.5 py-0.5", md: "text-sm px-2 py-1", lg: "text-base px-3 py-1.5" };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-mono font-bold rounded-md border",
      sizes[size],
      scoreBg(score),
      scoreColor(score)
    )}>
      {score}
      {showCategory && category && (
        <span className={cn("text-xs font-bold rounded px-1 border", categoryColor(category))}>
          {category}
        </span>
      )}
    </span>
  );
}
