import { MarketScore, MarketId, Topic } from "@/lib/types";

interface ScorerInput {
  title: string;
  summary: string;
  publishedAt: Date;
  sourceWeight: number;
  relevantMarkets: MarketId[];
  originMarket: MarketId;
  clusterSize: number; // number of articles about same topic
}

const HIGH_TREND_KEYWORDS = [
  "breaking", "urgente", "última hora", "en vivo", "alerta",
  "récord", "histórico", "primero", "inédito", "sorpresa",
  "viral", "trending", "millones", "muerto", "muertes",
  "terremoto", "tsunami", "huracán", "crisis", "colapso",
];

const REVENUE_SAFE_KEYWORDS = [
  "tecnología", "innovación", "deportes", "cultura", "economía",
  "emprendimiento", "educación", "salud", "viajes", "gastronomía",
  "entretenimiento", "música", "cine", "moda", "turismo",
];

const REVENUE_RISKY_KEYWORDS = [
  "violencia", "crimen", "narcotráfico", "asesinato", "masacre",
  "guerra", "conflicto armado", "terrorismo", "muerte", "tragedia",
  "corrupcíon", "escándalo", "abuso", "discriminación",
];

const EDITORIAL_OPPORTUNITY_KEYWORDS = [
  "análisis", "investigación", "exclusiva", "revelación", "impacto",
  "consecuencia", "futuro", "perspectiva", "tendencia", "profundo",
  "debate", "polémica", "controversia", "descubrimiento",
];

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function keywordScore(text: string, keywords: string[]): number {
  const norm = normalize(text);
  let matches = 0;
  for (const kw of keywords) {
    if (norm.includes(normalize(kw))) matches++;
  }
  return Math.min(matches / 3, 1); // cap at 1 after 3+ matches
}

function recencyScore(publishedAt: Date): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 1) return 1;
  if (ageHours < 3) return 0.9;
  if (ageHours < 6) return 0.75;
  if (ageHours < 12) return 0.6;
  if (ageHours < 24) return 0.4;
  return 0.2;
}

export function scoreForMarket(input: ScorerInput, market: MarketId): MarketScore {
  const combined = `${input.title} ${input.summary}`;

  // Trend score: recency + cluster size + high-trend keywords
  const recency = recencyScore(input.publishedAt);
  const clusterBoost = Math.min(input.clusterSize / 5, 1) * 0.3;
  const trendKeywords = keywordScore(combined, HIGH_TREND_KEYWORDS) * 0.3;
  const trend_score = Math.round((recency * 0.4 + clusterBoost + trendKeywords + input.sourceWeight * 0.2) * 100);

  // Editorial score: opportunity keywords + source weight + cluster diversity
  const editorialKw = keywordScore(combined, EDITORIAL_OPPORTUNITY_KEYWORDS);
  const editorial_score = Math.round((editorialKw * 0.4 + input.sourceWeight * 0.4 + clusterBoost * 0.2) * 100);

  // Revenue score: safe vs risky content
  const safeScore = keywordScore(combined, REVENUE_SAFE_KEYWORDS);
  const riskyScore = keywordScore(combined, REVENUE_RISKY_KEYWORDS);
  const revenue_score = Math.round(Math.max(10, (safeScore * 0.6 - riskyScore * 0.4 + 0.5) * 100));

  // Geo score: how relevant is this to the specific market
  const isOrigin = input.originMarket === market;
  const isRelevant = input.relevantMarkets.includes(market);
  const geoBase = isOrigin ? 0.9 : isRelevant ? 0.6 : 0.2;
  const geo_score = Math.round(geoBase * 100);

  // Master score: 0.30 trend + 0.30 editorial + 0.20 revenue + 0.20 geo
  const master_score = Math.round(
    trend_score * 0.3 +
    editorial_score * 0.3 +
    revenue_score * 0.2 +
    geo_score * 0.2
  );

  const clamped = {
    trend_score: Math.min(100, Math.max(0, trend_score)),
    editorial_score: Math.min(100, Math.max(0, editorial_score)),
    revenue_score: Math.min(100, Math.max(0, revenue_score)),
    geo_score: Math.min(100, Math.max(0, geo_score)),
    master_score: Math.min(100, Math.max(0, master_score)),
  };

  const category: "A" | "B" | "C" | "D" =
    clamped.master_score >= 85 ? "A" :
    clamped.master_score >= 70 ? "B" :
    clamped.master_score >= 50 ? "C" : "D";

  return { ...clamped, category, topic_id: "", market_id: market };
}

export function monetizationRisk(title: string, summary: string): Topic["monetization_risk"] {
  const combined = `${title} ${summary}`;
  const risky = keywordScore(combined, REVENUE_RISKY_KEYWORDS);
  if (risky > 0.5) return "high";
  if (risky > 0.2) return "medium";
  return "low";
}

export function suggestFormat(title: string, summary: string): string {
  const norm = normalize(`${title} ${summary}`);
  if (norm.includes("análisis") || norm.includes("investigación")) return "Artículo de fondo";
  if (norm.includes("video") || norm.includes("viral") || norm.includes("en vivo")) return "Video corto";
  if (norm.includes("entrevista")) return "Entrevista";
  if (norm.includes("datos") || norm.includes("estadística") || norm.includes("cifras")) return "Infografía";
  if (norm.includes("podcast") || norm.includes("audio")) return "Podcast";
  return "Artículo + Video";
}

export function suggestDuration(format: string): string {
  if (format.includes("corto") || format.includes("Video")) return "1–3 min";
  if (format.includes("Infografía")) return "Lectura 2 min";
  if (format.includes("Podcast")) return "15–25 min";
  if (format.includes("fondo")) return "Lectura 5–8 min";
  return "3–5 min";
}

export function suggestPlatform(format: string): string {
  if (format.includes("Video corto")) return "YouTube Shorts / TikTok";
  if (format.includes("Podcast")) return "Spotify / iHeart";
  if (format.includes("Infografía")) return "Instagram / Web";
  return "YouTube / Web";
}

export function inferCategoryTag(title: string, summary: string): string {
  const norm = normalize(`${title} ${summary}`);
  if (norm.includes("fútbol") || norm.includes("futbol") || norm.includes("deporte")) return "Deportes";
  if (norm.includes("política") || norm.includes("gobierno") || norm.includes("presidente")) return "Política";
  if (norm.includes("economía") || norm.includes("mercado") || norm.includes("inflación") || norm.includes("dólar")) return "Economía";
  if (norm.includes("tecnología") || norm.includes("ia") || norm.includes("inteligencia artificial")) return "Tecnología";
  if (norm.includes("cultura") || norm.includes("música") || norm.includes("cine") || norm.includes("arte")) return "Cultura";
  if (norm.includes("salud") || norm.includes("médico") || norm.includes("hospital")) return "Salud";
  if (norm.includes("educación") || norm.includes("universidad") || norm.includes("escuela")) return "Educación";
  if (norm.includes("migración") || norm.includes("inmigrante") || norm.includes("deportación")) return "Migración";
  if (norm.includes("clima") || norm.includes("terremoto") || norm.includes("huracán") || norm.includes("ambiente")) return "Medio Ambiente";
  if (norm.includes("crimen") || norm.includes("violencia") || norm.includes("seguridad")) return "Seguridad";
  return "General";
}
