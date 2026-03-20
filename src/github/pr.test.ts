import { describe, it, expect, afterEach } from "vitest";
import { getCurrentPRId, getCurrentRepo } from "./pr";

describe("getCurrentPRId", () => {
  const origLocation = window.location;

  function setHref(href: string): void {
    Object.defineProperty(window, "location", {
      value: { ...origLocation, href },
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: origLocation,
      writable: true,
      configurable: true,
    });
  });

  it("extracts PR number from a standard PR URL", () => {
    setHref("https://github.com/owner/repo/pull/42");
    expect(getCurrentPRId()).toBe("42");
  });

  it("extracts PR number from a PR sub-page", () => {
    setHref("https://github.com/owner/repo/pull/123/files");
    expect(getCurrentPRId()).toBe("123");
  });

  it("returns null when URL is not a PR page", () => {
    setHref("https://github.com/owner/repo/issues/5");
    expect(getCurrentPRId()).toBeNull();
  });

  it("returns null for a bare repo URL", () => {
    setHref("https://github.com/owner/repo");
    expect(getCurrentPRId()).toBeNull();
  });
});

describe("getCurrentRepo", () => {
  const origLocation = window.location;

  function setHref(href: string): void {
    Object.defineProperty(window, "location", {
      value: { ...origLocation, href },
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: origLocation,
      writable: true,
      configurable: true,
    });
  });

  it("extracts owner and repo from a GitHub URL", () => {
    setHref("https://github.com/octocat/hello-world/pull/1");
    expect(getCurrentRepo()).toEqual({ owner: "octocat", repo: "hello-world" });
  });

  it("returns null for a non-GitHub URL", () => {
    setHref("https://example.com/foo/bar");
    expect(getCurrentRepo()).toBeNull();
  });

  it("handles orgs with hyphens and dots", () => {
    setHref("https://github.com/my-org/my.repo/pull/99");
    expect(getCurrentRepo()).toEqual({ owner: "my-org", repo: "my.repo" });
  });
});
