/**
 * Injected into the tab being recorded (tab-capture mode).
 * Full annotation tools + drawing canvas overlay.
 * The PullTalk recorder tab shows only Stop & timer.
 *
 * The drawing canvas sits at a high z-index so annotations are visible
 * in the tab-capture stream and therefore appear in the final recording.
 */

import {
  getRecordingCapsuleStackHtml,
  getRecordingCapsuleStyles,
  wireRecordingCapsuleUi,
  type RecordingCapsuleTool,
} from "../shared/recordingCapsuleUi";
import { PULLTALK_TARGET_CAPSULE_HIDDEN_KEY } from "../shared/storageKeys";

const HOST_ID = "pulltalk-recording-target-overlay";
const DRAW_CANVAS_ID = "pulltalk-draw-canvas";
const TEXT_POP_ID = "pulltalk-overlay-text-pop";

let teardown: (() => void) | null = null;

type G = Window & { __pulltalkOverlayUnmount?: () => void };

/* ── Lightweight annotation types (mirrors compositor, standalone) ── */

type Pt = { x: number; y: number };

interface Stroke {
  points: Pt[];
  color: string;
  width: number;
  highlighter: boolean;
  scrollX: number;
  scrollY: number;
}

interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  scrollX: number;
  scrollY: number;
}

interface Shape {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth: number;
  fill: boolean;
  scrollX: number;
  scrollY: number;
}

interface TextLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  fontPx: number;
  scrollX: number;
  scrollY: number;
}

/* ── CSS for the capsule positioning ── */

const FLOAT_CSS = `
  #pt-capsule-float {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 2;
    pointer-events: auto;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    max-width: 96vw;
  }
`;

/* ── Main mount ── */

