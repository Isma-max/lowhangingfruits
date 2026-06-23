import Parser from "rss-parser";
import { Topic, MarketId } from "@/lib/types";
import { RSS_SOURCES, RssSource } from "./rss-sources";
import { detectGeo, isCrossBorder } from "./geo-detector";
import { clusterArticles, Cluster } from "./clusterer";
import {
  scoreForMarket,
  monetizationRisk,
  suggestFormat,
  suggestDuration,
  suggestPlatform,
  inferCategoryTag,
} from "./scorer";
import { enhanceWithLLM } from "./llm-enhancer";

const MARKETS: MarketId[] = ["mx", "cl", "ar", "co", "pe", "us_hispanic", "latam", "global_es"];
const FETCH_TIMEOUT_MS = 8000;
const MAX_ITEMS_PER_FEED = 15;

interface RawArticle {
  id: string;
  title: string;
  summary: string;
  publishedAt: Date;
  sourceName: string;
  sourceWeight: number;
  feedMarket: string;
}

async function fetchFeed(source: RssSource): Promise<RawArticle[]> {
  const parser = new Parser({
    timeout: FETCH_TIMEOUT_MS,
    customFields: { item: ["media:content", "media:thumbnail"] },
  });

  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, MAX_ITEMS_PER_FEED).map((item, i) => ({
      id: item.guid || item.link || `${source.name}-${i}`,
      title: item.title || "",
      summary: item.contentSnippet || item.summary || item.content || "",
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      sourceName: source.name,
      sourceWeight: source.weight,
      feedMarket: source.markets[0] || "latam",
    }));
  } catch {
    return [];
  }
}

async function clusterToTopic(cluster: Cluster, topicIndex: number): Promise<Topic> {
  const geo = detectGeo(cluster.title, cluster.summary, cluster.feedMarket as MarketId);

  const market_scores: Topic["market_scores"] = {};
  for (const market of MARKETS) {
    if (geo.relevantMarkets.includes(market) || market === geo.originMarket) {
      market_scores[market] = scoreForMarket(
        {
          title: cluster.title,
          summary: cluster.summary,
          publishedAt: cluster.publishedAt,
          sourceWeight: cluster.sourceWeight,
          relevantMarkets: geo.relevantMarkets,
          originMarket: geo.originMarket,
          clusterSize: cluster.clusterSize,
        },
        market
      );
    }
  }

  // Ensure at least the origin market has a score
  if (!market_scores[geo.originMarket]) {
    market_scores[geo.originMarket] = scoreForMarket(
      {
        title: cluster.title,
        summary: cluster.summary,
        publishedAt: cluster.publishedAt,
        sourceWeight: cluster.sourceWeight,
        relevantMarkets: geo.relevantMarkets,
        originMarket: geo.originMarket,
        clusterSize: cluster.clusterSize,
      },
      geo.originMarket
    );
  }

  const format = suggestFormat(cluster.title, cluster.summary);

  // Build angles + hooks: try LLM for top markets only, degrade gracefully
  const angles: Topic["angles"] = {};
  const hooks: Topic["hooks"] = {};

  // Pick top 2 markets by score for LLM enhancement (to avoid rate limits)
  const topMarkets = Object.entries(market_scores)
    .sort((a, b) => b[1].master_score - a[1].master_score)
    .slice(0, 2)
    .map(([m]) => m as MarketId);

  for (const market of topMarkets) {
    const enhanced = await enhanceWithLLM(cluster.title, cluster.summary, market);
    if (enhanced.angle) angles[market] = enhanced.angle;
    if (enhanced.hook) hooks[market] = enhanced.hook;
  }

  const crossBorder = isCrossBorder(geo.relevantMarkets);
  const crossBorderTo = crossBorder
    ? geo.relevantMarkets.filter((m) => m !== geo.originMarket)
    : undefined;

  return {
    id: `live-${topicIndex}-${Date.now()}`,
    title: cluster.title,
    summary: cluster.summary || `${cluster.sourceName} · ${cluster.clusterSize} fuentes`,
    category_tag: inferCategoryTag(cluster.title, cluster.summary),
    origin_region_id: geo.originMarket,
    origin_city: undefined,
    market_scores,
    angles,
    hooks,
    sources: cluster.articles.map((a) => ({
      name: a.sourceName,
      url: "",
      published_at: a.publishedAt.toISOString(),
    })),
    suggested_format: format,
    suggested_duration: suggestDuration(format),
    platform: "YouTube" as const,
    monetization_risk: monetizationRisk(cluster.title, cluster.summary),
    is_cross_border: crossBorder,
    cross_border_from: crossBorder ? geo.originMarket : undefined,
    cross_border_to: crossBorderTo,
    thumbnail_concept: "",
    published_at: cluster.publishedAt.toISOString(),
    geo: [],
  };
}

export async function runIngestionPipeline(): Promise<{ topics: Topic[]; errors: number }> {
  // Fetch all feeds in parallel
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchFeed));

  let errors = 0;
  const allArticles: RawArticle[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    } else {
      errors++;
    }
  }

  if (allArticles.length === 0) {
    return { topics: [], errors };
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = allArticles.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Cluster similar articles
  const clusters = clusterArticles(unique);

  // Filter to clusters with score potential (at least decent title)
  const validClusters = clusters.filter((c) => c.title && c.title.length > 10);

  // Convert top clusters to topics (limit to 30 to keep snappy)
  const topClusters = validClusters
    .sort((a, b) => b.clusterSize - a.clusterSize || b.sourceWeight - a.sourceWeight)
    .slice(0, 30);

  const topics = await Promise.all(
    topClusters.map((cluster, i) => clusterToTopic(cluster, i))
  );

  // Filter out topics with no market scores
  const validTopics = topics.filter((t) => Object.keys(t.market_scores).length > 0);

  return { topics: validTopics, errors };
}
