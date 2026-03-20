import type {
  ExtensionMessage,
  RecorderPortMessage,
  RecorderSetupContext,
} from "@/shared/messages";
import {
  PULLTALK_RECORDER_SETUP_CONTEXT_KEY,
  PULLTALK_SESSION_STORAGE_KEY,
  PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
  PULLTALK_STOP_FOR_TAB_KEY,
} from "@/shared/storageKeys";
import {
  setSession,
  setPendingTabCapture,
  type ActiveSession,
} from "../state";
import {
  clearSessionEverywhere,
  ensureSessionFromStorage,
  getRecordingStartBlockError,
} from "../helpers/session";
import { getRecorderUrl, sendToPrTab } from "../helpers/tabs";
import {
  validateCapturePayload,
  senderIsRecorderExtensionPage,
  clearRecorderSetupMarkers,
} from "../helpers/validation";

export function handleStartRecordingInTab(
  message: ExtensionMessage & { type: "start-recording-in-tab" },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean; error?: string; awaitingActionClick?: boolean }) => void,
): void {
  const recorderTabId = sender.tab?.id;
  if (recorderTabId == null || !senderIsRecorderExtensionPage(sender)) {
    sendResponse({
      ok: false,
      error: "Must start from the PullTalk recorder tab",
    });
    return;
  }

  const p = message.payload;
  const capErr = validateCapturePayload(p);
  if (capErr) {
    sendResponse({ ok: false, error: capErr });
    return;
  }

  const prTabId = message.prTabId;

  void (async (): Promise<void> => {
    const fail = async (messageText: string): Promise<void> => {
      setPendingTabCapture(null);
      await clearSessionEverywhere();
      await clearRecorderSetupMarkers();
      sendToPrTab(prTabId, {
        type: "recording-error",
        payload: { message: messageText },
      });
      sendResponse({ ok: false, error: messageText });
    };

    try {
      const raw = await chrome.storage.session.get(
        PULLTALK_RECORDER_SETUP_CONTEXT_KEY,
      );
      const ctx = raw[PULLTALK_RECORDER_SETUP_CONTEXT_KEY] as
        | RecorderSetupContext
        | undefined;
      if (
        ctx == null ||
        ctx.prTabId !== prTabId ||
        ctx.owner !== p.owner ||
        ctx.repo !== p.repo ||
        ctx.prId !== p.prId
      ) {
        await fail("Setup expired or mismatch — open Record from the PR again.");
        return;
      }

      const block = await getRecordingStartBlockError();
      if (block) {
        await fail(block);
        return;
      }

      const payload = p;
      const needsActionClick =
        payload.captureMode === "tab" &&
        payload.captureTargetTabId != null;

      const sess: ActiveSession = {
        prTabId,
        recorderTabId,
        port: null,
        payload,
      };

      if (needsActionClick) {
        setPendingTabCapture({
          recorderTabId,
          prTabId,
          targetTabId: payload.captureTargetTabId!,
        });
      }

      setSession(sess);

      const persisted = {
        prTabId,
        recorderTabId,
        payload,
      };
      chrome.storage.session.set(
        { [PULLTALK_SESSION_STORAGE_KEY]: persisted },
        () => {
          if (chrome.runtime.lastError) {
            const errMsg =
              chrome.runtime.lastError.message ??
              "Could not save recording session";
            setPendingTabCapture(null);
            void clearSessionEverywhere().then(() => clearRecorderSetupMarkers());
            sendToPrTab(prTabId, {
              type: "recording-error",
              payload: { message: errMsg },
            });
            sendResponse({ ok: false, error: errMsg });
            return;
          }
          void chrome.storage.session.remove([
            PULLTALK_RECORDER_SETUP_CONTEXT_KEY,
            PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
          ]);

          if (needsActionClick) {
            try {
              void chrome.tabs.update(payload.captureTargetTabId!, { active: true });
            } catch { /* target tab may be gone */ }
            void chrome.action.setBadgeText({ text: "REC" });
            void chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
            sendResponse({ ok: true, awaitingActionClick: true });
          } else {
            sendResponse({ ok: true });
          }
        },
      );
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not start recording";
      await fail(msg);
    }
  })();
}

export function handleStartRecording(
  message: ExtensionMessage & { type: "start-recording" },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean; error?: string }) => void,
): void {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    sendResponse({ ok: false, error: "No tab" });
    return;
  }

  const p = message.payload;
  const capErr = validateCapturePayload(p);
  if (capErr) {
    sendResponse({ ok: false, error: capErr });
    return;
  }

  void (async (): Promise<void> => {
    const fail = async (message: string): Promise<void> => {
      await clearSessionEverywhere();
      sendToPrTab(tabId, {
        type: "recording-error",
        payload: { message },
      });
      sendResponse({ ok: false, error: message });
    };

    try {
      const block = await getRecordingStartBlockError();
      if (block) {
        sendResponse({ ok: false, error: block });
        return;
      }

      const payload = message.payload;
      const sess: ActiveSession = {
        prTabId: tabId,
        recorderTabId: null,
        port: null,
        payload,
      };
      setSession(sess);

      chrome.tabs.create({ url: getRecorderUrl(), active: true }, (tab) => {
        if (chrome.runtime.lastError || tab?.id == null) {
          void clearSessionEverywhere();
          const errMsg =
            chrome.runtime.lastError?.message ?? "Could not open recorder";
          sendToPrTab(tabId, {
            type: "recording-error",
            payload: { message: errMsg },
          });
          sendResponse({ ok: false, error: errMsg });
          return;
        }

        const recorderTabId = tab.id;
        sess.recorderTabId = recorderTabId;

        const persisted = {
          prTabId: tabId,
          recorderTabId,
          payload,
        };
        chrome.storage.session.set(
          { [PULLTALK_SESSION_STORAGE_KEY]: persisted },
          () => {
            const le = chrome.runtime.lastError;
            if (le) {
              const errMsg =
                le.message ?? "Could not save recording session";
              void (async (): Promise<void> => {
                await clearSessionEverywhere();
              })();
              sendToPrTab(tabId, {
                type: "recording-error",
                payload: { message: errMsg },
              });
              sendResponse({ ok: false, error: errMsg });
              return;
            }
            sendResponse({ ok: true });
          },
        );
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not start recording";
      await fail(msg);
    }
  })();
}

export function handleStopRecording(
  _message: ExtensionMessage & { type: "stop-recording" | "pulltalk-stop-from-target-overlay" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean; error?: string }) => void,
): void {
  void runStopRecording(sendResponse);
}

async function runStopRecording(
  sendResponse: (r: { ok: boolean; error?: string }) => void,
): Promise<void> {
  const sess = await ensureSessionFromStorage();
  if (!sess?.recorderTabId) {
    sendResponse({
      ok: false,
      error: "No active recording session",
    });
    return;
  }

  if (sess.port) {
    try {
      sess.port.postMessage({
        type: "stop-capture",
      } satisfies RecorderPortMessage);
      await chrome.storage.session.remove(PULLTALK_STOP_FOR_TAB_KEY);
    } catch {
      sendResponse({ ok: false, error: "Recorder disconnected" });
      return;
    }
  } else {
    await chrome.storage.session.set({
      [PULLTALK_STOP_FOR_TAB_KEY]: sess.recorderTabId,
    });
  }

  if (sess.recorderTabId != null) {
    try {
      await chrome.tabs.update(sess.recorderTabId, { active: true });
    } catch {
      /* tab may be gone */
    }
  }

  sendToPrTab(sess.prTabId, { type: "recording-awaiting-editor" });
  sendResponse({ ok: true });
}
