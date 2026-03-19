import type { StartRecordingPayload } from "@/shared/messages";
import { PULLTALK_SESSION_STORAGE_KEY } from "@/shared/storageKeys";

export { PULLTALK_STOP_FOR_TAB_KEY } from "@/shared/storageKeys";

export type PersistedSessionData = {
  prTabId: number;
  recorderTabId: number;
  payload: StartRecordingPayload;
};

export async function writePersistedSession(
  data: PersistedSessionData | null
): Promise<void> {
  if (!data) {
    await chrome.storage.session.remove(PULLTALK_SESSION_STORAGE_KEY);
    return;
  }
  await chrome.storage.session.set({ [PULLTALK_SESSION_STORAGE_KEY]: data });
}

export async function readPersistedSession(): Promise<PersistedSessionData | null> {
  const r = await chrome.storage.session.get(PULLTALK_SESSION_STORAGE_KEY);
  const v = r[PULLTALK_SESSION_STORAGE_KEY];
  if (!v || typeof v !== "object") {
    return null;
  }
  return v as PersistedSessionData;
}
