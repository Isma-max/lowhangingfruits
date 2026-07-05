import { NextRequest } from "next/server";
import { heatmapProvider } from "@/lib/chacotero/services";
import { chacoteroErrorResponse } from "@/lib/chacotero/api-helpers";
import { VideoSource } from "@/lib/chacotero/types";

export async function POST(req: NextRequest) {
  try {
    const { source } = (await req.json()) as { source: VideoSource };
    const heatmapMoments = await heatmapProvider.getHeatmap(source);
    return Response.json({ heatmapMoments: heatmapMoments ?? null });
  } catch (error) {
    return chacoteroErrorResponse(error);
  }
}
