/**
 * Fast editor iteration without recorder: optional dev-only fixture (see README).
 */

import { idbGetBlob, idbPutBlob } from "@/shared/idb";

/** IndexedDB key for the generated sample (same as draft key while testing). */
export const DEV_SAMPLE_DRAFT_KEY = "pulltalk_dev_fixture";

export function isEditorDevToolsEnabled(): boolean {
  return (
    Boolean(import.meta.env.DEV)
    || import.meta.env.VITE_PULLTALK_EDITOR_DEV_TOOLS === "true"
  );
}

function pickWebmMime(): string {
  const candidates = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return "video/webm";
}

/**
 * Short VP8/VP9 WebM from canvas (no external asset). Used only when dev tools are on.
 */
export async function recordDevSampleWebm(durationMs = 900): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder not available in this context.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable.");
  }

  let frame = 0;
  const draw = (): void => {
    frame += 1;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#19e619";
    ctx.font = "600 22px system-ui,sans-serif";
    ctx.fillText("PullTalk dev sample", 32, 120);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "14px system-ui,sans-serif";
    ctx.fillText(`Frame ${frame} · use trim/crop/upload to test flows`, 32, 168);
  };
  draw();

  const stream = canvas.captureStream(12);
  const mime = pickWebmMime();
  const rec = new MediaRecorder(stream, { mimeType: mime });

  const chunks: Blob[] = [];
  rec.ondataavailable = (e): void => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    rec.onerror = (): void => void reject(new Error("MediaRecorder error"));
    rec.onstop = (): void => void resolve();
  });

  const iv = window.setInterval(draw, 1000 / 12);
  rec.start(100);

  await new Promise((r) => setTimeout(r, durationMs));
  window.clearInterval(iv);
  draw();
  rec.stop();
  await stopped;

  const out = new Blob(chunks, { type: "video/webm" });
  if (out.size < 32) {
    throw new Error("Dev sample recording produced an empty file. Try again.");
  }
  return out;
}

/** Reuse IDB blob across reloads so reopening the dev URL is instant. */
export async function loadOrCreateDevSampleBlob(): Promise<Blob> {
  const cached = await idbGetBlob(DEV_SAMPLE_DRAFT_KEY);
  if (cached != null && cached.size > 0) {
    return cached;
  }
  const fresh = await recordDevSampleWebm();
  await idbPutBlob(DEV_SAMPLE_DRAFT_KEY, fresh);
  return fresh;
}
