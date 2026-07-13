import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/yt/db";
import { createSessionToken, getSessionSecret, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/yt/auth/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  // Constant-shape response whether the user exists or not, avoid leaking which emails are registered.
  const passwordHash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await bcrypt.compare(password, passwordHash);

  if (!user || !valid) {
    console.warn("[yt-auth] login failed", { email });
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await createSessionToken(
    { userId: user.id, email: user.email, name: user.name, role: user.role, exp },
    getSessionSecret(),
  );

  const res = NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role } });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
