import type { ExtensionMessage } from "@/shared/messages";
import { isInjectableTabUrl } from "@/shared/injectableTabUrl";
import { getSession } from "../state";
import { ensureSessionFromStorage } from "../helpers/session";
import { sendToPrTab } from "../helpers/tabs";

export function handleQueryContentTabId(
  _message: ExtensionMessage & { type: "pulltalk-query-content-tab-id" },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
): void {
  sendResponse({ tabId: sender.tab?.id ?? null });
}

export function handleListInjectableTabs(
  message: ExtensionMessage & { type: "pulltalk-list-injectable-tabs" },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
): void {
  void (async () => {
    const preferred =
      message.payload?.preferredTabId != null
        ? message.payload.preferredTabId
        : null;
    const senderWindowId = sender.tab?.windowId;

    const tabs = await chrome.tabs.query({});
    type Row = {
      id: number;
      title: string;
      url: string;
      windowId: number;
      index: number;
    };
    const rows: Row[] = [];
    for (const t of tabs) {
      if (t.id == null) {
        continue;
      }
      const raw =
        (t.url && t.url.length > 0 ? t.url : t.pendingUrl) || "";
      if (!raw || !isInjectableTabUrl(raw)) {
        continue;
      }
      rows.push({
        id: t.id,
        title: t.title || "Untitled",
        url: t.url && t.url.length > 0 ? t.url : raw,
        windowId: t.windowId ?? 0,
        index: t.index ?? 0,
      });
    }

    const byId = new Map(rows.map((r) => [r.id, r]));

    let activeId: number | null = null;
    if (senderWindowId != null) {
      const cur = await chrome.tabs.query({
        windowId: senderWindowId,
        active: true,
      });
      activeId = cur[0]?.id ?? null;
    }

    const ordered: Row[] = [];
    const pushUnique = (id: number | null): void => {
      if (id == null) {
        return;
      }
      const r = byId.get(id);
      if (!r || ordered.some((o) => o.id === r.id)) {
        return;
      }
      ordered.push(r);
    };

    pushUnique(preferred);
    pushUnique(activeId);

    const rest = [...byId.values()]
      .filter((r) => !ordered.some((o) => o.id === r.id))
      .sort((a, b) =>
        a.windowId !== b.windowId
          ? a.windowId - b.windowId
          : a.index - b.index,
      );
    ordered.push(...rest);

    sendResponse({
      tabs: ordered.map(({ id, title, url }) => ({ id, title, url })),
    });
  })();
}

export function handleRecordingStartedInternal(
  _message: ExtensionMessage & { type: "pulltalk-recording-started-internal" },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
): void {
  void (async () => {
    await ensureSessionFromStorage();
    const sess = getSession();
    if (sess?.prTabId != null) {
      sendToPrTab(sess.prTabId, { type: "recording-started" });
    }
  })();
  sendResponse({ ok: true });
}
