export type CanonicalField =
  | "date"
  | "views"
  | "watch_time_hours"
  | "subscribers_gained"
  | "subscribers_lost"
  | "impressions"
  | "impressions_ctr"
  | "average_view_duration"
  | "average_view_percentage"
  | "estimated_revenue"
  | "video_id"
  | "title"
  | "url"
  | "published_at"
  | "duration"
  | "likes"
  | "comments"
  | "shares";

export const GENERAL_FIELDS: CanonicalField[] = [
  "date",
  "views",
  "watch_time_hours",
  "subscribers_gained",
  "subscribers_lost",
  "impressions",
  "impressions_ctr",
  "average_view_duration",
  "average_view_percentage",
  "estimated_revenue",
];

export const PER_VIDEO_FIELDS: CanonicalField[] = [
  "video_id",
  "title",
  "url",
  "published_at",
  "duration",
  "views",
  "watch_time_hours",
  "average_view_duration",
  "average_view_percentage",
  "impressions",
  "impressions_ctr",
  "likes",
  "comments",
  "shares",
  "subscribers_gained",
  "subscribers_lost",
  "estimated_revenue",
];

/** Aliases are matched after normalizeHeader() — lowercase, accent-stripped, unit-stripped. */
const ALIASES: Record<CanonicalField, string[]> = {
  date: ["fecha", "date", "dia", "day"],
  views: ["visualizaciones", "views", "vistas"],
  watch_time_hours: [
    "tiempo de reproduccion",
    "tiempo de reproduccion horas",
    "watch time",
    "watch time hours",
    "horas de visualizacion",
  ],
  subscribers_gained: ["suscriptores ganados", "subscribers gained", "suscriptores obtenidos"],
  subscribers_lost: ["suscriptores perdidos", "subscribers lost"],
  impressions: ["impresiones", "impressions"],
  impressions_ctr: [
    "ctr",
    "porcentaje de clics de las impresiones",
    "porcentaje de clics",
    "impressions click through rate",
    "impressions ctr",
    "click through rate",
  ],
  average_view_duration: [
    "duracion media de las visualizaciones",
    "duracion media",
    "average view duration",
  ],
  average_view_percentage: [
    "porcentaje medio visualizado",
    "porcentaje medio visto",
    "average percentage viewed",
    "audience retention",
  ],
  estimated_revenue: [
    "ingresos estimados",
    "estimated revenue",
    "ingresos estimados usd",
    "estimated revenue usd",
  ],
  video_id: ["id del video", "video id", "id de video"],
  title: ["titulo del video", "titulo", "video title", "title", "contenido"],
  url: ["url del video", "video url", "url", "enlace del video"],
  published_at: [
    "fecha de publicacion",
    "hora de publicacion del video",
    "video publish time",
    "publish date",
    "fecha de carga",
  ],
  duration: ["duracion", "duration", "duracion del video"],
  likes: ["me gusta", "likes"],
  comments: ["comentarios", "comments"],
  shares: ["veces que se compartio", "compartidos", "shares"],
};

/** Lowercase, strip accents/diacritics, drop bracketed units, collapse whitespace. */
export function normalizeHeader(raw: string): string {
  const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
  return raw
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Suggests a canonical field for each source header. Unmatched headers map to null. */
export function suggestMapping(
  headers: string[],
  fields: CanonicalField[] = [...GENERAL_FIELDS, ...PER_VIDEO_FIELDS],
): Record<string, CanonicalField | null> {
  const result: Record<string, CanonicalField | null> = {};
  const fieldSet = new Set(fields);

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let match: CanonicalField | null = null;

    for (const field of fields) {
      if (!fieldSet.has(field)) continue;
      const aliases = ALIASES[field];
      if (aliases.includes(normalized)) {
        match = field;
        break;
      }
    }

    if (!match) {
      // Fallback: substring match, longest alias wins to avoid "ctr" matching everything.
      let bestLen = 0;
      for (const field of fields) {
        for (const alias of ALIASES[field]) {
          if (normalized.includes(alias) && alias.length > bestLen) {
            match = field;
            bestLen = alias.length;
          }
        }
      }
    }

    result[header] = match;
  }

  return result;
}