function mount(): void {
  (globalThis as unknown as G).__pulltalkOverlayUnmount?.();
  document.getElementById(HOST_ID)?.remove();
  document.getElementById(DRAW_CANVAS_ID)?.remove();

  const started = Date.now();
  let raf = 0;

  /* ── Drawing state ── */
  let tool: RecordingCapsuleTool = "none";
  let drawColor = "#19e619";
  const strokes: Stroke[] = [];
  const arrows: Arrow[] = [];
  const shapes: Shape[] = [];
  const texts: TextLabel[] = [];
  let currentStroke: Stroke | null = null;
  let arrowStart: Pt | null = null;
  let shapeStart: Pt | null = null;

  /* ── Undo / redo ── */

  type AnnotationAction =
    | { kind: "add-stroke"; item: Stroke }
    | { kind: "add-arrow"; item: Arrow }
    | { kind: "add-shape"; item: Shape }
    | { kind: "add-text"; item: TextLabel }
    | { kind: "clear"; strokes: Stroke[]; arrows: Arrow[]; shapes: Shape[]; texts: TextLabel[] };

  const undoStack: AnnotationAction[] = [];
  const redoStack: AnnotationAction[] = [];

  function removeFromArray<T>(arr: T[], item: T): void {
    const idx = arr.indexOf(item);
    if (idx !== -1) arr.splice(idx, 1);
  }

  function pushAction(action: AnnotationAction): void {
    undoStack.push(action);
    redoStack.length = 0;
  }

  function applyAction(action: AnnotationAction): void {
    switch (action.kind) {
      case "add-stroke": strokes.push(action.item); break;
      case "add-arrow": arrows.push(action.item); break;
      case "add-shape": shapes.push(action.item); break;
      case "add-text": texts.push(action.item); break;
      case "clear":
        strokes.length = 0;
        arrows.length = 0;
        shapes.length = 0;
        texts.length = 0;
        break;
    }
  }

  function reverseAction(action: AnnotationAction): void {
    switch (action.kind) {
      case "add-stroke": removeFromArray(strokes, action.item); break;
      case "add-arrow": removeFromArray(arrows, action.item); break;
      case "add-shape": removeFromArray(shapes, action.item); break;
      case "add-text": removeFromArray(texts, action.item); break;
      case "clear":
        strokes.push(...action.strokes);
        arrows.push(...action.arrows);
        shapes.push(...action.shapes);
        texts.push(...action.texts);
        break;
    }
  }

  function performUndo(): void {
    const action = undoStack.pop();
    if (!action) return;
    reverseAction(action);
    redoStack.push(action);
  }

  function performRedo(): void {
    const action = redoStack.pop();
    if (!action) return;
    applyAction(action);
    undoStack.push(action);
  }

  /* ── Drawing canvas (outside shadow DOM so tab-capture sees it) ── */

  const drawCanvas = document.createElement("canvas");
  drawCanvas.id = DRAW_CANVAS_ID;
  Object.assign(drawCanvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "2147483645",
    pointerEvents: "none",
    cursor: "default",
  } as Partial<CSSStyleDeclaration>);

  function resizeCanvas(): void {
    drawCanvas.width = window.innerWidth * devicePixelRatio;
    drawCanvas.height = window.innerHeight * devicePixelRatio;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  /* ── Render annotations onto the canvas ── */

  function renderAnnotations(): void {
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;

    const dpr = devicePixelRatio;
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const curSX = window.scrollX;
    const curSY = window.scrollY;

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      const dx = s.scrollX - curSX;
      const dy = s.scrollY - curSY;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.highlighter) ctx.globalAlpha = 0.35;
      ctx.moveTo(s.points[0].x * cw + dx, s.points[0].y * ch + dy);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * cw + dx, s.points[i].y * ch + dy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const a of arrows) {
      const dx = a.scrollX - curSX;
      const dy = a.scrollY - curSY;
      const x1 = a.x1 * cw + dx;
      const y1 = a.y1 * ch + dy;
      const x2 = a.x2 * cw + dx;
      const y2 = a.y2 * ch + dy;
      ctx.beginPath();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.width;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const hl = 14;
      ctx.beginPath();
      ctx.fillStyle = a.color;
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - hl * Math.cos(angle - 0.4),
        y2 - hl * Math.sin(angle - 0.4)
      );
      ctx.lineTo(
        x2 - hl * Math.cos(angle + 0.4),
        y2 - hl * Math.sin(angle + 0.4)
      );
      ctx.closePath();
      ctx.fill();
    }

    for (const sh of shapes) {
      const dx = sh.scrollX - curSX;
      const dy = sh.scrollY - curSY;
      ctx.strokeStyle = sh.color;
      ctx.lineWidth = sh.strokeWidth;
      ctx.strokeRect(sh.x * cw + dx, sh.y * ch + dy, sh.w * cw, sh.h * ch);
      if (sh.fill) {
        ctx.fillStyle = sh.color;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(sh.x * cw + dx, sh.y * ch + dy, sh.w * cw, sh.h * ch);
        ctx.globalAlpha = 1;
      }
    }

    for (const t of texts) {
      const dx = t.scrollX - curSX;
      const dy = t.scrollY - curSY;
      ctx.font = `bold ${t.fontPx}px system-ui, sans-serif`;
      const metrics = ctx.measureText(t.text);
      const pad = 4;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(
        t.x * cw + dx - pad,
        t.y * ch + dy - pad,
        metrics.width + pad * 2,
        t.fontPx + pad * 2
      );
      ctx.fillStyle = t.color;
      ctx.textBaseline = "top";
      ctx.fillText(t.text, t.x * cw + dx, t.y * ch + dy);
    }

    ctx.restore();
  }

  /* ── Tool-dependent pointer-events on the canvas ── */

  function updateCanvasPointerEvents(): void {
    if (tool === "none") {
      drawCanvas.style.pointerEvents = "none";
      drawCanvas.style.cursor = "default";
    } else {
      drawCanvas.style.pointerEvents = "auto";
      drawCanvas.style.cursor = tool === "text" ? "text" : "crosshair";
    }
  }

  /* ── Canvas pointer handlers ── */

  let downScrollX = 0;
  let downScrollY = 0;

  drawCanvas.addEventListener("pointerdown", (e) => {
    const nx = e.clientX / window.innerWidth;
    const ny = e.clientY / window.innerHeight;
    downScrollX = window.scrollX;
    downScrollY = window.scrollY;

    if (tool === "draw" || tool === "highlight") {
      currentStroke = {
        points: [{ x: nx, y: ny }],
        color: drawColor,
        width: tool === "highlight" ? 28 : 3,
        highlighter: tool === "highlight",
        scrollX: downScrollX,
        scrollY: downScrollY,
      };
      strokes.push(currentStroke);
    }
    if (tool === "arrow") {
      arrowStart = { x: nx, y: ny };
    }
    if (tool === "rect") {
      shapeStart = { x: nx, y: ny };
    }
  });

  drawCanvas.addEventListener("pointermove", (e) => {
    if (
      (tool === "draw" || tool === "highlight") &&
      currentStroke &&
      e.buttons
    ) {
      const nx = e.clientX / window.innerWidth;
      const ny = e.clientY / window.innerHeight;
      currentStroke.points.push({ x: nx, y: ny });
    }
  });

  drawCanvas.addEventListener("pointerup", (e) => {
    const nx = e.clientX / window.innerWidth;
    const ny = e.clientY / window.innerHeight;
    const finishedStroke = currentStroke;
    currentStroke = null;

    if (finishedStroke) {
      pushAction({ kind: "add-stroke", item: finishedStroke });
    }

    if (tool === "arrow" && arrowStart) {
      const a: Arrow = {
        x1: arrowStart.x,
        y1: arrowStart.y,
        x2: nx,
        y2: ny,
        color: drawColor,
        width: 3,
        scrollX: downScrollX,
        scrollY: downScrollY,
      };
      arrows.push(a);
      pushAction({ kind: "add-arrow", item: a });
      arrowStart = null;
    }
    if (tool === "rect" && shapeStart) {
      const sh: Shape = {
        kind: "rect",
        x: Math.min(shapeStart.x, nx),
        y: Math.min(shapeStart.y, ny),
        w: Math.abs(nx - shapeStart.x),
        h: Math.abs(ny - shapeStart.y),
        color: drawColor,
        strokeWidth: 3,
        fill: false,
        scrollX: downScrollX,
        scrollY: downScrollY,
      };
      shapes.push(sh);
      pushAction({ kind: "add-shape", item: sh });
      shapeStart = null;
    }
  });

  drawCanvas.addEventListener("dblclick", (ev) => {
    if (tool !== "text") return;
    ev.preventDefault();
    const nx = ev.clientX / window.innerWidth;
    const ny = ev.clientY / window.innerHeight;
    const sx = window.scrollX;
    const sy = window.scrollY;
    openTextPopover(ev.clientX, ev.clientY, (t) => {
      const label: TextLabel = { x: nx, y: ny, text: t, color: drawColor, fontPx: 22, scrollX: sx, scrollY: sy };
      texts.push(label);
      pushAction({ kind: "add-text", item: label });
    });
  });

  /* ── Inline text popover ── */

  function openTextPopover(
    cx: number,
    cy: number,
    onCommit: (text: string) => void
  ): void {
    document.getElementById(TEXT_POP_ID)?.remove();

    const margin = 12;
    const popW = 280;
    const left = Math.min(
      Math.max(margin, cx - popW / 2),
      window.innerWidth - popW - margin
    );
    const top = Math.min(
      Math.max(margin, cy + margin),
      window.innerHeight - 120 - margin
    );

    const wrap = document.createElement("div");
    wrap.id = TEXT_POP_ID;
    Object.assign(wrap.style, {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      zIndex: "2147483647",
      width: `${popW}px`,
      background: "#161b22",
      border: "1px solid #30363d",
      borderRadius: "10px",
      padding: "10px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontFamily: "system-ui, sans-serif",
      pointerEvents: "auto",
    } as Partial<CSSStyleDeclaration>);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Label text";
    Object.assign(input.style, {
      width: "100%",
      boxSizing: "border-box",
      padding: "8px 10px",
      borderRadius: "6px",
      border: "1px solid #30363d",
      background: "#0d1117",
      color: "#e6edf3",
      fontSize: "14px",
    } as Partial<CSSStyleDeclaration>);

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      gap: "8px",
      justifyContent: "flex-end",
    } as Partial<CSSStyleDeclaration>);

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Cancel";
    Object.assign(btnCancel.style, {
      padding: "6px 12px",
      borderRadius: "6px",
      border: "1px solid #30363d",
      background: "#21262d",
      color: "#c9d1d9",
      cursor: "pointer",
      fontSize: "13px",
    } as Partial<CSSStyleDeclaration>);

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.textContent = "Add";
    Object.assign(btnOk.style, {
      padding: "6px 14px",
      borderRadius: "6px",
      border: "none",
      background: "#238636",
      color: "#fff",
      fontWeight: "600",
      cursor: "pointer",
      fontSize: "13px",
    } as Partial<CSSStyleDeclaration>);

    const removePopover = (): void => {
      window.removeEventListener("keydown", onKey, true);
      wrap.remove();
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") removePopover();
    };

    btnCancel.addEventListener("click", removePopover);
    btnOk.addEventListener("click", () => {
      const v = input.value.trim();
      removePopover();
      if (v) onCommit(v);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnOk.click();
      }
    });

    window.addEventListener("keydown", onKey, true);
    row.append(btnCancel, btnOk);
    wrap.append(input, row);
    document.documentElement.appendChild(wrap);
    void input.focus();
  }

  /* ── Capsule host (shadow DOM for style isolation) ── */

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-pulltalk-overlay", "1");
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483646",
    pointerEvents: "none",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  });

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>${FLOAT_CSS}</style>
    <style>${getRecordingCapsuleStyles()}</style>
    <div id="pt-capsule-float">${getRecordingCapsuleStackHtml()}</div>
  `;

  const floatHost = shadow.getElementById("pt-capsule-float") as HTMLElement;

  const capsuleWire = wireRecordingCapsuleUi(shadow, floatHost, {
    onStop: () => {
      void chrome.runtime.sendMessage({
        type: "pulltalk-stop-from-target-overlay",
      });
    },
    onToolChange: (t) => {
      tool = t;
      updateCanvasPointerEvents();
    },
    onClearAnnotations: () => {
      if (strokes.length || arrows.length || shapes.length || texts.length) {
        pushAction({
          kind: "clear",
          strokes: [...strokes],
          arrows: [...arrows],
          shapes: [...shapes],
          texts: [...texts],
        });
        strokes.length = 0;
        arrows.length = 0;
        shapes.length = 0;
        texts.length = 0;
      }
    },
    onUndo: () => performUndo(),
    onRedo: () => performRedo(),
    getDrawColor: () => drawColor,
    setDrawColor: (c) => {
      drawColor = c;
    },
    capsuleLayout: "default",
  });

  /* ── Toggle capsule visibility with H + undo/redo shortcuts ── */

  let capsuleVisible = true;
  const applyCapsuleVisibility = (): void => {
    host.style.visibility = capsuleVisible ? "visible" : "hidden";
    host.style.pointerEvents = "none";
    floatHost.style.pointerEvents = capsuleVisible ? "auto" : "none";
  };
  applyCapsuleVisibility();
  void chrome.storage.session
    .get(PULLTALK_TARGET_CAPSULE_HIDDEN_KEY)
    .then((r) => {
      capsuleVisible = !(r[PULLTALK_TARGET_CAPSULE_HIDDEN_KEY] as boolean | undefined);
      applyCapsuleVisibility();
    })
    .catch(() => {
      /* ignore storage read failures */
    });

  const onKeydown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement)?.tagName;
    const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      performUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      performRedo();
      return;
    }

    if (isInput) return;
    if (e.key === "h" || e.key === "H") {
      capsuleVisible = !capsuleVisible;
      applyCapsuleVisibility();
      void chrome.storage.session
        .set({ [PULLTALK_TARGET_CAPSULE_HIDDEN_KEY]: !capsuleVisible })
        .catch(() => {
          /* ignore storage write failures */
        });
    }
  };
  window.addEventListener("keydown", onKeydown);

  /* ── Animation loop: timer + annotation rendering ── */

  function loop(): void {
    capsuleWire.setElapsedSeconds((Date.now() - started) / 1000);
    capsuleWire.setUndoRedoState(undoStack.length > 0, redoStack.length > 0);
    renderAnnotations();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  /* ── Attach to DOM ── */

  document.documentElement.appendChild(drawCanvas);
  document.documentElement.appendChild(host);

  /* ── Extension message handler (teardown) ── */

  const onMsg = (
    msg: { type?: string },
    _s: unknown,
    sendResponse: (x: unknown) => void
  ): boolean => {
    if (msg?.type === "pulltalk-overlay-teardown") {
      sendResponse({ ok: true });
      doTeardown();
      return true;
    }
    return false;
  };
  chrome.runtime.onMessage.addListener(onMsg);

  function doTeardown(): void {
    cancelAnimationFrame(raf);
    capsuleWire.destroy();
    chrome.runtime.onMessage.removeListener(onMsg);
    window.removeEventListener("resize", resizeCanvas);
    window.removeEventListener("keydown", onKeydown);
    drawCanvas.remove();
    host.remove();
    document.getElementById(TEXT_POP_ID)?.remove();
    teardown = null;
    delete (globalThis as unknown as G).__pulltalkOverlayUnmount;
  }

  teardown = doTeardown;
  (globalThis as unknown as G).__pulltalkOverlayUnmount = doTeardown;
}

if (chrome.runtime?.id) {
  mount();
}
