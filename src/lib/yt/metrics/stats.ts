export function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

export function sumOrNull(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

/** Weighted average that skips pairs where either the value or the weight is missing/non-positive. */
export function weightedAverage(values: (number | null | undefined)[], weights: (number | null | undefined)[]): number | null {
  let sumWeight = 0;
  let sumValue = 0;
  let any = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const w = weights[i];
    if (v === null || v === undefined || w === null || w === undefined || w <= 0) continue;
    sumValue += v * w;
    sumWeight += w;
    any = true;
  }
  if (!any || sumWeight === 0) return null;
  return sumValue / sumWeight;
}

export interface MetricComparison {
  current: number | null;
  previous: number | null;
  absoluteDiff: number | null;
  percentDiff: number | null;
  /** True when there's no meaningful base to compute a % change from (no previous data, or previous is 0). */
  noBase: boolean;
}

/** Division-by-zero-safe period-over-period comparison, per the "Sin base comparable" rule. */
export function compareMetric(current: number | null, previous: number | null): MetricComparison {
  if (current === null) {
    return { current: null, previous, absoluteDiff: null, percentDiff: null, noBase: true };
  }
  if (previous === null) {
    return { current, previous: null, absoluteDiff: null, percentDiff: null, noBase: true };
  }
  if (previous === 0) {
    return { current, previous, absoluteDiff: current - previous, percentDiff: null, noBase: true };
  }
  return {
    current,
    previous,
    absoluteDiff: current - previous,
    percentDiff: ((current - previous) / Math.abs(previous)) * 100,
    noBase: false,
  };
}
