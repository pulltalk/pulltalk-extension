import {
  getSession,
  setSession,
  type ActiveSession,
} from "../state";
import {
  readPersistedSession,
  writePersistedSession,
} from "../sessionPersist";
import {
  SESSION_POLL_MAX_ATTEMPTS,
  SESSION_POLL_DELAY_MS,
} from "@/shared/constants";

export async function clearSessionEverywhere(): Promise<void> {
  setSession(null);
  await writePersistedSession(null);
}

export async function ensureSessionFromStorage(): Promise<ActiveSession | null> {
  const mem = getSession();
  if (mem?.recorderTabId != null) {
    return mem;
  }
  const p = await readPersistedSession();
  if (p == null || p.recorderTabId == null) {
    return null;
  }
  const s: ActiveSession = {
    prTabId: p.prTabId,
    recorderTabId: p.recorderTabId,
    port: null,
    payload: p.payload,
  };
  setSession(s);
  return s;
}

/**
 * Recorder tab often connects before `writePersistedSession` finishes, or the
 * service worker restarts and in-memory session is empty. Wait briefly for storage.
 */
export async function resolveSessionForRecorderPort(
  recorderTabId: number,
): Promise<ActiveSession | null> {
  const mem = getSession();
  if (mem?.recorderTabId === recorderTabId) {
    return mem;
  }

  const maxAttempts = SESSION_POLL_MAX_ATTEMPTS;
  const delayMs = SESSION_POLL_DELAY_MS;
  for (let i = 0; i < maxAttempts; i++) {
    const p = await readPersistedSession();
    if (p?.recorderTabId === recorderTabId) {
      const s: ActiveSession = {
        prTabId: p.prTabId,
        recorderTabId: p.recorderTabId,
        port: null,
        payload: p.payload,
      };
      setSession(s);
      return s;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export async function getRecordingStartBlockError(): Promise<string | null> {
  await ensureSessionFromStorage();
  const orphan = getSession();
  if (orphan != null && orphan.recorderTabId == null) {
    await clearSessionEverywhere();
  }

  const mem = getSession();
  if (mem?.recorderTabId != null) {
    try {
      const t = await chrome.tabs.get(mem.recorderTabId);
      const u = t.url ?? "";
      if (u.includes("editor.html")) {
        return "Finish upload or discard in the PullTalk editor tab before recording again.";
      }
      if (u.includes("recorder.html")) {
        return "Recording already in progress";
      }
    } catch {
      /* tab gone */
    }
    await clearSessionEverywhere();
  }

  const stale = await readPersistedSession();
  if (stale?.recorderTabId != null && !getSession()) {
    try {
      const t = await chrome.tabs.get(stale.recorderTabId);
      const u = t.url ?? "";
      if (u.includes("editor.html")) {
        return "Finish upload or discard in the PullTalk editor tab before recording again.";
      }
      if (u.includes("recorder.html")) {
        return "Recording already in progress";
      }
    } catch {
      /* tab closed */
    }
    await writePersistedSession(null);
  }

  return null;
}
