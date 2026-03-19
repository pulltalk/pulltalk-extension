import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "@/__test__/chrome.mock";
import { validateCapturePayload, senderIsRecorderExtensionPage } from "./validation";
import type { StartRecordingPayload } from "@/shared/messages";

beforeEach(() => {
  installChromeMock();
});

describe("validateCapturePayload", () => {
  const basePayload: StartRecordingPayload = {
    owner: "o",
    repo: "r",
    prId: "1",
    recordingType: "screen",
    captureMode: "monitor",
    displaySurfaceHint: "monitor",
    captureTargetTabId: null,
    cameraOn: false,
    micOn: false,
    pushToTalk: false,
    virtualBackground: false,
    virtualBgColor: "#009900",
    virtualBgEffect: "color",
    countdownSec: 0,
    alarmMinutes: null,
  };

  it("returns null for non-tab capture modes", () => {
    expect(validateCapturePayload({ ...basePayload, captureMode: "monitor" })).toBeNull();
    expect(validateCapturePayload({ ...basePayload, captureMode: "window" })).toBeNull();
  });

  it("returns error when tab mode has no target tab id", () => {
    const result = validateCapturePayload({
      ...basePayload,
      captureMode: "tab",
      captureTargetTabId: null,
    });
    expect(result).toContain("Pick a tab");
  });

  it("returns null when tab mode has a valid target tab id", () => {
    const result = validateCapturePayload({
      ...basePayload,
      captureMode: "tab",
      captureTargetTabId: 42,
    });
    expect(result).toBeNull();
  });
});

describe("senderIsRecorderExtensionPage", () => {
  it("returns true for recorder.html from extension origin", () => {
    const sender: chrome.runtime.MessageSender = {
      tab: { id: 1, url: "chrome-extension://test-id/src/recorder/recorder.html", index: 0, pinned: false, highlighted: false, active: true, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, windowId: 1 },
    };
    expect(senderIsRecorderExtensionPage(sender)).toBe(true);
  });

  it("returns false for non-extension URLs", () => {
    const sender: chrome.runtime.MessageSender = {
      tab: { id: 1, url: "https://github.com/recorder.html", index: 0, pinned: false, highlighted: false, active: true, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, windowId: 1 },
    };
    expect(senderIsRecorderExtensionPage(sender)).toBe(false);
  });

  it("returns false when URL is missing", () => {
    const sender: chrome.runtime.MessageSender = {};
    expect(senderIsRecorderExtensionPage(sender)).toBe(false);
  });
});
