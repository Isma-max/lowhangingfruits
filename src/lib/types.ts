export type RegionType = "country" | "city" | "cultural_cluster";

export interface Region {
  id: string;
  name: string;
  flag?: string;
  type: RegionType;
  parent_region_id?: string;
  language: string;
  timezone?: string;
}

export interface TopicGeography {
  topic_id: string;
  origin_region_id?: string;
  relevance_region_id: string;
  relevance_score: number;
  reason: string;
}

export type Category = "A" | "B" | "C" | "D";

export interface MarketScore {
  topic_id: string;
  market_id: string;
  trend_score: number;
  editorial_score: number;
  revenue_score: number;
  geo_score: number;
  master_score: number;
  category: Category;
}

export interface Topic {
  id: string;
  title: string;
  summary: string;
  origin_region_id: string;
  origin_city?: string;
  sources: Source[];
  published_at: string;
  category_tag: string;
  monetization_risk: "low" | "medium" | "high";
  suggested_format: string;
  suggested_duration: string;
  platform: "YouTube" | "Facebook" | "Both";
  market_scores: Record<string, MarketScore>;
  geo: TopicGeography[];
  angles: Record<string, string>;
  hooks: Record<string, string>;
  thumbnail_concept: string;
  is_cross_border: boolean;
  cross_border_from?: string;
  cross_border_to?: string[];
}

export interface Source {
  name: string;
  url: string;
  published_at: string;
}

export type MarketId =
  | "mx"
  | "cl"
  | "ar"
  | "co"
  | "pe"
  | "us_hispanic"
  | "latam"
  | "global_es";
