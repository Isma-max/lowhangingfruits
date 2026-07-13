import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";
import { runValidation } from "@/lib/yt/parsing/validate";
import { hashContent } from "@/lib/yt/parsing/hash";
import { PARSER_VERSION } from "@/lib/yt/parsing/version";
import { sanitizeFilename, isFileSizeAllowed } from "@/lib/yt/security";
import type { CanonicalField } from "@/lib/yt/parsing/columnMap";

const Schema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["GENERAL", "PER_VIDEO"]),
  text: z.string().min(1),
  mapping: z.record(z.string(), z.string().nullable()),
  duplicateAction: z.enum(["cancel", "replace", "new_version"]).optional(),
  savePreset: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { periodId } = await params;
  const period = await db.period.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { fileName, fileType, text, savePreset, duplicateAction } = parsed.data;
  const mapping = parsed.data.mapping as Record<string, CanonicalField | null>;

  if (!isFileSizeAllowed(Buffer.byteLength(text, "utf8"))) {
    return NextResponse.json({ error: "El archivo excede el tamaño máximo permitido (20MB)." }, { status: 413 });
  }

  const report = runValidation(text, fileType, mapping, {
    startDate: format(period.startDate, "yyyy-MM-dd"),
    endDate: format(period.endDate, "yyyy-MM-dd"),
  });

  if (report.errors.length > 0) {
    return NextResponse.json({ error: "No se puede confirmar: el archivo tiene errores bloqueantes.", errors: report.errors }, { status: 422 });
  }

  const hash = hashContent(text);
  const existing = await db.upload.findFirst({
    where: { periodId, fileType, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (!duplicateAction) {
      return NextResponse.json(
        {
          duplicate: true,
          existingUploadId: existing.id,
          existingUploadName: existing.originalName,
          sameContent: existing.hash === hash,
        },
        { status: 409 },
      );
    }
    if (duplicateAction === "cancel") {
      return NextResponse.json({ cancelled: true });
    }
  }

  const upload = await db.$transaction(async (tx) => {
    if (existing && duplicateAction === "replace") {
      await tx.upload.delete({ where: { id: existing.id } }); // cascades to its metrics
    } else if (existing && duplicateAction === "new_version") {
      await tx.upload.update({ where: { id: existing.id }, data: { status: "SUPERSEDED" } });
    }

    const created = await tx.upload.create({
      data: {
        periodId,
        userId: session.userId,
        fileType,
        originalName: sanitizeFilename(fileName),
        rawContent: text,
        hash,
        parserVersion: PARSER_VERSION,
        status: "CONFIRMED",
        rowCount: report.rowCount,
        validRowCount: report.validRowCount,
        metricsAvailable: JSON.stringify(report.metricsAvailable),
        metricsMissing: JSON.stringify(report.metricsMissing),
        errors: JSON.stringify(report.errors),
        warnings: JSON.stringify(report.warnings),
      },
    });

    if (fileType === "GENERAL") {
      const aggregated = new Map<string, {
        views: number;
        watchTimeHours: number;
        subscribersGained: number;
        subscribersLost: number;
        impressions: number;
        impressionsCtrSum: number;
        impressionsCtrCount: number;
        averageViewDurationSum: number;
        averageViewDurationCount: number;
        averageViewPercentageSum: number;
        averageViewPercentageCount: number;
        estimatedRevenue: number;
      }>();

      for (const row of report.generalRows) {
        if (!row.date) continue;
        const d = row.date;
        const existing = aggregated.get(d) ?? {
          views: 0,
          watchTimeHours: 0,
          subscribersGained: 0,
          subscribersLost: 0,
          impressions: 0,
          impressionsCtrSum: 0,
          impressionsCtrCount: 0,
          averageViewDurationSum: 0,
          averageViewDurationCount: 0,
          averageViewPercentageSum: 0,
          averageViewPercentageCount: 0,
          estimatedRevenue: 0,
        };

        if (row.views !== null) existing.views += row.views;
        if (row.watch_time_hours !== null) existing.watchTimeHours += row.watch_time_hours;
        if (row.subscribers_gained !== null) existing.subscribersGained += row.subscribers_gained;
        if (row.subscribers_lost !== null) existing.subscribersLost += row.subscribers_lost;
        if (row.impressions !== null) existing.impressions += row.impressions;
        if (row.impressions_ctr !== null) {
          existing.impressionsCtrSum += row.impressions_ctr;
          existing.impressionsCtrCount++;
        }
        if (row.average_view_duration !== null) {
          existing.averageViewDurationSum += row.average_view_duration;
          existing.averageViewDurationCount++;
        }
        if (row.average_view_percentage !== null) {
          existing.averageViewPercentageSum += row.average_view_percentage;
          existing.averageViewPercentageCount++;
        }
        if (row.estimated_revenue !== null) existing.estimatedRevenue += row.estimated_revenue;

        aggregated.set(d, existing);
      }

      for (const [dateStr, values] of aggregated.entries()) {
        await tx.dailyMetric.create({
          data: {
            periodId,
            uploadId: created.id,
            date: new Date(`${dateStr}T00:00:00Z`),
            views: values.views,
            watchTimeHours: values.watchTimeHours || null,
            subscribersGained: values.subscribersGained || null,
            subscribersLost: values.subscribersLost || null,
            impressions: values.impressions || null,
            impressionsCtr: values.impressionsCtrCount > 0 ? (values.impressionsCtrSum / values.impressionsCtrCount) : null,
            averageViewDuration: values.averageViewDurationCount > 0 ? Math.round(values.averageViewDurationSum / values.averageViewDurationCount) : null,
            averageViewPercentage: values.averageViewPercentageCount > 0 ? (values.averageViewPercentageSum / values.averageViewPercentageCount) : null,
            estimatedRevenue: values.estimatedRevenue || null,
          },
        });
      }
    } else {
      for (const row of report.videoRows) {
        if (!row.title) continue;
        await tx.videoMetric.create({
          data: {
            periodId,
            uploadId: created.id,
            videoId: row.video_id,
            title: row.title,
            url: row.url,
            publishedAt: row.published_at ? new Date(`${row.published_at}T00:00:00Z`) : null,
            durationSeconds: row.duration,
            views: row.views,
            watchTimeHours: row.watch_time_hours,
            averageViewDuration: row.average_view_duration,
            averageViewPercentage: row.average_view_percentage,
            impressions: row.impressions,
            impressionsCtr: row.impressions_ctr,
            likes: row.likes,
            comments: row.comments,
            shares: row.shares,
            subscribersGained: row.subscribers_gained,
            subscribersLost: row.subscribers_lost,
            estimatedRevenue: row.estimated_revenue,
          },
        });
      }
    }

    return created;
  });

  if (savePreset) {
    await db.columnMappingPreset.upsert({
      where: { channelId_fileType: { channelId: period.channelId, fileType } },
      update: { mapping: JSON.stringify(mapping) },
      create: { channelId: period.channelId, fileType, mapping: JSON.stringify(mapping) },
    });
  }

  return NextResponse.json({ uploadId: upload.id, warnings: report.warnings });
}
