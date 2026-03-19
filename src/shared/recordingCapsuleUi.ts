/**
 * Shared shadow DOM markup + wiring for the PullTalk recording capsule
 * (recorder tab + injected target tab overlay).
 */

export type RecordingCapsuleTool =
  | "none"
  | "draw"
  | "highlight"
  | "text"
  | "arrow"
  | "rect";

export const CAPSULE_NE = "#19e619";
export const CAPSULE_RED = "#ff4b4b";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatCapsuleElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  }
  return `${pad2(m)}:${pad2(sec)}`;
}

export function getRecordingCapsuleStyles(): string {
  const NE = CAPSULE_NE;
  const RED = CAPSULE_RED;
  return `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .main {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px 10px 10px;
        background: #000;
        border: 1px solid #1a1a1a;
        border-radius: 999px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(25,230,25,0.08);
        transition: padding 0.22s ease, box-shadow 0.22s ease;
      }
      .main.minimized {
        padding: 12px 14px;
        gap: 0;
      }
      .main.minimized .main-rest {
        display: none !important;
      }
      .main-rest {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .grip {
        display: grid;
        grid-template-columns: repeat(2, 4px);
        gap: 3px 4px;
        padding: 8px 6px;
        cursor: pointer;
        border: none;
        background: transparent;
        border-radius: 8px;
        flex-shrink: 0;
        touch-action: none;
      }
      .grip.dragging { cursor: grabbing; }
      .grip span {
        width: 4px; height: 4px;
        border-radius: 50%;
        background: #444;
        pointer-events: none;
      }
      .grip:hover span, .main.minimized .grip span { background: #666; }
      .main.minimized .grip span:nth-child(odd) { background: ${NE}; opacity: 0.9; }
      .timer-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .rec-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: ${NE};
        box-shadow: 0 0 10px ${NE};
        animation: pulse 1.2s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
      .timer {
        font-size: 18px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: ${NE};
        letter-spacing: 0.02em;
      }
      .btn-stop {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border: none;
        border-radius: 999px;
        background: ${RED};
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: filter 0.15s, transform 0.1s;
      }
      .btn-stop:hover { filter: brightness(1.08); }
      .btn-stop:active { transform: scale(0.98); }
      .btn-tools {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid ${NE};
        background: #0a1a0a;
        color: ${NE};
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }
      .btn-tools:hover { background: #0f220f; }
      .btn-tools[aria-expanded="true"] { background: #0d180d; }
      .btn-tools .chev { transition: transform 0.25s ease; display: inline-block; }
      .btn-tools[aria-expanded="true"] .chev { transform: rotate(180deg); }
      .tools-panel {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        background: #000;
        border: 1px solid #1a1a1a;
        border-radius: 999px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        max-width: min(96vw, 640px);
        opacity: 0;
        max-height: 0;
        overflow: hidden;
        padding-top: 0;
        padding-bottom: 0;
        margin-top: -6px;
        transition: opacity 0.28s ease, max-height 0.32s ease,
          padding 0.28s ease, margin 0.28s ease;
      }
      .tools-panel.open {
        opacity: 1;
        max-height: 120px;
        padding: 12px 16px;
        margin-top: 0;
      }
      .main.minimized ~ .tools-panel {
        display: none;
      }
      .tool {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 1px solid #333;
        background: #111;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
      }
      .tool:hover { border-color: #555; background: #1a1a1a; }
      .tool[data-active="true"] {
        border-color: ${NE};
        color: ${NE};
        background: #0a150a;
        box-shadow: 0 0 0 2px rgba(25,230,25,0.25);
      }
      .tool[data-disabled="true"] {
        opacity: 0.3;
        cursor: default;
        pointer-events: none;
      }
      .tool svg { width: 22px; height: 22px; }
      .color-wrap {
        position: relative;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #333;
      }
      .color-wrap input {
        position: absolute;
        inset: -8px;
        width: calc(100% + 16px);
        height: calc(100% + 16px);
        cursor: pointer;
        border: none;
        padding: 0;
      }
      /* Injected overlay on the captured tab: Stop + timer only (draw on PullTalk preview). */
      .stack.target-slim .btn-tools,
      .stack.target-slim #pt-tools-panel {
        display: none !important;
      }
      .linked-only-hint {
        display: none;
        font-size: 11px;
        font-weight: 500;
        color: #8b949e;
        max-width: min(92vw, 320px);
        line-height: 1.35;
        text-align: center;
      }
      .stack.target-slim .linked-only-hint {
        display: block;
      }
      .stack.target-slim .main.minimized .linked-only-hint {
        display: none !important;
      }
      .stack.target-slim .main {
        flex-wrap: wrap;
        justify-content: center;
        max-width: min(96vw, 420px);
      }
      .stack.annotation-minimal .btn-tools,
      .stack.annotation-minimal #pt-tools-panel {
        display: none !important;
      }
    `;
}

