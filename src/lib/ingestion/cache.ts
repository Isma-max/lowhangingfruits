import { Topic } from "@/lib/types";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  topics: Topic[];
  fetchedAt: number;
  isReal: boolean; // false = mock data fallback
}

// Module-level singleton (persists across requests in the same process)
let cache: CacheEntry | null = null;

export function getCachedTopics(): { topics: Topic[]; fetchedAt: number; isReal: boolean } | null {
  if (!cache) return null;
  const age = Date.now() - cache.fetchedAt;
  if (age > CACHE_TTL_MS) {
    cache = null;
    return null;
  }
  return cache;
}

export function setCachedTopics(topics: Topic[], isReal: boolean): void {
  cache = { topics, fetchedAt: Date.now(), isReal };
}

export function invalidateCache(): void {
  cache = null;
}

export function getCacheAge(): number | null {
  if (!cache) return null;
  return Date.now() - cache.fetchedAt;
}
