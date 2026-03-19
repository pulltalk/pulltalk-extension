import type { ExtensionMessage } from "@/shared/messages";
import { PULLTALK_CAPTURE_TAB_ID_KEY } from "@/shared/storageKeys";

export function sendToPrTab(tabId: number, msg: ExtensionMessage): void {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {
    /* tab may be closed */
  });
}

export function getRecorderUrl(): string {
  return chrome.runtime.getURL("src/recorder/recorder.html");
}

export function getRecorderSetupUrl(): string {
  return `${getRecorderUrl()}?setup=1`;
}

export async function teardownCaptureTabOverlay(): Promise<void> {
  const r = await chrome.storage.session.get(PULLTALK_CAPTURE_TAB_ID_KEY);
  const tid = r[PULLTALK_CAPTURE_TAB_ID_KEY] as number | undefined;
  if (tid != null) {
    try {
      await chrome.tabs.sendMessage(tid, {
        type: "pulltalk-overlay-teardown",
      });
    } catch {
      /* tab closed or no listener */
    }
  }
  await chrome.storage.session.remove(PULLTALK_CAPTURE_TAB_ID_KEY);
}

export async function findGithubPrTab(
  owner: string,
  repo: string,
  prId: string,
): Promise<number | undefined> {
  const path = `/${owner}/${repo}/pull/${prId}`;
  const tabs = await chrome.tabs.query({ url: "https://github.com/*/*/pull/*" });
  for (const t of tabs) {
    if (t.id == null || !t.url) {
      continue;
    }
    try {
      const u = new URL(t.url);
      if (
        u.hostname === "github.com" &&
        (u.pathname === path || u.pathname.startsWith(`${path}/`))
      ) {
        return t.id;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}
