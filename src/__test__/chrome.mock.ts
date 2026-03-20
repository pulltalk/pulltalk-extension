/**
 * Reusable Chrome extension API mocks for unit tests.
 *
 * Usage:
 *   import { installChromeMock } from "@/__test__/chrome.mock";
 *   beforeEach(() => installChromeMock());
 */
import { vi, type Mock } from "vitest";

export type MockPort = {
  name: string;
  postMessage: Mock;
  disconnect: Mock;
  onDisconnect: { addListener: Mock; removeListener: Mock };
  onMessage: { addListener: Mock; removeListener: Mock };
  sender?: { tab?: { id: number; url?: string }; url?: string };
};

export type MockChromeRuntime = {
  id: string;
  getURL: Mock;
  getManifest: Mock;
  sendMessage: Mock;
  onMessage: {
    addListener: Mock;
    removeListener: Mock;
    hasListener: Mock;
  };
  onConnect: {
    addListener: Mock;
    removeListener: Mock;
  };
  lastError: chrome.runtime.LastError | null;
};

export type MockChromeTabs = {
  query: Mock;
  get: Mock;
  create: Mock;
  update: Mock;
  sendMessage: Mock;
  onUpdated: { addListener: Mock; removeListener: Mock };
  onRemoved: { addListener: Mock; removeListener: Mock };
  getCurrent: Mock;
};

export type MockChromeStorageArea = {
  get: Mock;
  set: Mock;
  remove: Mock;
  clear: Mock;
};

export type MockChromeStorage = {
  session: MockChromeStorageArea;
  local: MockChromeStorageArea;
  sync: MockChromeStorageArea;
};

export type MockChromeScripting = {
  executeScript: Mock;
};

export type MockChromeAction = {
  onClicked: { addListener: Mock; removeListener: Mock };
  setBadgeText: Mock;
  setBadgeBackgroundColor: Mock;
};

export type MockChromeTabCapture = {
  getMediaStreamId: Mock;
};

export type MockChromeWindows = {
  update: Mock;
};

export type ChromeMock = {
  runtime: MockChromeRuntime;
  tabs: MockChromeTabs;
  storage: MockChromeStorage;
  scripting: MockChromeScripting;
  action: MockChromeAction;
  tabCapture: MockChromeTabCapture;
  windows: MockChromeWindows;
};

export function createMockRuntime(): MockChromeRuntime {
  return {
    id: "test-extension-id",
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    getManifest: vi.fn(() => ({ version: "1.0.0" })),
    sendMessage: vi.fn(
      (_msg: unknown, cb?: (resp: unknown) => void) => {
        cb?.(undefined);
        return Promise.resolve(undefined);
      },
    ),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
    },
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null as chrome.runtime.LastError | null,
  };
}

export function createMockTabs(): MockChromeTabs {
  return {
    query: vi.fn(() => Promise.resolve([])),
    get: vi.fn((id: number) =>
      Promise.resolve({ id, url: "", windowId: 0, index: 0 }),
    ),
    create: vi.fn(
      (_opts: unknown, cb?: (tab: { id: number }) => void) => {
        const tab = { id: 100 };
        cb?.(tab);
        return Promise.resolve(tab);
      },
    ),
    update: vi.fn(() => Promise.resolve({})),
    sendMessage: vi.fn(() => Promise.resolve(undefined)),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getCurrent: vi.fn(() => Promise.resolve(undefined)),
  };
}

export function createMockStorage(): MockChromeStorage {
  const stores: Record<string, Record<string, unknown>> = {
    session: {},
    local: {},
    sync: {},
  };

  function makeArea(name: string): MockChromeStorageArea {
    const store = stores[name];
    return {
      get: vi.fn((keys: string | string[]) => {
        const ks = typeof keys === "string" ? [keys] : keys;
        const result: Record<string, unknown> = {};
        for (const k of ks) {
          if (k in store) result[k] = store[k];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn(
        (items: Record<string, unknown>, cb?: () => void) => {
          Object.assign(store, items);
          cb?.();
          return Promise.resolve();
        },
      ),
      remove: vi.fn(
        (keys: string | string[], cb?: () => void) => {
          const ks = typeof keys === "string" ? [keys] : keys;
          for (const k of ks) delete store[k];
          cb?.();
          return Promise.resolve();
        },
      ),
      clear: vi.fn(() => {
        for (const k of Object.keys(store)) delete store[k];
        return Promise.resolve();
      }),
    };
  }

  return {
    session: makeArea("session"),
    local: makeArea("local"),
    sync: makeArea("sync"),
  };
}

export function createMockScripting(): MockChromeScripting {
  return {
    executeScript: vi.fn(() => Promise.resolve([])),
  };
}

export function createMockAction(): MockChromeAction {
  return {
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    setBadgeText: vi.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  };
}

export function createMockTabCapture(): MockChromeTabCapture {
  return {
    getMediaStreamId: vi.fn(
      (_opts: unknown, cb?: (id: string) => void) => {
        cb?.("mock-stream-id");
      },
    ),
  };
}

export function createMockWindows(): MockChromeWindows {
  return {
    update: vi.fn(() => Promise.resolve({})),
  };
}

export function createMockPort(name = "pulltalk-recorder"): MockPort {
  return {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  };
}

export function createChromeMock(): ChromeMock {
  return {
    runtime: createMockRuntime(),
    tabs: createMockTabs(),
    storage: createMockStorage(),
    scripting: createMockScripting(),
    action: createMockAction(),
    tabCapture: createMockTabCapture(),
    windows: createMockWindows(),
  };
}

export function installChromeMock(mock?: ChromeMock): ChromeMock {
  const m = mock ?? createChromeMock();
  Object.defineProperty(globalThis, "chrome", {
    value: m,
    writable: true,
    configurable: true,
  });
  return m;
}
