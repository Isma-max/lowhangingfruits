import { describe, it, expect } from "vitest";
import { median, sumOrNull, weightedAverage, compareMetric } from "../stats";

describe("median", () => {
  it("returns the middle value for an odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns null for an empty list", () => {
    expect(median([])).toBeNull();
  });
});

describe("sumOrNull", () => {
  it("sums present values and ignores null/undefined", () => {
    expect(sumOrNull([1, null, 2, undefined, 3])).toBe(6);
  });

  it("returns null when every value is missing", () => {
    expect(sumOrNull([null, undefined])).toBeNull();
  });
});

describe("weightedAverage", () => {
  it("computes a views-weighted average", () => {
    // 10% over 100 views and 20% over 300 views -> (10*100 + 20*300)/(400) = 17.5
    expect(weightedAverage([10, 20], [100, 300])).toBeCloseTo(17.5);
  });

  it("skips pairs with missing weight or zero weight instead of dividing by zero", () => {
    expect(weightedAverage([10, 20], [0, null])).toBeNull();
    expect(weightedAverage([10, null], [100, 200])).toBe(10);
  });
});

describe("compareMetric", () => {
  it("computes percent diff normally", () => {
    const r = compareMetric(120, 100);
    expect(r.absoluteDiff).toBe(20);
    expect(r.percentDiff).toBeCloseTo(20);
    expect(r.noBase).toBe(false);
  });

  it("flags noBase when previous is zero (division by zero guard)", () => {
    const r = compareMetric(50, 0);
    expect(r.percentDiff).toBeNull();
    expect(r.noBase).toBe(true);
  });

  it("flags noBase when previous is missing", () => {
    const r = compareMetric(50, null);
    expect(r.noBase).toBe(true);
  });

  it("flags noBase when current is missing", () => {
    const r = compareMetric(null, 50);
    expect(r.noBase).toBe(true);
  });
});
