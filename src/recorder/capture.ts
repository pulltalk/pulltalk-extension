import type { DisplaySurfaceHint } from "@/shared/messages";

export async function acquireDisplayMediaStream(
  displaySurface: DisplaySurfaceHint
): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: true,
  });
}

export async function acquireCameraVideoStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user",
    },
    audio: false,
  });
}

export async function acquireMicStream(
  micOn: boolean
): Promise<MediaStream | null> {
  if (!micOn) {
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } catch {
    return null;
  }
}
