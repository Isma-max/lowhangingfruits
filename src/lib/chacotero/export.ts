import { EditProject } from "@/lib/chacotero/types";
import { formatTimestamp } from "@/lib/chacotero/timeline";

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTranscript(project: EditProject): void {
  const lines = [
    `# ${project.storyAnalysis?.suggestedTitle ?? "Corte editorial"}`,
    `Fuente: ${project.source.title}`,
    "",
    ...project.selectedSegments.map(
      (s) => `[${formatTimestamp(s.startSeconds)}–${formatTimestamp(s.endSeconds)}] ${s.transcript}`
    ),
  ];
  downloadBlob(lines.join("\n\n"), `${project.id}-transcript.txt`, "text/plain");
}

export function downloadSegmentsJSON(project: EditProject): void {
  const report = {
    project_id: project.id,
    source_url: project.source.url,
    target_duration_seconds: project.targetDuration,
    editorial_mode: project.editorialMode,
    total_duration_seconds: project.totalDurationSeconds,
    story_analysis: project.storyAnalysis,
    segments: project.selectedSegments.map((s) => ({
      id: s.id,
      category: s.category,
      start_seconds: s.startSeconds,
      end_seconds: s.endSeconds,
      transcript: s.transcript,
      editorial_reason: s.editorialReason,
      narrative_score: s.narrativeScore,
    })),
  };
  downloadBlob(JSON.stringify(report, null, 2), `${project.id}-cortes.json`, "application/json");
}

export function downloadWav(audioUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = audioUrl;
  a.download = filename;
  a.click();
}

export async function copyEditorialSummary(project: EditProject): Promise<void> {
  if (!project.storyAnalysis) return;
  await navigator.clipboard.writeText(project.storyAnalysis.editorialSummary);
}

const STORAGE_PREFIX = "chacotero-project-";

// MVP persistence: browser localStorage. Real implementation would POST to
// an authenticated /api/chacotero/projects endpoint backed by a database.
export function saveProjectLocally(project: EditProject): void {
  localStorage.setItem(`${STORAGE_PREFIX}${project.id}`, JSON.stringify(project));
}

export function duplicateProject(project: EditProject): EditProject {
  const now = new Date().toISOString();
  const duplicate: EditProject = {
    ...project,
    id: `${project.id}-copy-${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
  };
  saveProjectLocally(duplicate);
  return duplicate;
}
