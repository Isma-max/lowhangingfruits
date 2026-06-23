interface RawArticle {
  id: string;
  title: string;
  summary: string;
  publishedAt: Date;
  sourceName: string;
  sourceWeight: number;
  feedMarket: string;
}

export interface Cluster {
  id: string;
  title: string; // best/most authoritative title
  summary: string;
  articles: RawArticle[];
  publishedAt: Date; // earliest
  sourceName: string;
  sourceWeight: number;
  feedMarket: string;
  clusterSize: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): Set<string> {
  const STOP_WORDS = new Set([
    "el", "la", "los", "las", "un", "una", "de", "del", "en", "y", "a",
    "que", "se", "es", "por", "con", "su", "sus", "al", "o", "lo", "le",
    "para", "como", "más", "pero", "si", "ya", "también", "esto", "esta",
    "the", "a", "an", "of", "in", "and", "to", "is", "for", "on",
  ]);
  return new Set(
    normalize(text)
      .split(" ")
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

const SIMILARITY_THRESHOLD = 0.25;

export function clusterArticles(articles: RawArticle[]): Cluster[] {
  const tokenSets = articles.map((a) => tokenize(`${a.title} ${a.summary}`));
  const clusterMap: number[] = new Array(articles.length).fill(-1);
  const clusters: number[][] = [];

  for (let i = 0; i < articles.length; i++) {
    if (clusterMap[i] !== -1) continue;

    const newCluster: number[] = [i];
    clusterMap[i] = clusters.length;

    for (let j = i + 1; j < articles.length; j++) {
      if (clusterMap[j] !== -1) continue;
      const sim = jaccardSimilarity(tokenSets[i], tokenSets[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        clusterMap[j] = clusters.length;
        newCluster.push(j);
      }
    }

    clusters.push(newCluster);
  }

  return clusters.map((indices, ci) => {
    const clusterArticles = indices.map((i) => articles[i]);
    // Pick the article with highest sourceWeight as the representative
    const best = clusterArticles.reduce((a, b) =>
      b.sourceWeight > a.sourceWeight ? b : a
    );
    const earliest = clusterArticles.reduce((a, b) =>
      b.publishedAt < a.publishedAt ? b : a
    );

    return {
      id: `cluster-${ci}-${Date.now()}`,
      title: best.title,
      summary: best.summary || clusterArticles[0].summary,
      articles: clusterArticles,
      publishedAt: earliest.publishedAt,
      sourceName: best.sourceName,
      sourceWeight: best.sourceWeight,
      feedMarket: best.feedMarket,
      clusterSize: clusterArticles.length,
    };
  });
}
