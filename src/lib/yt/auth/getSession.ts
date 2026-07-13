import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SessionPayload, getSessionSecret, verifySessionToken } from "./session";

/** Reads and verifies the session cookie in a Server Component / route handler. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token, getSessionSecret());
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  return session;
}
