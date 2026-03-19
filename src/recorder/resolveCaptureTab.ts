/**
 * Read Chrome display-surface metadata from getDisplayMedia streams
 * (not set on tab-capture streams — treat those as in-tab capture separately).
 */

export function getVideoDisplaySurface(
  stream: MediaStream
): string | undefined {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    return undefined;
  }
  const settings = track.getSettings() as MediaTrackSettings & {
    displaySurface?: string;
  };
  return settings.displaySurface;
}

export function isBrowserDisplaySurface(stream: MediaStream): boolean {
  return getVideoDisplaySurface(stream) === "browser";
}
