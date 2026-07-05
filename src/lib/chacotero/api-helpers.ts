import { ChacoteroError, PROCESSING_ERROR_MESSAGES } from "@/lib/chacotero/types";

export function chacoteroErrorResponse(error: unknown): Response {
  if (error instanceof ChacoteroError) {
    const { title, description } = PROCESSING_ERROR_MESSAGES[error.code];
    return Response.json({ error: { code: error.code, title, description } }, { status: 422 });
  }
  return Response.json(
    { error: { code: "analysis_failed", ...PROCESSING_ERROR_MESSAGES.analysis_failed } },
    { status: 500 }
  );
}
