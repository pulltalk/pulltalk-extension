import { describe, it, expect } from "vitest";
import { makeBlobKey } from "./idb";

describe("makeBlobKey", () => {
  it("starts with rec_ prefix", () => {
    expect(makeBlobKey()).toMatch(/^rec_/);
  });

  it("includes a timestamp component", () => {
    const before = Date.now();
    const key = makeBlobKey();
    const after = Date.now();
    const parts = key.split("_");
    const ts = Number(parts[1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("generates unique keys across calls", () => {
    const keys = new Set(Array.from({ length: 50 }, () => makeBlobKey()));
    expect(keys.size).toBe(50);
  });
});
