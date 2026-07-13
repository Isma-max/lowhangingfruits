import { describe, it, expect } from "vitest";
import { buildPeriodComparison } from "../comparison";
import { AggregatedGeneral } from "../../metrics/aggregate";

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

describe("buildPeriodComparison", () => {
  it("computes totals, per-day, per-video and percentage-point rows against a previous period", () => {
    const result = buildPeriodComparison({
      currentDays: 7,
      previousDays: 7,
      current: agg({ views: 70000, watchTimeHours: 700, subscribersGained: 700, impressionsCtr: 8, averageViewPercentage: 50, estimatedRevenue: 350 }),
      previous: agg({ views: 60000, watchTimeHours: 600, subscribersGained: 600, impressionsCtr: 6, averageViewPercentage: 45, estimatedRevenue: 300 }),
      currentVideoCount: 10,
      previousVideoCount: 8,
      currentEngagement: 6,
      previousEngagement: 5,
    });

    expect(result.dayCountMismatch).toBe(false);

    const views = result.rows.find((r) => r.key === "views")!;
    expect(views.comparison.current).toBe(70000);
    expect(views.comparison.percentDiff).toBeCloseTo((10000 / 60000) * 100);

    const viewsPerDay = result.rows.find((r) => r.key === "viewsPerDay")!;
    expect(viewsPerDay.comparison.current).toBeCloseTo(10000);
    expect(viewsPerDay.comparison.previous).toBeCloseTo(60000 / 7);

    const viewsPerVideo = result.rows.find((r) => r.key === "viewsPerVideo")!;
    expect(viewsPerVideo.comparison.current).toBeCloseTo(7000);
    expect(viewsPerVideo.comparison.previous).toBeCloseTo(7500);

    // CTR moved from 6% to 8% -> +2 percentage points, exposed via absoluteDiff.
    const ctr = result.rows.find((r) => r.key === "impressionsCtr")!;
    expect(ctr.isPercentagePoints).toBe(true);
    expect(ctr.comparison.absoluteDiff).toBeCloseTo(2);
  });

  it("flags a day-count mismatch instead of silently comparing unequal periods", () => {
    const result = buildPeriodComparison({
      currentDays: 30,
      previousDays: 28,
      current: agg({ views: 100000 }),
      previous: agg({ views: 90000 }),
      currentVideoCount: null,
      previousVideoCount: null,
      currentEngagement: null,
      previousEngagement: null,
    });
    expect(result.dayCountMismatch).toBe(true);
  });

  it("returns noBase comparisons when there is no previous period", () => {
    const result = buildPeriodComparison({
      currentDays: 7,
      previousDays: null,
      current: agg({ views: 1000 }),
      previous: null,
      currentVideoCount: 5,
      previousVideoCount: null,
      currentEngagement: null,
      previousEngagement: null,
    });
    const views = result.rows.find((r) => r.key === "views")!;
    expect(views.comparison.noBase).toBe(true);
  });
});
