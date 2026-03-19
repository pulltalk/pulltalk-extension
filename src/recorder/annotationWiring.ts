import type {
  AnnotationArrow,
  AnnotationShape,
  AnnotationStroke,
  AnnotationText,
  LiveCompositor,
} from "./compositor";

type Tool = "none" | "draw" | "highlight" | "text" | "arrow" | "rect";

export type AnnotationAddedEvent =
  | { kind: "add-stroke"; item: AnnotationStroke }
  | { kind: "add-arrow"; item: AnnotationArrow }
  | { kind: "add-shape"; item: AnnotationShape }
  | { kind: "add-text"; item: AnnotationText };

/** Inline text entry instead of `window.prompt` (extension pages). */
function openTextLabelPopover(
  clientX: number,
  clientY: number,
  onCommit: (text: string) => void,
): void {
  document.getElementById("pulltalk-text-label-popover")?.remove();

  const margin = 12;
  const popW = 280;
  const left = Math.min(
    Math.max(margin, clientX - popW / 2),
    window.innerWidth - popW - margin,
  );
  const top = Math.min(
    Math.max(margin, clientY + margin),
    window.innerHeight - 120 - margin,
  );

  const wrap = document.createElement("div");
  wrap.id = "pulltalk-text-label-popover";
  wrap.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:2147483646;width:${popW}px;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:10px;box-shadow:0 8px 32px rgba(0,0,0,0.55);display:flex;flex-direction:column;gap:8px;font-family:system-ui,sans-serif`;

  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("aria-label", "Label text");
  input.placeholder = "Label text";
  input.style.cssText =
    "width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;justify-content:flex-end";

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.textContent = "Cancel";
  btnCancel.style.cssText =
    "padding:6px 12px;border-radius:6px;border:1px solid #30363d;background:#21262d;color:#c9d1d9;cursor:pointer;font-size:13px";

  const btnOk = document.createElement("button");
  btnOk.type = "button";
  btnOk.textContent = "Add";
  btnOk.style.cssText =
    "padding:6px 14px;border-radius:6px;border:none;background:#238636;color:#fff;font-weight:600;cursor:pointer;font-size:13px";

  const remove = (): void => {
    window.removeEventListener("keydown", onDocKey, true);
    wrap.remove();
  };
  const onDocKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") remove();
  };

  btnCancel.addEventListener("click", remove);
  btnOk.addEventListener("click", () => {
    const t = input.value.trim();
    remove();
    if (t) onCommit(t);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); btnOk.click(); }
  });

  window.addEventListener("keydown", onDocKey, true);
  row.append(btnCancel, btnOk);
  wrap.append(input, row);
  document.body.appendChild(wrap);
  void input.focus();
}

export function wireAnnotationHandlers(
  canvas: HTMLCanvasElement,
  compositor: LiveCompositor,
  getTool: () => Tool,
  getDrawColor: () => string,
  vw: () => number,
  vh: () => number,
  onAnnotationAdded?: (event: AnnotationAddedEvent) => void,
): void {
  let currentStroke: AnnotationStroke | null = null;
  let arrowStart: { x: number; y: number } | null = null;
  let shapeStart: { x: number; y: number } | null = null;
  const c = compositor;

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    c.onCanvasPointer(nx, ny, "move", vw(), vh());
    const tool = getTool();
    if ((tool === "draw" || tool === "highlight") && currentStroke && e.buttons) {
      currentStroke.points.push({ x: nx, y: ny });
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    c.onCanvasPointer(nx, ny, "down", vw(), vh());
    const tool = getTool();
    if (tool === "draw" || tool === "highlight") {
      currentStroke = {
        points: [{ x: nx, y: ny }],
        color: getDrawColor(),
        width: tool === "highlight" ? 28 : 3,
        highlighter: tool === "highlight",
      };
      c.visual.strokes.push(currentStroke);
    }
    if (tool === "arrow") arrowStart = { x: nx, y: ny };
    if (tool === "rect") shapeStart = { x: nx, y: ny };
  });

  canvas.addEventListener("pointerup", (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    c.onCanvasPointer(nx, ny, "up", vw(), vh());
    const finishedStroke = currentStroke;
    currentStroke = null;
    const tool = getTool();
    const drawColor = getDrawColor();

    if (finishedStroke) {
      onAnnotationAdded?.({ kind: "add-stroke", item: finishedStroke });
    }

    if (tool === "arrow" && arrowStart) {
      const a: AnnotationArrow = {
        x1: arrowStart.x, y1: arrowStart.y,
        x2: nx, y2: ny,
        color: drawColor, width: 3,
      };
      c.visual.arrows.push(a);
      onAnnotationAdded?.({ kind: "add-arrow", item: a });
      arrowStart = null;
    }
    if (shapeStart && tool === "rect") {
      const sh: AnnotationShape = {
        kind: "rect",
        x: Math.min(shapeStart.x, nx),
        y: Math.min(shapeStart.y, ny),
        w: Math.abs(nx - shapeStart.x),
        h: Math.abs(ny - shapeStart.y),
        color: drawColor, strokeWidth: 3, fill: false,
      };
      c.visual.shapes.push(sh);
      onAnnotationAdded?.({ kind: "add-shape", item: sh });
      shapeStart = null;
    }
  });

  canvas.addEventListener("dblclick", (ev) => {
    if (getTool() !== "text") return;
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const nx = (ev.clientX - r.left) / r.width;
    const ny = (ev.clientY - r.top) / r.height;
    openTextLabelPopover(ev.clientX, ev.clientY, (t) => {
      const txt: AnnotationText = {
        x: nx, y: ny, text: t,
        color: getDrawColor(), fontPx: 22,
      };
      c.visual.texts.push(txt);
      onAnnotationAdded?.({ kind: "add-text", item: txt });
    });
  });
}
