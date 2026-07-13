import { describe, it, expect } from "vitest";
import { classifyVariation, classifyVideoPerformance, computeConcentration, classifyCtrRetention } from "../rules";
import { DEFAULT_THRESHOLDS } from "../thresholds";

describe("classifyVariation", () => {
  it("classifies a relevant increase (>= +15%)", () => {
    expect(classifyVariation(18.2)).toBe("increase");
    expect(classifyVariation(15)).toBe("increase");
  });

  it("classifies a relevant decrease (<= -15%)", () => {
    expect(classifyVariation(-20)).toBe("decrease");
    expect(classifyVariation(-15)).toBe("decrease");
  });

  it("classifies stability (within +/-5%)", () => {
    expect(classifyVariation(2)).toBe("stable");
    expect(classifyVariation(-4)).toBe("stable");
  });

  it("leaves the ambiguous band between stable and relevant unclassified", () => {
    expect(classifyVariation(10)).toBe("unclassified");
  });

  it("respects custom thresholds", () => {
    const custom = { ...DEFAULT_THRESHOLDS, relevantIncreasePct: 10 };
    expect(classifyVariation(10, custom)).toBe("increase");
  });

  it("returns unclassified for null (no comparable base)", () => {
    expect(classifyVariation(null)).toBe("unclassified");
  });
});

describe("classifyVideoPerformance", () => {
  it("flags an outstanding video (>2x median) with sufficient sample", () => {
    const r = classifyVideoPerformance(250, 100, 6);
    expect(r.outstanding).toBe(true);
    expect(r.underperforming).toBe(false);
  });

  it("flags an underperforming video (<0.5x median) with sufficient sample", () => {
    const r = classifyVideoPerformance(30, 100, 6);
    expect(r.underperforming).toBe(true);
    expect(r.outstanding).toBe(false);
  });

  it("does not apply the rule below the minimum sample size", () => {
    const r = classifyVideoPerformance(1000, 100, 2);
    expect(r.outstanding).toBe(false);
    expect(r.underperforming).toBe(false);
  });

  it("is safe when median is zero (division-by-zero guard)", () => {
    const r = classifyVideoPerformance(100, 0, 10);
    expect(r.outstanding).toBe(false);
    expect(r.underperforming).toBe(false);
  });
});

describe("computeConcentration", () => {
  it("flags a dominant top video (>35% of total views)", () => {
    const r = computeConcentration([600, 100, 100, 100, 50, 50]);
    expect(r.topVideoPct).toBeCloseTo(60);
    expect(r.topVideoNotable).toBe(true);
  });

  it("computes top-5 share correctly", () => {
    const r = computeConcentration([100, 100, 100, 100, 100, 500]);
    expect(r.top5Pct).toBeCloseTo(50);
  });

  it("is safe for an empty list (division-by-zero guard)", () => {
    const r = computeConcentration([]);
    expect(r.topVideoPct).toBeNull();
    expect(r.topVideoNotable).toBe(false);
  });
});

describe("classifyCtrRetention", () => {
  it("classifies all four quadrants relative to channel averages", () => {
    expect(classifyCtrRetention(8, 50, 6, 40)).toBe("high_ctr_high_retention");
    expect(classifyCtrRetention(8, 30, 6, 40)).toBe("high_ctr_low_retention");
    expect(classifyCtrRetention(4, 50, 6, 40)).toBe("low_ctr_high_retention");
    expect(classifyCtrRetention(4, 30, 6, 40)).toBe("low_ctr_low_retention");
  });

  it("returns unclassified when any input is missing", () => {
    expect(classifyCtrRetention(null, 50, 6, 40)).toBe("unclassified");
  });
});
