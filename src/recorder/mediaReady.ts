/**
 * Wait until a <video> backed by capture/camera has decodable dimensions.
 * Avoids compositing/recording black frames while videoWidth/height are still 0.
 */

function isVideoPaintReady(video: HTMLVideoElement): boolean {
  return (
    video.videoWidth >= 2 &&
    video.videoHeight >= 2 &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  );
}

export type WaitForVideoReadyOptions = {
  /** Default 15_000 */
  timeoutMs?: number;
  /** For error messages */
  label?: string;
};

/**
 * Ensures `play()` was attempted (with visible errors) and waits for the first
 * frame dimensions. Rejects on timeout or if the video track ends first.
 */
export async function waitForVideoReady(
  video: HTMLVideoElement,
  options?: WaitForVideoReadyOptions
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const label = options?.label ?? "video";

  try {
    await video.play();
  } catch (e) {
    console.error(`[PullTalk] video.play() failed (${label}):`, e);
    throw e instanceof Error
      ? e
      : new Error(`Could not start video playback (${label})`);
  }

  if (isVideoPaintReady(video)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(
        new Error(
          `Screen capture did not produce video frames (${label}) within ${timeoutMs / 1000}s. Try sharing again or pick another source.`
        )
      );
    }, timeoutMs);

    const stream =
      video.srcObject instanceof MediaStream ? video.srcObject : null;
    const vTrack = stream?.getVideoTracks()[0] ?? null;

    const cleanup = (): void => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", check);
      video.removeEventListener("playing", check);
      video.removeEventListener("canplay", check);
      video.removeEventListener("resize", check);
      vTrack?.removeEventListener("unmute", check);
      vTrack?.removeEventListener("ended", onEnded);
    };

    const finish = (ok: boolean, err?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (ok) {
        resolve();
      } else {
        reject(err ?? new Error(`Video became unavailable (${label})`));
      }
    };

    const check = (): void => {
      if (isVideoPaintReady(video)) {
        finish(true);
      }
    };

    const onEnded = (): void => {
      finish(
        false,
        new Error(`Video track ended before frames arrived (${label})`)
      );
    };

    video.addEventListener("loadeddata", check);
    video.addEventListener("playing", check);
    video.addEventListener("canplay", check);
    video.addEventListener("resize", check);
    vTrack?.addEventListener("unmute", check);
    vTrack?.addEventListener("ended", onEnded);

    check();
  });
}
