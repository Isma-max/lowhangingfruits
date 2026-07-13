/**
 * Parses a number written in either Latin (1.234,56) or Anglo-Saxon
 * (1,234.56) format into a JS number. Returns null for empty/unparseable
 * values (never throws) so callers can treat missing metrics as `null`
 * per the normalization contract.
 */
export function parseLocaleNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.trim();
  if (s === "" || s === "-" || s === "—" || s.toLowerCase() === "n/a" || s.toLowerCase() === "null") return null;

  s = s.replace(/\s/g, "");
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/^[-+]/, "").replace(/^\(|\)$/g, "");

  let normalized: string;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // Latin thousands (1.234.567) with optional decimal comma
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // Anglo thousands (1,234,567) with optional decimal point
    normalized = s.replace(/,/g, "");
  } else if (/^\d+,\d+$/.test(s)) {
    // Latin decimal, no thousands grouping (1234,56)
    normalized = s.replace(",", ".");
  } else if (/^\d+\.\d+$/.test(s)) {
    // Already Anglo decimal
    normalized = s;
  } else if (/^\d+$/.test(s)) {
    normalized = s;
  } else {
    return null;
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) return null;
  return negative ? -value : value;
}

/** Parses a percentage string ("6,7%", "6.7", "6.7 %") into a human value like 6.7 (not 0.067). */
export function parsePercentage(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const stripped = raw.trim().replace(/%$/, "").trim();
  return parseLocaleNumber(stripped);
}
