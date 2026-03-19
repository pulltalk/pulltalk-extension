import type { EditorState } from "./editorState";
import { MIN_CROP_PX, isCropFullFrame } from "./editorState";
import {
  EDITOR_WASM_BLOB_SCALED_FIRST_BYTES,
  EDITOR_WASM_PIXEL_THRESHOLD,
  EDITOR_WASM_TWO_PASS_MAX_H,
  EDITOR_WASM_TWO_PASS_MAX_W,
} from "@/shared/constants";

/**
 * Two-pass trim+scale → crop when crop is applied. Keeps crop encode off full-resolution frames.
 */
export function shouldUseTwoPassCropPipeline(
  needsReencode: boolean,
  needsCrop: boolean,
): boolean {
  return needsReencode && needsCrop;
}

/**
 * For trim/strip-audio without crop: prefer starting with a scaled encode when pixels or blob are large.
 */
export function shouldPreferScaledSinglePassFirst(
  vNatW: number,
  vNatH: number,
  blobByteLength: number,
): boolean {
  const pixels = Math.max(0, vNatW) * Math.max(0, vNatH);
  return (
    pixels > EDITOR_WASM_PIXEL_THRESHOLD
    || blobByteLength > EDITOR_WASM_BLOB_SCALED_FIRST_BYTES
  );
}

/**
 * Uniform downscale to fit inside [maxW,maxH], matching ffmpeg
 * `scale='min(iw,W)':'min(ih,H)':force_original_aspect_ratio=decrease` (approx).
 */
export function computePassAScaledDims(
  natW: number,
  natH: number,
  maxW = EDITOR_WASM_TWO_PASS_MAX_W,
  maxH = EDITOR_WASM_TWO_PASS_MAX_H,
): { sw: number; sh: number } {
  const iw = Math.max(1, natW);
  const ih = Math.max(1, natH);
  const s = Math.min(1, maxW / iw, maxH / ih);
  const sw = Math.max(1, Math.round(iw * s));
  const sh = Math.max(1, Math.round(ih * s));
  return { sw, sh };
}

/**
 * Map crop rect from natural video space to pass-A output dimensions (sw×sh).
 */
export function mapCropToScaledSpace(
  state: EditorState,
  sw: number,
  sh: number,
): { cx: number; cy: number; cw: number; ch: number } {
  if (isCropFullFrame(state)) {
    return { cx: 0, cy: 0, cw: sw, ch: sh };
  }
  const vw = Math.max(1, state.vNatW);
  const vh = Math.max(1, state.vNatH);
  let cx = Math.round((state.cropX * sw) / vw);
  let cy = Math.round((state.cropY * sh) / vh);
  let cw = Math.max(MIN_CROP_PX, Math.round((state.cropW * sw) / vw));
  let ch = Math.max(MIN_CROP_PX, Math.round((state.cropH * sh) / vh));

  cx = Math.max(0, Math.min(cx, sw - MIN_CROP_PX));
  cy = Math.max(0, Math.min(cy, sh - MIN_CROP_PX));
  cw = Math.max(MIN_CROP_PX, Math.min(cw, sw - cx));
  ch = Math.max(MIN_CROP_PX, Math.min(ch, sh - cy));
  return { cx, cy, cw, ch };
}
