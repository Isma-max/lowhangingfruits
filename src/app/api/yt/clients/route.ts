import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";

const CreateClientSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { channels: true } } },
  });
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const existing = await db.client.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un cliente con ese nombre" }, { status: 409 });
  }

  const client = await db.client.create({ data: { name: parsed.data.name } });
  return NextResponse.json({ client }, { status: 201 });
}
