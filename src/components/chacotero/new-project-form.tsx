"use client";

import { useEffect, useState } from "react";
import { EDITORIAL_MODES, EditorialMode, TargetDuration, VideoSource } from "@/lib/chacotero/types";
import { isValidYouTubeUrl } from "@/lib/chacotero/youtube";
import { formatDuration } from "@/lib/chacotero/timeline";
import { QA_ERROR_URLS } from "@/lib/chacotero/qa-triggers";
import { DEMO_VIDEO_SOURCE } from "@/lib/chacotero/demo-data";
import { cn } from "@/lib/utils";
import { Link2, CheckCircle2, Sparkles, Clock, Wand2, ChevronDown } from "lucide-react";

const DURATION_OPTIONS: { value: 180 | 300 | 600; label: string }[] = [
  { value: 180, label: "3 minutos" },
  { value: 300, label: "5 minutos" },
  { value: 600, label: "10 minutos" },
];

export interface GenerateConfig {
  url: string;
  targetDuration: TargetDuration;
  editorialMode: EditorialMode;
}

interface NewProjectFormProps {
  onGenerate: (config: GenerateConfig) => void;
  initialUrl?: string;
}

export function NewProjectForm({ onGenerate, initialUrl }: NewProjectFormProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [durationChoice, setDurationChoice] = useState<180 | 300 | 600 | "custom">(300);
  const [customMinutes, setCustomMinutes] = useState("7");
  const [mode, setMode] = useState<EditorialMode>("balanced");
  const [preview, setPreview] = useState<VideoSource | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showQaHelpers, setShowQaHelpers] = useState(false);

  const urlIsValid = url.trim().length > 0 && isValidYouTubeUrl(url);

  useEffect(() => {
    if (!urlIsValid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/chacotero/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setPreview(data.source);
        } else {
          setPreview(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, urlIsValid]);

  // Derived rather than cleared via setState so an in-flight/stale preview
  // never shows once the URL becomes invalid.
  const shownPreview = urlIsValid ? preview : null;
  const shownPreviewLoading = urlIsValid && previewLoading;

  const targetDuration: TargetDuration =
    durationChoice === "custom" ? Math.max(30, Math.round(Number(customMinutes) * 60) || 30) : durationChoice;

  const canSubmit = urlIsValid;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-xs text-[var(--accent)] bg-[var(--accent-soft)] border border-[rgba(124,106,247,0.2)] rounded-full px-3 py-1">
          <Sparkles size={12} />
          Chacotero Editor
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Nuevo corte editorial</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
          Pega el link de un episodio y la herramienta arma una primera propuesta editorial —
          coherente y narrada de principio a fin — que después puedes revisar y ajustar bloque por bloque.
        </p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-5">
        {/* URL input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Link de YouTube
          </label>
          <div className="relative">
            <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={cn(
                "w-full pl-9 pr-9 py-2.5 rounded-lg bg-[var(--surface-2)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors",
                url.length === 0
                  ? "border-[var(--border)] focus:border-[var(--accent)]"
                  : urlIsValid
                  ? "border-[rgba(34,197,94,0.4)]"
                  : "border-[rgba(239,68,68,0.4)]"
              )}
            />
            {urlIsValid && (
              <CheckCircle2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--green)]" />
            )}
          </div>
          {url.length > 0 && !urlIsValid && (
            <p className="text-xs text-[var(--red)]">Ese link no parece ser una URL válida de YouTube.</p>
          )}
          <button
            type="button"
            onClick={() => setUrl(DEMO_VIDEO_SOURCE.url)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Usar proyecto demo
          </button>
        </div>

        {/* Preview */}
        {(shownPreviewLoading || shownPreview) && (
          <div className="flex items-center gap-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 animate-fade-in">
            <div className="w-28 h-16 rounded-md bg-[var(--surface)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
              {shownPreview?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownPreview.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {shownPreviewLoading && !shownPreview ? (
                <div className="text-xs text-[var(--text-muted)]">Obteniendo metadata del video…</div>
              ) : (
                shownPreview && (
                  <>
                    <div className="text-sm text-[var(--text-primary)] font-medium line-clamp-1">{shownPreview.title}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {shownPreview.channelName} · {formatDuration(shownPreview.durationSeconds)}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={12} /> Duración objetivo
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationChoice(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  durationChoice === opt.value
                    ? "bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(124,106,247,0.3)]"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDurationChoice("custom")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                durationChoice === "custom"
                  ? "bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(124,106,247,0.3)]"
                  : "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              )}
            >
              Personalizada
            </button>
            {durationChoice === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-muted)]">min</span>
              </div>
            )}
          </div>
        </div>

        {/* Editorial mode */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Wand2 size={12} /> Enfoque editorial
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {EDITORIAL_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "text-left px-3 py-2 rounded-lg border transition-all",
                  mode === m.id
                    ? "bg-[var(--accent-soft)] border-[rgba(124,106,247,0.35)]"
                    : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]"
                )}
              >
                <div className={cn("text-sm font-medium", mode === m.id ? "text-[var(--accent)]" : "text-[var(--text-primary)]")}>
                  {m.label}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{m.description}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onGenerate({ url, targetDuration, editorialMode: mode })}
          className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(124,106,247,0.25)]"
        >
          Generar corte
        </button>
      </div>

      {/* QA / demo helpers */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowQaHelpers((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          Simular estados de error (demo) <ChevronDown size={12} className={cn("transition-transform", showQaHelpers && "rotate-180")} />
        </button>
        {showQaHelpers && (
          <div className="flex items-center justify-center gap-2 flex-wrap mt-2">
            {QA_ERROR_URLS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setUrl(q.url)}
                className="text-xs px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
