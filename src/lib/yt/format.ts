export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${trimTrailingZero(v)}M`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    return `${sign}${trimTrailingZero(v)}K`;
  }
  return `${sign}${Math.round(abs)}`;
}

function trimTrailingZero(v: number): string {
  const fixed = v.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("es-CL");
}

export function fmtPercent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtTrend(percentDiff: number | null, noBase: boolean): string {
  if (noBase || percentDiff === null) return "Sin base comparable";
  const arrow = percentDiff >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(percentDiff).toFixed(1)}%`;
}

export function fmtCurrencyUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `$${fmtCompact(n)}`;
}
