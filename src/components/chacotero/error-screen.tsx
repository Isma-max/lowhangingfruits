"use client";

import { PROCESSING_ERROR_MESSAGES, ProcessingErrorCode } from "@/lib/chacotero/types";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorScreenProps {
  code: ProcessingErrorCode;
  onRetry: () => void;
}

export function ErrorScreen({ code, onRetry }: ErrorScreenProps) {
  const { title, description } = PROCESSING_ERROR_MESSAGES[code];

  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-[var(--red-soft)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center mx-auto">
        <AlertTriangle size={20} className="text-[var(--red)]" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
      >
        <RotateCcw size={13} />
        Volver a intentar
      </button>
    </div>
  );
}
