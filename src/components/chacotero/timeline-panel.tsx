"use client";

import { HeatmapMoment, NarrativeSegment, TargetDuration } from "@/lib/chacotero/types";
import { formatDuration, overlapsHeatmap } from "@/lib/chacotero/timeline";
import { SegmentBlock } from "@/components/chacotero/segment-block";
import { Info } from "lucide-react";

interface TimelinePanelProps {
  segments: NarrativeSegment[];
  targetDuration: TargetDuration;
  totalDurationSeconds: number;
  heatmapMoments?: HeatmapMoment[];
  playingSegmentId: string | null;
  pinnedIds: Set<string>;
  onPlaySegment: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRemove: (id: string) => void;
  onExtend: (id: string) => void;
  onShorten: (id: string) => void;
  onReplace: (id: string, alternativeId: string) => void;
}

export function TimelinePanel({
  segments,
  targetDuration,
  totalDurationSeconds,
  heatmapMoments,
  playingSegmentId,
  pinnedIds,
  onPlaySegment,
  onTogglePin,
  onRemove,
  onExtend,
  onShorten,
  onReplace,
}: TimelinePanelProps) {
  const targetLabel = formatDuration(Number(targetDuration));
  const totalLabel = formatDuration(totalDurationSeconds);
  const overBudget = totalDurationSeconds > Number(targetDuration) * 1.15;

  return (
    <div className="space-y-3">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3 sticky top-[3.75rem] z-10">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Timeline de edición</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {segments.length} bloques · objetivo {targetLabel}
          </p>
        </div>
        <div className="score-bar">
          <div
            className="score-bar-fill"
            style={{
              width: `${Math.min(100, (totalDurationSeconds / Number(targetDuration)) * 100)}%`,
              background: overBudget ? "var(--yellow)" : "var(--accent)",
            }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={overBudget ? "text-[var(--yellow)]" : "text-[var(--text-secondary)]"}>
            Duración total: <span className="font-mono font-bold">{totalLabel}</span>
          </span>
          {heatmapMoments && heatmapMoments.length > 0 && (
            <span
              title="Los momentos de mayor interés se usan como señal complementaria. La selección final prioriza que la historia se entienda completa."
              className="flex items-center gap-1 text-[var(--text-muted)]"
            >
              <Info size={11} />
              Most Replayed disponible
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {segments.map((segment, i) => (
          <SegmentBlock
            key={segment.id}
            segment={segment}
            index={i}
            isPlaying={playingSegmentId === segment.id}
            isPinned={pinnedIds.has(segment.id)}
            heatmapIntensity={overlapsHeatmap(segment, heatmapMoments)}
            onPlay={() => onPlaySegment(segment.id)}
            onTogglePin={() => onTogglePin(segment.id)}
            onRemove={() => onRemove(segment.id)}
            onExtend={() => onExtend(segment.id)}
            onShorten={() => onShorten(segment.id)}
            onReplace={(altId) => onReplace(segment.id, altId)}
          />
        ))}
      </div>
    </div>
  );
}
