"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChacoteroError,
  EditProject,
  HeatmapMoment,
  NarrativeSegment,
  ProcessingErrorCode,
  ProcessingStageId,
  StoryAnalysis,
  TranscriptSegment,
  VideoSource,
} from "@/lib/chacotero/types";
import { postJSON } from "@/lib/chacotero/pipeline-client";
import {
  computeTotalDuration,
  extendSegment,
  removeSegment,
  replaceWithAlternative,
  shortenSegment,
} from "@/lib/chacotero/timeline";
import { MockAudioRenderProvider } from "@/lib/chacotero/services/mock-audio-render-provider";
import { NewProjectForm, GenerateConfig } from "@/components/chacotero/new-project-form";
import { ProcessingScreen } from "@/components/chacotero/processing-screen";
import { ErrorScreen } from "@/components/chacotero/error-screen";
import { StoryPanel } from "@/components/chacotero/story-panel";
import { TimelinePanel } from "@/components/chacotero/timeline-panel";
import { AudioPlayer } from "@/components/chacotero/audio-player";
import { ExportActions } from "@/components/chacotero/export-actions";
import { ToastStack, ToastMessage } from "@/components/ui/toast";
import { ArrowLeft, Sparkles } from "lucide-react";

type Status = "draft" | "processing" | "ready" | "error";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const audioProvider = new MockAudioRenderProvider();

