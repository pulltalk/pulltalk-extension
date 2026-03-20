import type { ExtensionMessage } from "@/shared/messages";
import { PULLTALK_STOP_FOR_TAB_KEY } from "@/shared/storageKeys";
import { getSession } from "../state";
import {
  clearSessionEverywhere,
  ensureSessionFromStorage,
} from "../helpers/session";
import {
  findGithubPrTab,
  sendToPrTab,
  teardownCaptureTabOverlay,
} from "../helpers/tabs";

export function handleNotifyRecordingUrl(
  message: ExtensionMessage & { type: "notify-pr-tab-recording-url" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean; linkInsertedInPrTab: boolean }) => void,
): void {
  const { url, owner, repo, prId } = message.payload;
  void (async (): Promise<void> => {
    await clearSessionEverywhere();
    const prTabId = await findGithubPrTab(owner, repo, prId);
    let linkInsertedInPrTab = false;
    if (prTabId != null) {
      try {
        await chrome.tabs.sendMessage(prTabId, {
          type: "recording-url",
          payload: { url },
        });
        linkInsertedInPrTab = true;
      } catch {
        linkInsertedInPrTab = false;
      }
    }
    try {
      sendResponse({ ok: true, linkInsertedInPrTab });
    } catch {
      /* channel may be gone */
    }
  })();
}

export function handleNotifyRecordingError(
  message: ExtensionMessage & { type: "notify-pr-tab-recording-error" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  const p = message.payload;
  void (async (): Promise<void> => {
    const prTabId = await findGithubPrTab(p.owner, p.repo, p.prId);
    if (prTabId != null) {
      sendToPrTab(prTabId, {
        type: "recording-error",
        payload: { message: p.message },
      });
    }
    try {
      sendResponse({ ok: true });
    } catch {
      /* ignore */
    }
  })();
}

export function handleEditCancelled(
  _message: ExtensionMessage & { type: "recording-edit-cancelled" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  void (async (): Promise<void> => {
    await ensureSessionFromStorage();
    const prTab = getSession()?.prTabId;
    await clearSessionEverywhere();
    if (prTab != null) {
      sendToPrTab(prTab, {
        type: "recording-error",
        payload: { message: "Edit cancelled" },
      });
    }
  })();
  sendResponse({ ok: true });
}

export function handleRecordingError(
  message: ExtensionMessage & { type: "recording-error" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  void (async (): Promise<void> => {
    await ensureSessionFromStorage();
    const sess = getSession();
    const prTab = sess?.prTabId;
    await teardownCaptureTabOverlay();
    await clearSessionEverywhere();
    await chrome.storage.session.remove(PULLTALK_STOP_FOR_TAB_KEY);
    if (prTab != null) {
      sendToPrTab(prTab, message);
    }
  })();
  sendResponse({ ok: true });
}
