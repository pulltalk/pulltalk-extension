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

async function resetFFmpeg(): Promise<void> {
  if (!ffmpegPromise) return;
  try {
    const ffmpeg = await ffmpegPromise;
    const maybeTerminable = ffmpeg as FFmpeg & { terminate?: () => void };
    maybeTerminable.terminate?.();
  } catch {
    /* ignore reset errors */
  } finally {
    ffmpegPromise = null;
  }
}

type EncodeStrategy = {
  label: string;
  videoCodec: "copy" | "libvpx-vp9" | "libvpx";
  videoBitrate?: string;
  cpuUsed?: string;
  deadline?: string;
  audioCodec: "copy" | "libopus" | "none";
  audioBitrate?: string;
  maxOutputWidth?: number;
  maxOutputHeight?: number;
};

function isWasmOutOfMemoryError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? "");
  const lower = text.toLowerCase();
  return (
    lower.includes("memory access out of bounds")
    || lower.includes("out of memory")
    || lower.includes("wasm")
    || lower.includes("runtimeerror")
  );
}

function buildFilterChain(
  state: EditorState,
  strategy: EncodeStrategy,
): string | null {
  const filters: string[] = [];
  const fullFrame = isCropFullFrame(state);
  if (!fullFrame) {
    filters.push(`crop=${state.cropW}:${state.cropH}:${state.cropX}:${state.cropY}`);
  }
  if (strategy.maxOutputWidth && strategy.maxOutputHeight) {
    filters.push(
      `scale='min(iw,${strategy.maxOutputWidth})':'min(ih,${strategy.maxOutputHeight})':force_original_aspect_ratio=decrease`,
    );
  }
  return filters.length > 0 ? filters.join(",") : null;
}

async function runFfmpegAttempt(
  blob: Blob,
  state: EditorState,
  trimStart: number,
  trimLen: number,
  strategy: EncodeStrategy,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  await resetFFmpeg();
  const ffmpeg = await getFFmpeg(onProgress);
  const inputFile = "in.webm";
  const outputFile = "out.webm";
  await ffmpeg.writeFile(inputFile, await fetchFile(blob));

  const vf = buildFilterChain(state, strategy);
  const args = [
    "-ss", String(trimStart),
    "-i", inputFile,
    "-t", String(trimLen),
    "-map", "0:v:0",
  ];

  if (strategy.audioCodec !== "none") args.push("-map", "0:a?");
  if (vf) args.push("-vf", vf);

  if (strategy.audioCodec === "none") {
    args.push("-an");
  } else if (strategy.audioCodec === "libopus") {
    args.push("-c:a", "libopus", "-b:a", strategy.audioBitrate ?? "96k");
  } else {
    args.push("-c:a", "copy");
  }

  if (strategy.videoCodec === "copy") {
    args.push("-c:v", "copy", outputFile);
  } else {
    args.push(
      "-c:v", strategy.videoCodec,
      "-deadline", strategy.deadline ?? EDITOR_REENCODE_DEADLINE,
      "-cpu-used", strategy.cpuUsed ?? EDITOR_REENCODE_CPU_USED,
      "-b:v", strategy.videoBitrate ?? EDITOR_REENCODE_BPS,
      outputFile,
    );
  }

  await ffmpeg.exec(args);
  const out = await ffmpeg.readFile(outputFile);
  return new Blob([out as unknown as BlobPart], { type: "video/webm" });
}

export async function processVideo(
  blob: Blob,
  state: EditorState,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const s = state.trimStart;
  const e = state.trimEnd;
  const len = Math.max(0.1, Math.min(e - s, state.dur - s + 1e6));
  if (!Number.isFinite(len) || len <= 0) throw new Error("Trim range invalid");

  const fullFrame = isCropFullFrame(state);
  const needsCrop = !fullFrame;
  const hasTrimEdit = state.durationKnown
    && (s > 0.05 || state.dur - e > 0.05);
  const hasAudioEdit = state.noAudio;
  const needsReencode = needsCrop || hasTrimEdit || hasAudioEdit;

  const fastPath: EncodeStrategy = {
    label: "copy",
    videoCodec: "copy",
    audioCodec: state.noAudio ? "none" : "copy",
  };
  const primaryEncode: EncodeStrategy = {
    label: "vp9",
    videoCodec: "libvpx-vp9",
    videoBitrate: EDITOR_REENCODE_BPS,
    cpuUsed: EDITOR_REENCODE_CPU_USED,
    deadline: EDITOR_REENCODE_DEADLINE,
    audioCodec: state.noAudio ? "none" : "libopus",
    audioBitrate: "96k",
  };
  const fallbackEncode: EncodeStrategy = {
    label: "vp8-fallback",
    videoCodec: "libvpx",
    videoBitrate: "2500k",
    cpuUsed: "6",
    deadline: "realtime",
    audioCodec: state.noAudio ? "none" : "libopus",
    audioBitrate: "80k",
  };
  const fallbackScaledEncode: EncodeStrategy = {
    label: "vp8-scaled-fallback",
    videoCodec: "libvpx",
    videoBitrate: "1800k",
    cpuUsed: "8",
    deadline: "realtime",
    audioCodec: state.noAudio ? "none" : "libopus",
    audioBitrate: "64k",
    maxOutputWidth: 1280,
    maxOutputHeight: 720,
  };

  const attempts: EncodeStrategy[] = needsReencode
    ? [primaryEncode, fallbackEncode, fallbackScaledEncode]
    : [fastPath];

  let lastErr: unknown = null;
  const totalAttempts = attempts.length;
  for (let i = 0; i < attempts.length; i += 1) {
    const strategy = attempts[i]!;
    try {
      const out = await runFfmpegAttempt(
        blob,
        state,
        s,
        len,
        strategy,
        (pct) => {
          // Keep UI progress monotonic across retries: each attempt owns a range.
          const base = Math.floor((i * 100) / totalAttempts);
          const span = Math.ceil(100 / totalAttempts);
          const mapped = Math.min(99, base + Math.floor((Math.max(0, Math.min(100, pct)) * span) / 100));
          onProgress?.(mapped);
        },
      );
      onProgress?.(100);
      return out;
    } catch (err) {
      lastErr = err;
      const canRetry = i < attempts.length - 1;
      if (!canRetry) break;
      // Always retry edited outputs with safer strategies; OOM is the common case.
      if (!isWasmOutOfMemoryError(err) && !needsReencode) break;
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "Unknown error");
  throw new Error(`Processing failed after fallback attempts: ${detail}`);
}
