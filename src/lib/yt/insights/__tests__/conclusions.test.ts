import { describe, it, expect } from "vitest";
import { generateConclusions } from "../conclusions";
import { AggregatedGeneral } from "../../metrics/aggregate";
import { compareMetric } from "../../metrics/stats";
import { computeConcentration } from "../rules";

function agg(partial: Partial<AggregatedGeneral>): AggregatedGeneral {
  return {
    views: null,
    watchTimeHours: null,
    subscribersGained: null,
    subscribersLost: null,
    subscribersNet: null,
    impressions: null,
    impressionsCtr: null,
    averageViewDuration: null,
    averageViewPercentage: null,
    estimatedRevenue: null,
    daysWithData: 0,
    ...partial,
  };
}

describe("generateConclusions", () => {
  it("writes the overview sentence with the trend when a comparison exists", () => {
    const blocks = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({ views: 2400000, impressionsCtr: 6, averageViewPercentage: 45 }),
      viewsComparison: compareMetric(2400000, 2030000),
      concentration: { topVideoPct: null, top5Pct: null, topVideoNotable: false },
      milestones: [],
      topVideo: null,
      bottomVideo: null,
      medianViews: null,
      videoSampleSize: 0,
    });
    const overview = blocks.find((b) => b.id === "auto:overview")!;
    expect(overview.text).toContain("junio de 2026");
    expect(overview.text).toContain("2.400.000");
    expect(overview.text).toContain("aumento");
  });

  it("omits the overview sentence entirely when views are unavailable (no fabrication)", () => {
    const blocks = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({}),
      viewsComparison: compareMetric(null, null),
      concentration: { topVideoPct: null, top5Pct: null, topVideoNotable: false },
      milestones: [],
      topVideo: null,
      bottomVideo: null,
      medianViews: null,
      videoSampleSize: 0,
    });
    expect(blocks.find((b) => b.id === "auto:overview")).toBeUndefined();
  });

  it("writes the top-5 concentration sentence matching the spec's example phrasing", () => {
    const concentration = computeConcentration([620000, 100000, 100000, 100000, 80000, 50000]);
    const blocks = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({ views: 1050000 }),
      viewsComparison: compareMetric(null, null),
      concentration,
      milestones: [],
      topVideo: null,
      bottomVideo: null,
      medianViews: null,
      videoSampleSize: 0,
    });
    const top5 = blocks.find((b) => b.id === "auto:concentration_top5")!;
    expect(top5.text).toMatch(/cinco videos principales concentraron el \d+(\.\d+)?%/);
  });

  it("describes CTR/retention without implying causality (non-causal phrasing)", () => {
    const blocks = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({ views: 100000, impressionsCtr: 6, averageViewPercentage: 45 }),
      viewsComparison: compareMetric(null, null),
      concentration: { topVideoPct: null, top5Pct: null, topVideoNotable: false },
      milestones: [],
      topVideo: { title: "Video destacado", views: 50000, impressionsCtr: 9, averageViewPercentage: 30 },
      bottomVideo: null,
      medianViews: null,
      videoSampleSize: 0,
    });
    const block = blocks.find((b) => b.id === "auto:top_video_ctr_retention")!;
    expect(block.text).toContain("atraer clics");
    expect(block.text).not.toMatch(/caus[aó]|porque|debido a/i);
  });

  it("flags an outstanding video only with a sufficient sample", () => {
    const withSample = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({ views: 100000 }),
      viewsComparison: compareMetric(null, null),
      concentration: { topVideoPct: null, top5Pct: null, topVideoNotable: false },
      milestones: [],
      topVideo: { title: "Video viral", views: 500, impressionsCtr: null, averageViewPercentage: null },
      bottomVideo: null,
      medianViews: 100,
      videoSampleSize: 6,
    });
    expect(withSample.some((b) => b.id === "auto:video_outstanding")).toBe(true);

    const withoutSample = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({ views: 100000 }),
      viewsComparison: compareMetric(null, null),
      concentration: { topVideoPct: null, top5Pct: null, topVideoNotable: false },
      milestones: [],
      topVideo: { title: "Video viral", views: 500, impressionsCtr: null, averageViewPercentage: null },
      bottomVideo: null,
      medianViews: 100,
      videoSampleSize: 2,
    });
    expect(withoutSample.some((b) => b.id === "auto:video_outstanding")).toBe(false);
  });

  it("maps each milestone into its own conclusion block", () => {
    const blocks = generateConclusions({
      periodLabel: "junio de 2026",
      current: agg({}),
      viewsComparison: compareMetric(null, null),
      concentration: { topVideoPct: null, top5Pct: null, topVideoNotable: false },
      milestones: [{ type: "best_day", label: "Mejor día", detail: "2026-06-02 fue el día con más vistas (4.000)." }],
      topVideo: null,
      bottomVideo: null,
      medianViews: null,
      videoSampleSize: 0,
    });
    expect(blocks.find((b) => b.id === "auto:milestone:best_day")?.text).toContain("Mejor día");
  });
});
