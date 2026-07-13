import { describe, it, expect } from "vitest";
import { parseLocaleNumber, parsePercentage } from "../numbers";

describe("parseLocaleNumber", () => {
  it("parses plain integers", () => {
    expect(parseLocaleNumber("1234")).toBe(1234);
  });

  it("parses latin thousands with decimal comma", () => {
    expect(parseLocaleNumber("1.234.567,89")).toBeCloseTo(1234567.89);
  });

  it("parses anglo thousands with decimal point", () => {
    expect(parseLocaleNumber("1,234,567.89")).toBeCloseTo(1234567.89);
  });

  it("parses latin decimal without thousands grouping", () => {
    expect(parseLocaleNumber("1234,56")).toBeCloseTo(1234.56);
  });

  it("parses anglo decimal without thousands grouping", () => {
    expect(parseLocaleNumber("1234.56")).toBeCloseTo(1234.56);
  });

  it("handles negative values", () => {
    expect(parseLocaleNumber("-42")).toBe(-42);
  });

  it("returns null for empty/dash/n-a values", () => {
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("-")).toBeNull();
    expect(parseLocaleNumber("N/A")).toBeNull();
    expect(parseLocaleNumber(undefined)).toBeNull();
    expect(parseLocaleNumber(null)).toBeNull();
  });

  it("returns null for unparseable garbage", () => {
    expect(parseLocaleNumber("abc")).toBeNull();
  });

  it("division-by-zero-safe callers can rely on null, not NaN", () => {
    const v = parseLocaleNumber("");
    expect(v === null || Number.isFinite(v)).toBe(true);
  });
});

describe("parsePercentage", () => {
  it("strips a trailing % and parses the human value", () => {
    expect(parsePercentage("6,7%")).toBeCloseTo(6.7);
    expect(parsePercentage("6.7%")).toBeCloseTo(6.7);
    expect(parsePercentage("6.7 %")).toBeCloseTo(6.7);
  });

  it("parses a bare number as already-human percentage", () => {
    expect(parsePercentage("6.7")).toBeCloseTo(6.7);
  });
});
