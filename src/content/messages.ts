import type { ExtensionMessage, StartRecordingPayload } from "@/shared/messages";
import { errorFromUnknown, isExtensionContextValid } from "@/shared/extensionRuntime";

export function sendOpenRecorderSetup(payload: {
  owner: string;
  repo: string;
  prId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        resolve({
          ok: false,
          error: errorFromUnknown("Extension context invalidated"),
        });
        return;
      }
      chrome.runtime.sendMessage(
        { type: "open-recorder-setup", payload } satisfies ExtensionMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: errorFromUnknown(chrome.runtime.lastError.message),
            });
            return;
          }
          resolve((response as { ok: boolean; error?: string } | undefined) ?? { ok: false, error: "No response" });
        }
      );
    } catch (e) {
      resolve({ ok: false, error: errorFromUnknown(e) });
    }
  });
}

export function sendStartRecording(payload: StartRecordingPayload): Promise<{
  ok: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        resolve({ ok: false, error: errorFromUnknown("Extension context invalidated") });
        return;
      }
      chrome.runtime.sendMessage(
        { type: "start-recording", payload } satisfies ExtensionMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: errorFromUnknown(chrome.runtime.lastError.message),
            });
            return;
          }
          resolve((response as { ok: boolean; error?: string } | undefined) ?? { ok: false, error: "No response" });
        }
      );
    } catch (e) {
      resolve({ ok: false, error: errorFromUnknown(e) });
    }
  });
}
