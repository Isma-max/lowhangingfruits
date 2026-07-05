"use client";

import { PROCESSING_STAGES, ProcessingStageId } from "@/lib/chacotero/types";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

interface ProcessingScreenProps {
  currentStageId: ProcessingStageId;
}

export function ProcessingScreen({ currentStageId }: ProcessingScreenProps) {
  const currentIndex = PROCESSING_STAGES.findIndex((s) => s.id === currentStageId);

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Construyendo tu corte editorial</h1>
        <p className="text-sm text-[var(--text-muted)]">Esto toma unos momentos. No cierres esta pantalla.</p>
      </div>

      <div className="score-bar">
        <div
          className="score-bar-fill bg-[var(--accent)]"
          style={{ width: `${((currentIndex + 1) / PROCESSING_STAGES.length) * 100}%` }}
        />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] overflow-hidden">
        {PROCESSING_STAGES.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={stage.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  done && "bg-[var(--green-soft)] text-[var(--green)]",
                  active && "bg-[var(--accent-soft)] text-[var(--accent)]",
                  !done && !active && "bg-[var(--surface-2)] text-[var(--text-muted)]"
                )}
              >
                {done ? (
                  <Check size={12} />
                ) : active ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span className="text-[10px] font-mono">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  done && "text-[var(--text-secondary)]",
                  active && "text-[var(--text-primary)] font-medium",
                  !done && !active && "text-[var(--text-muted)]"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
