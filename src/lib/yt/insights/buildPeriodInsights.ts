import { Period, VideoMetric } from "@prisma/client";
import { db } from "@/lib/yt/db";
import { getDailyMetrics, getVideoMetrics } from "../metrics/queries";
import { aggregateGeneral } from "../metrics/aggregate";
import { resolveComparisonPeriod } from "../metrics/comparisonPeriod";
import { median, compareMetric } from "../metrics/stats";
import { computeConcentration, ConcentrationResult } from "./rules";
import { buildPeriodComparison, PeriodComparisonResult } from "./comparison";
import { detectMilestones, Milestone } from "./milestones";
import { generateConclusions, ConclusionBlock, TopVideoForConclusion } from "./conclusions";

function daysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function computeChannelEngagement(videos: Pick<VideoMetric, "likes" | "comments" | "shares" | "views">[]): number | null {
  const totalViews = videos.reduce((sum, v) => sum + (v.views ?? 0), 0);
  if (totalViews <= 0) return null;
  let any = false;
  const totalInteractions = videos.reduce((sum, v) => {
    if (v.likes === null && v.comments === null && v.shares === null) return sum;
    any = true;
    return sum + (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0);
  }, 0);
  if (!any) return null;
  return (totalInteractions / totalViews) * 100;
}

export interface PeriodInsights {
  comparison: PeriodComparisonResult;
  milestones: Milestone[];
  autoConclusions: ConclusionBlock[];
  concentration: ConcentrationResult;
  comparePeriod: { id: string; name: string } | null;
  videosCount: number;
}

/** Server-side orchestrator: gathers DB data and runs it through the pure insights functions. */
export async function buildPeriodInsights(period: Period): Promise<PeriodInsights> {
  const [dailyRows, videoRows, comparePeriod] = await Promise.all([
    getDailyMetrics(period.id),
    getVideoMetrics(period.id),
    resolveComparisonPeriod(period),
  ]);

  const current = aggregateGeneral(dailyRows);
  const [compareDailyRows, compareVideoRows] = comparePeriod
    ? await Promise.all([getDailyMetrics(comparePeriod.id), getVideoMetrics(comparePeriod.id)])
    : [[], []];
  const previous = comparePeriod ? aggregateGeneral(compareDailyRows) : null;

  const currentDays = daysInclusive(period.startDate, period.endDate);
  const previousDays = comparePeriod ? daysInclusive(comparePeriod.startDate, comparePeriod.endDate) : null;

  const currentEngagement = computeChannelEngagement(videoRows);
  const previousEngagement = comparePeriod ? computeChannelEngagement(compareVideoRows) : null;

  const comparison = buildPeriodComparison({
    currentDays,
    previousDays,
    current,
    previous,
    currentVideoCount: videoRows.length || null,
    previousVideoCount: comparePeriod ? compareVideoRows.length || null : null,
    currentEngagement,
    previousEngagement,
  });

  const viewsSortedDesc = videoRows.map((v) => v.views ?? 0).filter((v) => v > 0).sort((a, b) => b - a);
  const concentration = computeConcentration(viewsSortedDesc);
  const medianViews = median(videoRows.map((v) => v.views).filter((v): v is number => v !== null));

  const year = period.startDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const siblingPeriods = await db.period.findMany({
    where: { channelId: period.channelId, startDate: { gte: yearStart }, endDate: { lte: yearEnd } },
  });
  const sameYearPeriods = await Promise.all(
    siblingPeriods.map(async (p) => {
      const rows = p.id === period.id ? dailyRows : await getDailyMetrics(p.id);
      return { periodId: p.id, name: p.name, views: aggregateGeneral(rows).views };
    }),
  );

  const viewsComparison = compareMetric(current.views, previous?.views ?? null);

  const milestones = detectMilestones({
    currentPeriodId: period.id,
    dailyPoints: dailyRows.map((r) => ({ date: r.date.toISOString().slice(0, 10), views: r.views })),
    videos: videoRows.map((v) => ({
      id: v.id,
      title: v.title,
      views: v.views,
      impressionsCtr: v.impressionsCtr,
      averageViewPercentage: v.averageViewPercentage,
      subscribersGained: v.subscribersGained,
    })),
    viewsComparison,
    concentration,
    sameYearPeriods,
  });

  const sortedByViews = [...videoRows].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const toConclusionVideo = (v: VideoMetric | undefined): TopVideoForConclusion | null =>
    v ? { title: v.title, views: v.views, impressionsCtr: v.impressionsCtr, averageViewPercentage: v.averageViewPercentage } : null;
  const topVideo = toConclusionVideo(sortedByViews[0]);
  const bottomVideo = sortedByViews.length > 1 ? toConclusionVideo(sortedByViews[sortedByViews.length - 1]) : null;

  const autoConclusions = generateConclusions({
    periodLabel: period.name,
    current,
    viewsComparison,
    concentration,
    milestones,
    topVideo,
    bottomVideo,
    medianViews,
    videoSampleSize: videoRows.length,
  });

  return {
    comparison,
    milestones,
    autoConclusions,
    concentration,
    comparePeriod: comparePeriod ? { id: comparePeriod.id, name: comparePeriod.name } : null,
    videosCount: videoRows.length,
  };
}
