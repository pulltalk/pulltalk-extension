import {
  RECORDER_PORT_NAME,
  type ExtensionMessage,
  type RecorderPortMessage,
} from "@/shared/messages";
import {
  PULLTALK_CAPTURE_TAB_ID_KEY,
  PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
  PULLTALK_STOP_FOR_TAB_KEY,
} from "@/shared/storageKeys";
import {
  getSession,
  clearSessionIfRecorderTab,
  getPendingTabCapture,
  setPendingTabCapture,
} from "./state";
import {
  ensureSessionFromStorage,
  clearSessionEverywhere,
  resolveSessionForRecorderPort,
} from "./helpers/session";
import {
  sendToPrTab,
  teardownCaptureTabOverlay,
} from "./helpers/tabs";
import { clearRecorderSetupMarkers } from "./helpers/validation";

import {
  handleQueryContentTabId,
  handleListInjectableTabs,
  handleRecordingStartedInternal,
} from "./handlers/query";
import {
  handleOpenRecorderSetup,
  handleCancelRecorderSetup,
} from "./handlers/setup";
import {
  handleStartRecordingInTab,
  handleStartRecording,
  handleStopRecording,
} from "./handlers/recording";
import {
  handleRegisterCaptureTab,
  handleTeardownTargetOverlay,
  handleRelayScroll,
} from "./handlers/capture";
import {
  handleNotifyRecordingUrl,
  handleNotifyRecordingError,
  handleEditCancelled,
  handleRecordingError,
} from "./handlers/notify";

/* ── Overlay re-injection on tab navigation ──────────────────────── */

const RECORDING_TARGET_OVERLAY_JS = "recordingTargetOverlay.js";

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "complete") return;
  void (async (): Promise<void> => {
    const cap = await chrome.storage.session.get(PULLTALK_CAPTURE_TAB_ID_KEY);
    const captureId = cap[PULLTALK_CAPTURE_TAB_ID_KEY] as number | undefined;
    if (captureId !== tabId) return;
    const sess = await ensureSessionFromStorage();
    if (sess?.recorderTabId == null) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [RECORDING_TARGET_OVERLAY_JS],
      });
    } catch {
      /* page may block scripting */
    }
  })();
});

/* ── Recorder port connection ────────────────────────────────────── */

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== RECORDER_PORT_NAME) return;
  const tabId = port.sender?.tab?.id;
  void (async (): Promise<void> => {
    if (tabId == null) { port.disconnect(); return; }
    const sess = await resolveSessionForRecorderPort(tabId);
    if (!sess || sess.recorderTabId !== tabId) { port.disconnect(); return; }
    sess.port = port;
    port.onDisconnect.addListener(() => {
      const s = getSession();
      if (s?.recorderTabId === tabId) s.port = null;
    });
    const pending = getPendingTabCapture();
    if (pending && pending.recorderTabId === tabId) return;
    const needsActionClick =
      sess.payload.captureMode === "tab" &&
      sess.payload.captureTargetTabId != null;
    if (needsActionClick) return;
    const start: RecorderPortMessage = { type: "start-capture", payload: sess.payload };
    port.postMessage(start);
  })();
});

/* ── Message router ──────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message)) return;

    switch (message.type) {
      case "pulltalk-query-content-tab-id":
        handleQueryContentTabId(message, sender, sendResponse); return true;
      case "pulltalk-list-injectable-tabs":
        handleListInjectableTabs(message, sender, sendResponse); return true;
      case "pulltalk-recording-started-internal":
        handleRecordingStartedInternal(message, sender, sendResponse); return true;
      case "open-recorder-setup":
        handleOpenRecorderSetup(message, sender, sendResponse); return true;
      case "pulltalk-cancel-recorder-setup":
        handleCancelRecorderSetup(message, sender, sendResponse); return true;
      case "start-recording-in-tab":
        handleStartRecordingInTab(message, sender, sendResponse); return true;
      case "start-recording":
        handleStartRecording(message, sender, sendResponse); return true;
      case "stop-recording":
      case "pulltalk-stop-from-target-overlay":
        handleStopRecording(message, sender, sendResponse); return true;
      case "pulltalk-register-capture-tab":
        handleRegisterCaptureTab(message, sender, sendResponse); return true;
      case "pulltalk-teardown-target-overlay":
        handleTeardownTargetOverlay(message, sender, sendResponse); return true;
      case "pulltalk-relay-scroll":
        handleRelayScroll(message, sender, sendResponse); return true;
      case "notify-pr-tab-recording-url":
        handleNotifyRecordingUrl(message, sender, sendResponse); return true;
      case "notify-pr-tab-recording-error":
        handleNotifyRecordingError(message, sender, sendResponse); return true;
      case "recording-edit-cancelled":
        handleEditCancelled(message, sender, sendResponse); return true;
      case "recording-error":
        handleRecordingError(message, sender, sendResponse); return true;
      default: break;
    }
    return false;
  },
);

/* ── Extension icon click → tab capture ──────────────────────────── */

chrome.action.onClicked.addListener((_tab) => {
  const pending = getPendingTabCapture();
  if (!pending) return;
  setPendingTabCapture(null);

  void (async (): Promise<void> => {
    let streamId: string;
    try {
      streamId = await new Promise<string>((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId({}, (id) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!id) { reject(new Error("No tab capture stream ID returned")); return; }
          resolve(id);
        });
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Tab capture failed";
      void chrome.action.setBadgeText({ text: "" });
      const sess = getSession();
      if (sess?.port) {
        sess.port.postMessage({
          type: "capture-error", message: errMsg,
        } satisfies RecorderPortMessage);
      }
      sendToPrTab(pending.prTabId, {
        type: "recording-error", payload: { message: errMsg },
      });
      await clearSessionEverywhere();
      return;
    }

    void chrome.action.setBadgeText({ text: "" });
    const sess = getSession();
    if (!sess || sess.recorderTabId !== pending.recorderTabId || !sess.port) return;
    sess.port.postMessage({
      type: "start-capture", payload: sess.payload, tabCaptureStreamId: streamId,
    } satisfies RecorderPortMessage);
    try {
      await chrome.tabs.update(pending.targetTabId, { active: true });
    } catch { /* tab may be gone */ }
  })();
});

/* ── Tab removal cleanup ─────────────────────────────────────────── */

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async (): Promise<void> => {
    const setupRaw = await chrome.storage.session.get(PULLTALK_SETUP_RECORDER_TAB_ID_KEY);
    if (setupRaw[PULLTALK_SETUP_RECORDER_TAB_ID_KEY] === tabId) {
      await clearRecorderSetupMarkers();
    }
    const pending = getPendingTabCapture();
    if (pending?.recorderTabId === tabId) {
      setPendingTabCapture(null);
      void chrome.action.setBadgeText({ text: "" });
    }
    const sess = getSession();
    if (sess?.recorderTabId === tabId) {
      const prTab = sess.prTabId;
      await teardownCaptureTabOverlay();
      await clearSessionEverywhere();
      await chrome.storage.session.remove(PULLTALK_STOP_FOR_TAB_KEY);
      sendToPrTab(prTab, {
        type: "recording-error", payload: { message: "Recorder tab was closed" },
      });
    }
    clearSessionIfRecorderTab(tabId);
  })();
});
