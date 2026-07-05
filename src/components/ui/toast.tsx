"use client";

import { CheckCircle2, Info } from "lucide-react";

export interface ToastMessage {
  id: number;
  text: string;
  variant?: "default" | "success";
}

interface ToastStackProps {
  toasts: ToastMessage[];
}

export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-in flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] shadow-xl text-sm text-[var(--text-primary)]"
        >
          {t.variant === "success" ? (
            <CheckCircle2 size={14} className="text-[var(--green)]" />
          ) : (
            <Info size={14} className="text-[var(--accent)]" />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}
