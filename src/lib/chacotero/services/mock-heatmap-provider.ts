import { HeatmapMoment, VideoSource } from "@/lib/chacotero/types";
import { extractYouTubeVideoId } from "@/lib/chacotero/youtube";
import { DEMO_VIDEO_ID, DEMO_HEATMAP_MOMENTS } from "@/lib/chacotero/demo-data";
import { HeatmapProvider } from "@/lib/chacotero/services/types";

// Real implementation: YouTube's "Most Replayed" heatmap is not exposed by
// any public API today — this would come from an internal scraper/partner
// feed. It is intentionally optional: absence must degrade gracefully.
export class MockHeatmapProvider implements HeatmapProvider {
  async getHeatmap(source: VideoSource): Promise<HeatmapMoment[] | undefined> {
    await delay(150);
    const videoId = extractYouTubeVideoId(source.url);
    if (videoId === DEMO_VIDEO_ID) return DEMO_HEATMAP_MOMENTS;
    // Unknown videos: no heatmap signal available, which the UI must handle.
    return undefined;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
