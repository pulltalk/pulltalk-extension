import { describe, it, expect } from "vitest";
import { formatRecordingCommentMarkdown } from "./recordingComment";

describe("formatRecordingCommentMarkdown", () => {
  it("wraps a simple URL in markdown link", () => {
    const result = formatRecordingCommentMarkdown(
      "https://storage.example.com/video.webm",
    );
    expect(result).toContain(
      "[Watch recording](https://storage.example.com/video.webm)",
    );
    expect(result).toContain("**PullTalk**");
  });

  it("wraps URLs with spaces in angle brackets", () => {
    const url = "https://storage.example.com/my video.webm";
    const result = formatRecordingCommentMarkdown(url);
    expect(result).toContain(`[Watch recording](<${url}>)`);
  });

  it("wraps URLs containing ) in angle brackets", () => {
    const url = "https://storage.example.com/file(1).webm";
    const result = formatRecordingCommentMarkdown(url);
    expect(result).toContain(`[Watch recording](<${url}>)`);
  });

  it("includes surrounding newlines for clean embedding", () => {
    const result = formatRecordingCommentMarkdown("https://example.com/v.webm");
    expect(result.startsWith("\n\n")).toBe(true);
    expect(result.endsWith("\n\n")).toBe(true);
  });
});
