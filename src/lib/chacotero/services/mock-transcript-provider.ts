import { ChacoteroError, TranscriptSegment, VideoSource } from "@/lib/chacotero/types";
import { qaTriggerFromUrl } from "@/lib/chacotero/qa-triggers";
import { DEMO_TRANSCRIPT } from "@/lib/chacotero/demo-data";
import { TranscriptProvider } from "@/lib/chacotero/services/types";

// Real implementation: download/extract audio (yt-dlp + ffmpeg) then run it
// through an ASR provider (Whisper, Deepgram, etc.) with diarization.
export class MockTranscriptProvider implements TranscriptProvider {
  async getTranscript(source: VideoSource): Promise<TranscriptSegment[]> {
    await delay(400);

    const trigger = qaTriggerFromUrl(source.url);
    if (trigger === "audio_unprocessable" || trigger === "transcription_failed") {
      throw new ChacoteroError(trigger);
    }

    return DEMO_TRANSCRIPT;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
