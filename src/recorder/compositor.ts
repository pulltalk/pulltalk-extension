/**
 * Live compositor: display (and optional camera) canvas with zoom, spotlight,
 * cursor ring, click pulses, PiP, and annotation overlay.
 */

import type { VirtualBackgroundProcessor } from "./virtualBackground";
import { createDefaultVisualState, type CompositorVisualState } from "./rendering/types";
import { PULSE_MS } from "./rendering/math";
import { drawFrame, type DrawFrameContext } from "./rendering/drawFrame";
import {
  MAX_OUTPUT_W, MAX_OUTPUT_H,
  MIN_OUTPUT_W, MIN_OUTPUT_H,
} from "@/shared/constants";

export type {
  StrokePoint,
  AnnotationStroke,
  AnnotationText,
  AnnotationArrow,
  AnnotationShape,
  CompositorVisualState,
} from "./rendering/types";

function createTickWorker(): Worker {
  const code = `let id=0;onmessage=e=>{if(e.data==='start'){if(!id)id=setInterval(()=>postMessage(0),33)}else{clearInterval(id);id=0}}`;
  return new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
}

export class LiveCompositor {
  readonly canvas: HTMLCanvasElement;
  private video: HTMLVideoElement;
  private cameraVideo: HTMLVideoElement | null = null;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private bgWorker: Worker | null = null;
  private bgWorkerHandler: ((e: MessageEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private outputW = 1280;
  private outputH = 720;
  private zoomSmooth = 1;
  private panSmoothNx = 0;
  private panSmoothNy = 0;
  visual: CompositorVisualState = createDefaultVisualState();
  mouseN = { x: 0.5, y: 0.5 };
  targetCenterSrc = { x: 640, y: 360 };
  currentCenterSrc = { x: 640, y: 360 };
  private lastFrame = 0;
  virtualBgMain: VirtualBackgroundProcessor | null = null;
  virtualBgPip: VirtualBackgroundProcessor | null = null;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.ctx.imageSmoothingQuality = "high";
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
  }

  setCameraStream(stream: MediaStream | null): void {
    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null;
      this.cameraVideo = null;
    }
    if (!stream) return;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    this.cameraVideo = v;
  }

  getMainVideo(): HTMLVideoElement { return this.video; }
  getPipVideo(): HTMLVideoElement | null { return this.cameraVideo; }

  attachDisplayStream(stream: MediaStream): void {
    this.video.srcObject = stream;
    const track = stream.getVideoTracks()[0];
    const s = track?.getSettings?.() ?? {};
    let w = s.width ?? 1280;
    let h = s.height ?? 720;

    if (w > MAX_OUTPUT_W || h > MAX_OUTPUT_H) {
      const scale = Math.min(MAX_OUTPUT_W / w, MAX_OUTPUT_H / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    if (w < MIN_OUTPUT_W || h < MIN_OUTPUT_H) {
      const scale = Math.max(MIN_OUTPUT_W / w, MIN_OUTPUT_H / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    w = w & ~1;
    h = h & ~1;

    this.outputW = w;
    this.outputH = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  getCaptureStream(fps = 30): MediaStream {
    return this.canvas.captureStream(fps);
  }

  forceRender(): void { this.renderTick(); }

  private getDrawContext(): DrawFrameContext {
    return {
      ctx: this.ctx,
      video: this.video,
      cameraVideo: this.cameraVideo,
      outputW: this.outputW,
      outputH: this.outputH,
      visual: this.visual,
      mouseN: this.mouseN,
      currentCenterSrc: this.currentCenterSrc,
      targetCenterSrc: this.targetCenterSrc,
      zoomSmooth: this.zoomSmooth,
      panSmoothNx: this.panSmoothNx,
      panSmoothNy: this.panSmoothNy,
      virtualBgMain: this.virtualBgMain,
      virtualBgPip: this.virtualBgPip,
    };
  }

  private renderTick(): void {
    const t = performance.now();
    this.lastFrame = t;
    this.zoomSmooth += (this.visual.zoom - this.zoomSmooth) * 0.12;
    this.panSmoothNx += (this.visual.panNx - this.panSmoothNx) * 0.12;
    this.panSmoothNy += (this.visual.panNy - this.panSmoothNy) * 0.12;
    drawFrame(this.getDrawContext());
    this.visual.clickPulses = this.visual.clickPulses.filter(
      (p) => t - p.start < PULSE_MS,
    );
  }

  startLoop(): void {
    const rafTick = (): void => {
      this.renderTick();
      this.raf = requestAnimationFrame(rafTick);
    };
    this.raf = requestAnimationFrame(rafTick);

    const worker = createTickWorker();
    this.bgWorker = worker;
    this.bgWorkerHandler = (): void => this.renderTick();

    const onVisibility = (): void => {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        worker.addEventListener("message", this.bgWorkerHandler!);
        worker.postMessage("start");
      } else {
        worker.postMessage("stop");
        worker.removeEventListener("message", this.bgWorkerHandler!);
        this.raf = requestAnimationFrame(rafTick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.visibilityHandler = onVisibility;

    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      worker.addEventListener("message", this.bgWorkerHandler);
      worker.postMessage("start");
    }
  }

  stopLoop(): void {
    cancelAnimationFrame(this.raf);
    if (this.bgWorker) {
      this.bgWorker.postMessage("stop");
      this.bgWorker.terminate();
      this.bgWorker = null;
      this.bgWorkerHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  onCanvasPointer(
    nx: number, ny: number,
    type: "move" | "down" | "up",
    vw: number, vh: number,
  ): void {
    this.mouseN = { x: nx, y: ny };
    const z = Math.max(1, Math.min(4, this.zoomSmooth));
    const halfSrcW = vw / (2 * z);
    const halfSrcH = vh / (2 * z);
    const cx = this.currentCenterSrc.x;
    const cy = this.currentCenterSrc.y;
    const left = cx - halfSrcW;
    const top = cy - halfSrcH;
    this.targetCenterSrc.x = Math.min(vw, Math.max(0, left + nx * 2 * halfSrcW));
    this.targetCenterSrc.y = Math.min(vh, Math.max(0, top + ny * 2 * halfSrcH));

    if (type === "down") {
      this.visual.clickPulses.push({
        x: nx, y: ny,
        start: this.lastFrame || performance.now(),
      });
    }
  }
}
