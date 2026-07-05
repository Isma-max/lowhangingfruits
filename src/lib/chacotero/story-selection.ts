import {
  EditorialMode,
  HeatmapMoment,
  NarrativeCategory,
  NarrativeSegment,
  StoryAnalysis,
} from "@/lib/chacotero/types";

// A candidate is a possible beat the editorial engine can choose to include.
// `tier` encodes editorial priority, not chronology:
//   1 = spine — required to keep the story comprehensible on its own
//   2 = important — adds nuance/escalation, included when the duration budget allows
//   3 = optional — connective tissue or extra color, only kept for longer cuts
export interface CandidateAlternative {
  id: string;
  startSeconds: number;
  endSeconds: number;
  transcript: string;
  editorialReason: string;
  narrativeScore: number;
}

export interface CandidateSegment {
  id: string;
  category: NarrativeCategory;
  tier: 1 | 2 | 3;
  startSeconds: number;
  endSeconds: number;
  transcript: string;
  editorialReason: string;
  narrativeScore: number;
  emotionalScore: number;
  clarityScore: number;
  audienceInterestScore: number;
  alternatives?: CandidateAlternative[];
}

interface ModeWeights {
  narrative: number;
  emotional: number;
  clarity: number;
  audience: number;
}

const MODE_WEIGHTS: Record<EditorialMode, ModeWeights> = {
  balanced: { narrative: 0.4, emotional: 0.2, clarity: 0.2, audience: 0.2 },
  dramatic: { narrative: 0.3, emotional: 0.45, clarity: 0.1, audience: 0.15 },
  entertaining: { narrative: 0.25, emotional: 0.15, clarity: 0.1, audience: 0.5 },
  direct: { narrative: 0.5, emotional: 0.15, clarity: 0.3, audience: 0.05 },
  contextual: { narrative: 0.35, emotional: 0.1, clarity: 0.45, audience: 0.1 },
};

// Most Replayed style signal: contributes a small bonus, never enough to
// outweigh narrative/clarity weighting on its own.
const HEATMAP_WEIGHT = 0.08;

function heatmapBonus(segment: Pick<CandidateSegment, "startSeconds" | "endSeconds">, heatmap?: HeatmapMoment[]): number {
  if (!heatmap || heatmap.length === 0) return 0;
  const overlapping = heatmap.filter(
    (m) => m.startSeconds < segment.endSeconds && m.endSeconds > segment.startSeconds
  );
  if (overlapping.length === 0) return 0;
  return Math.max(...overlapping.map((m) => m.intensity)) * 100;
}

export function effectiveScore(
  segment: CandidateSegment,
  mode: EditorialMode,
  heatmap?: HeatmapMoment[]
): number {
  const w = MODE_WEIGHTS[mode];
  const base =
    segment.narrativeScore * w.narrative +
    segment.emotionalScore * w.emotional +
    segment.clarityScore * w.clarity +
    segment.audienceInterestScore * w.audience;
  return base + heatmapBonus(segment, heatmap) * HEATMAP_WEIGHT;
}

function toNarrativeSegment(c: CandidateSegment, selected: boolean): NarrativeSegment {
  return {
    id: c.id,
    category: c.category,
    startSeconds: c.startSeconds,
    endSeconds: c.endSeconds,
    transcript: c.transcript,
    editorialReason: c.editorialReason,
    narrativeScore: c.narrativeScore,
    emotionalScore: c.emotionalScore,
    clarityScore: c.clarityScore,
    audienceInterestScore: c.audienceInterestScore,
    isSelected: selected,
    alternatives: c.alternatives?.map((a) => ({
      id: a.id,
      category: c.category,
      startSeconds: a.startSeconds,
      endSeconds: a.endSeconds,
      transcript: a.transcript,
      editorialReason: a.editorialReason,
      narrativeScore: a.narrativeScore,
      isSelected: false,
    })),
  };
}

export interface SelectionResult {
  selected: NarrativeSegment[];
  excluded: CandidateSegment[];
}

