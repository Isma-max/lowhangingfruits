import { MarketId } from "@/lib/types";

interface GeoSignals {
  originMarket: MarketId;
  relevantMarkets: MarketId[];
  confidence: number;
}

const MARKET_KEYWORDS: Record<MarketId, string[]> = {
  mx: [
    "méxico", "mexico", "mexicano", "mexicana", "cdmx", "guadalajara", "monterrey",
    "pemex", "amlo", "sheinbaum", "morena", "jalisco", "oaxaca", "yucatán",
    "peso mexicano", "tlc", "t-mec", "veracruz", "puebla", "tijuana",
  ],
  cl: [
    "chile", "chileno", "chilena", "santiago", "valparaíso", "concepción",
    "boric", "piñera", "cobre", "codelco", "peso chileno", "atacama",
    "magallanes", "antofagasta", "biobío", "araucanía", "mapuche",
  ],
  ar: [
    "argentina", "argentino", "argentina", "buenos aires", "córdoba", "rosario",
    "milei", "kirchner", "peronismo", "peso argentino", "inflación argentina",
    "patagonia", "mendoza", "tucumán", "dólar blue", "cepo cambiario",
  ],
  co: [
    "colombia", "colombiano", "colombiana", "bogotá", "medellín", "cali",
    "petro", "gustavo petro", "eln", "farc", "coca", "peso colombiano",
    "cartagena", "barranquilla", "amazonía colombiana", "pacífico colombiano",
  ],
  pe: [
    "perú", "peru", "peruano", "peruana", "lima", "cusco", "arequipa",
    "boluarte", "sol peruano", "machu picchu", "amazonas peruano",
    "trujillo", "piura", "callao", "ica", "puno",
  ],
  us_hispanic: [
    "hispano", "hispana", "latino", "latina", "estados unidos", "eeuu",
    "miami", "los angeles", "nueva york", "chicago", "houston",
    "inmigrante", "deportación", "dreamers", "daca", "frontera",
    "trump", "biden", "washington", "congress", "senate",
  ],
  latam: [
    "latinoamérica", "latin america", "latam", "sudamérica", "america latina",
    "mercosur", "celac", "unasur", "alba", "caricom",
    "región", "continente", "hispanoamérica",
  ],
  global_es: [
    "mundial", "global", "internacional", "europa", "asia", "áfrica",
    "onu", "oms", "fmi", "banco mundial", "g20", "otan", "nato",
    "cumbre", "tratado", "convenio internacional",
  ],
};

const CROSS_BORDER_TOPICS = [
  "migración", "migrant", "deportación",
  "fútbol", "futbol", "copa", "mundial",
  "economía regional", "libre comercio",
  "cambio climático", "clima", "sequía",
  "pandemia", "virus", "salud pública",
  "criptomoneda", "bitcoin", "tecnología",
];

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const normalizedText = normalize(text);
  return keywords.reduce((count, kw) => {
    return count + (normalizedText.includes(normalize(kw)) ? 1 : 0);
  }, 0);
}

export function detectGeo(title: string, summary: string, sourceFeedMarket?: MarketId): GeoSignals {
  const combined = `${title} ${summary}`;
  const scores: Partial<Record<MarketId, number>> = {};

  for (const [market, keywords] of Object.entries(MARKET_KEYWORDS)) {
    const count = countKeywordMatches(combined, keywords);
    if (count > 0) scores[market as MarketId] = count;
  }

  // Boost the feed's own market
  if (sourceFeedMarket && sourceFeedMarket !== "latam" && sourceFeedMarket !== "global_es") {
    scores[sourceFeedMarket] = (scores[sourceFeedMarket] || 0) + 2;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const originMarket: MarketId = sorted[0]?.[0] as MarketId || sourceFeedMarket || "latam";

  // Markets with any signal (above 0) are relevant
  const relevantMarkets: MarketId[] = sorted
    .filter(([, score]) => score > 0)
    .map(([m]) => m as MarketId);

  // Check for cross-border signals
  const normalizedCombined = normalize(combined);
  const hasCrossBorderSignal = CROSS_BORDER_TOPICS.some((kw) =>
    normalizedCombined.includes(normalize(kw))
  );
  if (hasCrossBorderSignal) {
    // Add latam as relevant if not already
    if (!relevantMarkets.includes("latam")) relevantMarkets.push("latam");
  }

  // Ensure origin is in relevant
  if (!relevantMarkets.includes(originMarket)) relevantMarkets.unshift(originMarket);

  const topScore = sorted[0]?.[1] || 0;
  const confidence = Math.min(topScore / 5, 1);

  return { originMarket, relevantMarkets, confidence };
}

export function isCrossBorder(relevantMarkets: MarketId[]): boolean {
  const specifics: MarketId[] = ["mx", "cl", "ar", "co", "pe", "us_hispanic"];
  return relevantMarkets.filter((m) => specifics.includes(m)).length >= 2;
}