export default function ChacoteroPage() {
  const [status, setStatus] = useState<Status>("draft");
  const [stageId, setStageId] = useState<ProcessingStageId>("metadata");
  const [errorCode, setErrorCode] = useState<ProcessingErrorCode | null>(null);
  const [lastUrl, setLastUrl] = useState("");

  const [project, setProject] = useState<EditProject | null>(null);
  const [editedAudioUrl, setEditedAudioUrl] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [requestedSegmentId, setRequestedSegmentId] = useState<string | null>(null);
  const [requestedNonce, setRequestedNonce] = useState(0);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function showToast(text: string, variant: "default" | "success" = "default") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  async function rerenderAudio(segments: NarrativeSegment[], source: VideoSource) {
    try {
      const { audioUrl } = await audioProvider.render({ source, segments });
      setEditedAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return audioUrl;
      });
    } catch {
      showToast("No se pudo re-renderizar el audio del corte.");
    }
  }

  async function handleGenerate(config: GenerateConfig) {
    setLastUrl(config.url);
    setStatus("processing");
    setErrorCode(null);
    setStageId("metadata");

    try {
      const { source } = await postJSON<{ source: VideoSource }>("/api/chacotero/metadata", { url: config.url });
      if (source.durationSeconds < 150) {
        throw new ChacoteroError("video_too_short");
      }

      setStageId("audio_prep");
      await delay(500);

      setStageId("transcription");
      const { transcript } = await postJSON<{ transcript: TranscriptSegment[] }>("/api/chacotero/transcript", { source });

      setStageId("diarization");
      await delay(400);

      setStageId("story_reconstruction");
      await delay(400);

      setStageId("key_moments");
      const { heatmapMoments } = await postJSON<{ heatmapMoments: HeatmapMoment[] | null }>("/api/chacotero/heatmap", {
        source,
      });

      setStageId("segment_selection");
      const { storyAnalysis, selectedSegments } = await postJSON<{
        storyAnalysis: StoryAnalysis;
        selectedSegments: NarrativeSegment[];
      }>("/api/chacotero/analyze", {
        transcript,
        targetDuration: config.targetDuration,
        editorialMode: config.editorialMode,
        heatmapMoments: heatmapMoments ?? undefined,
        sourceUrl: config.url,
      });

      setStageId("assembly");
      const { audioUrl } = await audioProvider.render({ source, segments: selectedSegments });

      const now = new Date().toISOString();
      const newProject: EditProject = {
        id: `proj-${Date.now().toString(36)}`,
        status: "ready",
        targetDuration: config.targetDuration,
        editorialMode: config.editorialMode,
        source,
        heatmapMoments: heatmapMoments ?? undefined,
        transcript,
        storyAnalysis,
        selectedSegments,
        totalDurationSeconds: computeTotalDuration(selectedSegments),
        createdAt: now,
        updatedAt: now,
      };

      setProject(newProject);
      setEditedAudioUrl(audioUrl);
      setPinnedIds(new Set());
      setActiveSegmentId(null);
      setStatus("ready");
    } catch (err) {
      setErrorCode(err instanceof ChacoteroError ? err.code : "analysis_failed");
      setStatus("error");
    }
  }

  function updateSegments(next: NarrativeSegment[]) {
    if (!project) return;
    const updated: EditProject = {
      ...project,
      selectedSegments: next,
      totalDurationSeconds: computeTotalDuration(next),
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    rerenderAudio(next, project.source);
  }

  function onTogglePin(id: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onRegenerateSegment(id: string) {
    if (!project) return;
    const segment = project.selectedSegments.find((s) => s.id === id);
    if (!segment || !segment.alternatives || segment.alternatives.length === 0) {
      showToast("Este bloque no tiene alternativas disponibles todavía.");
      return;
    }
    updateSegments(replaceWithAlternative(project.selectedSegments, id, segment.alternatives[0].id));
    showToast("Bloque regenerado con una alternativa.", "success");
  }

  async function onRegenerateAll() {
    if (!project) return;
    try {
      const { storyAnalysis, selectedSegments } = await postJSON<{
        storyAnalysis: StoryAnalysis;
        selectedSegments: NarrativeSegment[];
      }>("/api/chacotero/analyze", {
        transcript: project.transcript,
        targetDuration: project.targetDuration,
        editorialMode: project.editorialMode,
        heatmapMoments: project.heatmapMoments,
        sourceUrl: project.source.url,
      });

      const pinned = project.selectedSegments.filter((s) => pinnedIds.has(s.id));
      const freshNonOverlapping = selectedSegments.filter(
        (ns) => !pinned.some((p) => ns.startSeconds < p.endSeconds && ns.endSeconds > p.startSeconds)
      );
      const merged = [...pinned, ...freshNonOverlapping].sort((a, b) => a.startSeconds - b.startSeconds);

      const updated: EditProject = {
        ...project,
        selectedSegments: merged,
        storyAnalysis,
        totalDurationSeconds: computeTotalDuration(merged),
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      await rerenderAudio(merged, project.source);
      showToast("Corte regenerado.", "success");
    } catch {
      showToast("No se pudo regenerar el corte.");
    }
  }

  function onPlaySegment(id: string) {
    setRequestedSegmentId(id);
    setRequestedNonce((n) => n + 1);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="sticky top-0 z-30 bg-[var(--background)] border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeft size={13} />
              LowHangingFruits
            </Link>
            <span className="text-[var(--border)]">·</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Sparkles size={13} className="text-[var(--accent)]" />
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Chacotero Editor</span>
            </div>
            {status === "ready" && project && (
              <>
                <span className="text-[var(--border)] hidden sm:inline">·</span>
                <span className="text-xs text-[var(--text-muted)] line-clamp-1 hidden sm:inline">
                  {project.storyAnalysis?.suggestedTitle ?? project.source.title}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">
              Datos simulados
            </span>
            {status === "ready" && project && (
              <ExportActions
                project={project}
                editedAudioUrl={editedAudioUrl}
                activeSegmentId={activeSegmentId}
                onRegenerateAll={onRegenerateAll}
                onRegenerateSegment={onRegenerateSegment}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto px-4 py-6 w-full">
        {status === "draft" && <NewProjectForm onGenerate={handleGenerate} initialUrl={lastUrl} />}
        {status === "processing" && <ProcessingScreen currentStageId={stageId} />}
        {status === "error" && errorCode && (
          <ErrorScreen code={errorCode} onRetry={() => setStatus("draft")} />
        )}
        {status === "ready" && project && project.storyAnalysis && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-6 pb-16">
            <StoryPanel storyAnalysis={project.storyAnalysis} />
            <TimelinePanel
              segments={project.selectedSegments}
              targetDuration={project.targetDuration}
              totalDurationSeconds={project.totalDurationSeconds}
              heatmapMoments={project.heatmapMoments}
              playingSegmentId={activeSegmentId}
              pinnedIds={pinnedIds}
              onPlaySegment={onPlaySegment}
              onTogglePin={onTogglePin}
              onRemove={(id) => updateSegments(removeSegment(project.selectedSegments, id))}
              onExtend={(id) => updateSegments(extendSegment(project.selectedSegments, id, project.source.durationSeconds))}
              onShorten={(id) => updateSegments(shortenSegment(project.selectedSegments, id))}
              onReplace={(id, altId) => updateSegments(replaceWithAlternative(project.selectedSegments, id, altId))}
            />
          </div>
        )}
      </main>

      {status === "ready" && project && (
        <AudioPlayer
          segments={project.selectedSegments}
          source={project.source}
          editedAudioUrl={editedAudioUrl}
          requestedSegmentId={requestedSegmentId}
          requestedSegmentNonce={requestedNonce}
          onActiveSegmentChange={setActiveSegmentId}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
