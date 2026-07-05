import { NarrativeSegment, VideoSource } from "@/lib/chacotero/types";
import { CATEGORY_FREQUENCIES, renderToneTrackWav } from "@/lib/chacotero/synth-audio";
import { computeCompressedRanges } from "@/lib/chacotero/timeline";
import { AudioRenderProvider } from "@/lib/chacotero/services/types";

// Real implementation: concatenate the source audio at each selected
// segment's timestamps (ffmpeg or a media-processing service) and upload the
// result, returning a hosted URL. This mock runs entirely client-side (Web
// Audio has no Node equivalent) and synthesizes a stand-in tone track so the
// player has real, scrubbable audio in the MVP — a distinct pitch per
// narrative category, one continuous take with no gaps between blocks.
export class MockAudioRenderProvider implements AudioRenderProvider {
  async render(input: { source: VideoSource; segments: NarrativeSegment[] }): Promise<{
    audioUrl: string;
    durationSeconds: number;
  }> {
    const ranges = computeCompressedRanges(input.segments);
    const cues = input.segments.map((segment) => {
      const range = ranges.get(segment.id)!;
      return { startSeconds: range.start, endSeconds: range.end, freqHz: CATEGORY_FREQUENCIES[segment.category] };
    });
    const totalDuration = Math.max(0, ...Array.from(ranges.values()).map((r) => r.end));

    const { blob, durationSeconds } = await renderToneTrackWav(cues, totalDuration);
    return { audioUrl: URL.createObjectURL(blob), durationSeconds };
  }
}
