import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "@/__test__/chrome.mock";
import { findGithubPrTab } from "./tabs";

beforeEach(() => {
  installChromeMock();
});

describe("findGithubPrTab", () => {
  it("returns the tab id matching the PR path", async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 10, url: "https://github.com/owner/repo/pull/42" } as chrome.tabs.Tab,
      { id: 20, url: "https://github.com/other/repo/pull/1" } as chrome.tabs.Tab,
    ]);
    const result = await findGithubPrTab("owner", "repo", "42");
    expect(result).toBe(10);
  });

  it("matches sub-pages of the PR", async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 10, url: "https://github.com/owner/repo/pull/42/files" } as chrome.tabs.Tab,
    ]);
    const result = await findGithubPrTab("owner", "repo", "42");
    expect(result).toBe(10);
  });

  it("returns undefined when no tab matches", async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 10, url: "https://github.com/other/repo/pull/99" } as chrome.tabs.Tab,
    ]);
    const result = await findGithubPrTab("owner", "repo", "42");
    expect(result).toBeUndefined();
  });

  it("skips tabs without id or url", async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { url: "https://github.com/owner/repo/pull/42" } as chrome.tabs.Tab,
      { id: 5 } as chrome.tabs.Tab,
    ]);
    const result = await findGithubPrTab("owner", "repo", "42");
    expect(result).toBeUndefined();
  });
});
