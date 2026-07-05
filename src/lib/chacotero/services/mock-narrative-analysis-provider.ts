import { ChacoteroError, EditorialMode, HeatmapMoment, NarrativeSegment, StoryAnalysis, TargetDuration, TranscriptSegment } from "@/lib/chacotero/types";
import { DEMO_CANDIDATES, DEMO_STORY_ANALYSIS_BASE } from "@/lib/chacotero/demo-data";
import { buildStoryAnalysis, selectNarrativeSegments } from "@/lib/chacotero/story-selection";
import { NarrativeAnalysisProvider } from "@/lib/chacotero/services/types";

// Real implementation: send the diarized transcript (+ heatmap, if present)
// to an LLM (see src/lib/ingestion/llm-enhancer.ts for the existing
// ANTHROPIC_API_KEY-gated pattern used elsewhere in this repo) with a prompt
// that returns StoryAnalysis + ranked NarrativeSegment candidates. The
// deterministic heuristic below (src/lib/chacotero/story-selection.ts) can
// stay as the offline/no-API-key fallback.
export class MockNarrativeAnalysisProvider implements NarrativeAnalysisProvider {
  async analyze(input: {
    transcript: TranscriptSegment[];
    targetDuration: TargetDuration;
    editorialMode: EditorialMode;
    heatmapMoments?: HeatmapMoment[];
  }): Promise<{ storyAnalysis: StoryAnalysis; selectedSegments: NarrativeSegment[] }> {
    await delay(500);

    if (input.transcript.length < 5) {
      throw new ChacoteroError("analysis_failed");
    }

    // The mock transcript provider always returns the demo story's
    // transcript, so its matching candidate pool is what we score against.
    const { selected, excluded } = selectNarrativeSegments(
      DEMO_CANDIDATES,
      Number(input.targetDuration),
      input.editorialMode,
      input.heatmapMoments
    );

    if (selected.length === 0) {
      throw new ChacoteroError("analysis_failed");
    }

    const storyAnalysis = buildStoryAnalysis(DEMO_STORY_ANALYSIS_BASE, selected, excluded, input.editorialMode);

    return { storyAnalysis, selectedSegments: selected };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
