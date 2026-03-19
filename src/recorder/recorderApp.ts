import type { ExtensionMessage, StartRecordingPayload } from "@/shared/messages";
import { PULLTALK_STOP_FOR_TAB_KEY } from "@/shared/storageKeys";
import {
  acquireCameraVideoStream,
  acquireDisplayMediaStream,
} from "./capture";
import {
  mountRecordingCapsule,
  type RecordingCapsuleTool,
} from "./recordingCapsule";
import { RecordSession } from "./recordSession";
import { acquireTabCaptureMediaStream, acquireTabCaptureMediaStreamFromId } from "./tabCaptureStream";
import { wireAnnotationHandlers, type AnnotationAddedEvent } from "./annotationWiring";
import type { AnnotationStroke, AnnotationText, AnnotationArrow, AnnotationShape } from "./compositor";
import {
  registerCaptureTargetTab,
  attachPreviewWheelHandler,
  resolveRecorderPageTabId,
} from "./overlayInjection";

type Tool = RecordingCapsuleTool;

export function showRecorderError(message: string): void {
  document.body.innerHTML = "";
  document.body.style.cssText =
    "margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;color:#c9d1d9;font-family:system-ui,sans-serif";
  const wrap = document.createElement("div");
  wrap.style.cssText = "max-width:28rem;text-align:center;padding:2rem";
  const title = document.createElement("p");
  title.style.cssText = "color:#f85149;font-weight:600;font-size:16px;margin:0 0 12px";
  title.textContent = "Recording failed";
  const msg = document.createElement("p");
  msg.style.cssText = "font-size:14px;line-height:1.5;margin:0 0 20px;word-break:break-word";
  msg.textContent = message;
  const btn = document.createElement("button");
  btn.textContent = "Close";
  btn.style.cssText =
    "padding:10px 24px;border-radius:8px;border:1px solid #30363d;background:#21262d;color:#c9d1d9;cursor:pointer;font-size:14px;font-weight:600";
  btn.addEventListener("click", () => window.close());
  wrap.append(title, msg, btn);
  document.body.appendChild(wrap);
}

const EDITOR_PAGE = "src/editor/editor.html";

let stopPollTimer: ReturnType<typeof setInterval> | null = null;

export function clearStopPollTimer(): void {
  if (stopPollTimer) {
    clearInterval(stopPollTimer);
    stopPollTimer = null;
  }
}

function startExternalStopPolling(
  session: RecordSession,
  recorderTabId: number,
): void {
  clearStopPollTimer();
  stopPollTimer = setInterval(() => {
    chrome.storage.session.get(PULLTALK_STOP_FOR_TAB_KEY, (r) => {
      const v = r[PULLTALK_STOP_FOR_TAB_KEY] as number | undefined;
      if (v === recorderTabId) {
        void chrome.storage.session.remove(PULLTALK_STOP_FOR_TAB_KEY);
        clearStopPollTimer();
        session.clearRecordingAlarm?.();
        session.onRequestFinalize?.(session.stopAndPersist());
      }
    });
  }, 200);
}

