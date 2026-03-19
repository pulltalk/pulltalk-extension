import type { ExtensionMessage, RecorderSetupContext } from "@/shared/messages";
import {
  PULLTALK_RECORDER_SETUP_CONTEXT_KEY,
  PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
} from "@/shared/storageKeys";
import { getRecordingStartBlockError } from "../helpers/session";
import { getRecorderSetupUrl } from "../helpers/tabs";
import { clearRecorderSetupMarkers } from "../helpers/validation";

export function handleOpenRecorderSetup(
  message: ExtensionMessage & { type: "open-recorder-setup" },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean; error?: string }) => void,
): void {
  const prTabId = sender.tab?.id;
  if (prTabId == null) {
    sendResponse({ ok: false, error: "No tab" });
    return;
  }

  void (async () => {
    const block = await getRecordingStartBlockError();
    if (block) {
      sendResponse({ ok: false, error: block });
      return;
    }

    const { owner, repo, prId } = message.payload;
    const ctx: RecorderSetupContext = { prTabId, owner, repo, prId };
    const setupUrl = getRecorderSetupUrl();

    const sidRaw = await chrome.storage.session.get(
      PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
    );
    const existingSetupId = sidRaw[
      PULLTALK_SETUP_RECORDER_TAB_ID_KEY
    ] as number | undefined;

    const persistContext = (): Promise<void> =>
      new Promise((resolve, reject) => {
        chrome.storage.session.set(
          { [PULLTALK_RECORDER_SETUP_CONTEXT_KEY]: ctx },
          () => {
            if (chrome.runtime.lastError) {
              reject(
                new Error(
                  chrome.runtime.lastError.message ?? "Storage error",
                ),
              );
              return;
            }
            resolve();
          },
        );
      });

    try {
      await persistContext();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sendResponse({ ok: false, error: msg });
      return;
    }

    if (existingSetupId != null) {
      try {
        const t = await chrome.tabs.get(existingSetupId);
        const u = t.url ?? "";
        if (u.includes("recorder.html")) {
          await chrome.tabs.update(existingSetupId, {
            url: setupUrl,
            active: true,
          });
          if (t.windowId != null) {
            await chrome.windows.update(t.windowId, { focused: true });
          }
          sendResponse({ ok: true });
          return;
        }
      } catch {
        await chrome.storage.session.remove(
          PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
        );
      }
    }

    chrome.tabs.create({ url: setupUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError || tab?.id == null) {
        void clearRecorderSetupMarkers();
        sendResponse({
          ok: false,
          error:
            chrome.runtime.lastError?.message ?? "Could not open recorder",
        });
        return;
      }
      chrome.storage.session.set(
        { [PULLTALK_SETUP_RECORDER_TAB_ID_KEY]: tab.id },
        () => {
          sendResponse({ ok: true });
        },
      );
    });
  })();
}

export function handleCancelRecorderSetup(
  _message: ExtensionMessage & { type: "pulltalk-cancel-recorder-setup" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: { ok: boolean }) => void,
): void {
  void (async () => {
    await clearRecorderSetupMarkers();
    sendResponse({ ok: true });
  })();
}
