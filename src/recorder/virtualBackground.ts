import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import type { VirtualBgEffect } from "@/shared/messages";

const locateFile = (file: string): string =>
  chrome.runtime.getURL(`mediapipe/${file}`);

export class VirtualBackgroundProcessor {
  private seg: SelfieSegmentation | null = null;
  private out: HTMLCanvasElement;
  private tmp: HTMLCanvasElement;
  private ready = false;
  private lastW = 0;
  private lastH = 0;

  constructor(
    private readonly bgColor: string,
    private readonly effect: VirtualBgEffect = "color",
  ) {
    this.out = document.createElement("canvas");
    this.tmp = document.createElement("canvas");
  }

  async init(): Promise<void> {
    const seg = new SelfieSegmentation({ locateFile });
    seg.setOptions({ modelSelection: 1 });
    seg.onResults((results) => {
      const w = results.image.width;
      const h = results.image.height;
      if (this.out.width !== w || this.out.height !== h) {
        this.out.width = w;
        this.out.height = h;
        this.tmp.width = w;
        this.tmp.height = h;
      }
      const tctx = this.tmp.getContext("2d")!;
      const octx = this.out.getContext("2d")!;

      if (this.effect === "blur") {
        // Build foreground person cutout in tmp first.
        tctx.save();
        tctx.clearRect(0, 0, w, h);
        tctx.drawImage(results.segmentationMask, 0, 0, w, h);
        tctx.globalCompositeOperation = "source-in";
        tctx.drawImage(results.image, 0, 0, w, h);
        tctx.restore();

        // Draw blurred full frame as background, then place subject on top.
        octx.save();
        octx.clearRect(0, 0, w, h);
        octx.filter = "blur(14px)";
        octx.drawImage(results.image, 0, 0, w, h);
        octx.restore();
        octx.drawImage(this.tmp, 0, 0);
      } else {
        tctx.save();
        tctx.clearRect(0, 0, w, h);
        tctx.drawImage(results.segmentationMask, 0, 0, w, h);
        tctx.globalCompositeOperation = "source-in";
        tctx.drawImage(results.image, 0, 0, w, h);
        tctx.restore();
        octx.fillStyle = this.bgColor;
        octx.fillRect(0, 0, w, h);
        octx.drawImage(this.tmp, 0, 0);
      }
      this.ready = true;
    });
    await seg.initialize();
    this.seg = seg;
  }

  async close(): Promise<void> {
    await this.seg?.close();
    this.seg = null;
    this.ready = false;
  }

  /** Fire-and-forget; draws last good frame until next result */
  tick(video: HTMLVideoElement): void {
    if (!this.seg || video.readyState < 2) {
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w < 2 || h < 2) {
      return;
    }
    void this.seg.send({ image: video });
  }

  drawLast(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    if (this.ready && this.out.width > 0) {
      ctx.drawImage(this.out, dx, dy, dw, dh);
    }
  }

  hasFrame(): boolean {
    return this.ready && this.out.width > 0;
  }

  getOutputCanvas(): HTMLCanvasElement {
    return this.out;
  }
}
