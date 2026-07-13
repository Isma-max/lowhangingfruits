import { DEFAULT_THRESHOLDS, RuleThresholds } from "./thresholds";

export type VariationClass = "increase" | "decrease" | "stable" | "unclassified";

/** "Alza relevante" / "caída relevante" / "estabilidad" per the spec's configurable thresholds. */
export function classifyVariation(percentDiff: number | null, thresholds: RuleThresholds = DEFAULT_THRESHOLDS): VariationClass {
  if (percentDiff === null) return "unclassified";
  if (percentDiff >= thresholds.relevantIncreasePct) return "increase";
  if (percentDiff <= thresholds.relevantDecreasePct) return "decrease";
  if (percentDiff >= -thresholds.stableBandPct && percentDiff <= thresholds.stableBandPct) return "stable";
  return "unclassified";
}

export interface VideoPerformanceFlag {
  outstanding: boolean;
  underperforming: boolean;
}

/** "Video sobresaliente" / "bajo rendimiento" vs. the period's median views — only applied with a sufficient sample. */
export function classifyVideoPerformance(
  views: number | null,
  medianViews: number | null,
  sampleSize: number,
  thresholds: RuleThresholds = DEFAULT_THRESHOLDS,
): VideoPerformanceFlag {
  if (views === null || medianViews === null || medianViews <= 0 || sampleSize < thresholds.minSampleForVideoRules) {
    return { outstanding: false, underperforming: false };
  }
  return {
    outstanding: views > medianViews * thresholds.outstandingMultiplier,
    underperforming: views < medianViews * thresholds.underperformingMultiplier,
  };
}

export interface ConcentrationResult {
  topVideoPct: number | null;
  top5Pct: number | null;
  topVideoNotable: boolean;
}

/** Views concentration among the top video and top 5 videos of the period. */
export function computeConcentration(viewsDescending: number[], thresholds: RuleThresholds = DEFAULT_THRESHOLDS): ConcentrationResult {
  const total = viewsDescending.reduce((a, b) => a + b, 0);
  if (total <= 0 || viewsDescending.length === 0) {
    return { topVideoPct: null, top5Pct: null, topVideoNotable: false };
  }
  const topVideoPct = (viewsDescending[0] / total) * 100;
  const top5Sum = viewsDescending.slice(0, 5).reduce((a, b) => a + b, 0);
  const top5Pct = (top5Sum / total) * 100;
  return { topVideoPct, top5Pct, topVideoNotable: topVideoPct > thresholds.topVideoConcentrationPct };
}

export type CtrRetentionQuadrant =
  | "high_ctr_high_retention"
  | "high_ctr_low_retention"
  | "low_ctr_high_retention"
  | "low_ctr_low_retention"
  | "unclassified";

/**
 * Classifies a video's CTR/retention relative to the channel-period averages.
 * Describes the pattern only — never implies a cause (e.g. never attributes
 * low retention to the thumbnail/CTR).
 */
export function classifyCtrRetention(
  videoCtr: number | null,
  videoRetention: number | null,
  avgCtr: number | null,
  avgRetention: number | null,
): CtrRetentionQuadrant {
  if (videoCtr === null || videoRetention === null || avgCtr === null || avgRetention === null) return "unclassified";
  const highCtr = videoCtr >= avgCtr;
  const highRetention = videoRetention >= avgRetention;
  if (highCtr && highRetention) return "high_ctr_high_retention";
  if (highCtr && !highRetention) return "high_ctr_low_retention";
  if (!highCtr && highRetention) return "low_ctr_high_retention";
  return "low_ctr_low_retention";
}
