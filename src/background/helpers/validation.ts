import type { StartRecordingPayload } from "@/shared/messages";
import {
  PULLTALK_RECORDER_SETUP_CONTEXT_KEY,
  PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
} from "@/shared/storageKeys";

export function validateCapturePayload(p: StartRecordingPayload): string | null {
  if (
    p.captureMode === "tab" &&
    (p.captureTargetTabId == null ||
      typeof p.captureTargetTabId !== "number" ||
      !Number.isFinite(p.captureTargetTabId))
  ) {
    return "Pick a tab to record in the dropdown.";
  }
  return null;
}

export function senderIsRecorderExtensionPage(
  sender: chrome.runtime.MessageSender,
): boolean {
  const u = sender.tab?.url ?? sender.url ?? "";
  return u.includes("recorder.html") && u.startsWith(chrome.runtime.getURL(""));
}

export async function clearRecorderSetupMarkers(): Promise<void> {
  await chrome.storage.session.remove([
    PULLTALK_RECORDER_SETUP_CONTEXT_KEY,
    PULLTALK_SETUP_RECORDER_TAB_ID_KEY,
  ]);
}
