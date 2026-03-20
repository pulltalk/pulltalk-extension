import {
  EDITOR_TRANSCODE_BLOB_BYTES_THRESHOLD,
  EDITOR_TRANSCODE_CROP_BLOB_BYTES_THRESHOLD,
  EDITOR_TRANSCODE_PIXEL_THRESHOLD,
} from "@/shared/constants";

export type UploadBackendChoice = "wasm" | "server";

export type ChooseUploadBackendInput = {
  blobBytes: number;
  vNatW: number;
  vNatH: number;
  /** True when user applied a non–full-frame crop. */
  hasCrop: boolean;
  /** True when trim or strip-audio forces re-encode (same as editor needsReencode). */
  needsReencode: boolean;
};

/**
 * Decide whether edited uploads should use in-browser ffmpeg.wasm or server transcode.
 * When `server` is returned, callers must only run wasm if server transcode is unavailable
 * (feature flag off or misconfigured) — see uploadPipeline.
 */
export function chooseUploadBackend(input: ChooseUploadBackendInput): UploadBackendChoice {
  if (!input.needsReencode) {
    return "wasm";
  }
  const pixels = Math.max(0, input.vNatW) * Math.max(0, input.vNatH);
  if (input.hasCrop && input.blobBytes >= EDITOR_TRANSCODE_CROP_BLOB_BYTES_THRESHOLD) {
    return "server";
  }
  if (pixels > EDITOR_TRANSCODE_PIXEL_THRESHOLD) {
    return "server";
  }
  if (input.blobBytes >= EDITOR_TRANSCODE_BLOB_BYTES_THRESHOLD) {
    return "server";
  }
  return "wasm";
}
