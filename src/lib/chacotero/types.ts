// Core data model for Chacotero Editor.
// Kept decoupled from any provider implementation so real backends can
// replace the mock adapters in src/lib/chacotero/services without touching the UI.

export type TargetDuration = 180 | 300 | 600 | number;

export type EditorialMode =
  | "balanced"
  | "dramatic"
  | "entertaining"
  | "direct"
  | "contextual";

export const EDITORIAL_MODES: { id: EditorialMode; label: string; description: string }[] = [
  { id: "balanced", label: "Balanceado", description: "Equilibra emoción, claridad y ritmo" },
  { id: "dramatic", label: "Más dramático", description: "Prioriza tensión y peso emocional" },
  { id: "entertaining", label: "Más entretenido", description: "Prioriza ritmo y momentos memorables" },
  { id: "direct", label: "Más directo", description: "Va al conflicto rápido, recorta contexto" },
  { id: "contextual", label: "Más contexto", description: "Cuida que se entienda quién es quién" },
];

export type NarrativeCategory =
  | "hook"
  | "context"
  | "conflict"
  | "escalation"
  | "revelation"
  | "climax"
  | "reaction"
  | "closing"
  | "transition";

export const NARRATIVE_CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  hook: "Hook",
  context: "Contexto",
  conflict: "Conflicto",
  escalation: "Escalada",
  revelation: "Revelación",
  climax: "Clímax",
  reaction: "Reacción",
  closing: "Cierre",
  transition: "Transición",
};

export interface VideoSource {
  url: string;
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  publishedAt?: string;
  sourceType: "youtube";
}

export interface HeatmapMoment {
  startSeconds: number;
  endSeconds: number;
  intensity: number; // 0-1
  label?: string;
}

export interface TranscriptSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  speaker?: string;
  text: string;
  confidence?: number;
}

export interface NarrativeSegment {
  id: string;
  category: NarrativeCategory;
  startSeconds: number;
  endSeconds: number;
  transcript: string;
  editorialReason: string;
  narrativeScore: number;
  emotionalScore?: number;
  clarityScore?: number;
  audienceInterestScore?: number;
  isSelected: boolean;
  alternatives?: NarrativeSegment[];
}

export interface StoryAnalysis {
  suggestedTitle: string;
  premise: string;
  conflictType: string;
  identifiedCharacters: string[];
  relationships: string[];
  tone: string[];
  mainConflict: string;
  turningPoint?: string;
  climax?: string;
  ending?: string;
  continuityWarnings: string[];
  editorialSummary: string;
}

export type ProjectStatus = "draft" | "processing" | "ready" | "error";

export interface EditProject {
  id: string;
  status: ProjectStatus;
  targetDuration: TargetDuration;
  editorialMode: EditorialMode;
  source: VideoSource;
  heatmapMoments?: HeatmapMoment[];
  transcript: TranscriptSegment[];
  storyAnalysis?: StoryAnalysis;
  selectedSegments: NarrativeSegment[];
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export type ProcessingStageId =
  | "metadata"
  | "audio_prep"
  | "transcription"
  | "diarization"
  | "story_reconstruction"
  | "key_moments"
  | "segment_selection"
  | "assembly";

export interface ProcessingStage {
  id: ProcessingStageId;
  label: string;
}

export const PROCESSING_STAGES: ProcessingStage[] = [
  { id: "metadata", label: "Obteniendo metadata del video" },
  { id: "audio_prep", label: "Preparando audio" },
  { id: "transcription", label: "Transcribiendo conversación" },
  { id: "diarization", label: "Identificando hablantes" },
  { id: "story_reconstruction", label: "Reconstruyendo historia" },
  { id: "key_moments", label: "Detectando momentos clave" },
  { id: "segment_selection", label: "Seleccionando segmentos" },
  { id: "assembly", label: "Ensamblando corte final" },
];

export type ProcessingErrorCode =
  | "invalid_url"
  | "video_unavailable"
  | "audio_unprocessable"
  | "transcription_failed"
  | "video_too_short"
  | "analysis_failed";

export const PROCESSING_ERROR_MESSAGES: Record<ProcessingErrorCode, { title: string; description: string }> = {
  invalid_url: {
    title: "El link no es válido",
    description: "Revisa que sea una URL de YouTube completa, por ejemplo https://www.youtube.com/watch?v=...",
  },
  video_unavailable: {
    title: "El video no está disponible",
    description: "Puede ser privado, haber sido eliminado o restringido en tu región.",
  },
  audio_unprocessable: {
    title: "No se pudo procesar el audio",
    description: "El audio del video llegó dañado, silencioso o en un formato no soportado.",
  },
  transcription_failed: {
    title: "La transcripción falló",
    description: "No fue posible transcribir la conversación con suficiente confianza. Intenta de nuevo.",
  },
  video_too_short: {
    title: "El video es demasiado corto",
    description: "Necesitamos más material del que cabe en la duración objetivo para reconstruir una historia completa.",
  },
  analysis_failed: {
    title: "El análisis editorial falló",
    description: "No se pudo reconstruir una historia coherente a partir de la transcripción disponible.",
  },
};

export class ChacoteroError extends Error {
  code: ProcessingErrorCode;
  constructor(code: ProcessingErrorCode, message?: string) {
    super(message ?? PROCESSING_ERROR_MESSAGES[code].title);
    this.code = code;
  }
}
