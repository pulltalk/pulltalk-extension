/**
 * Single pipeline for "Process & upload": same logic for tab / window / screen recordings
 * (all land in the editor with a Blob). Chooses in-browser ffmpeg.wasm vs server transcode.
 */

import { processVideo, type ProcessVideoOptions } from "./ffmpegProcessor";
import { chooseUploadBackend } from "./uploadPolicy";
import type { EditorState, PrMeta } from "./editorState";
import { isCropFullFrame } from "./editorState";
import {
  ensureAnonymousFirebaseAuth,
  getFirebaseFirestore,
  isFirebaseConfigured,
  isServerTranscodeEnabled,
} from "@/storage/firebase";
import {
  buildStagingSourcePath,
  createTranscodeJobDocument,
  waitForTranscodeJob,
  type TranscodeEditPayload,
} from "@/storage/transcodeJob";
import { uploadStagingWebm } from "@/storage/stagingUpload";

const TRANSCODE_TIMEOUT_MS = 10 * 60 * 1000;

const STAGING_UPLOAD_MAX_RETRIES = 2;

export type EditedRecordingResult =
  | { backend: "wasm"; blob: Blob }
  | { backend: "server"; downloadUrl: string };

export function isServerTranscodeAvailable(): boolean {
  return isFirebaseConfigured() && isServerTranscodeEnabled();
}

export function serverTranscodeRequiredMessage(): string {
  return (
    "This clip is too large to process in the browser. "
    + 'Try a shorter recording or use "Upload without edits".'
  );
}

function computeNeedsReencode(state: EditorState): {
  needsReencode: boolean;
  needsCrop: boolean;
} {
  const needsCrop = !isCropFullFrame(state);
  // Only crop forces a re-encode. Trim and strip-audio use stream copy (instant).
  const needsReencode = needsCrop;
  return { needsReencode, needsCrop };
}

async function uploadStagingWithRetry(
  blob: Blob,
  storagePath: string,
  onStage?: ProcessVideoOptions["onStage"],
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= STAGING_UPLOAD_MAX_RETRIES; attempt++) {
    try {
      await uploadStagingWebm(blob, storagePath);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < STAGING_UPLOAD_MAX_RETRIES) {
        onStage?.(`Upload failed, retrying (${attempt + 1}/${STAGING_UPLOAD_MAX_RETRIES})…`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`Failed to upload video for server processing after ${STAGING_UPLOAD_MAX_RETRIES + 1} attempts: ${msg}`);
}

/**
 * Prepares an edited recording for PR upload: either encodes with wasm or uploads to staging
 * and waits for the Cloud Function to produce the final WebM URL.
 */
export async function prepareEditedVideoForUpload(
  blob: Blob,
  state: EditorState,
  prMeta: PrMeta,
  processOptions: ProcessVideoOptions,
): Promise<EditedRecordingResult> {
  const { needsReencode, needsCrop } = computeNeedsReencode(state);

  if (!needsReencode) {
    return { backend: "wasm", blob };
  }

  const backend = chooseUploadBackend({
    blobBytes: blob.size,
    vNatW: state.vNatW,
    vNatH: state.vNatH,
    hasCrop: needsCrop,
    needsReencode,
  });

  if (backend === "server") {
    if (!isServerTranscodeAvailable()) {
      throw new Error(serverTranscodeRequiredMessage());
    }

    processOptions.onStage?.("Authenticating…");
    processOptions.onProgress?.(2);

    let uid: string;
    try {
      uid = await ensureAnonymousFirebaseAuth();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Authentication failed — check that Firebase Anonymous Auth is enabled. (${detail})`);
    }

    processOptions.onStage?.("Uploading for server processing…");
    processOptions.onProgress?.(5);

    let db;
    try {
      db = getFirebaseFirestore();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Firestore init failed — check Firebase config. (${detail})`);
    }

    const jobId = crypto.randomUUID();

    const edit: TranscodeEditPayload = {
      trimStart: state.trimStart,
      trimEnd: state.trimEnd,
      dur: state.dur,
      cropX: state.cropX,
      cropY: state.cropY,
      cropW: state.cropW,
      cropH: state.cropH,
      vNatW: state.vNatW,
      vNatH: state.vNatH,
      noAudio: state.noAudio,
    };

    try {
      await createTranscodeJobDocument(db, jobId, uid, prMeta, edit);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Could not create server job — check Firestore rules. (${detail})`);
    }

    const storagePath = buildStagingSourcePath(uid, jobId);
    await uploadStagingWithRetry(blob, storagePath, processOptions.onStage);

    processOptions.onProgress?.(25);
    processOptions.onStage?.("Processing on server…", { indeterminate: true });

    let downloadUrl: string;
    try {
      downloadUrl = await waitForTranscodeJob(db, jobId, TRANSCODE_TIMEOUT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/timed out/i.test(msg)) {
        throw new Error(
          "Server processing timed out after 10 minutes. "
          + "The Cloud Function may have cold-started or the clip is very large. "
          + 'Try again or use "Upload without edits".',
        );
      }
      throw new Error(`Server processing failed: ${msg}`);
    }

    processOptions.onProgress?.(100);
    return { backend: "server", downloadUrl };
  }

  const outBlob = await processVideo(blob, state, processOptions);
  return { backend: "wasm", blob: outBlob };
}

/**
 * Facade name aligned with architecture docs (raw vs edited both use storage upload + PR notify).
 * Edited path calls {@link prepareEditedVideoForUpload}.
 */
export async function prepareRecordingForUpload(
  input: { kind: "raw"; blob: Blob },
): Promise<{ kind: "raw"; blob: Blob }>;
export async function prepareRecordingForUpload(
  input: {
    kind: "edited";
    blob: Blob;
    state: EditorState;
    prMeta: PrMeta;
    processOptions: ProcessVideoOptions;
  },
): Promise<EditedRecordingResult>;
export async function prepareRecordingForUpload(
  input:
    | { kind: "raw"; blob: Blob }
    | {
        kind: "edited";
        blob: Blob;
        state: EditorState;
        prMeta: PrMeta;
        processOptions: ProcessVideoOptions;
      },
): Promise<EditedRecordingResult | { kind: "raw"; blob: Blob }> {
  if (input.kind === "raw") {
    return { kind: "raw", blob: input.blob };
  }
  return prepareEditedVideoForUpload(
    input.blob,
    input.state,
    input.prMeta,
    input.processOptions,
  );
}
