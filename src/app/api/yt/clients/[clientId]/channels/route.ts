import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";

const CreateChannelSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  handle: z.string().trim().max(100).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { clientId } = await params;
  const channels = await db.channel.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
    include: { _count: { select: { periods: true } } },
  });
  return NextResponse.json({ channels });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { clientId } = await params;
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CreateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const existing = await db.channel.findUnique({
    where: { clientId_name: { clientId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un canal con ese nombre para este cliente" }, { status: 409 });
  }

  const channel = await db.channel.create({
    data: { clientId, name: parsed.data.name, handle: parsed.data.handle || null },
  });
  return NextResponse.json({ channel }, { status: 201 });
}
