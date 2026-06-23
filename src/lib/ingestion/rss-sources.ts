import { MarketId } from "@/lib/types";

export interface RssSource {
  name: string;
  url: string;
  markets: MarketId[];
  language: string;
  weight: number; // editorial authority 0-1
}

export const RSS_SOURCES: RssSource[] = [
  // Google News per market (no API key needed)
  {
    name: "Google News México",
    url: "https://news.google.com/rss?hl=es-419&gl=MX&ceid=MX:es-419",
    markets: ["mx"],
    language: "es",
    weight: 0.6,
  },
  {
    name: "Google News Chile",
    url: "https://news.google.com/rss?hl=es-419&gl=CL&ceid=CL:es-419",
    markets: ["cl"],
    language: "es",
    weight: 0.6,
  },
  {
    name: "Google News Argentina",
    url: "https://news.google.com/rss?hl=es-419&gl=AR&ceid=AR:es-419",
    markets: ["ar"],
    language: "es",
    weight: 0.6,
  },
  {
    name: "Google News Colombia",
    url: "https://news.google.com/rss?hl=es-419&gl=CO&ceid=CO:es-419",
    markets: ["co"],
    language: "es",
    weight: 0.6,
  },
  {
    name: "Google News Perú",
    url: "https://news.google.com/rss?hl=es-419&gl=PE&ceid=PE:es-419",
    markets: ["pe"],
    language: "es",
    weight: 0.6,
  },
  {
    name: "Google News US Spanish",
    url: "https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419",
    markets: ["us_hispanic"],
    language: "es",
    weight: 0.6,
  },
  // Editorial sources
  {
    name: "BBC Mundo",
    url: "https://feeds.bbci.co.uk/mundo/rss.xml",
    markets: ["mx", "cl", "ar", "co", "pe", "us_hispanic", "latam", "global_es"],
    language: "es",
    weight: 0.9,
  },
  {
    name: "Infobae",
    url: "https://www.infobae.com/feeds/rss/",
    markets: ["ar", "mx", "latam"],
    language: "es",
    weight: 0.8,
  },
  {
    name: "El País América",
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada",
    markets: ["latam", "global_es", "mx", "ar"],
    language: "es",
    weight: 0.85,
  },
  {
    name: "CNN en Español",
    url: "http://cnnespanol.cnn.com/feed/",
    markets: ["latam", "us_hispanic", "mx", "co"],
    language: "es",
    weight: 0.75,
  },
];

export const SOURCES_BY_MARKET: Record<MarketId, RssSource[]> = {
  mx: RSS_SOURCES.filter((s) => s.markets.includes("mx")),
  cl: RSS_SOURCES.filter((s) => s.markets.includes("cl")),
  ar: RSS_SOURCES.filter((s) => s.markets.includes("ar")),
  co: RSS_SOURCES.filter((s) => s.markets.includes("co")),
  pe: RSS_SOURCES.filter((s) => s.markets.includes("pe")),
  us_hispanic: RSS_SOURCES.filter((s) => s.markets.includes("us_hispanic")),
  latam: RSS_SOURCES.filter((s) => s.markets.includes("latam")),
  global_es: RSS_SOURCES.filter((s) => s.markets.includes("global_es")),
};
