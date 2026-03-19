import { describe, it, expect } from "vitest";
import {
  createEditorState,
  isCropFullFrame,
  clampCropToVideo,
  clampTrim,
  MIN_CROP_PX,
  MIN_TRIM,
} from "./editorState";

describe("createEditorState", () => {
  it("initializes with given dimensions", () => {
    const s = createEditorState(1920, 1080);
    expect(s.vNatW).toBe(1920);
    expect(s.vNatH).toBe(1080);
    expect(s.cropW).toBe(1920);
    expect(s.cropH).toBe(1080);
    expect(s.durationKnown).toBe(false);
    expect(s.noAudio).toBe(false);
  });
});

describe("isCropFullFrame", () => {
  it("returns true when crop equals natural dimensions", () => {
    const s = createEditorState(1920, 1080);
    expect(isCropFullFrame(s)).toBe(true);
  });

  it("returns false when crop differs", () => {
    const s = createEditorState(1920, 1080);
    s.cropX = 10;
    expect(isCropFullFrame(s)).toBe(false);
  });
});

describe("clampCropToVideo", () => {
  it("clamps crop within video bounds", () => {
    const s = createEditorState(100, 100);
    s.cropX = -10;
    s.cropY = 120;
    s.cropW = 200;
    s.cropH = 5;
    clampCropToVideo(s);
    expect(s.cropX).toBe(0);
    expect(s.cropY).toBe(100 - MIN_CROP_PX);
    expect(s.cropW).toBe(100);
    expect(s.cropH).toBe(MIN_CROP_PX);
  });
});

describe("clampTrim", () => {
  it("does nothing when duration is unknown", () => {
    const s = createEditorState(100, 100);
    s.trimStart = -5;
    s.trimEnd = 999;
    clampTrim(s);
    expect(s.trimStart).toBe(-5);
    expect(s.trimEnd).toBe(999);
  });

  it("clamps trim to valid range", () => {
    const s = createEditorState(100, 100);
    s.durationKnown = true;
    s.dur = 10;
    s.trimStart = -1;
    s.trimEnd = 20;
    clampTrim(s);
    expect(s.trimStart).toBe(0);
    expect(s.trimEnd).toBe(10);
  });

  it("enforces minimum trim duration", () => {
    const s = createEditorState(100, 100);
    s.durationKnown = true;
    s.dur = 10;
    s.trimStart = 5;
    s.trimEnd = 5;
    clampTrim(s);
    expect(s.trimEnd - s.trimStart).toBeCloseTo(MIN_TRIM, 5);
  });
});
