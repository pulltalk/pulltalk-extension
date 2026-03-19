import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "@/__test__/chrome.mock";
import {
  isExtensionContextValid,
  userFacingRuntimeError,
  errorFromUnknown,
  getReloadHint,
  EXTENSION_RELOAD_USER_HINT,
} from "./extensionRuntime";

beforeEach(() => {
  installChromeMock();
});

describe("getReloadHint", () => {
  it("returns GitHub-specific hint for github context", () => {
    expect(getReloadHint("github")).toContain("GitHub tab");
  });

  it("returns generic hint for extension context", () => {
    expect(getReloadHint("extension")).toContain("this page");
    expect(getReloadHint("extension")).not.toContain("GitHub tab");
  });

  it("defaults to extension context", () => {
    expect(getReloadHint()).toBe(getReloadHint("extension"));
  });
});

describe("EXTENSION_RELOAD_USER_HINT", () => {
  it("matches the github hint for backward compat", () => {
    expect(EXTENSION_RELOAD_USER_HINT).toBe(getReloadHint("github"));
  });
});

describe("isExtensionContextValid", () => {
  it("returns true when chrome.runtime.id is set", () => {
    expect(isExtensionContextValid()).toBe(true);
  });

  it("returns false when chrome.runtime.id is empty", () => {
    (chrome.runtime as { id: string }).id = "";
    expect(isExtensionContextValid()).toBe(false);
  });

  it("returns false when chrome.runtime throws", () => {
    Object.defineProperty(globalThis, "chrome", {
      get() {
        throw new Error("context invalidated");
      },
      configurable: true,
    });
    expect(isExtensionContextValid()).toBe(false);
    installChromeMock();
  });
});

describe("userFacingRuntimeError", () => {
  it("returns hint for 'extension context invalidated'", () => {
    const result = userFacingRuntimeError("Extension context invalidated");
    expect(result).toContain("refresh this page");
  });

  it("returns hint for 'context invalidated' (partial match)", () => {
    const result = userFacingRuntimeError("Some context invalidated here");
    expect(result).toContain("refresh this page");
  });

  it("returns hint for 'receiving end does not exist'", () => {
    const result = userFacingRuntimeError(
      "Could not establish connection. Receiving end does not exist.",
    );
    expect(result).toContain("refresh this page");
  });

  it("returns GitHub-specific hint when context is github", () => {
    const result = userFacingRuntimeError(
      "Extension context invalidated",
      "github",
    );
    expect(result).toContain("GitHub tab");
  });

  it("passes through unrecognized messages unchanged", () => {
    expect(userFacingRuntimeError("Network error")).toBe("Network error");
  });
});

describe("errorFromUnknown", () => {
  it("extracts message from Error objects", () => {
    const result = errorFromUnknown(new Error("something broke"));
    expect(result).toBe("something broke");
  });

  it("converts non-Error values to string", () => {
    expect(errorFromUnknown(42)).toBe("42");
    expect(errorFromUnknown(null)).toBe("null");
    expect(errorFromUnknown(undefined)).toBe("undefined");
  });

  it("maps 'Extension context invalidated' Error to hint", () => {
    const result = errorFromUnknown(
      new Error("Extension context invalidated"),
    );
    expect(result).toContain("refresh this page");
  });

  it("uses github context when specified", () => {
    const result = errorFromUnknown(
      new Error("Extension context invalidated"),
      "github",
    );
    expect(result).toContain("GitHub tab");
  });
});
