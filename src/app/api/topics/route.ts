import { NextRequest } from "next/server";
import { getCachedTopics, setCachedTopics } from "@/lib/ingestion/cache";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { MOCK_TOPICS } from "@/lib/mock-data";

export async function GET(_req: NextRequest) {
  const cached = getCachedTopics();

  if (cached) {
    return Response.json({
      topics: cached.topics,
      fetchedAt: cached.fetchedAt,
      isReal: cached.isReal,
      fromCache: true,
    });
  }

  // Try real ingestion
  try {
    const { topics, errors } = await runIngestionPipeline();

    if (topics.length > 0) {
      setCachedTopics(topics, true);
      return Response.json({
        topics,
        fetchedAt: Date.now(),
        isReal: true,
        fromCache: false,
        errors,
      });
    }
  } catch {
    // Fall through to mock data
  }

  // Fallback to mock data
  setCachedTopics(MOCK_TOPICS, false);
  return Response.json({
    topics: MOCK_TOPICS,
    fetchedAt: Date.now(),
    isReal: false,
    fromCache: false,
    isMockFallback: true,
  });
}
