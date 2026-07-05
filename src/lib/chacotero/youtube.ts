const YOUTUBE_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;

export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  const match = trimmed.match(YOUTUBE_URL_PATTERN);
  if (!match) return null;
  const idPart = match[5];
  return idPart.split(/[?&#]/)[0];
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

// Small deterministic hash so the same pasted URL always produces the same
// mock metadata/duration instead of random values on every render.
export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
