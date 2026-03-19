import { describe, it, expect } from "vitest";
import { isInjectableTabUrl } from "./injectableTabUrl";

describe("isInjectableTabUrl", () => {
  it("allows normal http URLs", () => {
    expect(isInjectableTabUrl("https://github.com/foo/bar")).toBe(true);
    expect(isInjectableTabUrl("http://localhost:3000")).toBe(true);
  });

  it("rejects chrome:// URLs", () => {
    expect(isInjectableTabUrl("chrome://extensions")).toBe(false);
  });

  it("rejects chrome-extension:// URLs", () => {
    expect(isInjectableTabUrl("chrome-extension://abc/popup.html")).toBe(false);
  });

  it("rejects edge:// URLs", () => {
    expect(isInjectableTabUrl("edge://settings")).toBe(false);
  });

  it("rejects about: URLs", () => {
    expect(isInjectableTabUrl("about:blank")).toBe(false);
  });

  it("rejects devtools:// URLs", () => {
    expect(isInjectableTabUrl("devtools://devtools/bundled/inspector.html")).toBe(
      false,
    );
  });

  it("rejects view-source: URLs", () => {
    expect(isInjectableTabUrl("view-source:https://example.com")).toBe(false);
  });
});
