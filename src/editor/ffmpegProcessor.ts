import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { EditorState } from "./editorState";
import { isCropFullFrame } from "./editorState";
import {
  EDITOR_REENCODE_BPS,
  EDITOR_REENCODE_CPU_USED,
  EDITOR_REENCODE_DEADLINE,
} from "@/shared/constants";

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function loadFfmpeg(
  onProgress?: (pct: number) => void,
): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg();
  if (import.meta.env.DEV) {
    ffmpeg.on("log", ({ message }) => {
      console.log(message);
    });
  }

  type FfmpegWithProgress = FFmpeg & {
    on(event: "progress", cb: (p: { progress?: number }) => void): void;
  };
  let peak = 0;
  (ffmpeg as FfmpegWithProgress).on("progress", ({ progress }) => {
    if (typeof progress === "number" && Number.isFinite(progress)) {
      peak = Math.max(peak, Math.round(progress * 100));
      onProgress?.(Math.min(99, peak));
    }
  });

  // MV3 CSP forbids blob: in script-src. Force classic workers so
  // importScripts() loads extension URLs directly.
  const NativeWorker = globalThis.Worker;
  globalThis.Worker = class extends NativeWorker {
    constructor(scriptURL: string | URL, options?: WorkerOptions) {
      super(scriptURL, { ...options, type: "classic" });
    }
  } as typeof Worker;

  const base = chrome.runtime.getURL("ffmpeg/");
  try {
    await ffmpeg.load({
      coreURL: `${base}ffmpeg-core.js`,
      wasmURL: `${base}ffmpeg-core.wasm`,
    });
  } finally {
    globalThis.Worker = NativeWorker;
  }
  return ffmpeg;
}

export function getFFmpeg(
  onProgress?: (pct: number) => void,
): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = loadFfmpeg(onProgress).catch((err) => {
      ffmpegPromise = null;
      throw err;
    });
  }
  return ffmpegPromise;
}

export async function processVideo(
  blob: Blob,
  state: EditorState,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);
  const inputFile = "in.webm";
  await ffmpeg.writeFile(inputFile, await fetchFile(blob));

  const s = state.trimStart;
  const e = state.trimEnd;
  const len = Math.max(0.1, Math.min(e - s, state.dur - s + 1e6));
  if (!Number.isFinite(len) || len <= 0) throw new Error("Trim range invalid");

  const fullFrame = isCropFullFrame(state);
  const needsCrop = !fullFrame;
  const vf = needsCrop
    ? `crop=${state.cropW}:${state.cropH}:${state.cropX}:${state.cropY}`
    : null;

  const args = ["-ss", String(s), "-i", inputFile, "-t", String(len)];
  if (vf) args.push("-vf", vf);
  if (state.noAudio) args.push("-an");
  else args.push("-c:a", "copy");

  if (needsCrop) {
    args.push(
      "-c:v", "libvpx-vp9",
      "-deadline", EDITOR_REENCODE_DEADLINE,
      "-cpu-used", EDITOR_REENCODE_CPU_USED,
      "-b:v", EDITOR_REENCODE_BPS,
      "out.webm",
    );
  } else {
    args.push("-c:v", "copy", "out.webm");
  }

  await ffmpeg.exec(args);
  onProgress?.(100);

  const out = await ffmpeg.readFile("out.webm");
  return new Blob([out as unknown as BlobPart], { type: "video/webm" });
}
