import { ChacoteroError, VideoSource } from "@/lib/chacotero/types";
import { extractYouTubeVideoId, hashString } from "@/lib/chacotero/youtube";
import { qaTriggerFromUrl } from "@/lib/chacotero/qa-triggers";
import { DEMO_VIDEO_ID, DEMO_VIDEO_SOURCE } from "@/lib/chacotero/demo-data";
import { VideoMetadataProvider } from "@/lib/chacotero/services/types";

// Real implementation: replace with a YouTube Data API (or oEmbed/yt-dlp)
// lookup by video id, returning title/channel/thumbnail/duration.
export class MockVideoMetadataProvider implements VideoMetadataProvider {
  async getMetadata(url: string): Promise<VideoSource> {
    await delay(300);

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new ChacoteroError("invalid_url");
    }

    if (videoId === DEMO_VIDEO_ID) {
      return DEMO_VIDEO_SOURCE;
    }

    const trigger = qaTriggerFromUrl(url);
    if (trigger === "video_unavailable") {
      throw new ChacoteroError("video_unavailable");
    }
    if (trigger === "video_too_short") {
      return {
        url,
        title: "Llamado breve — El Chacotero Sentimental",
        channelName: "El Chacotero Sentimental",
        thumbnailUrl: "/chacotero-demo-thumb.svg",
        durationSeconds: 45,
        sourceType: "youtube",
      };
    }

    // No real ingestion available yet: fall back to the demo story so the
    // full flow stays usable end to end for any pasted link, clearly marked
    // as simulated data in the UI (see the "demo" badge on the result screen).
    const hash = hashString(videoId);
    return {
      url,
      title: `EL CHACOTERO SENTIMENTAL — episodio #${1000 + (hash % 9000)}`,
      channelName: "El Chacotero Sentimental",
      thumbnailUrl: "/chacotero-demo-thumb.svg",
      durationSeconds: DEMO_VIDEO_SOURCE.durationSeconds,
      sourceType: "youtube",
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
