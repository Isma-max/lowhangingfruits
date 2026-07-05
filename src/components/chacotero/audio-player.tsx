"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NarrativeSegment, VideoSource } from "@/lib/chacotero/types";
import { BADGE_VARIANT_COLOR_VAR, CATEGORY_META, computeCompressedRanges, formatTimestamp } from "@/lib/chacotero/timeline";
import { CATEGORY_FREQUENCIES, renderToneTrackWav } from "@/lib/chacotero/synth-audio";
import { cn } from "@/lib/utils";
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat } from "lucide-react";

interface AudioPlayerProps {
  segments: NarrativeSegment[];
  source: VideoSource;
  editedAudioUrl: string | null;
  requestedSegmentId: string | null;
  requestedSegmentNonce: number;
  onActiveSegmentChange: (id: string | null) => void;
}

type PlaybackMode = "edited" | "original";

const CONTEXT_LEAD_SECONDS = 8;

export function AudioPlayer({
  segments,
  source,
  editedAudioUrl,
  requestedSegmentId,
  requestedSegmentNonce,
  onActiveSegmentChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mode, setMode] = useState<PlaybackMode>("edited");
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const editedRanges = useMemo(() => computeCompressedRanges(segments), [segments]);
  const originalRanges = useMemo(() => {
    const map = new Map<string, { start: number; end: number }>();
    for (const s of segments) map.set(s.id, { start: s.startSeconds, end: s.endSeconds });
    return map;
  }, [segments]);
  const ranges = mode === "edited" ? editedRanges : originalRanges;

  const activeSrc = mode === "edited" ? editedAudioUrl : originalAudioUrl;

  useEffect(() => {
    if (audioRef.current && activeSrc) {
      audioRef.current.load();
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [activeSrc]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function ensureOriginalTrack(): Promise<void> {
    if (originalAudioUrl || loadingOriginal) return;
    setLoadingOriginal(true);
    try {
      const cues = segments.map((s) => ({
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        freqHz: CATEGORY_FREQUENCIES[s.category],
      }));
      const { blob } = await renderToneTrackWav(cues, source.durationSeconds);
      setOriginalAudioUrl(URL.createObjectURL(blob));
    } finally {
      setLoadingOriginal(false);
    }
  }

  async function handleToggleMode() {
    const next = mode === "edited" ? "original" : "edited";
    if (next === "original") await ensureOriginalTrack();
    setMode(next);
  }

  function seekTo(seconds: number, play = true) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, seconds);
    setCurrentTime(audioRef.current.currentTime);
    if (play) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  useEffect(() => {
    if (!requestedSegmentId) return;
    const range = ranges.get(requestedSegmentId);
    if (!range) return;
    const startAt = mode === "original" ? Math.max(0, range.start - CONTEXT_LEAD_SECONDS) : range.start;
    seekTo(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSegmentNonce]);

  function handleTimeUpdate() {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    let match: string | null = null;
    for (const [id, range] of ranges) {
      if (t >= range.start && t <= range.end) {
        match = id;
        break;
      }
    }
    onActiveSegmentChange(match);
  }

  function jump(direction: 1 | -1) {
    const ordered = [...ranges.entries()].sort((a, b) => a[1].start - b[1].start);
    const idx = ordered.findIndex(([, r]) => currentTime >= r.start && currentTime <= r.end);
    const nextIdx = idx === -1 ? (direction === 1 ? 0 : ordered.length - 1) : idx + direction;
    const next = ordered[Math.max(0, Math.min(ordered.length - 1, nextIdx))];
    if (next) seekTo(next[1].start);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  const markers = [...ranges.entries()].map(([id, range]) => {
    const segment = segments.find((s) => s.id === id);
    return { id, start: range.start, category: segment?.category };
  });

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3 z-20">
      <audio
        ref={audioRef}
        src={activeSrc ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="max-w-[1400px] mx-auto flex items-center gap-4">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => jump(-1)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            title="Bloque anterior"
          >
            <SkipBack size={15} />
          </button>
          <button
            onClick={togglePlay}
            disabled={!activeSrc}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            onClick={() => jump(1)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            title="Siguiente bloque"
          >
            <SkipForward size={15} />
          </button>
        </div>

        <span className="text-xs font-mono text-[var(--text-secondary)] w-10 shrink-0 text-right">
          {formatTimestamp(currentTime)}
        </span>

        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={duration || 1}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value), isPlaying)}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
          />
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none">
            {markers.map((m) => (
              <span
                key={m.id}
                className="absolute w-0.5 h-2 -translate-y-1/2 top-1/2 rounded-full"
                style={{
                  left: `${duration ? (m.start / duration) * 100 : 0}%`,
                  background: m.category ? BADGE_VARIANT_COLOR_VAR[CATEGORY_META[m.category].badgeVariant] : "var(--border)",
                }}
              />
            ))}
          </div>
        </div>

        <span className="text-xs font-mono text-[var(--text-muted)] w-10 shrink-0">{formatTimestamp(duration)}</span>

        <button
          onClick={handleToggleMode}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs shrink-0 transition-colors",
            mode === "original"
              ? "bg-[var(--accent-soft)] border-[rgba(124,106,247,0.3)] text-[var(--accent)]"
              : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
          title="Comparar con el video original (con contexto previo/posterior)"
        >
          <Repeat size={12} />
          {loadingOriginal ? "Generando…" : mode === "original" ? "Original" : "Editado"}
        </button>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0 w-24">
          <Volume2 size={13} className="text-[var(--text-muted)]" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