export async function runRecorderFlow(
  payload: StartRecordingPayload,
  session: RecordSession,
  requestStopRecording: () => void,
  tabCaptureStreamId?: string,
): Promise<void> {
  document.body.innerHTML = "";
  document.body.style.cssText =
    "margin:0;overflow:hidden;background:#0d1117;font-family:system-ui,sans-serif";

  let displayStream: MediaStream | null = null;
  let cameraStream: MediaStream | null = null;
  const recorderIdForLink = await resolveRecorderPageTabId();

  try {
    if (payload.captureMode === "tab") {
      const tid = payload.captureTargetTabId;
      if (tid == null || recorderIdForLink == null) {
        throw new Error("Tab capture requires a target tab and recorder tab");
      }
      displayStream = tabCaptureStreamId
        ? await acquireTabCaptureMediaStreamFromId(tabCaptureStreamId)
        : await acquireTabCaptureMediaStream(tid, recorderIdForLink);
    } else {
      const hint = payload.displaySurfaceHint ??
        (payload.captureMode === "monitor" ? "monitor" : "window");
      displayStream = await acquireDisplayMediaStream(hint);
    }
    if (payload.cameraOn) {
      cameraStream = await acquireCameraVideoStream();
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Could not access capture";
    chrome.runtime.sendMessage({
      type: "recording-error",
      payload: { message: errMsg },
    });
    showRecorderError(errMsg);
    return;
  }

  let linkedTargetTabId: number | undefined;
  let tabOverlayInjectFailed = false;
  const usesTabCapture = payload.captureMode === "tab";
  const captureTid = payload.captureTargetTabId;

  if (displayStream && usesTabCapture && captureTid != null && recorderIdForLink != null) {
    if (await registerCaptureTargetTab(captureTid)) {
      linkedTargetTabId = captureTid;
    } else {
      linkedTargetTabId = undefined;
      tabOverlayInjectFailed = true;
    }
  }

  await session.start(payload, displayStream, cameraStream);
  if (recorderIdForLink != null) {
    void chrome.runtime.sendMessage({
      type: "pulltalk-recording-started-internal",
    } satisfies ExtensionMessage);
    startExternalStopPolling(session, recorderIdForLink);
  }

  const c = session.compositor;
  c.visual.zoom = 1;
  c.visual.panNx = 0;
  c.visual.panNy = 0;
  c.visual.spotlight = false;
  c.visual.cursorRing = false;

  const canvas = c.canvas;
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;z-index:1";

  attachPreviewWheelHandler(canvas, c, linkedTargetTabId != null);

  const annotationsOnTarget = linkedTargetTabId != null && usesTabCapture && !tabOverlayInjectFailed;
  appendHintBanner(tabOverlayInjectFailed, annotationsOnTarget);

  let tool: Tool = "none";
  let drawColor = "#19e619";

  /* ── Undo / redo for compositor annotations ── */

  type RecorderAction =
    | { kind: "add-stroke"; item: AnnotationStroke }
    | { kind: "add-arrow"; item: AnnotationArrow }
    | { kind: "add-shape"; item: AnnotationShape }
    | { kind: "add-text"; item: AnnotationText }
    | { kind: "clear"; strokes: AnnotationStroke[]; arrows: AnnotationArrow[]; shapes: AnnotationShape[]; texts: AnnotationText[] };

  const undoStack: RecorderAction[] = [];
  const redoStack: RecorderAction[] = [];

  function removeFromArray<T>(arr: T[], item: T): void {
    const idx = arr.indexOf(item);
    if (idx !== -1) arr.splice(idx, 1);
  }

  function pushAction(action: RecorderAction): void {
    undoStack.push(action);
    redoStack.length = 0;
  }

  function applyAction(action: RecorderAction): void {
    switch (action.kind) {
      case "add-stroke": c.visual.strokes.push(action.item); break;
      case "add-arrow": c.visual.arrows.push(action.item); break;
      case "add-shape": c.visual.shapes.push(action.item); break;
      case "add-text": c.visual.texts.push(action.item); break;
      case "clear":
        c.visual.strokes = [];
        c.visual.texts = [];
        c.visual.arrows = [];
        c.visual.shapes = [];
        break;
    }
  }

  function reverseAction(action: RecorderAction): void {
    switch (action.kind) {
      case "add-stroke": removeFromArray(c.visual.strokes, action.item); break;
      case "add-arrow": removeFromArray(c.visual.arrows, action.item); break;
      case "add-shape": removeFromArray(c.visual.shapes, action.item); break;
      case "add-text": removeFromArray(c.visual.texts, action.item); break;
      case "clear":
        c.visual.strokes.push(...action.strokes);
        c.visual.arrows.push(...action.arrows);
        c.visual.shapes.push(...action.shapes);
        c.visual.texts.push(...action.texts);
        break;
    }
  }

  function performUndo(): void {
    const action = undoStack.pop();
    if (!action) return;
    reverseAction(action);
    redoStack.push(action);
    capsule.setUndoRedoState(undoStack.length > 0, redoStack.length > 0);
  }

  function performRedo(): void {
    const action = redoStack.pop();
    if (!action) return;
    applyAction(action);
    undoStack.push(action);
    capsule.setUndoRedoState(undoStack.length > 0, redoStack.length > 0);
  }

  const onAnnotationAdded = (ev: AnnotationAddedEvent): void => {
    pushAction(ev as RecorderAction);
    capsule.setUndoRedoState(undoStack.length > 0, redoStack.length > 0);
  };

  const recordingStartedAt = Date.now();
  let timerIv: number | null = null;
  const capsule = mountRecordingCapsule({
    onStop: () => {
      if (timerIv != null) { window.clearInterval(timerIv); timerIv = null; }
      requestStopRecording();
    },
    onToolChange(t) { tool = t; },
    onClearAnnotations() {
      if (c.visual.strokes.length || c.visual.texts.length || c.visual.arrows.length || c.visual.shapes.length) {
        pushAction({
          kind: "clear",
          strokes: [...c.visual.strokes],
          arrows: [...c.visual.arrows],
          shapes: [...c.visual.shapes],
          texts: [...c.visual.texts],
        });
        c.visual.strokes = [];
        c.visual.texts = [];
        c.visual.arrows = [];
        c.visual.shapes = [];
        capsule.setUndoRedoState(undoStack.length > 0, redoStack.length > 0);
      }
    },
    onUndo: () => performUndo(),
    onRedo: () => performRedo(),
    getDrawColor: () => drawColor,
    setDrawColor(col) { drawColor = col; },
    annotationTools: annotationsOnTarget ? "minimal" : "full",
  });
  capsule.setElapsedSeconds(0);
  timerIv = window.setInterval(() => {
    capsule.setElapsedSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000));
  }, 1000);

  document.body.append(canvas);

  let capsuleVisible = true;
  window.addEventListener("keydown", (e) => {
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
    if (e.key === "h" || e.key === "H") {
      const el = document.getElementById("pulltalk-recording-capsule-host");
      if (el) {
        capsuleVisible = !capsuleVisible;
        el.style.visibility = capsuleVisible ? "visible" : "hidden";
        el.style.pointerEvents = capsuleVisible ? "auto" : "none";
      }
    }
    if (!annotationsOnTarget) {
      const step = 0.08;
      if (e.key === "ArrowLeft") c.visual.panNx -= step;
      if (e.key === "ArrowRight") c.visual.panNx += step;
      if (e.key === "ArrowUp") c.visual.panNy -= step;
      if (e.key === "ArrowDown") c.visual.panNy += step;
    }
  });

  const vw = (): number => session.compositor.getMainVideo().videoWidth || 1280;
  const vh = (): number => session.compositor.getMainVideo().videoHeight || 720;

  if (!annotationsOnTarget) {
    wireAnnotationHandlers(canvas, c, () => tool, () => drawColor, vw, vh, onAnnotationAdded);
  }

  let alarmId: ReturnType<typeof setTimeout> | null = null;
  if (payload.alarmMinutes != null && payload.alarmMinutes > 0) {
    alarmId = setTimeout(() => {
      void session
        .stopAndPersist()
        .then(({ blobKey, durationMs }) => {
          const q = new URLSearchParams({ k: blobKey });
          if (durationMs > 0) q.set("d", String(durationMs));
          window.location.href = `${chrome.runtime.getURL(EDITOR_PAGE)}?${q}`;
        })
        .catch(() => {});
    }, payload.alarmMinutes * 60 * 1000);
  }
  session.clearRecordingAlarm = () => {
    if (alarmId != null) { clearTimeout(alarmId); alarmId = null; }
  };
}

function appendHintBanner(
  tabOverlayInjectFailed: boolean,
  annotationsOnTarget: boolean,
): void {
  const hintStyle: Partial<CSSStyleDeclaration> = {
    position: "fixed",
    top: "10px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "6",
    maxWidth: "min(92vw,520px)",
    background: "rgba(13,17,23,0.92)",
    color: "#8b949e",
    padding: "10px 14px",
    borderRadius: "10px",
    fontSize: "12px",
    lineHeight: "1.45",
    textAlign: "center",
    border: "1px solid #30363d",
    pointerEvents: "none",
  };

  if (tabOverlayInjectFailed) {
    const warn = document.createElement("div");
    warn.textContent =
      "Could not attach annotation overlay on the captured tab — use this PullTalk tab to stop. Scroll-from-preview on that page may be unavailable.";
    Object.assign(warn.style, { ...hintStyle, color: "#d29922", borderColor: "#634b1f" });
    document.body.appendChild(warn);
  } else if (annotationsOnTarget) {
    const ann = document.createElement("div");
    ann.textContent =
      "Tab capture active — annotate on the recorded tab. This preview shows Stop & timer only.";
    Object.assign(ann.style, hintStyle);
    document.body.appendChild(ann);
  }
}