export function getRecordingCapsuleStackHtml(): string {
  const NE = CAPSULE_NE;
  return `
    <div class="stack" id="pt-cap-stack">
      <div class="main" id="pt-main-bar">
        <button type="button" class="grip" id="pt-grip"
          aria-label="Click to collapse to handle only, or drag to move">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </button>
        <div class="main-rest">
          <div class="timer-wrap">
            <span class="rec-dot" aria-hidden="true"></span>
            <span class="timer" id="t-elapsed">00:00</span>
          </div>
          <button type="button" class="btn-stop" aria-label="Stop recording and open editor">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect width="14" height="14" rx="2" fill="currentColor"/></svg>
            Stop
          </button>
          <button type="button" class="btn-tools" aria-expanded="true" aria-controls="pt-tools-panel" id="pt-tools-toggle" aria-label="Show or hide annotation tools">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Tools
            <span class="chev" aria-hidden="true">▼</span>
          </button>
        </div>
        <div class="linked-only-hint" aria-live="polite">
          Draw on the PullTalk recorder tab (large preview). Here: Stop and timer only — scroll the recorder preview to move this page.
        </div>
      </div>
      <div class="tools-panel open" id="pt-tools-panel" role="toolbar" aria-label="Annotation tools">
        <button type="button" class="tool" data-tool="none" data-active="true" aria-label="Move view — pan with arrow keys" title="Select">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3l14 11h-7l4 8-3 1.5-4-8-4 3.5z"/></svg>
        </button>
        <button type="button" class="tool" data-tool="draw" aria-label="Draw freehand with pen" title="Pen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
        </button>
        <button type="button" class="tool" data-tool="highlight" aria-label="Highlighter marker" title="Highlight">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 11-6 6v3h9l3-3"/>
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
          </svg>
        </button>
        <button type="button" class="tool" data-tool="text" aria-label="Add text — double-click on the preview" title="Text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 4h12M12 4v16"/>
          </svg>
        </button>
        <button type="button" class="tool" data-tool="arrow" aria-label="Draw arrow" title="Arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="19" x2="19" y2="5"/>
            <polyline points="10,5 19,5 19,14"/>
          </svg>
        </button>
        <button type="button" class="tool" data-tool="rect" aria-label="Draw rectangle" title="Rectangle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="1.5"/>
          </svg>
        </button>
        <button type="button" class="tool" data-action="undo" data-disabled="true" aria-label="Undo last annotation" title="Undo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
        <button type="button" class="tool" data-action="redo" data-disabled="true" aria-label="Redo last undone annotation" title="Redo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
          </svg>
        </button>
        <button type="button" class="tool" data-action="clear" aria-label="Erase all drawings and labels" title="Clear all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
        <div class="color-wrap" title="Color">
          <input type="color" id="pt-color" aria-label="Ink and highlight color" value="${NE}" />
        </div>
      </div>
    </div>
  `;
}

export type RecordingCapsuleWireOpts = {
  onStop: () => void;
  onToolChange: (tool: RecordingCapsuleTool) => void;
  onClearAnnotations: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  getDrawColor: () => string;
  setDrawColor: (c: string) => void;
  /**
   * Injected overlay on the captured tab: timer + Stop + hint (no Tools row).
   * Full annotation UI stays on the PullTalk recorder tab.
   */
  capsuleLayout?: "default" | "target-slim";
  /** Window/screen capture: hide pen, shapes, etc.; keep Stop, timer, pan. */
  annotationTools?: "full" | "minimal";
};

export type RecordingCapsuleWireHandle = {
  setElapsedSeconds: (sec: number) => void;
  setActiveTool: (t: RecordingCapsuleTool) => void;
  setUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;
  destroy: () => void;
};

