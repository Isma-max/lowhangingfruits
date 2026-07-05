import { NextRequest } from "next/server";
import { narrativeAnalysisProvider } from "@/lib/chacotero/services";
import { chacoteroErrorResponse } from "@/lib/chacotero/api-helpers";
import { ChacoteroError, EditorialMode, HeatmapMoment, TargetDuration, TranscriptSegment } from "@/lib/chacotero/types";
import { qaTriggerFromUrl } from "@/lib/chacotero/qa-triggers";

interface AnalyzeRequestBody {
  transcript: TranscriptSegment[];
  targetDuration: TargetDuration;
  editorialMode: EditorialMode;
  heatmapMoments?: HeatmapMoment[];
  // Only used for the QA error-trigger affordance (see qa-triggers.ts) — the
  // NarrativeAnalysisProvider interface itself never depends on the source URL.
  sourceUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody;

    if (body.sourceUrl && qaTriggerFromUrl(body.sourceUrl) === "analysis_failed") {
      throw new ChacoteroError("analysis_failed");
    }

    const result = await narrativeAnalysisProvider.analyze({
      transcript: body.transcript,
      targetDuration: body.targetDuration,
      editorialMode: body.editorialMode,
      heatmapMoments: body.heatmapMoments,
    });
    return Response.json(result);
  } catch (error) {
    return chacoteroErrorResponse(error);
  }
}
