/** Configurable thresholds for the deterministic rules engine — spec requires these to be adjustable, not hardcoded. */
export interface RuleThresholds {
  relevantIncreasePct: number; // e.g. 15 -> +15% or more is a "relevant increase"
  relevantDecreasePct: number; // e.g. -15 -> -15% or less is a "relevant decrease"
  stableBandPct: number; // e.g. 5 -> within [-5%, +5%] is "stable"
  outstandingMultiplier: number; // e.g. 2 -> more than 2x the median views
  underperformingMultiplier: number; // e.g. 0.5 -> less than half the median views
  minSampleForVideoRules: number; // minimum number of videos before outstanding/underperforming rules apply
  topVideoConcentrationPct: number; // e.g. 35 -> top video concentrating >35% of views is notable
}

export const DEFAULT_THRESHOLDS: RuleThresholds = {
  relevantIncreasePct: 15,
  relevantDecreasePct: -15,
  stableBandPct: 5,
  outstandingMultiplier: 2,
  underperformingMultiplier: 0.5,
  minSampleForVideoRules: 5,
  topVideoConcentrationPct: 35,
};
