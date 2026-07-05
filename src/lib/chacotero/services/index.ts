// Single place that wires which adapter implementation is active. Swapping a
// mock for a real integration should only ever require changing the import
// here — UI code depends on the interfaces in ./types, never on a concrete
// class directly.
import { MockVideoMetadataProvider } from "@/lib/chacotero/services/mock-video-metadata-provider";
import { MockHeatmapProvider } from "@/lib/chacotero/services/mock-heatmap-provider";
import { MockTranscriptProvider } from "@/lib/chacotero/services/mock-transcript-provider";
import { MockNarrativeAnalysisProvider } from "@/lib/chacotero/services/mock-narrative-analysis-provider";

export const videoMetadataProvider = new MockVideoMetadataProvider();
export const heatmapProvider = new MockHeatmapProvider();
export const transcriptProvider = new MockTranscriptProvider();
export const narrativeAnalysisProvider = new MockNarrativeAnalysisProvider();

// MockAudioRenderProvider is browser-only (Web Audio API) and is imported
// directly by client components instead of re-exported here.
export * from "@/lib/chacotero/services/types";
