import {
  RECORDER_PORT_NAME,
  type ExtensionMessage,
  type RecorderPortMessage,
  type RecorderSetupContext,
  type StartRecordingPayload,
} from "@/shared/messages";
import { PULLTALK_RECORDER_SETUP_CONTEXT_KEY } from "@/shared/storageKeys";
import { openRecordModal } from "@/shared/recordSetupModal";
import { RecordSession } from "./recordSession";
import { clearStopPollTimer, runRecorderFlow, showRecorderError } from "./recorderApp";

const session = new RecordSession();
let finalizeStarted = false;
/** PR metadata for editor URL + upload fallback */
let lastCapturePayload: StartRecordingPayload | null = null;

function editorUrl(blobKey: string, durationMs?: number): string {
  const q = new URLSearchParams({ k: blobKey });
  const p = lastCapturePayload;
  if (p) {
    q.set("o", p.owner);
    q.set("r", p.repo);
    q.set("p", p.prId);
  }
  if (durationMs != null && durationMs > 0) {
    q.set("d", String(durationMs));
  }
  return `${chrome.runtime.getURL("src/editor/editor.html")}?${q}`;
}

function finalizeRecording(
  p: Promise<{ blobKey: string; size: number; durationMs: number }>
): void {
  if (finalizeStarted) {
    return;
  }
  finalizeStarted = true;
  void p.then(({ blobKey, durationMs }) => {
    window.location.href = editorUrl(blobKey, durationMs);
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    void chrome.runtime.sendMessage({
      type: "recording-error",
      payload: { message: msg },
    });
    showRecorderError(msg);
  });
}

session.onRequestFinalize = (p): void => {
  finalizeRecording(p);
};

let receivedCaptureMessage = false;
let connectAttempts = 0;
const MAX_CONNECT_ATTEMPTS = 4;

function connect(): void {
  connectAttempts += 1;
  const port = chrome.runtime.connect({ name: RECORDER_PORT_NAME });

  port.onMessage.addListener((msg: RecorderPortMessage) => {
    if (msg.type === "start-capture") {
      receivedCaptureMessage = true;
      lastCapturePayload = msg.payload;
      finalizeStarted = false;
      void runRecorderFlow(msg.payload, session, () => {
        clearStopPollTimer();
        session.clearRecordingAlarm?.();
        finalizeRecording(session.stopAndPersist());
      }, msg.tabCaptureStreamId).catch((e) => {
        const errText = e instanceof Error ? e.message : String(e);
        void chrome.runtime.sendMessage({
          type: "recording-error",
          payload: { message: errText },
        });
        showRecorderError(errText);
      });
    }
    if (msg.type === "capture-error") {
      showRecorderError(msg.message);
    }
    if (msg.type === "stop-capture") {
      if (!receivedCaptureMessage) {
        return;
      }
      clearStopPollTimer();
      session.clearRecordingAlarm?.();
      finalizeRecording(session.stopAndPersist());
    }
  });

  port.onDisconnect.addListener(() => {
    if (receivedCaptureMessage || connectAttempts >= MAX_CONNECT_ATTEMPTS) {
      return;
    }
    window.setTimeout(() => {
      if (!receivedCaptureMessage) {
        connect();
      }
    }, 120);
  });
}

function loadSetupContext(): Promise<RecorderSetupContext | null> {
  return new Promise((resolve) => {
    chrome.storage.session.get(PULLTALK_RECORDER_SETUP_CONTEXT_KEY, (r) => {
      const ctx = r[PULLTALK_RECORDER_SETUP_CONTEXT_KEY] as
        | RecorderSetupContext
        | undefined;
      resolve(ctx ?? null);
    });
  });
}

function showAwaitingActionClick(): void {
  document.body.innerHTML = "";
  document.body.style.cssText =
    "margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;color:#c9d1d9;font-family:system-ui,sans-serif";
  const wrap = document.createElement("div");
  wrap.style.cssText = "max-width:30rem;text-align:center;padding:2rem";
  const icon = document.createElement("p");
  icon.style.cssText = "font-size:48px;margin:0 0 16px";
  icon.textContent = "\u{1F3AC}";
  const title = document.createElement("p");
  title.style.cssText = "font-weight:700;font-size:18px;margin:0 0 12px;color:#e2e8f0";
  title.textContent = "Click the PullTalk icon to start capturing";
  const desc = document.createElement("p");
  desc.style.cssText = "font-size:14px;line-height:1.6;margin:0 0 20px;color:#94a3b8";
  desc.innerHTML =
    'The target tab has been focused. Click the <strong style="color:#c9d1d9">PullTalk icon</strong> in your browser toolbar to grant capture access, then recording will begin automatically.';
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.style.cssText =
    "padding:10px 24px;border-radius:8px;border:1px solid #30363d;background:#21262d;color:#c9d1d9;cursor:pointer;font-size:14px;font-weight:600";
  cancel.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "recording-error", payload: { message: "Cancelled" } });
    window.close();
  });
  wrap.append(icon, title, desc, cancel);
  document.body.appendChild(wrap);
}

async function shouldAbortWithoutRecorderConnect(): Promise<boolean> {
  const pageUrl = new URL(window.location.href);
  if (pageUrl.searchParams.get("setup") !== "1") {
    return false;
  }

  const ctx = await loadSetupContext();
  if (!ctx) {
    document.body.innerHTML =
      "<p>PullTalk setup expired or missing. Click <strong>Record</strong> on the PR again.</p>";
    return true;
  }

  const modal = await openRecordModal(ctx.prTabId);
  if (modal.action === "cancel") {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        { type: "pulltalk-cancel-recorder-setup" } satisfies ExtensionMessage,
        () => resolve()
      );
    });
    window.close();
    return true;
  }

  const fullPayload = {
    ...modal.payload,
    owner: ctx.owner,
    repo: ctx.repo,
    prId: ctx.prId,
  };

  const startResult = await new Promise<{ ok?: boolean; error?: string; awaitingActionClick?: boolean }>(
    (resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "start-recording-in-tab",
          payload: fullPayload,
          prTabId: ctx.prTabId,
        } satisfies ExtensionMessage,
        (response) => resolve((response as { ok?: boolean; error?: string; awaitingActionClick?: boolean } | undefined) ?? { ok: false, error: "No response" })
      );
    }
  );

  if (!startResult.ok) {
    document.body.innerHTML = `<p>${startResult.error ?? "Could not start recording"}</p>`;
    return true;
  }

  pageUrl.searchParams.delete("setup");
  const next = pageUrl.pathname + (pageUrl.search || "");
  window.history.replaceState({}, "", next);

  if (startResult.awaitingActionClick) {
    showAwaitingActionClick();
  }

  return false;
}

void (async (): Promise<void> => {
  if (await shouldAbortWithoutRecorderConnect()) {
    return;
  }
  connect();
})();
