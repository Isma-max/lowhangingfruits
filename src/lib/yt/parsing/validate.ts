import Papa from "papaparse";
import { CanonicalField, GENERAL_FIELDS, PER_VIDEO_FIELDS } from "./columnMap";
import { stripBom, isTotalsRow, normalizeRows, NormalizedGeneralRow, NormalizedVideoRow } from "./csv";
import { detectDelimiter } from "./delimiter";

export type UploadFileType = "GENERAL" | "PER_VIDEO";

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationReport {
  fileType: UploadFileType;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  videosDetected: number;
  dateRange: { min: string | null; max: string | null };
  metricsAvailable: CanonicalField[];
  metricsMissing: CanonicalField[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  generalRows: NormalizedGeneralRow[];
  videoRows: NormalizedVideoRow[];
}

function dateRangeOf(dates: (string | null)[]): { min: string | null; max: string | null } {
  const valid = dates.filter((d): d is string => d !== null).sort();
  if (valid.length === 0) return { min: null, max: null };
  return { min: valid[0], max: valid[valid.length - 1] };
}

export function runValidation(
  rawText: string,
  fileType: UploadFileType,
  mapping: Record<string, CanonicalField | null>,
  period?: { startDate: string; endDate: string },
): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const text = stripBom(rawText);
  if (text.trim() === "") {
    errors.push({ code: "empty_file", message: "El archivo está vacío." });
    return {
      fileType,
      rowCount: 0,
      validRowCount: 0,
      invalidRowCount: 0,
      videosDetected: 0,
      dateRange: { min: null, max: null },
      metricsAvailable: [],
      metricsMissing: fileType === "GENERAL" ? GENERAL_FIELDS : PER_VIDEO_FIELDS,
      errors,
      warnings,
      generalRows: [],
      videoRows: [],
    };
  }

  const delimiter = detectDelimiter(text);
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  if (parsed.errors.some((e) => e.type === "Delimiter") || headers.length === 0) {
    errors.push({ code: "corrupt_file", message: "No se pudo leer el archivo: formato o delimitador no reconocido." });
  }

  const mappedFields = Object.values(mapping).filter((f): f is CanonicalField => f !== null);
  if (mappedFields.length === 0) {
    errors.push({ code: "no_recognizable_columns", message: "Ninguna columna del archivo pudo reconocerse. Revisa el mapeo manualmente." });
  }

  // Duplicate headers mapped to the same canonical field.
  const seenFields = new Map<CanonicalField, string[]>();
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    seenFields.set(field, [...(seenFields.get(field) ?? []), header]);
  }
  for (const [field, headersForField] of seenFields) {
    if (headersForField.length > 1) {
      warnings.push({
        code: "duplicate_mapping",
        message: `Varias columnas (${headersForField.join(", ")}) están mapeadas al mismo campo "${field}". Se usará la última.`,
      });
    }
  }

  const allRows = (parsed.data ?? []).filter((r) => !isTotalsRow(r));
  const rowCount = allRows.length;

  if (rowCount === 0 && errors.length === 0) {
    errors.push({ code: "empty_file", message: "El archivo no contiene filas de datos." });
  }

  const expectedFields = fileType === "GENERAL" ? GENERAL_FIELDS : PER_VIDEO_FIELDS;
  const requiredField: CanonicalField = fileType === "GENERAL" ? "date" : "title";

  let generalRowsRaw: NormalizedGeneralRow[] = [];
  let videoRowsRaw: NormalizedVideoRow[] = [];
  let invalidRowCount = 0;
  let finalMetricsAvailable: CanonicalField[] = [];
  let finalMetricsMissing: CanonicalField[] = [];

  if (fileType === "GENERAL") {
    const result = normalizeRows<NormalizedGeneralRow>(allRows, mapping, expectedFields, requiredField);
    generalRowsRaw = result.rows;
    invalidRowCount = result.invalidRowCount;
    finalMetricsAvailable = result.metricsAvailable;
    finalMetricsMissing = result.metricsMissing;
  } else {
    const result = normalizeRows<NormalizedVideoRow>(allRows, mapping, expectedFields, requiredField);
    videoRowsRaw = result.rows;
    invalidRowCount = result.invalidRowCount;
    finalMetricsAvailable = result.metricsAvailable;
    finalMetricsMissing = result.metricsMissing;
  }

  const validRowCount = rowCount - invalidRowCount;

  if (rowCount > 0 && validRowCount === 0) {
    errors.push({
      code: "all_rows_invalid",
      message:
        fileType === "GENERAL"
          ? "Ninguna fila tiene una fecha interpretable. Revisa el mapeo de la columna de fecha."
          : "Ninguna fila tiene un título de video interpretable. Revisa el mapeo de la columna de título.",
    });
  } else if (invalidRowCount > 0) {
    warnings.push({
      code: "some_rows_invalid",
      message: `${invalidRowCount} de ${rowCount} filas no pudieron interpretarse y fueron descartadas.`,
    });
  }

  if (finalMetricsMissing.includes("impressions_ctr")) {
    warnings.push({ code: "missing_ctr", message: "Falta el CTR de miniatura (impressions_ctr)." });
  }
  if (finalMetricsMissing.includes("average_view_percentage")) {
    warnings.push({ code: "missing_retention", message: "Falta el porcentaje medio visto (retención)." });
  }
  if (fileType === "PER_VIDEO" && finalMetricsMissing.includes("video_id")) {
    warnings.push({ code: "missing_video_id", message: "Falta el ID del video; se usará el título como identificador." });
  }

  const dateRange =
    fileType === "GENERAL" ? dateRangeOf(generalRowsRaw.map((r) => r.date)) : dateRangeOf(videoRowsRaw.map((r) => r.published_at));

  if (period && dateRange.min && dateRange.max) {
    if (dateRange.min < period.startDate || dateRange.max > period.endDate) {
      warnings.push({
        code: "period_mismatch",
        message: `El rango de fechas del archivo (${dateRange.min} a ${dateRange.max}) no coincide exactamente con el período seleccionado (${period.startDate} a ${period.endDate}).`,
      });
    }
  }

  if (fileType === "PER_VIDEO") {
    const titles = videoRowsRaw.map((r) => (r.title ?? "").trim().toLowerCase()).filter(Boolean);
    const dupTitles = titles.filter((t, i) => titles.indexOf(t) !== i);
    if (dupTitles.length > 0) {
      warnings.push({ code: "duplicate_titles", message: `Hay ${new Set(dupTitles).size} título(s) de video duplicados en el archivo.` });
    }
  }

  return {
    fileType,
    rowCount,
    validRowCount,
    invalidRowCount,
    videosDetected: fileType === "PER_VIDEO" ? videoRowsRaw.length : 0,
    dateRange,
    metricsAvailable: finalMetricsAvailable,
    metricsMissing: finalMetricsMissing,
    errors,
    warnings,
    generalRows: generalRowsRaw,
    videoRows: videoRowsRaw,
  };
}
