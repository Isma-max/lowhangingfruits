import { ProcessingErrorCode } from "@/lib/chacotero/types";
import { extractYouTubeVideoId } from "@/lib/chacotero/youtube";

// QA-only affordance so every error screen can be exercised without a real
// backend: paste a YouTube URL whose video id contains one of these keywords,
// e.g. https://www.youtube.com/watch?v=demo-noanalysis
const KEYWORD_TO_ERROR: Record<string, ProcessingErrorCode> = {
  unavailable: "video_unavailable",
  tooshort: "video_too_short",
  noaudio: "audio_unprocessable",
  notranscript: "transcription_failed",
  noanalysis: "analysis_failed",
};

export const QA_ERROR_URLS: { url: string; label: string }[] = Object.entries(KEYWORD_TO_ERROR).map(
  ([keyword, code]) => ({
    url: `https://www.youtube.com/watch?v=demo-${keyword}`,
    label: code,
  })
);

export function qaTriggerFromUrl(url: string): ProcessingErrorCode | undefined {
  const videoId = extractYouTubeVideoId(url)?.toLowerCase();
  if (!videoId) return undefined;
  for (const [keyword, code] of Object.entries(KEYWORD_TO_ERROR)) {
    if (videoId.includes(keyword)) return code;
  }
  return undefined;
}
