import {
  EditorialMode,
  HeatmapMoment,
  NarrativeSegment,
  StoryAnalysis,
  TargetDuration,
  TranscriptSegment,
  VideoSource,
} from "@/lib/chacotero/types";

export interface VideoMetadataProvider {
  getMetadata(url: string): Promise<VideoSource>;
}

export interface HeatmapProvider {
  getHeatmap(source: VideoSource): Promise<HeatmapMoment[] | undefined>;
}

export interface TranscriptProvider {
  getTranscript(source: VideoSource): Promise<TranscriptSegment[]>;
}

export interface NarrativeAnalysisProvider {
  analyze(input: {
    transcript: TranscriptSegment[];
    targetDuration: TargetDuration;
    editorialMode: EditorialMode;
    heatmapMoments?: HeatmapMoment[];
  }): Promise<{
    storyAnalysis: StoryAnalysis;
    selectedSegments: NarrativeSegment[];
  }>;
}

export interface AudioRenderProvider {
  render(input: {
    source: VideoSource;
    segments: NarrativeSegment[];
  }): Promise<{
    audioUrl: string;
    durationSeconds: number;
  }>;
}
