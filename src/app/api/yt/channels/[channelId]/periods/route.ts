import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";

const CreatePeriodSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
    startDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inicial inválida"),
    endDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Fecha final inválida"),
    comparisonMode: z.enum(["PREVIOUS_PERIOD", "YEAR_OVER_YEAR", "CUSTOM", "NONE"]).default("PREVIOUS_PERIOD"),
    comparePeriodId: z.string().trim().min(1).optional().nullable(),
  })
  .refine((v) => new Date(v.startDate) <= new Date(v.endDate), {
    message: "La fecha inicial debe ser anterior o igual a la fecha final",
    path: ["endDate"],
  });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { channelId } = await params;
  const periods = await db.period.findMany({
    where: { channelId },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { uploads: true } } },
  });
  return NextResponse.json({ periods });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { channelId } = await params;
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel) return NextResponse.json({ error: "Canal no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CreatePeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.comparisonMode === "CUSTOM" && !parsed.data.comparePeriodId) {
    return NextResponse.json({ error: "Selecciona el período de comparación personalizado" }, { status: 400 });
  }

  const period = await db.period.create({
    data: {
      channelId,
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      comparisonMode: parsed.data.comparisonMode,
      comparePeriodId: parsed.data.comparisonMode === "CUSTOM" ? parsed.data.comparePeriodId : null,
    },
  });
  return NextResponse.json({ period }, { status: 201 });
}
