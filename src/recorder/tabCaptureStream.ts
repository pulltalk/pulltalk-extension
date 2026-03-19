/**
 * Capture a specific tab by ID (chrome.tabCapture + getUserMedia).
 * `consumerTabId` must be the tab where getUserMedia runs (recorder page).
 */

type TabCaptureWithStreamId = typeof chrome.tabCapture & {
  getMediaStreamId(
    options: { targetTabId: number; consumerTabId: number },
    callback: (streamId: string | undefined) => void
  ): void;
};

function getTabCaptureApi(): TabCaptureWithStreamId {
  return chrome.tabCapture as TabCaptureWithStreamId;
}

export function acquireTabCaptureMediaStreamFromId(
  streamId: string
): Promise<MediaStream> {
  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        maxWidth: 1920,
        maxHeight: 1080,
        minFrameRate: 15,
        maxFrameRate: 30,
      },
    },
  } as MediaStreamConstraints;

  return navigator.mediaDevices.getUserMedia(constraints);
}

export function acquireTabCaptureMediaStream(
  targetTabId: number,
  consumerTabId: number
): Promise<MediaStream> {
  const api = getTabCaptureApi();
  if (!api || typeof api.getMediaStreamId !== "function") {
    return Promise.reject(
      new Error("tabCapture.getMediaStreamId is not available in this Chrome build")
    );
  }

  return new Promise((resolve, reject) => {
    api.getMediaStreamId(
      { targetTabId, consumerTabId },
      (streamId: string | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!streamId) {
          reject(new Error("No tab capture stream id returned"));
          return;
        }

        const constraints = {
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: streamId,
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: streamId,
              maxWidth: 1920,
              maxHeight: 1080,
              minFrameRate: 15,
              maxFrameRate: 30,
            },
          },
        } as MediaStreamConstraints;

        void navigator.mediaDevices
          .getUserMedia(constraints)
          .then(resolve)
          .catch(reject);
      }
    );
  });
}
