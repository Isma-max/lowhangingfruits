/**
 * Parses a duration into whole seconds. Supports `HH:MM:SS`, `MM:SS`,
 * `H:MM:SS:FF`-style YouTube exports (extra trailing frame field is
 * ignored) and bare integer-second strings. Returns null when the value
 * is empty or not a recognizable duration.
 */
export function parseDurationToSeconds(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim();
  if (s === "" || s === "-" || s.toLowerCase() === "n/a") return null;

  if (/^\d+$/.test(s)) {
    return Number(s);
  }

  const parts = s.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 4 || parts.some((p) => !/^\d+$/.test(p))) {
    return null;
  }

  // Drop a trailing frames field if present (HH:MM:SS:FF), we only need whole seconds.
  const timeParts = parts.length === 4 ? parts.slice(0, 3) : parts;
  const nums = timeParts.map(Number);

  let seconds = 0;
  for (const n of nums) {
    seconds = seconds * 60 + n;
  }
  return seconds;
}

export function formatSecondsAsDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
