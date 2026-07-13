import { describe, it, expect } from "vitest";
import { parseFlexibleDate } from "../dates";

describe("parseFlexibleDate", () => {
  it("parses ISO dates", () => {
    expect(parseFlexibleDate("2026-06-01")).toBe("2026-06-01");
  });

  it("parses dd/MM/yyyy", () => {
    expect(parseFlexibleDate("01/06/2026")).toBe("2026-06-01");
  });

  it("parses 'MMM d, yyyy' (English YouTube export style)", () => {
    expect(parseFlexibleDate("Jun 1, 2026")).toBe("2026-06-01");
  });

  it("parses 'd MMMM yyyy' with Spanish month names", () => {
    expect(parseFlexibleDate("1 junio 2026")).toBe("2026-06-01");
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("not a date")).toBeNull();
    expect(parseFlexibleDate(undefined)).toBeNull();
  });
});
