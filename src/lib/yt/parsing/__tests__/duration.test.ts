import { describe, it, expect } from "vitest";
import { parseDurationToSeconds, formatSecondsAsDuration } from "../duration";

describe("parseDurationToSeconds", () => {
  it("parses HH:MM:SS", () => {
    expect(parseDurationToSeconds("00:03:25")).toBe(205);
    expect(parseDurationToSeconds("01:00:00")).toBe(3600);
  });

  it("parses MM:SS", () => {
    expect(parseDurationToSeconds("3:25")).toBe(205);
  });

  it("ignores a trailing frames field (HH:MM:SS:FF)", () => {
    expect(parseDurationToSeconds("00:03:25:10")).toBe(205);
  });

  it("passes through bare integer seconds", () => {
    expect(parseDurationToSeconds("205")).toBe(205);
  });

  it("returns null for empty/garbage", () => {
    expect(parseDurationToSeconds("")).toBeNull();
    expect(parseDurationToSeconds("abc")).toBeNull();
    expect(parseDurationToSeconds(undefined)).toBeNull();
  });
});

describe("formatSecondsAsDuration", () => {
  it("formats seconds under an hour as M:SS", () => {
    expect(formatSecondsAsDuration(205)).toBe("3:25");
  });

  it("formats seconds over an hour as H:MM:SS", () => {
    expect(formatSecondsAsDuration(3725)).toBe("1:02:05");
  });

  it("handles null gracefully", () => {
    expect(formatSecondsAsDuration(null)).toBe("—");
  });
});
