import type { ExtensionMessage } from "./messages";

/**
 * Type-safe message handler map. Each key is a message type string and the
 * handler receives the narrowed message union member.
 *
 * Handlers that perform async work must return `true` to keep the
 * `sendResponse` channel open (standard Chrome messaging contract).
 */
export type MessageHandlerMap = {
  [K in ExtensionMessage["type"]]?: (
    msg: Extract<ExtensionMessage, { type: K }>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ) => void;
};

/**
 * Creates a `chrome.runtime.onMessage` listener from a typed handler map.
 * Unhandled message types are silently ignored (returns `false`).
 */
export function createMessageRouter(
  handlers: MessageHandlerMap,
): (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
) => boolean | undefined {
  return (message, sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return;
    }
    const handler = handlers[message.type as ExtensionMessage["type"]];
    if (handler) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as (m: any, s: any, sr: any) => void)(message, sender, sendResponse);
      return true;
    }
    return false;
  };
}
