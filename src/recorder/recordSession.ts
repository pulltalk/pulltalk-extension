import type { ExtensionMessage, StartRecordingPayload } from "@/shared/messages";
import { acquireMicStream } from "./capture";
import { LiveCompositor } from "./compositor";
import { waitForVideoReady } from "./mediaReady";
import {
  buildMixedAudioStream,
  cleanupAudioStream,
} from "./audioGraph";
import { VirtualBackgroundProcessor } from "./virtualBackground";
import { idbPutBlob, makeBlobKey } from "@/shared/idb";
import { AUDIO_BPS, RECORDING_FPS, videoBpsForResolution } from "@/shared/constants";

export class RecordSession {
  readonly compositor = new LiveCompositor();
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private displayStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private mixedAudioStream: MediaStream | null = null;
  private vbMain: VirtualBackgroundProcessor | null = null;
  private vbPip: VirtualBackgroundProcessor | null = null;
  private stopPromise: Promise<{ blobKey: string; size: number; durationMs: number }> | null =
    null;
  private recordingStartMs = 0;

  onRequestFinalize: ((p: Promise<{ blobKey: string; size: number; durationMs: number }>) => void) | null =
    null;
  clearRecordingAlarm: (() => void) | null = null;

  async start(
    payload: StartRecordingPayload,
    displayStream: MediaStream,
    cameraStream: MediaStream | null
  ): Promise<void> {
    this.displayStream = displayStream;
    this.cameraStream = cameraStream;

    this.compositor.attachDisplayStream(displayStream);

    if (cameraStream) {
      this.compositor.setCameraStream(cameraStream);
      if (payload.virtualBackground) {
        try {
          this.vbPip = new VirtualBackgroundProcessor(
            payload.virtualBgColor || "#1a1a2e",
            payload.virtualBgEffect ?? "color",
          );
          await this.vbPip.init();
          this.compositor.virtualBgPip = this.vbPip;
        } catch {
          this.vbPip = null;
        }
      }
    } else {
      this.compositor.setCameraStream(null);
    }

    const vw =
      displayStream.getVideoTracks()[0]?.getSettings?.().width ?? 1280;
    const vh =
      displayStream.getVideoTracks()[0]?.getSettings?.().height ?? 720;
    this.compositor.targetCenterSrc.x = vw / 2;
    this.compositor.targetCenterSrc.y = vh / 2;
    this.compositor.currentCenterSrc.x = vw / 2;
    this.compositor.currentCenterSrc.y = vh / 2;

    try {
      await waitForVideoReady(this.compositor.getMainVideo(), {
        label: "screen capture",
      });
      if (cameraStream) {
        const pip = this.compositor.getPipVideo();
        if (pip) {
          await waitForVideoReady(pip, { label: "camera" });
        }
      }
    } catch (e) {
      await this.cleanup();
      throw e;
    }

    const wantsMic = payload.micOn || payload.pushToTalk;
    this.micStream = await acquireMicStream(wantsMic);
    const baseForAudio = displayStream ?? new MediaStream();
    this.mixedAudioStream = buildMixedAudioStream(baseForAudio, this.micStream, {
      pushToTalk: payload.pushToTalk,
    });

    const vTrack = displayStream?.getVideoTracks()[0];
    vTrack?.addEventListener("ended", () => {
      void this.stopFromDisplayEnded();
    });

    this.compositor.startLoop();
    const canvasVideoTrack = this.compositor.getCaptureStream(RECORDING_FPS).getVideoTracks()[0];
    const audioTracks = this.mixedAudioStream.getAudioTracks();
    const combined = new MediaStream([canvasVideoTrack, ...audioTracks]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
    if (!mimeType) {
      await this.cleanup();
      throw new Error("No supported video format");
    }

    const canvasW = this.compositor.canvas.width;
    const canvasH = this.compositor.canvas.height;

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: videoBpsForResolution(canvasW, canvasH, RECORDING_FPS),
      audioBitsPerSecond: AUDIO_BPS,
    });
    this.mediaRecorder.ondataavailable = (e): void => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
    this.recordingStartMs = Date.now();
    this.mediaRecorder.start(250);
  }

  private stopFromDisplayEnded(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      const p = this.stopAndPersist();
      if (this.onRequestFinalize) {
        this.onRequestFinalize(p);
      } else {
        void p.catch((e) => {
          console.error(e);
          void chrome.runtime.sendMessage({
            type: "recording-error",
            payload: {
              message:
                e instanceof Error ? e.message : "Recording ended unexpectedly",
            },
          });
        });
      }
    }
  }

  async stopAndPersist(): Promise<{ blobKey: string; size: number; durationMs: number }> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    const mr = this.mediaRecorder;
    if (!mr || mr.state === "inactive") {
      await this.cleanup();
      throw new Error("No active recording");
    }

    const durationMs = Math.max(1, Date.now() - this.recordingStartMs);

    try { this.compositor.forceRender(); } catch { /* best-effort */ }

    this.stopPromise = new Promise((resolve, reject) => {
      mr.onstop = async (): Promise<void> => {
        try {
          void chrome.runtime.sendMessage({
            type: "pulltalk-teardown-target-overlay",
          } satisfies ExtensionMessage);
          const blob = new Blob(this.chunks, { type: "video/webm" });
          await this.cleanup();
          if (blob.size === 0) {
            reject(new Error("Empty recording"));
            return;
          }

          const blobKey = makeBlobKey();
          await idbPutBlob(blobKey, blob);
          resolve({ blobKey, size: blob.size, durationMs });
        } catch (e) {
          await this.cleanup();
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };
      mr.onerror = (): void => {
        void this.cleanup();
        reject(new Error("MediaRecorder error"));
      };
      try { mr.requestData(); } catch { /* not all states allow requestData */ }
      mr.stop();
      this.mediaRecorder = null;
    });

    return this.stopPromise;
  }

  private async cleanup(): Promise<void> {
    this.compositor.stopLoop();
    if (this.mixedAudioStream) {
      cleanupAudioStream(this.mixedAudioStream);
      this.mixedAudioStream = null;
    }
    await this.vbMain?.close();
    await this.vbPip?.close();
    this.vbMain = null;
    this.vbPip = null;
    this.compositor.virtualBgMain = null;
    this.compositor.virtualBgPip = null;

    [this.displayStream, this.cameraStream, this.micStream].forEach((s) => {
      s?.getTracks().forEach((t) => t.stop());
    });
    this.displayStream = null;
    this.cameraStream = null;
    this.micStream = null;
    this.chunks = [];
    this.mediaRecorder = null;
  }
}
