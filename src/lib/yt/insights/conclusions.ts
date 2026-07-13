import { AggregatedGeneral } from "../metrics/aggregate";
import { MetricComparison } from "../metrics/stats";
import { fmtInt, fmtPercent } from "../format";
import { ConcentrationResult, classifyCtrRetention, classifyVideoPerformance } from "./rules";
import { Milestone } from "./milestones";
import { DEFAULT_THRESHOLDS, RuleThresholds } from "./thresholds";

export interface ConclusionBlock {
  id: string;
  text: string;
  source: "auto" | "manual";
}

export interface TopVideoForConclusion {
  title: string;
  views: number | null;
  impressionsCtr: number | null;
  averageViewPercentage: number | null;
}

export interface ConclusionInput {
  periodLabel: string;
  current: AggregatedGeneral;
  viewsComparison: MetricComparison;
  concentration: ConcentrationResult;
  milestones: Milestone[];
  topVideo: TopVideoForConclusion | null;
  bottomVideo: TopVideoForConclusion | null;
  medianViews: number | null;
  videoSampleSize: number;
  thresholds?: RuleThresholds;
}

/**
 * Deterministic, template-based conclusions from real computed data only —
 * never inventing explanations or causes. Every block is editable by the
 * user before the report is generated (the caller persists edits
 * separately; this only produces the initial auto-generated suggestions).
 */
export function generateConclusions(input: ConclusionInput): ConclusionBlock[] {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const blocks: ConclusionBlock[] = [];

  // Overview
  if (input.current.views !== null) {
    const trendPhrase =
      input.viewsComparison.percentDiff !== null
        ? `, ${input.viewsComparison.percentDiff >= 0 ? "un aumento" : "una caída"} de ${fmtPercent(Math.abs(input.viewsComparison.percentDiff))} respecto del período comparado`
        : "";
    blocks.push({
      id: "auto:overview",
      source: "auto",
      text: `Durante ${input.periodLabel}, el canal obtuvo ${fmtInt(input.current.views)} visualizaciones${trendPhrase}.`,
    });
  }

  // Subscribers
  if (input.current.subscribersNet !== null) {
    const gained = input.current.subscribersGained;
    const lost = input.current.subscribersLost;
    const detail = gained !== null && lost !== null ? ` (${fmtInt(gained)} ganados, ${fmtInt(lost)} perdidos)` : "";
    blocks.push({
      id: "auto:subscribers",
      source: "auto",
      text: `El canal sumó ${fmtInt(input.current.subscribersNet)} suscriptores netos en el período${detail}.`,
    });
  }

  // Concentration
  if (input.concentration.top5Pct !== null) {
    blocks.push({
      id: "auto:concentration_top5",
      source: "auto",
      text: `Los cinco videos principales concentraron el ${fmtPercent(input.concentration.top5Pct)} de las visualizaciones del período.`,
    });
  }
  if (input.concentration.topVideoNotable && input.concentration.topVideoPct !== null) {
    blocks.push({
      id: "auto:concentration_top1",
      source: "auto",
      text: `El video principal concentró por sí solo el ${fmtPercent(input.concentration.topVideoPct)} de las vistas.`,
    });
  }

  // CTR/retention pattern for the top video — describes the pattern, never a cause.
  if (input.topVideo) {
    const quadrant = classifyCtrRetention(
      input.topVideo.impressionsCtr,
      input.topVideo.averageViewPercentage,
      input.current.impressionsCtr,
      input.current.averageViewPercentage,
    );
    const phrase: Partial<Record<typeof quadrant, string>> = {
      high_ctr_low_retention: `El video "${input.topVideo.title}" logró atraer clics por sobre el promedio del canal, pero sostuvo menos atención que el promedio.`,
      high_ctr_high_retention: `El video "${input.topVideo.title}" combinó un CTR y una retención por sobre el promedio del canal.`,
      low_ctr_high_retention: `El video "${input.topVideo.title}" tuvo un CTR bajo el promedio, pero sostuvo la atención por sobre el promedio del canal.`,
      low_ctr_low_retention: `El video "${input.topVideo.title}" tuvo un CTR y una retención bajo el promedio del canal.`,
    };
    if (quadrant !== "unclassified" && phrase[quadrant]) {
      blocks.push({ id: "auto:top_video_ctr_retention", source: "auto", text: phrase[quadrant]! });
    }
  }

  // Video sobresaliente / bajo rendimiento (only with sufficient sample)
  if (input.topVideo) {
    const flag = classifyVideoPerformance(input.topVideo.views, input.medianViews, input.videoSampleSize, thresholds);
    if (flag.outstanding) {
      blocks.push({
        id: "auto:video_outstanding",
        source: "auto",
        text: `El video "${input.topVideo.title}" fue sobresaliente en el período, con más del doble de la mediana de vistas (${fmtInt(input.medianViews)}).`,
      });
    }
  }
  if (input.bottomVideo) {
    const flag = classifyVideoPerformance(input.bottomVideo.views, input.medianViews, input.videoSampleSize, thresholds);
    if (flag.underperforming) {
      blocks.push({
        id: "auto:video_underperforming",
        source: "auto",
        text: `El video "${input.bottomVideo.title}" tuvo bajo rendimiento en el período, con menos de la mitad de la mediana de vistas (${fmtInt(input.medianViews)}).`,
      });
    }
  }

  // Milestones — already phrased as complete statements.
  for (const milestone of input.milestones) {
    blocks.push({ id: `auto:milestone:${milestone.type}`, source: "auto", text: `${milestone.label}: ${milestone.detail}` });
  }

  return blocks;
}
