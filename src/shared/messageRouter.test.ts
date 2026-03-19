import { describe, it, expect, vi, beforeEach } from "vitest";
import { installChromeMock } from "@/__test__/chrome.mock";
import { createMessageRouter, type MessageHandlerMap } from "./messageRouter";

beforeEach(() => {
  installChromeMock();
});

describe("createMessageRouter", () => {
  it("dispatches to the correct handler based on message type", () => {
    const handler = vi.fn();
    const handlers: MessageHandlerMap = {
      "pulltalk-query-content-tab-id": handler,
    };
    const router = createMessageRouter(handlers);
    const sendResponse = vi.fn();
    const sender = {};

    const result = router(
      { type: "pulltalk-query-content-tab-id" },
      sender,
      sendResponse,
    );

    expect(handler).toHaveBeenCalledWith(
      { type: "pulltalk-query-content-tab-id" },
      sender,
      sendResponse,
    );
    expect(result).toBe(true);
  });

  it("returns false for unhandled message types", () => {
    const handlers: MessageHandlerMap = {};
    const router = createMessageRouter(handlers);
    const result = router(
      { type: "stop-recording" },
      {},
      vi.fn(),
    );
    expect(result).toBe(false);
  });

  it("returns undefined for invalid messages", () => {
    const router = createMessageRouter({});
    const result = router(null as never, {}, vi.fn());
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-object messages", () => {
    const router = createMessageRouter({});
    const result = router("hello" as never, {}, vi.fn());
    expect(result).toBeUndefined();
  });
});
