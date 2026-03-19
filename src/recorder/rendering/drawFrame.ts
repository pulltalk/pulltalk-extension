import type { CompositorVisualState } from "./types";
import type { VirtualBackgroundProcessor } from "../virtualBackground";
import { PULSE_MS, easeOutCubic, clampCenter } from "./math";

export type DrawFrameContext = {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement;
  cameraVideo: HTMLVideoElement | null;
  outputW: number;
  outputH: number;
  visual: CompositorVisualState;
  mouseN: { x: number; y: number };
  currentCenterSrc: { x: number; y: number };
  targetCenterSrc: { x: number; y: number };
  zoomSmooth: number;
  panSmoothNx: number;
  panSmoothNy: number;
  virtualBgMain: VirtualBackgroundProcessor | null;
  virtualBgPip: VirtualBackgroundProcessor | null;
};

export function drawFrame(c: DrawFrameContext): void {
  const { ctx, visual, outputW, outputH, video, cameraVideo } = c;
  const intrinsicW = video.videoWidth;
  const intrinsicH = video.videoHeight;
  const layoutW = intrinsicW >= 2 ? intrinsicW : Math.max(1, outputW);
  const layoutH = intrinsicH >= 2 ? intrinsicH : Math.max(1, outputH);
  const mainPaintReady =
    intrinsicW >= 2 &&
    intrinsicH >= 2 &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  const z = Math.max(1, Math.min(4, c.zoomSmooth));
  const halfSrcW = layoutW / (2 * z);
  const halfSrcH = layoutH / (2 * z);
  c.currentCenterSrc.x += (c.targetCenterSrc.x - c.currentCenterSrc.x) * 0.15;
  c.currentCenterSrc.y += (c.targetCenterSrc.y - c.currentCenterSrc.y) * 0.15;
  const panX = c.panSmoothNx * layoutW * 0.15;
  const panY = c.panSmoothNy * layoutH * 0.15;
  const clamped = clampCenter(
    c.currentCenterSrc.x + panX,
    c.currentCenterSrc.y + panY,
    halfSrcW, halfSrcH, layoutW, layoutH,
  );

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outputW, outputH);

  if (mainPaintReady) {
    let src: CanvasImageSource = video;
    if (c.virtualBgMain) {
      c.virtualBgMain.tick(video);
      if (c.virtualBgMain.hasFrame()) src = c.virtualBgMain.getOutputCanvas();
    }
    ctx.drawImage(
      src,
      clamped.x - halfSrcW, clamped.y - halfSrcH,
      halfSrcW * 2, halfSrcH * 2,
      0, 0, outputW, outputH,
    );
  } else {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, outputW, outputH);
    ctx.fillStyle = "#8b949e";
    ctx.font = `600 ${Math.max(14, Math.round(outputW * 0.018))}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Waiting for screen capture…", outputW / 2, outputH / 2);
  }

  const mx = c.mouseN.x * outputW;
  const my = c.mouseN.y * outputH;

  if (visual.spotlight) {
    const r = visual.spotlightRadius * Math.min(outputW, outputH);
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, r * 2.2);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.35, "rgba(0,0,0,0.15)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, outputW, outputH);
  }

  drawStrokes(ctx, visual, outputW, outputH);
  drawArrows(ctx, visual, outputW, outputH);
  drawShapes(ctx, visual, outputW, outputH);
  drawTexts(ctx, visual, outputW, outputH);
  drawClickPulses(ctx, visual, outputW, outputH);

  if (visual.cursorRing) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, 15, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawPip(ctx, cameraVideo, c.virtualBgPip, outputW, outputH);
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  visual: CompositorVisualState,
  w: number, h: number,
): void {
  for (const s of visual.strokes) {
    if (s.points.length < 2) continue;
    if (s.highlighter) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(s.width, 22);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
    }
    ctx.stroke();
    if (s.highlighter) ctx.restore();
  }
}

function drawArrows(
  ctx: CanvasRenderingContext2D,
  visual: CompositorVisualState,
  w: number, h: number,
): void {
  for (const a of visual.arrows) {
    const x1 = a.x1 * w, y1 = a.y1 * h;
    const x2 = a.x2 * w, y2 = a.y2 * h;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const head = Math.min(24, len * 0.15);
    ctx.strokeStyle = a.color;
    ctx.fillStyle = a.color;
    ctx.lineWidth = a.width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
    ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  }
}

function drawShapes(
  ctx: CanvasRenderingContext2D,
  visual: CompositorVisualState,
  w: number, h: number,
): void {
  for (const sh of visual.shapes) {
    const x = sh.x * w, y = sh.y * h;
    const sw = sh.w * w, sh2 = sh.h * h;
    ctx.lineWidth = sh.strokeWidth;
    ctx.strokeStyle = sh.color;
    if (sh.fill) {
      ctx.fillStyle = sh.color.length === 7 ? `${sh.color}33` : "rgba(88,166,255,0.2)";
    }
    ctx.beginPath();
    if (sh.kind === "rect") {
      ctx.rect(x, y, sw, sh2);
    } else {
      ctx.ellipse(x + sw / 2, y + sh2 / 2, Math.abs(sw) / 2, Math.abs(sh2) / 2, 0, 0, Math.PI * 2);
    }
    if (sh.fill) ctx.fill();
    ctx.stroke();
  }
}

function drawTexts(
  ctx: CanvasRenderingContext2D,
  visual: CompositorVisualState,
  w: number, h: number,
): void {
  for (const tx of visual.texts) {
    ctx.font = `600 ${tx.fontPx}px system-ui,sans-serif`;
    ctx.fillStyle = tx.color;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 3;
    const px = tx.x * w, py = tx.y * h;
    ctx.strokeText(tx.text, px, py);
    ctx.fillText(tx.text, px, py);
  }
}

function drawClickPulses(
  ctx: CanvasRenderingContext2D,
  visual: CompositorVisualState,
  w: number, h: number,
): void {
  const now = performance.now();
  for (const p of visual.clickPulses) {
    const u = easeOutCubic(Math.min(1, (now - p.start) / PULSE_MS));
    const rad = 12 + 48 * u;
    const alpha = 1 - u;
    ctx.strokeStyle = `rgba(56,139,253,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPip(
  ctx: CanvasRenderingContext2D,
  cameraVideo: HTMLVideoElement | null,
  virtualBgPip: VirtualBackgroundProcessor | null,
  outputW: number, outputH: number,
): void {
  if (!cameraVideo || cameraVideo.readyState < 2) return;
  const cw = cameraVideo.videoWidth || 320;
  const ch = cameraVideo.videoHeight || 240;
  const pipSize = Math.min(280, outputW * 0.22);
  const pipR = pipSize / 2;
  const pipCx = outputW - pipR - 16;
  const pipCy = outputH - pipR - 16;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.arc(pipCx, pipCy, pipR + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pipCx, pipCy, pipR, 0, Math.PI * 2);
  ctx.clip();

  const srcSquare = Math.min(cw, ch);
  const sx = (cw - srcSquare) / 2;
  const sy = (ch - srcSquare) / 2;
  const dx = pipCx - pipR;
  const dy = pipCy - pipR;

  if (virtualBgPip) {
    virtualBgPip.tick(cameraVideo);
    if (virtualBgPip.hasFrame()) {
      ctx.drawImage(virtualBgPip.getOutputCanvas(), sx, sy, srcSquare, srcSquare, dx, dy, pipSize, pipSize);
    } else {
      ctx.drawImage(cameraVideo, sx, sy, srcSquare, srcSquare, dx, dy, pipSize, pipSize);
    }
  } else {
    ctx.drawImage(cameraVideo, sx, sy, srcSquare, srcSquare, dx, dy, pipSize, pipSize);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pipCx, pipCy, pipR, 0, Math.PI * 2);
  ctx.stroke();
}
