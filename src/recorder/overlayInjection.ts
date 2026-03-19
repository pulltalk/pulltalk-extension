import type { ExtensionMessage } from "@/shared/messages";
import type { LiveCompositor } from "./compositor";

const TARGET_OVERLAY_FILE = "recordingTargetOverlay.js";

export async function registerCaptureTargetTab(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [TARGET_OVERLAY_FILE],
    });
    await new Promise((r) => setTimeout(r, 120));
    await chrome.runtime.sendMessage({
      type: "pulltalk-register-capture-tab",
      payload: { tabId },
    } satisfies ExtensionMessage);
    return true;
  } catch {
    return false;
  }
}

export function attachPreviewWheelHandler(
  canvas: HTMLCanvasElement,
  compositor: LiveCompositor,
  linkedTabActive: boolean,
): void {
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (linkedTabActive) {
        void chrome.runtime.sendMessage({
          type: "pulltalk-relay-scroll",
          payload: { dy: e.deltaY },
        } satisfies ExtensionMessage);
        return;
      }
      const c = compositor;
      if (e.ctrlKey || e.metaKey) {
        const dz = -e.deltaY * 0.002;
        c.visual.zoom = Math.min(3, Math.max(0.35, c.visual.zoom + dz));
      } else {
        c.visual.panNy += e.deltaY * 0.00035;
      }
    },
    { passive: false },
  );
}

/**
 * `chrome.tabs.getCurrent()` often returns undefined from extension pages (MV3).
 * Falls back to the active tab in this window when it is the PullTalk recorder page.
 */
export async function resolveRecorderPageTabId(): Promise<number | undefined> {
  try {
    const fromGetCurrent = await new Promise<number | undefined>((resolve) => {
      try {
        chrome.tabs.getCurrent((tab) => {
          resolve(tab?.id ?? undefined);
        });
      } catch {
        resolve(undefined);
      }
    });
    if (fromGetCurrent != null) return fromGetCurrent;
  } catch {
    /* ignore */
  }
  try {
    const recorderPrefix = chrome.runtime.getURL("src/recorder/recorder.html");
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = active?.url ?? "";
    if (active?.id != null && url.startsWith(recorderPrefix)) return active.id;
  } catch {
    /* ignore */
  }
  return undefined;
}
