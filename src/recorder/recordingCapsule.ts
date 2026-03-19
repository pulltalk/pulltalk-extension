/**
 * Draggable recording capsule + collapsible annotation tools (recorder tab).
 * The injected target-tab overlay reuses the same markup with `capsuleLayout: 'target-slim'`.
 * Shadow DOM isolates styles from the host page.
 */

import {
  getRecordingCapsuleStackHtml,
  getRecordingCapsuleStyles,
  wireRecordingCapsuleUi,
  type RecordingCapsuleTool,
  type RecordingCapsuleWireOpts,
} from "@/shared/recordingCapsuleUi";

export type { RecordingCapsuleTool };

const HOST_ID = "pulltalk-recording-capsule-host";
const Z = 2147483647;

export type RecordingCapsuleOptions = RecordingCapsuleWireOpts;

export function mountRecordingCapsule(
  opts: RecordingCapsuleOptions
): {
  setElapsedSeconds: (sec: number) => void;
  setActiveTool: (t: RecordingCapsuleTool) => void;
  setUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;
  destroy: () => void;
} {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-pulltalk-overlay", "1");
  Object.assign(host.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    zIndex: String(Z),
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    pointerEvents: "auto",
  });

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${getRecordingCapsuleStyles()}</style>${getRecordingCapsuleStackHtml()}`;

  const wire = wireRecordingCapsuleUi(shadow, host, opts);

  document.body.appendChild(host);

  return {
    setElapsedSeconds: wire.setElapsedSeconds,
    setActiveTool: wire.setActiveTool,
    setUndoRedoState: wire.setUndoRedoState,
    destroy() {
      wire.destroy();
      host.remove();
    },
  };
}
