import { describe, it, expect } from "vitest";
import { easeOutCubic, clampCenter } from "./math";

describe("easeOutCubic", () => {
  it("returns 0 at t=0", () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it("returns 1 at t=1", () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it("returns value between 0 and 1 for t in (0,1)", () => {
    const v = easeOutCubic(0.5);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("decelerates (second half changes less than first half)", () => {
    const firstHalf = easeOutCubic(0.5) - easeOutCubic(0);
    const secondHalf = easeOutCubic(1) - easeOutCubic(0.5);
    expect(firstHalf).toBeGreaterThan(secondHalf);
  });
});

describe("clampCenter", () => {
  it("clamps center within valid range", () => {
    const result = clampCenter(50, 50, 100, 100, 1280, 720);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it("centers when halfW exceeds layout bounds", () => {
    const result = clampCenter(0, 0, 700, 400, 1280, 720);
    expect(result.x).toBe(640);
    expect(result.y).toBe(360);
  });

  it("passes through values already in range", () => {
    const result = clampCenter(640, 360, 200, 200, 1280, 720);
    expect(result.x).toBe(640);
    expect(result.y).toBe(360);
  });

  it("clamps to max when too far right/down", () => {
    const result = clampCenter(2000, 2000, 200, 200, 1280, 720);
    expect(result.x).toBe(1080);
    expect(result.y).toBe(520);
  });
});
