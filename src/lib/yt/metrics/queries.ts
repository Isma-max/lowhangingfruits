import { DailyMetric, VideoMetric } from "@prisma/client";
import { db } from "@/lib/yt/db";

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
