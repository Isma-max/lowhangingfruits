import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/yt/db";
import { getSession } from "@/lib/yt/auth/getSession";

const FileTypeSchema = z.enum(["GENERAL", "PER_VIDEO"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { channelId } = await params;
  const fileType = FileTypeSchema.safeParse(req.nextUrl.searchParams.get("fileType"));
  if (!fileType.success) return NextResponse.json({ error: "fileType inválido" }, { status: 400 });

  const preset = await db.columnMappingPreset.findUnique({
    where: { channelId_fileType: { channelId, fileType: fileType.data } },
  });

  return NextResponse.json({ mapping: preset ? JSON.parse(preset.mapping) : null });
}

const SaveSchema = z.object({
  fileType: FileTypeSchema,
  mapping: z.record(z.string(), z.string().nullable()),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { channelId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const preset = await db.columnMappingPreset.upsert({
    where: { channelId_fileType: { channelId, fileType: parsed.data.fileType } },
    update: { mapping: JSON.stringify(parsed.data.mapping) },
    create: { channelId, fileType: parsed.data.fileType, mapping: JSON.stringify(parsed.data.mapping) },
  });

  return NextResponse.json({ ok: true, presetId: preset.id });
}