export function wireRecordingCapsuleUi(
  shadow: ShadowRoot,
  positionHost: HTMLElement,
  opts: RecordingCapsuleWireOpts
): RecordingCapsuleWireHandle {
  const $ = <T extends HTMLElement>(sel: string): T =>
    shadow.querySelector(sel) as T;

  const stack = $("#pt-cap-stack");
  const mainBar = $("#pt-main-bar");
  const timerEl = $("#t-elapsed");
  const grip = $("#pt-grip");
  const btnStop = $(".btn-stop");
  const btnTools = $("#pt-tools-toggle");
  const toolsPanel = $("#pt-tools-panel");
  const colorInput = $("#pt-color") as HTMLInputElement;

  const targetSlim = opts.capsuleLayout === "target-slim";
  if (targetSlim) {
    stack.classList.add("target-slim");
    btnTools.setAttribute("aria-hidden", "true");
    toolsPanel.setAttribute("aria-hidden", "true");
    grip.setAttribute(
      "aria-label",
      "Click to collapse to handle only, or drag to move — Stop and timer for this tab"
    );
  }

  if (opts.annotationTools === "minimal") {
    stack.classList.add("annotation-minimal");
    btnTools.setAttribute("aria-hidden", "true");
    toolsPanel.setAttribute("aria-hidden", "true");
  }

  colorInput.value = opts.getDrawColor();

  let toolsWereOpen = true;

  function setToolButtonsActive(t: RecordingCapsuleTool): void {
    shadow.querySelectorAll(".tool[data-tool]").forEach((el) => {
      const btn = el as HTMLElement;
      btn.dataset.active = btn.getAttribute("data-tool") === t ? "true" : "false";
    });
  }

  btnStop.addEventListener("click", () => opts.onStop());

  btnTools.addEventListener("click", () => {
    const open = btnTools.getAttribute("aria-expanded") === "true";
    const next = !open;
    btnTools.setAttribute("aria-expanded", next ? "true" : "false");
    toolsPanel.classList.toggle("open", next);
    toolsWereOpen = next;
  });

  shadow.querySelectorAll(".tool[data-tool]").forEach((el) => {
    el.addEventListener("click", () => {
      const t = (el as HTMLElement).getAttribute(
        "data-tool"
      ) as RecordingCapsuleTool;
      setToolButtonsActive(t);
      opts.onToolChange(t);
    });
  });

  const btnUndo = shadow.querySelector('.tool[data-action="undo"]') as HTMLElement | null;
  const btnRedo = shadow.querySelector('.tool[data-action="redo"]') as HTMLElement | null;

  btnUndo?.addEventListener("click", () => opts.onUndo?.());
  btnRedo?.addEventListener("click", () => opts.onRedo?.());

  shadow
    .querySelector('.tool[data-action="clear"]')
    ?.addEventListener("click", () => {
      opts.onClearAnnotations();
    });

  colorInput.addEventListener("input", () => {
    opts.setDrawColor(colorInput.value);
  });

  let minimized = false;
  function setMinimized(v: boolean): void {
    minimized = v;
    mainBar.classList.toggle("minimized", v);
    grip.setAttribute(
      "aria-label",
      targetSlim
        ? v
          ? "Click to expand timer and Stop, or drag to move"
          : "Collapsed — drag to move. Stop and timer on this tab."
        : v
          ? "Click to expand timer, stop, and tools, or drag to move"
          : "Click to collapse to handle only, or drag to move"
    );
    if (v) {
      toolsPanel.classList.remove("open");
      btnTools.setAttribute("aria-expanded", "false");
    } else {
      toolsPanel.classList.toggle("open", toolsWereOpen);
      btnTools.setAttribute("aria-expanded", toolsWereOpen ? "true" : "false");
    }
  }

  const DRAG_THRESH = 10;
  let ptrDown = false;
  let downX = 0;
  let downY = 0;
  let anchorLeft = 0;
  let anchorTop = 0;
  let draggingHost = false;

  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    ptrDown = true;
    draggingHost = false;
    downX = e.clientX;
    downY = e.clientY;
    const r = positionHost.getBoundingClientRect();
    anchorLeft = r.left;
    anchorTop = r.top;
    grip.setPointerCapture(e.pointerId);
  });

  grip.addEventListener("pointermove", (e) => {
    if (!ptrDown) {
      return;
    }
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (!draggingHost) {
      if (Math.hypot(dx, dy) < DRAG_THRESH) {
        return;
      }
      draggingHost = true;
      grip.classList.add("dragging");
      positionHost.style.transform = "none";
      positionHost.style.bottom = "auto";
      positionHost.style.left = `${anchorLeft}px`;
      positionHost.style.top = `${anchorTop}px`;
    }
    const w = positionHost.offsetWidth;
    const h = positionHost.offsetHeight;
    const margin = 8;
    let nx = anchorLeft + dx;
    let ny = anchorTop + dy;
    nx = Math.min(Math.max(margin, nx), window.innerWidth - w - margin);
    ny = Math.min(Math.max(margin, ny), window.innerHeight - h - margin);
    positionHost.style.left = `${nx}px`;
    positionHost.style.top = `${ny}px`;
  });

  grip.addEventListener("pointerup", (e) => {
    if (!ptrDown) {
      return;
    }
    ptrDown = false;
    try {
      grip.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
    grip.classList.remove("dragging");
    if (draggingHost) {
      const r = positionHost.getBoundingClientRect();
      anchorLeft = r.left;
      anchorTop = r.top;
    } else {
      setMinimized(!minimized);
    }
    draggingHost = false;
  });

  grip.addEventListener("pointercancel", () => {
    ptrDown = false;
    draggingHost = false;
    grip.classList.remove("dragging");
  });

  const onResize = (): void => {
    const r = positionHost.getBoundingClientRect();
    const margin = 8;
    if (r.right > window.innerWidth - margin) {
      positionHost.style.left = `${Math.max(margin, window.innerWidth - r.width - margin)}px`;
    }
    if (r.bottom > window.innerHeight - margin) {
      positionHost.style.top = `${Math.max(margin, window.innerHeight - r.height - margin)}px`;
    }
  };
  window.addEventListener("resize", onResize);

  return {
    setElapsedSeconds(sec: number) {
      timerEl.textContent = formatCapsuleElapsed(sec);
    },
    setActiveTool(t: RecordingCapsuleTool) {
      setToolButtonsActive(t);
    },
    setUndoRedoState(canUndo: boolean, canRedo: boolean) {
      btnUndo?.setAttribute("data-disabled", canUndo ? "false" : "true");
      btnRedo?.setAttribute("data-disabled", canRedo ? "false" : "true");
    },
    destroy() {
      window.removeEventListener("resize", onResize);
    },
  };
}
