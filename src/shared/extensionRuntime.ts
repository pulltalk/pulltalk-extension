/**
 * Runtime validity for extension pages and content scripts (shared).
 */

const HINT_GITHUB =
  "PullTalk was reloaded or updated — refresh this GitHub tab (⌘R / Ctrl+R), then try again.";
const HINT_GENERIC =
  "PullTalk was reloaded or updated — refresh this page (⌘R / Ctrl+R), then try again.";

export type RuntimeContext = "github" | "extension";

export function getReloadHint(context: RuntimeContext = "extension"): string {
  return context === "github" ? HINT_GITHUB : HINT_GENERIC;
}

/**
 * @deprecated Use {@link getReloadHint} directly. Kept for backward compat.
 */
export const EXTENSION_RELOAD_USER_HINT = HINT_GITHUB;

export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function userFacingRuntimeError(
  message: string,
  context: RuntimeContext = "extension",
): string {
  const m = message.toLowerCase();
  if (
    m.includes("extension context invalidated") ||
    m.includes("context invalidated")
  ) {
    return getReloadHint(context);
  }
  if (m.includes("receiving end does not exist")) {
    return getReloadHint(context);
  }
  return message;
}

export function errorFromUnknown(
  err: unknown,
  context: RuntimeContext = "extension",
): string {
  if (err instanceof Error) {
    return userFacingRuntimeError(err.message, context);
  }
  return userFacingRuntimeError(String(err), context);
}
