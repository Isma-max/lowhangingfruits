import { NarrativeCategory, NarrativeSegment } from "@/lib/chacotero/types";

export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec}s`;
}

export function segmentDuration(segment: NarrativeSegment): number {
  return segment.endSeconds - segment.startSeconds;
}

export function computeTotalDuration(segments: NarrativeSegment[]): number {
  return segments.reduce((sum, s) => sum + segmentDuration(s), 0);
}

// The rendered final-cut audio is one continuous take with no gaps between
// blocks. This maps each segment's id to its [start,end] window inside that
// compressed track, so the player can jump to a block by id.
export function computeCompressedRanges(segments: NarrativeSegment[]): Map<string, { start: number; end: number }> {
  const ordered = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
  const ranges = new Map<string, { start: number; end: number }>();
  let cursor = 0;
  for (const s of ordered) {
    const duration = segmentDuration(s);
    ranges.set(s.id, { start: cursor, end: cursor + duration });
    cursor += duration;
  }
  return ranges;
}

export interface CategoryMeta {
  label: string;
  badgeVariant: "default" | "green" | "yellow" | "red" | "blue" | "purple" | "muted";
  emphasize?: boolean;
}

export const BADGE_VARIANT_COLOR_VAR: Record<CategoryMeta["badgeVariant"], string> = {
  default: "var(--text-secondary)",
  green: "var(--green)",
  yellow: "var(--yellow)",
  red: "var(--red)",
  blue: "var(--blue)",
  purple: "var(--accent)",
  muted: "var(--text-muted)",
};

export const CATEGORY_META: Record<NarrativeCategory, CategoryMeta> = {
  hook: { label: "Hook", badgeVariant: "purple" },
  context: { label: "Contexto", badgeVariant: "blue" },
  conflict: { label: "Conflicto", badgeVariant: "yellow" },
  escalation: { label: "Escalada", badgeVariant: "red" },
  revelation: { label: "Revelación", badgeVariant: "purple" },
  climax: { label: "Clímax", badgeVariant: "red", emphasize: true },
  reaction: { label: "Reacción", badgeVariant: "green" },
  closing: { label: "Cierre", badgeVariant: "blue" },
  transition: { label: "Transición", badgeVariant: "muted" },
};

const MIN_SEGMENT_SECONDS = 5;
const EXTEND_STEP_SECONDS = 15;

export function removeSegment(segments: NarrativeSegment[], id: string): NarrativeSegment[] {
  return segments.filter((s) => s.id !== id);
}

export function replaceWithAlternative(
  segments: NarrativeSegment[],
  id: string,
  alternativeId: string
): NarrativeSegment[] {
  return segments.map((s) => {
    if (s.id !== id) return s;
    const alt = s.alternatives?.find((a) => a.id === alternativeId);
    if (!alt) return s;
    const remainingAlternatives = (s.alternatives ?? []).filter((a) => a.id !== alternativeId);
    const swappedBack: NarrativeSegment = {
      ...s,
      id: s.id,
      isSelected: false,
    };
    return {
      ...alt,
      id: s.id,
      category: s.category,
      isSelected: true,
      alternatives: [swappedBack, ...remainingAlternatives],
    };
  });
}

export function extendSegment(
  segments: NarrativeSegment[],
  id: string,
  maxEndSeconds: number,
  deltaSeconds = EXTEND_STEP_SECONDS
): NarrativeSegment[] {
  return segments.map((s, i) => {
    if (s.id !== id) return s;
    const nextStart = segments[i + 1]?.startSeconds ?? maxEndSeconds;
    const newEnd = Math.min(s.endSeconds + deltaSeconds, nextStart, maxEndSeconds);
    return { ...s, endSeconds: newEnd };
  });
}

export function shortenSegment(
  segments: NarrativeSegment[],
  id: string,
  deltaSeconds = EXTEND_STEP_SECONDS
): NarrativeSegment[] {
  return segments.map((s) => {
    if (s.id !== id) return s;
    const newEnd = Math.max(s.startSeconds + MIN_SEGMENT_SECONDS, s.endSeconds - deltaSeconds);
    return { ...s, endSeconds: newEnd };
  });
}

export function overlapsHeatmap(
  segment: NarrativeSegment,
  heatmapMoments?: { startSeconds: number; endSeconds: number; intensity: number }[]
): number {
  if (!heatmapMoments || heatmapMoments.length === 0) return 0;
  const overlapping = heatmapMoments.filter(
    (m) => m.startSeconds < segment.endSeconds && m.endSeconds > segment.startSeconds
  );
  if (overlapping.length === 0) return 0;
  return Math.max(...overlapping.map((m) => m.intensity));
}
