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
      for (const row of report.generalRows) {
        if (!row.date) continue;
        await tx.dailyMetric.create({
          data: {
            periodId,
            uploadId: created.id,
            date: new Date(`${row.date}T00:00:00Z`),
            views: row.views,
            watchTimeHours: row.watch_time_hours,
            subscribersGained: row.subscribers_gained,
            subscribersLost: row.subscribers_lost,
            impressions: row.impressions,
            impressionsCtr: row.impressions_ctr,
            averageViewDuration: row.average_view_duration,
            averageViewPercentage: row.average_view_percentage,
            estimatedRevenue: row.estimated_revenue,
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
