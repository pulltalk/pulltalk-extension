/* ── Timing ──────────────────────────────────────────────────────── */

export const OPEN_RECORDER_SETUP_TIMEOUT_MS = 30_000;
export const SESSION_POLL_DELAY_MS = 50;
export const SESSION_POLL_MAX_ATTEMPTS = 30;

/* ── Video ───────────────────────────────────────────────────────── */

export const RECORDING_FPS = 30;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

/* ── Quality ─────────────────────────────────────────────────────── */

export const MAX_OUTPUT_W = 1920;
export const MAX_OUTPUT_H = 1080;
export const MIN_OUTPUT_W = 640;
export const MIN_OUTPUT_H = 360;
export const AUDIO_BPS = 128_000;

/** ~3 Mbps at 720p, ~6 Mbps at 1080p, capped at MAX_VIDEO_BPS. */
export const MAX_VIDEO_BPS = 8_000_000;
export const MIN_VIDEO_BPS = 2_000_000;
export function videoBpsForResolution(w: number, h: number, fps = RECORDING_FPS): number {
  const pixels = w * h;
  const bps = (pixels * 3.2 * fps) / 1000;
  return Math.max(MIN_VIDEO_BPS, Math.min(MAX_VIDEO_BPS, Math.round(bps)));
}

export const EDITOR_REENCODE_BPS = "4M";
export const EDITOR_REENCODE_CPU_USED = "4";
export const EDITOR_REENCODE_DEADLINE = "good";

