import { NextRequest } from "next/server";
import { invalidateCache, setCachedTopics } from "@/lib/ingestion/cache";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { MOCK_TOPICS } from "@/lib/mock-data";

export async function POST(_req: NextRequest) {
  invalidateCache();

  try {
    const { topics, errors } = await runIngestionPipeline();

    if (topics.length > 0) {
      setCachedTopics(topics, true);
      return Response.json({
        ok: true,
        count: topics.length,
        errors,
        isReal: true,
      });
    }
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }

  // Fallback
  setCachedTopics(MOCK_TOPICS, false);
  return Response.json({
    ok: true,
    count: MOCK_TOPICS.length,
    errors: 0,
    isReal: false,
    isMockFallback: true,
  });
}
