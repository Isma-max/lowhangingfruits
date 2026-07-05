"use client";

import { useState } from "react";
import { NarrativeSegment } from "@/lib/chacotero/types";
import { CATEGORY_META, formatDuration, formatTimestamp, segmentDuration } from "@/lib/chacotero/timeline";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, Pin, PinOff, Trash2, Shuffle, Plus, Minus, Flame, ChevronDown } from "lucide-react";

interface SegmentBlockProps {
  segment: NarrativeSegment;
  index: number;
  isPlaying: boolean;
  isPinned: boolean;
  heatmapIntensity: number;
  onPlay: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
  onExtend: () => void;
  onShorten: () => void;
  onReplace: (alternativeId: string) => void;
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md border transition-colors",
        active
          ? "bg-[var(--accent-soft)] border-[rgba(124,106,247,0.3)] text-[var(--accent)]"
          : danger
          ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--red)] hover:border-[rgba(239,68,68,0.3)]"
          : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
      )}
    >
      {icon}
    </button>
  );
}

export function SegmentBlock({
  segment,
  index,
  isPlaying,
  isPinned,
  heatmapIntensity,
  onPlay,
  onTogglePin,
  onRemove,
  onExtend,
  onShorten,
  onReplace,
}: SegmentBlockProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const meta = CATEGORY_META[segment.category];

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2.5 transition-colors",
        isPlaying ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]",
        meta.emphasize && !isPlaying && "border-[rgba(239,68,68,0.35)]"
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--text-muted)] font-mono w-4 shrink-0">{index + 1}</span>
        <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
        <span className="text-xs text-[var(--text-secondary)] font-mono">
          {formatTimestamp(segment.startSeconds)}–{formatTimestamp(segment.endSeconds)}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{formatDuration(segmentDuration(segment))}</span>
        {heatmapIntensity > 0.5 && (
          <span
            title="Coincide con un momento de alto interés (Most Replayed)"
            className="flex items-center gap-0.5 text-xs text-[var(--yellow)]"
          >
            <Flame size={11} />
          </span>
        )}
        <span className="ml-auto text-xs font-mono font-bold text-[var(--text-muted)]">{segment.narrativeScore}</span>
      </div>

      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{segment.transcript}</p>
      <p className="text-xs text-[var(--text-muted)] italic leading-relaxed">{segment.editorialReason}</p>

      <div className="flex items-center gap-1.5 pt-0.5">
        <ActionButton icon={<Play size={12} />} label="Reproducir este bloque" onClick={onPlay} active={isPlaying} />
        <ActionButton
          icon={isPinned ? <Pin size={12} /> : <PinOff size={12} />}
          label={isPinned ? "Bloque fijado: mantener" : "Mantener (fijar para regeneraciones)"}
          onClick={onTogglePin}
          active={isPinned}
        />
        <ActionButton icon={<Plus size={12} />} label="Extender bloque" onClick={onExtend} />
        <ActionButton icon={<Minus size={12} />} label="Acortar bloque" onClick={onShorten} />
        {segment.alternatives && segment.alternatives.length > 0 && (
          <ActionButton
            icon={<Shuffle size={12} />}
            label="Ver alternativas"
            onClick={() => setShowAlternatives((v) => !v)}
            active={showAlternatives}
          />
        )}
        <ActionButton icon={<Trash2 size={12} />} label="Eliminar bloque" onClick={onRemove} danger />
        {segment.alternatives && segment.alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAlternatives((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            {segment.alternatives.length} alternativa{segment.alternatives.length > 1 ? "s" : ""}
            <ChevronDown size={11} className={cn("transition-transform", showAlternatives && "rotate-180")} />
          </button>
        )}
      </div>

      {showAlternatives && segment.alternatives && (
        <div className="space-y-1.5 pt-1.5 border-t border-[var(--border)]">
          {segment.alternatives.map((alt) => (
            <div
              key={alt.id}
              className="flex items-start gap-2 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-2.5"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs text-[var(--text-secondary)] font-mono">
                  {formatTimestamp(alt.startSeconds)}–{formatTimestamp(alt.endSeconds)} ·{" "}
                  {formatDuration(alt.endSeconds - alt.startSeconds)}
                </div>
                <div className="text-xs text-[var(--text-muted)] italic leading-relaxed">{alt.editorialReason}</div>
              </div>
              <button
                type="button"
                onClick={() => onReplace(alt.id)}
                className="shrink-0 text-xs px-2 py-1 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
              >
                Usar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
