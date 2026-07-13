import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/yt/auth/getSession";
import { parseCsvPreview } from "@/lib/yt/parsing/csv";
import { isFileSizeAllowed } from "@/lib/yt/security";

const Schema = z.object({ text: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  if (!isFileSizeAllowed(Buffer.byteLength(parsed.data.text, "utf8"))) {
    return NextResponse.json({ error: "El archivo excede el tamaño máximo permitido (20MB)." }, { status: 413 });
  }

  const preview = parseCsvPreview(parsed.data.text);
  console.log("[yt-preview] file preview parsed:", {
    fileTypeGuess: preview.fileTypeGuess,
    headers: preview.headers,
    suggestedMapping: preview.suggestedMapping,
    rowCount: preview.totalRows,
  });
  return NextResponse.json({ preview });
}
