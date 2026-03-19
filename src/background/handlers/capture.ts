import type { ExtensionMessage } from "@/shared/messages";
import { PULLTALK_CAPTURE_TAB_ID_KEY } from "@/shared/storageKeys";
import { teardownCaptureTabOverlay } from "../helpers/tabs";

export function handleRegisterCaptureTab(
  message: ExtensionMessage & { type: "pulltalk-register-capture-tab" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  void chrome.storage.session.set({
    [PULLTALK_CAPTURE_TAB_ID_KEY]: message.payload.tabId,
  });
  sendResponse({ ok: true });
}

export function handleTeardownTargetOverlay(
  _message: ExtensionMessage & { type: "pulltalk-teardown-target-overlay" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  void (async () => {
    await teardownCaptureTabOverlay();
    sendResponse({ ok: true });
  })();
}

export function handleRelayScroll(
  message: ExtensionMessage & { type: "pulltalk-relay-scroll" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  void (async () => {
    const r = await chrome.storage.session.get(PULLTALK_CAPTURE_TAB_ID_KEY);
    const tid = r[PULLTALK_CAPTURE_TAB_ID_KEY] as number | undefined;
    if (tid != null) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tid },
          func: (dy: number) => {
            window.scrollBy({ top: dy, left: 0, behavior: "instant" });
          },
          args: [message.payload.dy],
        });
      } catch {
        /* restricted page */
      }
    }
    sendResponse({ ok: true });
  })();
}
