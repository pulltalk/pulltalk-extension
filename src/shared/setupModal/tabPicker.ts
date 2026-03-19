import type { ExtensionMessage } from "@/shared/messages";
import { errorFromUnknown, isExtensionContextValid } from "@/shared/extensionRuntime";

function extensionSend<T>(msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      if (!isExtensionContextValid()) {
        reject(new Error("Extension context invalidated"));
        return;
      }
      chrome.runtime.sendMessage(msg, (response: T) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

export type TabPickerState = {
  injectableTabCount: number;
};

export function createTabPicker(
  tabSelect: HTMLSelectElement,
  tabPickEmpty: HTMLElement,
  tabPickWrap: HTMLElement,
  startBtn: HTMLButtonElement,
  prTabId: number | null,
): { refreshTabs: () => Promise<void>; syncVisibility: (mode: string) => void; state: TabPickerState } {
  const state: TabPickerState = { injectableTabCount: 0 };
  let currentMode = "tab";

  function syncStartDisabled(): void {
    startBtn.disabled = currentMode === "tab" && state.injectableTabCount === 0;
  }

  async function refreshTabs(): Promise<void> {
    try {
      const priorRaw = tabSelect.value;
      const priorId = priorRaw ? parseInt(priorRaw, 10) : NaN;
      const r = await extensionSend<{
        tabs: Array<{ id: number; title: string; url: string }>;
      }>({
        type: "pulltalk-list-injectable-tabs",
        payload: { preferredTabId: prTabId },
      });
      const tabs = r.tabs ?? [];
      state.injectableTabCount = tabs.length;
      tabSelect.innerHTML = "";
      for (const t of tabs) {
        const opt = document.createElement("option");
        opt.value = String(t.id);
        let host = t.url.slice(0, 40);
        try { host = new URL(t.url).hostname; } catch { /* keep slice */ }
        opt.textContent = `${t.title} (${host})`;
        tabSelect.appendChild(opt);
      }
      let chosen: number | null = null;
      if (Number.isFinite(priorId) && tabs.some((t) => t.id === priorId)) {
        chosen = priorId;
      } else if (tabs.length > 0) {
        chosen = tabs[0].id;
      }
      if (chosen != null) tabSelect.value = String(chosen);
      tabPickEmpty.style.display = tabs.length === 0 ? "block" : "none";
      tabSelect.disabled = tabs.length === 0;
    } catch (e) {
      state.injectableTabCount = 0;
      tabPickEmpty.textContent = errorFromUnknown(e);
      tabPickEmpty.style.display = "block";
      tabSelect.disabled = true;
    }
    syncStartDisabled();
  }

  function syncVisibility(mode: string): void {
    currentMode = mode;
    tabPickWrap.style.display = mode === "tab" ? "block" : "none";
    syncStartDisabled();
  }

  return { refreshTabs, syncVisibility, state };
}
