import { NarrativeCategory } from "@/lib/chacotero/types";

// Browser-only tone synthesizer used by the mock AudioRenderProvider.
// Stands in for a real render pipeline (ffmpeg concat of the original audio
// at the selected timestamps) so the player has something real to scrub
// through in the MVP. Each narrative category gets a distinct pitch so an
// operator can literally hear the beat change as blocks go by.
export const CATEGORY_FREQUENCIES: Record<NarrativeCategory, number> = {
  hook: 523.25,
  context: 392.0,
  conflict: 293.66,
  escalation: 349.23,
  revelation: 659.25,
  climax: 783.99,
  reaction: 440.0,
  closing: 523.25,
  transition: 261.63,
};

export interface ToneCue {
  startSeconds: number;
  endSeconds: number;
  freqHz: number;
}

const SAMPLE_RATE = 22050;

export async function renderToneTrackWav(
  cues: ToneCue[],
  totalDurationSeconds: number
): Promise<{ blob: Blob; durationSeconds: number }> {
  if (typeof window === "undefined") {
    throw new Error("renderToneTrackWav can only run in the browser");
  }

  const OfflineCtor: typeof OfflineAudioContext =
    window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  const duration = Math.max(0.1, totalDurationSeconds);
  const ctx = new OfflineCtor(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);

  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);

  for (const cue of cues) {
    const start = Math.max(0, cue.startSeconds);
    const end = Math.min(duration, cue.endSeconds);
    if (end <= start) continue;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = cue.freqHz;

    const gain = ctx.createGain();
    const attack = Math.min(0.05, (end - start) / 4);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(1, start + attack);
    gain.gain.setValueAtTime(1, Math.max(start + attack, end - attack));
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end);
  }

  const rendered = await ctx.startRendering();
  const blob = encodeWav(rendered);
  return { blob, durationSeconds: duration };
}

function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const blockAlign = 2; // mono, 16-bit
  const dataSize = samples.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
