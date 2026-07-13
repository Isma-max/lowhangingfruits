import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";
import { runValidation } from "@/lib/yt/parsing/validate";
import { hashContent } from "@/lib/yt/parsing/hash";
import { isFileSizeAllowed } from "@/lib/yt/security";
import { format } from "date-fns";

const Schema = z.object({
  fileType: z.enum(["GENERAL", "PER_VIDEO"]),
  text: z.string().min(1),
  mapping: z.record(z.string(), z.string().nullable()),
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

  if (!isFileSizeAllowed(Buffer.byteLength(parsed.data.text, "utf8"))) {
    return NextResponse.json({ error: "El archivo excede el tamaño máximo permitido (20MB)." }, { status: 413 });
  }

  const mapping = parsed.data.mapping as Record<string, import("@/lib/yt/parsing/columnMap").CanonicalField | null>;
  const report = runValidation(parsed.data.text, parsed.data.fileType, mapping, {
    startDate: format(period.startDate, "yyyy-MM-dd"),
    endDate: format(period.endDate, "yyyy-MM-dd"),
  });

  const hash = hashContent(parsed.data.text);
  const existing = await db.upload.findFirst({
    where: { periodId, fileType: parsed.data.fileType, status: { in: ["CONFIRMED"] } },
    orderBy: { createdAt: "desc" },
  });

  const duplicate = existing
    ? { existingUploadId: existing.id, existingUploadName: existing.originalName, sameContent: existing.hash === hash }
    : null;

  return NextResponse.json({
    report: { ...report, generalRows: undefined, videoRows: undefined },
    rowsPreview: {
      general: report.generalRows.slice(0, 5),
      video: report.videoRows.slice(0, 5),
    },
    duplicate,
    hash,
  });
}
