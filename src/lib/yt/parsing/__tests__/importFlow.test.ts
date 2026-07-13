import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsvPreview } from "../csv";
import { runValidation } from "../validate";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

describe("full CSV import flow — general report", () => {
  it("imports a Spanish, semicolon-delimited, BOM-prefixed, latin-number file", () => {
    const text = fixture("general_es.csv");
    const preview = parseCsvPreview(text);

    expect(preview.delimiter).toBe(";");
    expect(preview.fileTypeGuess).toBe("GENERAL");
    expect(preview.totalRows).toBe(3); // totals row excluded
    expect(preview.suggestedMapping["Fecha"]).toBe("date");
    expect(preview.suggestedMapping["Visualizaciones"]).toBe("views");

    const report = runValidation(text, "GENERAL", preview.suggestedMapping, {
      startDate: "2026-06-01",
      endDate: "2026-06-07",
    });

    expect(report.errors).toHaveLength(0);
    expect(report.rowCount).toBe(3);
    expect(report.validRowCount).toBe(3);
    expect(report.metricsMissing).toHaveLength(0);
    expect(report.dateRange).toEqual({ min: "2026-06-01", max: "2026-06-03" });

    const day1 = report.generalRows[0];
    expect(day1.date).toBe("2026-06-01");
    expect(day1.views).toBe(12500);
    expect(day1.watch_time_hours).toBeCloseTo(340.5);
    expect(day1.impressions_ctr).toBeCloseTo(6.7);
    expect(day1.average_view_duration).toBe(205); // 00:03:25
    expect(day1.estimated_revenue).toBeCloseTo(85.3);
  });

  it("imports the equivalent English, comma-delimited, anglo-number file to the same canonical values", () => {
    const text = fixture("general_en.csv");
    const preview = parseCsvPreview(text);

    expect(preview.delimiter).toBe(",");
    expect(preview.fileTypeGuess).toBe("GENERAL");

    const report = runValidation(text, "GENERAL", preview.suggestedMapping);
    expect(report.errors).toHaveLength(0);
    expect(report.validRowCount).toBe(3);

    const day1 = report.generalRows[0];
    expect(day1.date).toBe("2026-06-01");
    expect(day1.views).toBe(12500);
    expect(day1.watch_time_hours).toBeCloseTo(340.5);
    expect(day1.average_view_duration).toBe(205);
  });
});

describe("full CSV import flow — per-video report", () => {
  it("imports a Spanish per-video file and detects videos + engagement inputs", () => {
    const text = fixture("per_video_es.csv");
    const preview = parseCsvPreview(text);

    expect(preview.fileTypeGuess).toBe("PER_VIDEO");
    expect(preview.suggestedMapping["Título del video"]).toBe("title");
    expect(preview.suggestedMapping["ID del video"]).toBe("video_id");

    const report = runValidation(text, "PER_VIDEO", preview.suggestedMapping);
    expect(report.errors).toHaveLength(0);
    expect(report.videosDetected).toBe(3);

    const top = report.videoRows[0];
    expect(top.title).toBe("Parodia: el profe que llega tarde");
    expect(top.views).toBe(24100);
    expect(top.likes).toBe(1850);
    expect(top.duration).toBe(252); // 00:04:12
  });

  it("imports the equivalent English per-video file to the same canonical values", () => {
    const text = fixture("per_video_en.csv");
    const preview = parseCsvPreview(text);

    expect(preview.fileTypeGuess).toBe("PER_VIDEO");

    const report = runValidation(text, "PER_VIDEO", preview.suggestedMapping);
    expect(report.errors).toHaveLength(0);
    expect(report.videosDetected).toBe(3);
    expect(report.videoRows[0].views).toBe(24100);
    expect(report.videoRows[0].published_at).toBe("2026-06-01");
  });

  it("flags a file with no recognizable columns as a blocking error", () => {
    const report = runValidation("Columna A;Columna B\n1;2\n", "GENERAL", { "Columna A": null, "Columna B": null });
    expect(report.errors.some((e) => e.code === "no_recognizable_columns")).toBe(true);
  });

  it("flags an empty file as a blocking error", () => {
    const report = runValidation("", "GENERAL", {});
    expect(report.errors.some((e) => e.code === "empty_file")).toBe(true);
  });
});
