import type { StartRecordingPayload } from "@/shared/messages";

export type ActiveSession = {
  prTabId: number;
  recorderTabId: number | null;
  port: chrome.runtime.Port | null;
  payload: StartRecordingPayload;
};

export type PendingTabCapture = {
  recorderTabId: number;
  prTabId: number;
  targetTabId: number;
};

/**
 * Encapsulated session store.
 * All access goes through these functions — no direct module-level mutation.
 */
class SessionStore {
  private session: ActiveSession | null = null;
  private pendingCapture: PendingTabCapture | null = null;

  getSession(): ActiveSession | null {
    return this.session;
  }

  setSession(s: ActiveSession | null): void {
    this.session = s;
  }

  clearSessionIfRecorderTab(tabId: number): void {
    if (this.session?.recorderTabId === tabId) {
      this.session = null;
    }
  }

  getPendingTabCapture(): PendingTabCapture | null {
    return this.pendingCapture;
  }

  setPendingTabCapture(p: PendingTabCapture | null): void {
    this.pendingCapture = p;
  }
}

const store = new SessionStore();

export function getSession(): ActiveSession | null {
  return store.getSession();
}

export function setSession(s: ActiveSession | null): void {
  store.setSession(s);
}

export function clearSessionIfRecorderTab(tabId: number): void {
  store.clearSessionIfRecorderTab(tabId);
}

export function getPendingTabCapture(): PendingTabCapture | null {
  return store.getPendingTabCapture();
}

export function setPendingTabCapture(p: PendingTabCapture | null): void {
  store.setPendingTabCapture(p);
}
