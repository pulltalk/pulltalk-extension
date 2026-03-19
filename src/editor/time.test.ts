import { describe, it, expect } from "vitest";
import { formatClock, round2, pctFromTime } from "./time";

describe("formatClock", () => {
  it("formats 0 as 00:00", () => {
    expect(formatClock(0)).toBe("00:00");
  });

  it("formats seconds-only values", () => {
    expect(formatClock(45)).toBe("00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatClock(125)).toBe("02:05");
  });

  it("formats hours when >= 3600", () => {
    expect(formatClock(3661)).toBe("01:01:01");
  });

  it("clamps negative values to 0", () => {
    expect(formatClock(-5)).toBe("00:00");
  });

  it("truncates fractional seconds", () => {
    expect(formatClock(5.9)).toBe("00:05");
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.999)).toBe(2);
    expect(round2(3.14159)).toBe(3.14);
    expect(round2(0)).toBe(0);
  });
});

describe("pctFromTime", () => {
  it("returns 0 when duration is unknown", () => {
    expect(pctFromTime(5, 10, false)).toBe(0);
  });

  it("returns 0 when duration is 0", () => {
    expect(pctFromTime(5, 0, true)).toBe(0);
  });

  it("computes correct percentage", () => {
    expect(pctFromTime(5, 10, true)).toBe(50);
    expect(pctFromTime(0, 10, true)).toBe(0);
    expect(pctFromTime(10, 10, true)).toBe(100);
  });
});
