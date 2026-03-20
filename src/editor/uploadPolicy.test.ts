import { describe, expect, it } from "vitest";
import { chooseUploadBackend } from "./uploadPolicy";

describe("chooseUploadBackend", () => {
  it("uses wasm when no re-encode", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 50 * 1024 * 1024,
        vNatW: 3840,
        vNatH: 2160,
        hasCrop: true,
        needsReencode: false,
      }),
    ).toBe("wasm");
  });

  it("uses wasm for a typical 1-min 720p clip with edits", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 30 * 1024 * 1024,
        vNatW: 1280,
        vNatH: 720,
        hasCrop: false,
        needsReencode: true,
      }),
    ).toBe("wasm");
  });

  it("uses wasm for 1080p edits under threshold", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 40 * 1024 * 1024,
        vNatW: 1920,
        vNatH: 1080,
        hasCrop: false,
        needsReencode: true,
      }),
    ).toBe("wasm");
  });

  it("uses server for very large blob (>80 MB) with edits", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 85 * 1024 * 1024,
        vNatW: 1280,
        vNatH: 720,
        hasCrop: false,
        needsReencode: true,
      }),
    ).toBe("server");
  });

  it("uses server for 1440p+ with edits", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 10 * 1024 * 1024,
        vNatW: 2560,
        vNatH: 1441,
        hasCrop: false,
        needsReencode: true,
      }),
    ).toBe("server");
  });

  it("uses wasm for 1440p exactly (boundary)", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 10 * 1024 * 1024,
        vNatW: 2560,
        vNatH: 1440,
        hasCrop: false,
        needsReencode: true,
      }),
    ).toBe("wasm");
  });

  it("uses server for crop + very large blob", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 55 * 1024 * 1024,
        vNatW: 1920,
        vNatH: 1080,
        hasCrop: true,
        needsReencode: true,
      }),
    ).toBe("server");
  });

  it("uses wasm for crop + normal-size blob", () => {
    expect(
      chooseUploadBackend({
        blobBytes: 20 * 1024 * 1024,
        vNatW: 1280,
        vNatH: 720,
        hasCrop: true,
        needsReencode: true,
      }),
    ).toBe("wasm");
  });
});
