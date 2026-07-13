import { AggregatedGeneral, subscribersPer1000Views } from "../metrics/aggregate";
import { compareMetric, MetricComparison } from "../metrics/stats";

export type MetricUnit = "count" | "hours" | "percent" | "currency" | "ratio" | "seconds";

export interface ComparisonRow {
  key: string;
  label: string;
  unit: MetricUnit;
  /** When true, absoluteDiff should be read/labeled as "puntos porcentuales" rather than raw units. */
  isPercentagePoints?: boolean;
  comparison: MetricComparison;
}

export interface PeriodComparisonInput {
  currentDays: number;
  previousDays: number | null;
  current: AggregatedGeneral;
  previous: AggregatedGeneral | null;
  currentVideoCount: number | null;
  previousVideoCount: number | null;
  currentEngagement: number | null;
  previousEngagement: number | null;
}

export interface PeriodComparisonResult {
  currentDays: number;
  previousDays: number | null;
  dayCountMismatch: boolean;
  rows: ComparisonRow[];
}

function ratioOrNull(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

function watchSecondsPerView(watchTimeHours: number | null, views: number | null): number | null {
  if (watchTimeHours === null || views === null || views <= 0) return null;
  return (watchTimeHours * 3600) / views;
}

/**
 * Full period-over-period comparison per the spec: totals, per-day, videos
 * published, views/video, subs/1000 views, watch time/view, CTR, retention,
 * engagement and revenue — with day-count mismatches surfaced explicitly
 * rather than silently averaged away.
 */
export function buildPeriodComparison(input: PeriodComparisonInput): PeriodComparisonResult {
  const { currentDays, previousDays, current, previous, currentVideoCount, previousVideoCount, currentEngagement, previousEngagement } = input;

  const viewsPerDayCurrent = ratioOrNull(current.views, currentDays);
  const viewsPerDayPrevious = previous ? ratioOrNull(previous.views, previousDays) : null;

  const watchPerDayCurrent = ratioOrNull(current.watchTimeHours, currentDays);
  const watchPerDayPrevious = previous ? ratioOrNull(previous.watchTimeHours, previousDays) : null;

  const viewsPerVideoCurrent = ratioOrNull(current.views, currentVideoCount);
  const viewsPerVideoPrevious = previous ? ratioOrNull(previous.views, previousVideoCount) : null;

  const subsPer1000Current = subscribersPer1000Views(current.subscribersGained, current.views);
  const subsPer1000Previous = previous ? subscribersPer1000Views(previous.subscribersGained, previous.views) : null;

  const watchSecPerViewCurrent = watchSecondsPerView(current.watchTimeHours, current.views);
  const watchSecPerViewPrevious = previous ? watchSecondsPerView(previous.watchTimeHours, previous.views) : null;

  const rows: ComparisonRow[] = [
    { key: "views", label: "Vistas totales", unit: "count", comparison: compareMetric(current.views, previous?.views ?? null) },
    { key: "viewsPerDay", label: "Vistas por día", unit: "count", comparison: compareMetric(viewsPerDayCurrent, viewsPerDayPrevious) },
    {
      key: "watchTimeHours",
      label: "Horas de reproducción",
      unit: "hours",
      comparison: compareMetric(current.watchTimeHours, previous?.watchTimeHours ?? null),
    },
    { key: "watchTimePerDay", label: "Horas por día", unit: "hours", comparison: compareMetric(watchPerDayCurrent, watchPerDayPrevious) },
    { key: "videosPublished", label: "Videos publicados", unit: "count", comparison: compareMetric(currentVideoCount, previousVideoCount) },
    { key: "viewsPerVideo", label: "Vistas por video publicado", unit: "count", comparison: compareMetric(viewsPerVideoCurrent, viewsPerVideoPrevious) },
    {
      key: "subsPer1000Views",
      label: "Suscriptores por 1.000 vistas",
      unit: "ratio",
      comparison: compareMetric(subsPer1000Current, subsPer1000Previous),
    },
    {
      key: "watchSecondsPerView",
      label: "Watch time por vista (seg.)",
      unit: "seconds",
      comparison: compareMetric(watchSecPerViewCurrent, watchSecPerViewPrevious),
    },
    {
      key: "impressionsCtr",
      label: "CTR de impresiones",
      unit: "percent",
      isPercentagePoints: true,
      comparison: compareMetric(current.impressionsCtr, previous?.impressionsCtr ?? null),
    },
    {
      key: "averageViewPercentage",
      label: "Retención (% medio visto)",
      unit: "percent",
      isPercentagePoints: true,
      comparison: compareMetric(current.averageViewPercentage, previous?.averageViewPercentage ?? null),
    },
    {
      key: "engagement",
      label: "Engagement ((me gusta + comentarios + compartidos) / vistas)",
      unit: "percent",
      isPercentagePoints: true,
      comparison: compareMetric(currentEngagement, previousEngagement),
    },
    {
      key: "estimatedRevenue",
      label: "Ingresos estimados",
      unit: "currency",
      comparison: compareMetric(current.estimatedRevenue, previous?.estimatedRevenue ?? null),
    },
  ];

  return {
    currentDays,
    previousDays,
    dayCountMismatch: previousDays !== null && previousDays !== currentDays,
    rows,
  };
}
