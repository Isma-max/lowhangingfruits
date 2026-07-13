import { DailyMetric, VideoMetric } from "@prisma/client";
import { db } from "@/lib/yt/db";
import { sumOrNull, weightedAverage } from "./stats";

export interface AggregatedGeneral {
  views: number | null;
  watchTimeHours: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
  subscribersNet: number | null;
  impressions: number | null;
  impressionsCtr: number | null;
  averageViewDuration: number | null;
  averageViewPercentage: number | null;
  estimatedRevenue: number | null;
  daysWithData: number;
}

export function aggregateGeneral(rows: DailyMetric[]): AggregatedGeneral {
  const subscribersGained = sumOrNull(rows.map((r) => r.subscribersGained));
  const subscribersLost = sumOrNull(rows.map((r) => r.subscribersLost));
  return {
    views: sumOrNull(rows.map((r) => r.views)),
    watchTimeHours: sumOrNull(rows.map((r) => r.watchTimeHours)),
    subscribersGained,
    subscribersLost,
    subscribersNet: subscribersGained !== null || subscribersLost !== null ? (subscribersGained ?? 0) - (subscribersLost ?? 0) : null,
    impressions: sumOrNull(rows.map((r) => r.impressions)),
    impressionsCtr: weightedAverage(rows.map((r) => r.impressionsCtr), rows.map((r) => r.impressions)),
    averageViewDuration: weightedAverage(rows.map((r) => r.averageViewDuration), rows.map((r) => r.views)),
    averageViewPercentage: weightedAverage(rows.map((r) => r.averageViewPercentage), rows.map((r) => r.views)),
    estimatedRevenue: sumOrNull(rows.map((r) => r.estimatedRevenue)),
    daysWithData: rows.length,
  };
}

/** The active upload for a (period, fileType) pair: the latest CONFIRMED one. */
export async function getActiveUpload(periodId: string, fileType: "GENERAL" | "PER_VIDEO") {
  return db.upload.findFirst({ where: { periodId, fileType, status: "CONFIRMED" }, orderBy: { createdAt: "desc" } });
}

export async function getDailyMetrics(periodId: string): Promise<DailyMetric[]> {
  const upload = await getActiveUpload(periodId, "GENERAL");
  if (!upload) return [];
  return db.dailyMetric.findMany({ where: { uploadId: upload.id }, orderBy: { date: "asc" } });
}

export async function getVideoMetrics(periodId: string): Promise<VideoMetric[]> {
  const upload = await getActiveUpload(periodId, "PER_VIDEO");
  if (!upload) return [];
  return db.videoMetric.findMany({ where: { uploadId: upload.id }, orderBy: { views: "desc" } });
}

export function engagementRate(v: { likes: number | null; comments: number | null; shares: number | null; views: number | null }): number | null {
  if (!v.views || v.views <= 0) return null;
  if (v.likes === null && v.comments === null && v.shares === null) return null;
  const interactions = (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0);
  return (interactions / v.views) * 100;
}

export function subscribersPer1000Views(subscribersGained: number | null, views: number | null): number | null {
  if (subscribersGained === null || views === null || views <= 0) return null;
  return (subscribersGained / views) * 1000;
}
