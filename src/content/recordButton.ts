import { sendOpenRecorderSetup } from "./messages";
import { showToast } from "./notifications";
import { getCurrentPRId, getCurrentRepo } from "@/github/pr";
import { findCommentTextareas } from "@/github/dom";
import { insertCommentMarkdown } from "@/github/insertComment";
import { formatRecordingCommentMarkdown } from "@/github/recordingComment";
import type { ExtensionMessage } from "@/shared/messages";
import {
  errorFromUnknown,
  EXTENSION_RELOAD_USER_HINT,
  isExtensionContextValid,
} from "@/shared/extensionRuntime";

import { OPEN_RECORDER_SETUP_TIMEOUT_MS } from "@/shared/constants";

let activeTextarea: HTMLTextAreaElement | null = null;

function sendOpenRecorderSetupWithTimeout(
  payload: Parameters<typeof sendOpenRecorderSetup>[0]
): Promise<{ ok: boolean; error?: string }> {
  return Promise.race([
    sendOpenRecorderSetup(payload).catch((e) => ({
      ok: false as const,
      error: errorFromUnknown(e),
    })),
    new Promise<{ ok: boolean; error: string }>((resolve) => {
      window.setTimeout(() => {
        resolve({
          ok: false,
          error: "Timed out opening PullTalk — try again",
        });
      }, OPEN_RECORDER_SETUP_TIMEOUT_MS);
    }),
  ]);
}

function wireRuntimeMessages(): void {
  chrome.runtime.onMessage.addListener(
    (msg: ExtensionMessage, _sender, sendResponse) => {
      if (!msg?.type) {
        return;
      }
      if (msg.type === "recording-url") {
        const ta = activeTextarea;
        const url = msg.payload.url;
        if (ta) {
          insertCommentMarkdown(ta, formatRecordingCommentMarkdown(url));
          showToast("Link inserted into comment");
        } else {
          showToast("Recording ready — paste the link from the console", "error");
          console.info("PullTalk recording URL:", url);
        }
        sendResponse({ ok: true });
        return true;
      }
      if (msg.type === "recording-error") {
        showToast(msg.payload.message, "error");
        sendResponse({ ok: true });
        return true;
      }
      if (msg.type === "recording-awaiting-editor") {
        showToast(
          "Recording stopped — finish in the PullTalk editor tab (upload there).",
          "info"
        );
        sendResponse({ ok: true });
        return true;
      }
      if (msg.type === "recording-started") {
        sendResponse({ ok: true });
        return true;
      }
      return false;
    }
  );
}

export function injectRecordButton(anchor: HTMLElement): void {
  if (anchor.querySelector(".pulltalk-record-btn")) {
    return;
  }

  const btn = document.createElement("button");
  btn.textContent = "Record";
  btn.className = "pulltalk-record-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Record video comment");
  Object.assign(btn.style, {
    marginLeft: "8px",
    padding: "5px 10px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#238636",
    color: "white",
    border: "1px solid rgba(240, 246, 252, 0.1)",
    borderRadius: "6px",
    fontWeight: "500",
  });

  btn.addEventListener("click", (): void => void (async (): Promise<void> => {
    if (btn.disabled) {
      return;
    }

    try {
      if (!isExtensionContextValid()) {
        showToast(EXTENSION_RELOAD_USER_HINT, "error");
        return;
      }

      const textareas = findCommentTextareas();
      const ta =
        textareas.find((t) => anchor.contains(t)) ??
        textareas[0] ??
        null;
      activeTextarea = ta;

      const repo = getCurrentRepo();
      const prId = getCurrentPRId();
      if (!repo || !prId) {
        showToast("Could not detect repository or PR", "error");
        return;
      }

      btn.disabled = true;
      const result = await sendOpenRecorderSetupWithTimeout({
        owner: repo.owner,
        repo: repo.repo,
        prId,
      });

      if (!result.ok) {
        btn.disabled = false;
        showToast(result.error ?? "Could not open PullTalk", "error");
        return;
      }

      btn.disabled = false;
      showToast("Configure recording in the PullTalk tab.", "info");
    } catch (e) {
      btn.disabled = false;
      showToast(errorFromUnknown(e), "error");
    }
  })());

  const parent = anchor.parentElement || anchor;
  if (parent.nextSibling) {
    parent.parentElement?.insertBefore(btn, parent.nextSibling);
  } else {
    parent.parentElement?.appendChild(btn);
  }
}

export function initPullTalkUi(): void {
  wireRuntimeMessages();
}
