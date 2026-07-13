import { parse, isValid, format } from "date-fns";
import { es, enUS } from "date-fns/locale";

const FORMATS = [
  "yyyy-MM-dd",
  "yyyy/MM/dd",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "dd-MM-yyyy",
  "MM-dd-yyyy",
  "d MMM yyyy",
  "MMM d, yyyy",
  "MMMM d, yyyy",
  "d MMMM yyyy",
  "d 'de' MMMM 'de' yyyy",
  "yyyyMMdd",
];

const LOCALES = [enUS, es];

function isPlausible(date: Date): boolean {
  const year = date.getFullYear();
  return year >= 2000 && year <= 2100;
}

/**
 * Best-effort parser for the many date formats YouTube Studio exports
 * use across locales/regions. Returns an ISO 8601 date string
 * (`yyyy-MM-dd`) or null when nothing matches.
 */
export function parseFlexibleDate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim();
  if (s === "") return null;

  // Native ISO fast path.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00Z`);
    if (isValid(d) && isPlausible(d)) return s;
  }

  for (const fmt of FORMATS) {
    for (const locale of LOCALES) {
      const d = parse(s, fmt, new Date(2000, 0, 1), { locale });
      if (isValid(d) && isPlausible(d)) {
        return format(d, "yyyy-MM-dd");
      }
    }
  }

  // Last resort: native Date parsing (handles e.g. "June 1, 2026").
  const native = new Date(s);
  if (isValid(native) && isPlausible(native)) {
    return format(native, "yyyy-MM-dd");
  }

  return null;
}
