import Papa from "papaparse";
import { detectDelimiter } from "./delimiter";
import { CanonicalField, GENERAL_FIELDS, PER_VIDEO_FIELDS, suggestMapping } from "./columnMap";
import { parseLocaleNumber, parsePercentage } from "./numbers";
import { parseDurationToSeconds } from "./duration";
import { parseFlexibleDate } from "./dates";

export type FileTypeGuess = "GENERAL" | "PER_VIDEO" | "UNKNOWN";

export interface ParsedPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  delimiter: string;
  fileTypeGuess: FileTypeGuess;
  suggestedMapping: Record<string, CanonicalField | null>;
}

/** Strips a UTF-8 BOM if present so header detection doesn't choke on it. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const TOTAL_ROW_MARKERS = ["total", "totales", "totals", "sum"];

export function isTotalsRow(row: Record<string, string>): boolean {
  const firstValue = Object.values(row)[0]?.trim().toLowerCase() ?? "";
  return TOTAL_ROW_MARKERS.includes(firstValue);
}

function guessFileType(mapping: Record<string, CanonicalField | null>): FileTypeGuess {
  const matched = new Set(Object.values(mapping).filter((f): f is CanonicalField => f !== null));
  const hasVideoSignal = matched.has("title") || matched.has("video_id") || matched.has("url");
  const hasDateSeries = matched.has("date");
  if (hasVideoSignal && !hasDateSeries) return "PER_VIDEO";
  if (hasDateSeries && !hasVideoSignal) return "GENERAL";
  if (hasVideoSignal) return "PER_VIDEO";
  if (hasDateSeries) return "GENERAL";
  return "UNKNOWN";
}

/** Parses the raw CSV text and produces a preview: headers, sample rows, detected delimiter/type/mapping. */
export function parseCsvPreview(rawText: string, previewRowLimit = 10): ParsedPreview {
  const text = stripBom(rawText);
  const delimiter = detectDelimiter(text);

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const allRows = (result.data ?? []).filter((r) => !isTotalsRow(r));
  const suggestedMapping = suggestMapping(headers);
  const fileTypeGuess = guessFileType(suggestedMapping);

  return {
    headers,
    rows: allRows.slice(0, previewRowLimit),
    totalRows: allRows.length,
    delimiter,
    fileTypeGuess,
    suggestedMapping,
  };
}

export interface NormalizedGeneralRow {
  date: string | null;
  views: number | null;
  watch_time_hours: number | null;
  subscribers_gained: number | null;
  subscribers_lost: number | null;
  impressions: number | null;
  impressions_ctr: number | null;
  average_view_duration: number | null;
  average_view_percentage: number | null;
  estimated_revenue: number | null;
}

export interface NormalizedVideoRow {
  video_id: string | null;
  title: string | null;
  url: string | null;
  published_at: string | null;
  duration: number | null;
  views: number | null;
  watch_time_hours: number | null;
  average_view_duration: number | null;
  average_view_percentage: number | null;
  impressions: number | null;
  impressions_ctr: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  subscribers_gained: number | null;
  subscribers_lost: number | null;
  estimated_revenue: number | null;
}

const DURATION_FIELDS: CanonicalField[] = ["average_view_duration", "duration"];
const PERCENTAGE_FIELDS: CanonicalField[] = ["impressions_ctr", "average_view_percentage"];
const DATE_FIELDS: CanonicalField[] = ["date", "published_at"];
const STRING_FIELDS: CanonicalField[] = ["video_id", "title", "url"];

function coerceValue(field: CanonicalField, raw: string): string | number | null {
  if (DATE_FIELDS.includes(field)) return parseFlexibleDate(raw);
  if (DURATION_FIELDS.includes(field)) return parseDurationToSeconds(raw);
  if (PERCENTAGE_FIELDS.includes(field)) return parsePercentage(raw);
  if (STRING_FIELDS.includes(field)) return raw.trim() === "" ? null : raw.trim();
  return parseLocaleNumber(raw);
}

export interface NormalizeResult<T> {
  rows: T[];
  invalidRowCount: number;
  metricsAvailable: CanonicalField[];
  metricsMissing: CanonicalField[];
}

/** Applies a confirmed header->field mapping to every row and coerces values to canonical types. */
export function normalizeRows<T>(
  rows: Record<string, string>[],
  mapping: Record<string, CanonicalField | null>,
  expectedFields: CanonicalField[],
  requiredField: CanonicalField,
): NormalizeResult<T> {
  const present = new Set(Object.values(mapping).filter((f): f is CanonicalField => f !== null));
  const metricsAvailable = expectedFields.filter((f) => present.has(f));
  const metricsMissing = expectedFields.filter((f) => !present.has(f));

  let invalidRowCount = 0;
  const normalized: T[] = [];

  for (const row of rows) {
    const out: Record<string, unknown> = {};
    for (const field of expectedFields) out[field] = null;

    for (const [header, field] of Object.entries(mapping)) {
      if (!field || !expectedFields.includes(field)) continue;
      out[field] = coerceValue(field, row[header] ?? "");
    }

    if (out[requiredField] === null || out[requiredField] === undefined) {
      invalidRowCount++;
      continue;
    }

    normalized.push(out as T);
  }

  return { rows: normalized, invalidRowCount, metricsAvailable, metricsMissing };
}

export { GENERAL_FIELDS, PER_VIDEO_FIELDS };
