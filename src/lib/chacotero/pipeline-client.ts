import { ChacoteroError, ProcessingErrorCode } from "@/lib/chacotero/types";

interface ErrorEnvelope {
  error?: { code: ProcessingErrorCode; title?: string };
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const envelope = data as ErrorEnvelope;
    throw new ChacoteroError(envelope.error?.code ?? "analysis_failed", envelope.error?.title);
  }
  return data as T;
}
