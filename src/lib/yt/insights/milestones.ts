import { MetricComparison } from "../metrics/stats";
import { fmtInt, fmtPercent } from "../format";
import { classifyVariation, ConcentrationResult } from "./rules";
import { DEFAULT_THRESHOLDS, RuleThresholds } from "./thresholds";

export interface Milestone {
  type: string;
  label: string;
  detail: string;
}

export interface DailyPoint {
  date: string;
  views: number | null;
}

export interface VideoSummary {
  id: string;
  title: string;
  views: number | null;
  impressionsCtr: number | null;
  averageViewPercentage: number | null;
  subscribersGained: number | null;
}

export interface PeriodYearSample {
  periodId: string;
  name: string;
  views: number | null;
}

export interface MilestoneInput {
  currentPeriodId: string;
  dailyPoints: DailyPoint[];
  videos: VideoSummary[];
  viewsComparison: MetricComparison;
  concentration: ConcentrationResult;
  /** Every Period this channel has confirmed data for within the same calendar year, including the current one. */
  sameYearPeriods: PeriodYearSample[];
  thresholds?: RuleThresholds;
}

/**
 * Detects the spec's milestone types from real data only. "Mejor período
 * del año" is withheld unless there are at least two same-year periods
 * with data — never declared off a single data point.
 */
export function detectMilestones(input: MilestoneInput): Milestone[] {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const milestones: Milestone[] = [];

  const sameYearWithViews = input.sameYearPeriods.filter((p) => p.views !== null);
  if (sameYearWithViews.length >= 2) {
    const best = sameYearWithViews.reduce((a, b) => (b.views! > a.views! ? b : a));
    if (best.periodId === input.currentPeriodId) {
      milestones.push({
        type: "best_period_of_year",
        label: "Mejor período del año",
        detail: `Este es el período con más vistas del año hasta ahora, entre los ${sameYearWithViews.length} períodos con datos cargados (${fmtInt(best.views)} vistas).`,
      });
    }
  }

  const byViews = [...input.videos].filter((v) => v.views !== null).sort((a, b) => b.views! - a.views!);
  if (byViews.length > 0) {
    const v = byViews[0];
    milestones.push({ type: "top_video_views", label: "Video más visto", detail: `"${v.title}" con ${fmtInt(v.views)} vistas.` });
  }

  const byCtr = [...input.videos].filter((v) => v.impressionsCtr !== null).sort((a, b) => b.impressionsCtr! - a.impressionsCtr!);
  if (byCtr.length > 0) {
    const v = byCtr[0];
    milestones.push({ type: "top_video_ctr", label: "Video con mayor CTR", detail: `"${v.title}" con ${fmtPercent(v.impressionsCtr)} de CTR.` });
  }

  const byRetention = [...input.videos].filter((v) => v.averageViewPercentage !== null).sort((a, b) => b.averageViewPercentage! - a.averageViewPercentage!);
  if (byRetention.length > 0) {
    const v = byRetention[0];
    milestones.push({
      type: "top_video_retention",
      label: "Video con mejor retención",
      detail: `"${v.title}" con ${fmtPercent(v.averageViewPercentage)} de porcentaje medio visto.`,
    });
  }

  const bySubs = [...input.videos].filter((v) => v.subscribersGained !== null && v.subscribersGained > 0).sort((a, b) => b.subscribersGained! - a.subscribersGained!);
  if (bySubs.length > 0) {
    const v = bySubs[0];
    milestones.push({
      type: "top_video_subscribers",
      label: "Video que más suscriptores generó",
      detail: `"${v.title}" aportó ${fmtInt(v.subscribersGained)} suscriptores nuevos.`,
    });
  }

  const daysWithViews = input.dailyPoints.filter((d) => d.views !== null);
  if (daysWithViews.length > 0) {
    const best = daysWithViews.reduce((a, b) => (b.views! > a.views! ? b : a));
    milestones.push({ type: "best_day", label: "Mejor día", detail: `${best.date} fue el día con más vistas (${fmtInt(best.views)}).` });
  }

  const variation = classifyVariation(input.viewsComparison.percentDiff, thresholds);
  if (variation === "increase" && input.viewsComparison.percentDiff !== null) {
    milestones.push({
      type: "biggest_increase",
      label: "Mayor alza",
      detail: `Las vistas subieron ${fmtPercent(input.viewsComparison.percentDiff)} respecto del período comparado.`,
    });
  } else if (variation === "decrease" && input.viewsComparison.percentDiff !== null) {
    milestones.push({
      type: "biggest_drop",
      label: "Mayor caída",
      detail: `Las vistas cayeron ${fmtPercent(Math.abs(input.viewsComparison.percentDiff))} respecto del período comparado.`,
    });
  }

  if (input.concentration.topVideoNotable && input.concentration.topVideoPct !== null) {
    milestones.push({
      type: "concentration",
      label: "Mayor concentración de vistas",
      detail: `El video principal concentró ${fmtPercent(input.concentration.topVideoPct)} de las vistas del período.`,
    });
  }

  const bySubEfficiency = input.videos
    .filter((v): v is VideoSummary & { views: number; subscribersGained: number } => v.views !== null && v.views > 0 && v.subscribersGained !== null && v.subscribersGained > 0)
    .map((v) => ({ ...v, efficiency: (v.subscribersGained / v.views) * 1000 }))
    .sort((a, b) => b.efficiency - a.efficiency);
  if (bySubEfficiency.length > 0) {
    const v = bySubEfficiency[0];
    milestones.push({
      type: "best_subscriber_efficiency",
      label: "Mejor eficiencia de suscripción",
      detail: `"${v.title}" generó ${v.efficiency.toFixed(2)} suscriptores por cada 1.000 vistas.`,
    });
  }

  return milestones;
}
