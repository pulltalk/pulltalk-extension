import { describe, expect, it } from "vitest";
import { createEditorState } from "./editorState";
import {
  computePassAScaledDims,
  mapCropToScaledSpace,
  shouldPreferScaledSinglePassFirst,
  shouldUseTwoPassCropPipeline,
} from "./ffmpegStrategy";
import {
  EDITOR_WASM_BLOB_SCALED_FIRST_BYTES,
  EDITOR_WASM_PIXEL_THRESHOLD,
} from "@/shared/constants";

describe("shouldUseTwoPassCropPipeline", () => {
  it("is true when re-encode and crop", () => {
    expect(shouldUseTwoPassCropPipeline(true, true)).toBe(true);
  });
  it("is false when no crop", () => {
    expect(shouldUseTwoPassCropPipeline(true, false)).toBe(false);
  });
  it("is false when no re-encode", () => {
    expect(shouldUseTwoPassCropPipeline(false, true)).toBe(false);
  });
});

describe("shouldPreferScaledSinglePassFirst", () => {
  it("is true when pixels exceed threshold", () => {
    const w = 1920;
    const h = 1080;
    expect(w * h).toBeGreaterThan(EDITOR_WASM_PIXEL_THRESHOLD);
    expect(shouldPreferScaledSinglePassFirst(w, h, 0)).toBe(true);
  });
  it("is true when blob is large even at low resolution", () => {
    expect(
      shouldPreferScaledSinglePassFirst(640, 360, EDITOR_WASM_BLOB_SCALED_FIRST_BYTES + 1),
    ).toBe(true);
  });
  it("is false for small 720p frame and small blob", () => {
    expect(shouldPreferScaledSinglePassFirst(1280, 720, 1024)).toBe(false);
  });
});

describe("computePassAScaledDims", () => {
  it("does not upscale", () => {
    expect(computePassAScaledDims(640, 360, 1280, 720)).toEqual({ sw: 640, sh: 360 });
  });
  it("fits 1080p into 1280x720 box", () => {
    const { sw, sh } = computePassAScaledDims(1920, 1080, 1280, 720);
    expect(sw).toBeLessThanOrEqual(1280);
    expect(sh).toBeLessThanOrEqual(720);
    expect(sw / sh).toBeCloseTo(1920 / 1080, 1);
  });
});

describe("mapCropToScaledSpace", () => {
  it("maps center crop from 1920x1080 to scaled frame", () => {
    const state = createEditorState(1920, 1080);
    state.cropX = 460;
    state.cropY = 240;
    state.cropW = 1000;
    state.cropH = 600;
    const { sw, sh } = computePassAScaledDims(1920, 1080, 1280, 720);
    const m = mapCropToScaledSpace(state, sw, sh);
    expect(m.cx).toBeGreaterThanOrEqual(0);
    expect(m.cy).toBeGreaterThanOrEqual(0);
    expect(m.cw).toBeGreaterThan(0);
    expect(m.ch).toBeGreaterThan(0);
    expect(m.cx + m.cw).toBeLessThanOrEqual(sw);
    expect(m.cy + m.ch).toBeLessThanOrEqual(sh);
  });
});
