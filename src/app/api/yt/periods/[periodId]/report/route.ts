import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";

const ConclusionSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["auto", "manual"]),
});

const SaveSchema = z.object({
  name: z.string().trim().min(1).max(200),
  conclusions: z.array(ConclusionSchema),
});

/** The editable draft report for a period: the most recent Report row that hasn't been exported to PDF yet. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { periodId } = await params;
  const draft = await db.report.findFirst({ where: { periodId, pdfPath: null }, orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    draft: draft ? { id: draft.id, name: draft.name, conclusions: JSON.parse(draft.conclusions) } : null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { periodId } = await params;
  const period = await db.period.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const existingDraft = await db.report.findFirst({ where: { periodId, pdfPath: null }, orderBy: { createdAt: "desc" } });

  const report = existingDraft
    ? await db.report.update({
        where: { id: existingDraft.id },
        data: { name: parsed.data.name, conclusions: JSON.stringify(parsed.data.conclusions) },
      })
    : await db.report.create({
        data: {
          periodId,
          userId: session.userId,
          name: parsed.data.name,
          conclusions: JSON.stringify(parsed.data.conclusions),
          config: "{}",
        },
      });

  return NextResponse.json({ ok: true, reportId: report.id });
}
