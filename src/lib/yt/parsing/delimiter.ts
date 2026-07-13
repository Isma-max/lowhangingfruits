const CANDIDATES = [",", ";", "\t"] as const;
export type Delimiter = (typeof CANDIDATES)[number];

/**
 * Picks the delimiter that produces the most consistent column count
 * across the first sample lines. Falls back to comma.
 */
export function detectDelimiter(sample: string): Delimiter {
  const lines = sample
    .split(/\r\n|\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 10);

  if (lines.length === 0) return ",";

  let best: Delimiter = ",";
  let bestScore = -1;

  for (const candidate of CANDIDATES) {
    const counts = lines.map((line) => line.split(candidate).length);
    const max = Math.max(...counts);
    if (max <= 1) continue;
    const consistent = counts.filter((c) => c === max).length;
    // Prefer delimiters that (a) split into more columns and (b) do so consistently.
    const score = consistent * 1000 + max;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}