// Greedy budget fill that never sacrifices the narrative spine (tier 1) to
// save time: coherence outranks hitting the exact target duration.
export function selectNarrativeSegments(
  candidates: CandidateSegment[],
  targetDurationSeconds: number,
  mode: EditorialMode,
  heatmap?: HeatmapMoment[]
): SelectionResult {
  const scored = candidates
    .map((c) => ({ c, score: effectiveScore(c, mode, heatmap) }))
    .sort((a, b) => b.score - a.score);

  const spine = scored.filter((s) => s.c.tier === 1).map((s) => s.c);
  const rest = scored.filter((s) => s.c.tier !== 1).sort((a, b) => {
    if (a.c.tier !== b.c.tier) return a.c.tier - b.c.tier;
    return b.score - a.score;
  });

  const selectedIds = new Set<string>();
  let total = 0;

  for (const c of spine) {
    selectedIds.add(c.id);
    total += c.endSeconds - c.startSeconds;
  }

  const ceiling = targetDurationSeconds * 1.15;
  for (const { c } of rest) {
    const duration = c.endSeconds - c.startSeconds;
    if (total + duration <= ceiling) {
      selectedIds.add(c.id);
      total += duration;
    }
  }

  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id));
  const excluded = candidates.filter((c) => !selectedIds.has(c.id));

  const selected = selectedCandidates
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((c) => toNarrativeSegment(c, true));

  return { selected, excluded };
}

export function buildEditorialSummary(
  selected: NarrativeSegment[],
  excluded: CandidateSegment[],
  mode: EditorialMode
): string {
  const sentences: string[] = [];

  const hook = selected.find((s) => s.category === "hook");
  const context = selected.find((s) => s.category === "context");
  const revelations = selected.filter((s) => s.category === "revelation");
  const climax = selected.find((s) => s.category === "climax");
  const closing = selected.find((s) => s.category === "closing");

  if (hook) {
    sentences.push("Se abrió con el hook que instala el conflicto sin necesidad de rodeos.");
  }
  if (context) {
    sentences.push(
      "Se mantuvo el contexto mínimo porque permite entender quién es quién y la relación entre los involucrados."
    );
  }
  if (revelations.length > 0) {
    const top = [...revelations].sort((a, b) => b.narrativeScore - a.narrativeScore)[0];
    sentences.push(
      `Se priorizó la revelación "${top.editorialReason.split(".")[0].toLowerCase()}" por su impacto narrativo.`
    );
  }
  if (climax) {
    sentences.push("Se conservó el clímax completo: es el punto donde la historia se vuelve irreversible.");
  }
  if (closing) {
    sentences.push("Se incluyó el cierre para que el corte se sienta completo y no quede abierto.");
  }

  const modeNote: Record<EditorialMode, string> = {
    balanced: "",
    dramatic: "El enfoque dramático priorizó los pasajes de mayor carga emocional sobre los explicativos.",
    entertaining: "El enfoque entretenido priorizó los momentos más citables y de mayor interés de audiencia.",
    direct: "El enfoque directo recortó transiciones y contexto secundario para ir más rápido al conflicto.",
    contextual: "El enfoque de contexto priorizó claridad sobre ritmo, conservando más pasajes explicativos.",
  };
  if (modeNote[mode]) sentences.push(modeNote[mode]);

  const droppable = excluded.filter((c) => c.category === "escalation" || c.category === "transition");
  if (droppable.length > 0) {
    sentences.push(
      `Se eliminaron ${droppable.length} pasaje${droppable.length > 1 ? "s" : ""} de transición o repetición que no agregaban información nueva.`
    );
  }

  return sentences.join(" ");
}

export function buildContinuityWarnings(excluded: CandidateSegment[]): string[] {
  const warnings: string[] = [];
  const excludedContext = excluded.find((c) => c.category === "context");
  if (excludedContext) {
    warnings.push(
      "Se recortó parte del contexto de la relación; en la versión más corta el vínculo entre los personajes se entiende, pero con menos detalle de fondo."
    );
  }
  const excludedEscalation = excluded.filter((c) => c.category === "escalation");
  if (excludedEscalation.length >= 2) {
    warnings.push(
      "Se comprimieron varios pasos de la escalada del conflicto; el operador puede extender algún bloque si necesita más gradualidad."
    );
  }
  return warnings;
}

export function buildStoryAnalysis(
  base: Omit<StoryAnalysis, "editorialSummary" | "continuityWarnings">,
  selected: NarrativeSegment[],
  excluded: CandidateSegment[],
  mode: EditorialMode
): StoryAnalysis {
  return {
    ...base,
    continuityWarnings: buildContinuityWarnings(excluded),
    editorialSummary: buildEditorialSummary(selected, excluded, mode),
  };
}
