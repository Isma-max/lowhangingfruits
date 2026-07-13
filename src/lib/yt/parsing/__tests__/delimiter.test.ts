import { describe, it, expect } from "vitest";
import { detectDelimiter } from "../delimiter";

describe("detectDelimiter", () => {
  it("detects comma-separated files", () => {
    expect(detectDelimiter("a,b,c\n1,2,3\n4,5,6")).toBe(",");
  });

  it("detects semicolon-separated files (common in latin-locale exports)", () => {
    expect(detectDelimiter("a;b;c\n1;2;3\n4;5;6")).toBe(";");
  });

  it("detects tab-separated files", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("falls back to comma for a single-column file", () => {
    expect(detectDelimiter("a\n1\n2")).toBe(",");
  });
});
