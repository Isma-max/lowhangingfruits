import { describe, it, expect } from "vitest";
import { detectMilestones, VideoSummary } from "../milestones";
import { computeConcentration } from "../rules";
import { compareMetric } from "../../metrics/stats";

const videos: VideoSummary[] = [
  { id: "1", title: "Video A", views: 10000, impressionsCtr: 9, averageViewPercentage: 55, subscribersGained: 40 },
  { id: "2", title: "Video B", views: 3000, impressionsCtr: 5, averageViewPercentage: 40, subscribersGained: 5 },
  { id: "3", title: "Video C", views: 500, impressionsCtr: 4, averageViewPercentage: 20, subscribersGained: 1 },
];

const dailyPoints = [
  { date: "2026-06-01", views: 1000 },
  { date: "2026-06-02", views: 4000 },
  { date: "2026-06-03", views: 2000 },
];

function baseInput() {
  return {
    currentPeriodId: "p1",
    dailyPoints,
    videos,
    viewsComparison: compareMetric(13500, 10000),
    concentration: computeConcentration(videos.map((v) => v.views!).sort((a, b) => b - a)),
    sameYearPeriods: [{ periodId: "p1", name: "Junio 2026", views: 13500 }],
  };
}

describe("detectMilestones", () => {
  it("detects video-level milestones (top views, CTR, retention, subscribers)", () => {
    const milestones = detectMilestones(baseInput());
    const byType = Object.fromEntries(milestones.map((m) => [m.type, m]));
    expect(byType.top_video_views.detail).toContain("Video A");
    expect(byType.top_video_ctr.detail).toContain("Video A");
    expect(byType.top_video_retention.detail).toContain("Video A");
    expect(byType.top_video_subscribers.detail).toContain("Video A");
  });

  it("detects the best day from daily points", () => {
    const milestones = detectMilestones(baseInput());
    const best = milestones.find((m) => m.type === "best_day")!;
    expect(best.detail).toContain("2026-06-02");
  });

  it("detects a relevant increase as 'mayor alza'", () => {
    const milestones = detectMilestones(baseInput());
    expect(milestones.some((m) => m.type === "biggest_increase")).toBe(true);
    expect(milestones.some((m) => m.type === "biggest_drop")).toBe(false);
  });

  it("detects a relevant decrease as 'mayor caída'", () => {
    const input = { ...baseInput(), viewsComparison: compareMetric(7000, 10000) };
    const milestones = detectMilestones(input);
    expect(milestones.some((m) => m.type === "biggest_drop")).toBe(true);
  });

  it("does NOT declare 'mejor período del año' with only one same-year period (insufficient history)", () => {
    const milestones = detectMilestones(baseInput());
    expect(milestones.some((m) => m.type === "best_period_of_year")).toBe(false);
  });

  it("declares 'mejor período del año' when there is enough same-year history and this period wins", () => {
    const input = {
      ...baseInput(),
      sameYearPeriods: [
        { periodId: "p0", name: "Mayo 2026", views: 9000 },
        { periodId: "p1", name: "Junio 2026", views: 13500 },
      ],
    };
    const milestones = detectMilestones(input);
    expect(milestones.some((m) => m.type === "best_period_of_year")).toBe(true);
  });

  it("does not declare 'mejor período del año' when a different period in the year did better", () => {
    const input = {
      ...baseInput(),
      sameYearPeriods: [
        { periodId: "p0", name: "Mayo 2026", views: 90000 },
        { periodId: "p1", name: "Junio 2026", views: 13500 },
      ],
    };
    const milestones = detectMilestones(input);
    expect(milestones.some((m) => m.type === "best_period_of_year")).toBe(false);
  });
});
