import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { EditorState } from "./editorState";
import { createEditorState, isCropFullFrame } from "./editorState";
import {
  EDITOR_REENCODE_BPS,
  EDITOR_REENCODE_CPU_USED,
  EDITOR_REENCODE_DEADLINE,
  EDITOR_WASM_TWO_PASS_MAX_H,
  EDITOR_WASM_TWO_PASS_MAX_W,
} from "@/shared/constants";
import {
  computePassAScaledDims,
  mapCropToScaledSpace,
  shouldPreferScaledSinglePassFirst,
  shouldUseTwoPassCropPipeline,
} from "./ffmpegStrategy";

let ffmpegPromise: Promise<FFmpeg> | null = null;
let ffmpegProgressSink: ((pct: number) => void) | undefined;

export type ProcessVideoOptions = {
  onProgress?: (pct: number) => void;
  /** Shown in modal eyebrow while a sub-step runs */
  onStage?: (eyebrow: string) => void;
};

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
      ffmpegProgressSink?.(Math.min(99, peak));
    }
  });
  ffmpegProgressSink = onProgress;

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
  ffmpegProgressSink = onProgress;
  if (!ffmpegPromise) {
    ffmpegPromise = loadFfmpeg(onProgress).catch((err) => {
      ffmpegPromise = null;
      ffmpegProgressSink = undefined;
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
    ffmpegProgressSink = undefined;
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

type TrimMode =
  | { kind: "segment"; start: number; len: number }
  | { kind: "full" };

async function runFfmpegAttempt(
  ffmpeg: FFmpeg,
  sourceBuffer: ArrayBuffer,
  state: EditorState,
  trim: TrimMode,
  strategy: EncodeStrategy,
): Promise<Blob> {
  const inputFile = "in.webm";
  const outputFile = "out.webm";
  await ffmpeg.writeFile(inputFile, new Uint8Array(sourceBuffer.slice(0)));

  const vf = buildFilterChain(state, strategy);
  const args: string[] = [];
  if (trim.kind === "segment") {
    args.push("-ss", String(trim.start), "-i", inputFile, "-t", String(trim.len));
  } else {
    args.push("-i", inputFile);
  }
  args.push("-map", "0:v:0");

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

  try {
    await ffmpeg.exec(args);
    const out = await ffmpeg.readFile(outputFile);
    return new Blob([out as unknown as BlobPart], { type: "video/webm" });
  } finally {
    await ffmpeg.deleteFile(outputFile).catch(() => {});
    await ffmpeg.deleteFile(inputFile).catch(() => {});
  }
}

function buildEncodeStrategies(state: EditorState, scaledFirst: boolean): EncodeStrategy[] {
  const primaryEncode: EncodeStrategy = {
    label: "vp9",
    videoCodec: "libvpx-vp9",
    videoBitrate: EDITOR_REENCODE_BPS,
    cpuUsed: "6",
    deadline: "realtime",
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
    maxOutputWidth: EDITOR_WASM_TWO_PASS_MAX_W,
    maxOutputHeight: EDITOR_WASM_TWO_PASS_MAX_H,
  };

  const ordered = scaledFirst
    ? [fallbackScaledEncode, primaryEncode, fallbackEncode]
    : [primaryEncode, fallbackEncode, fallbackScaledEncode];
  // De-dupe by label (scaled-first puts scaled first; third may duplicate scaled — avoid)
  const seen = new Set<string>();
  return ordered.filter((s) => {
    if (seen.has(s.label)) return false;
    seen.add(s.label);
    return true;
  });
}

async function runStrategyAttempts(
  sourceBuffer: ArrayBuffer,
  state: EditorState,
  trim: TrimMode,
  strategies: EncodeStrategy[],
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  let lastErr: unknown = null;
  const totalAttempts = strategies.length;
  let ffmpeg = await getFFmpeg();

  for (let i = 0; i < strategies.length; i += 1) {
    const strategy = strategies[i]!;
    try {
      ffmpeg = await getFFmpeg((pct) => {
        const base = Math.floor((i * 100) / totalAttempts);
        const span = Math.ceil(100 / totalAttempts);
        const mapped = Math.min(
          99,
          base + Math.floor((Math.max(0, Math.min(100, pct)) * span) / 100),
        );
        onProgress?.(mapped);
      });
      const out = await runFfmpegAttempt(ffmpeg, sourceBuffer, state, trim, strategy);
      onProgress?.(100);
      return out;
    } catch (err) {
      lastErr = err;
      const canRetry = i < strategies.length - 1;
      if (!canRetry) break;
      await resetFFmpeg();
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "Unknown error");
  throw new Error(`Processing failed after fallback attempts: ${detail}`);
}

function passAFullFrameState(state: EditorState): EditorState {
  return {
    ...state,
    cropX: 0,
    cropY: 0,
    cropW: state.vNatW,
    cropH: state.vNatH,
  };
}

/** Pass A tiers: smaller caps reduce wasm peak memory if a tier fails. */
const PASS_A_TIERS: readonly { maxW: number; maxH: number; bitrate: string }[] = [
  { maxW: EDITOR_WASM_TWO_PASS_MAX_W, maxH: EDITOR_WASM_TWO_PASS_MAX_H, bitrate: "2000k" },
  { maxW: 960, maxH: 540, bitrate: "1200k" },
  { maxW: 854, maxH: 480, bitrate: "800k" },
];

async function processVideoTwoPassCrop(
  sourceBuffer: ArrayBuffer,
  state: EditorState,
  trimStart: number,
  trimLen: number,
  options: ProcessVideoOptions,
): Promise<Blob> {
  const { onProgress, onStage } = options;

  onStage?.("Step 1 of 2 — trim & resize");

  const passAState = passAFullFrameState(state);
  let midBlob: Blob | null = null;
  let sw = 1;
  let sh = 1;
  let lastPassAErr: unknown = null;

  for (let t = 0; t < PASS_A_TIERS.length; t += 1) {
    const tier = PASS_A_TIERS[t]!;
    const dims = computePassAScaledDims(state.vNatW, state.vNatH, tier.maxW, tier.maxH);
    sw = dims.sw;
    sh = dims.sh;

    const passAStrategy: EncodeStrategy = {
      label: `pass-a-vp8-${tier.maxW}x${tier.maxH}`,
      videoCodec: "libvpx",
      videoBitrate: tier.bitrate,
      cpuUsed: "8",
      deadline: "realtime",
      audioCodec: state.noAudio ? "none" : "libopus",
      audioBitrate: "80k",
      maxOutputWidth: tier.maxW,
      maxOutputHeight: tier.maxH,
    };

    try {
      midBlob = await runStrategyAttempts(
        sourceBuffer,
        passAState,
        { kind: "segment", start: trimStart, len: trimLen },
        [passAStrategy],
        (p) => onProgress?.(Math.floor(p * 0.42)),
      );
      lastPassAErr = null;
      break;
    } catch (e) {
      lastPassAErr = e;
      await resetFFmpeg();
    }
  }

  if (!midBlob) {
    const detail = lastPassAErr instanceof Error ? lastPassAErr.message : String(lastPassAErr ?? "Unknown error");
    throw new Error(`Processing failed (step 1 — trim & resize): ${detail}`);
  }

  await resetFFmpeg();

  const { cx, cy, cw, ch } = mapCropToScaledSpace(state, sw, sh);

  const midBuffer = await midBlob.arrayBuffer();
  const passBDur = trimLen;
  const passBBase = createEditorState(sw, sh);
  const passBState: EditorState = {
    ...passBBase,
    cropX: cx,
    cropY: cy,
    cropW: cw,
    cropH: ch,
    trimStart: 0,
    trimEnd: passBDur,
    dur: passBDur,
    durationKnown: true,
    noAudio: state.noAudio,
    uploadInFlight: false,
    cropActive: state.cropActive,
  };

  onStage?.("Step 2 of 2 — crop & encode");

  const passBStrategies = buildEncodeStrategies(passBState, false);
  return runStrategyAttempts(
    midBuffer,
    passBState,
    { kind: "full" },
    passBStrategies,
    (p) => onProgress?.(42 + Math.floor(p * 0.58)),
  );
}

function normalizeProcessOptions(
  third?: ProcessVideoOptions | ((pct: number) => void),
): ProcessVideoOptions {
  if (typeof third === "function") {
    return { onProgress: third };
  }
  return third ?? {};
}

export async function processVideo(
  blob: Blob,
  state: EditorState,
  third?: ProcessVideoOptions | ((pct: number) => void),
): Promise<Blob> {
  const { onProgress, onStage } = normalizeProcessOptions(third);
  const sourceBuffer = await blob.arrayBuffer();
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

  if (!needsReencode) {
    return runStrategyAttempts(
      sourceBuffer,
      state,
      { kind: "segment", start: s, len: len },
      [fastPath],
      onProgress,
    );
  }

  const twoPass = shouldUseTwoPassCropPipeline(needsReencode, needsCrop);
  if (twoPass) {
    return processVideoTwoPassCrop(sourceBuffer, state, s, len, { onProgress, onStage });
  }

  const scaledFirst = shouldPreferScaledSinglePassFirst(
    state.vNatW,
    state.vNatH,
    blob.size,
  );
  const strategies = buildEncodeStrategies(state, scaledFirst);
  if (scaledFirst) {
    onStage?.("Optimizing for browser limits (resolution)");
  }
  return runStrategyAttempts(
    sourceBuffer,
    state,
    { kind: "segment", start: s, len: len },
    strategies,
    onProgress,
  );
}
