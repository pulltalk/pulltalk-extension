import { idbDeleteBlob, idbGetBlob, idbPutBlob, makeBlobKey } from "@/shared/idb";
import type { ExtensionMessage } from "@/shared/messages";
import { isFirebaseConfigured, uploadVideoBlob } from "@/storage/upload";
import type { EditorState } from "./editorState";
import type { PrMeta } from "./editorState";
import { processVideo } from "./ffmpegProcessor";

const PROCESSING_FINAL_HINT =
  " If this keeps failing, try “Upload without edits” or a shorter clip — in-browser encoding has strict memory limits.";

export type ModalHandle = {
  show: (o: { title: string; infoHtml: string; eyebrow?: string; indeterminate?: boolean }) => void;
  setProgress: (pct: number) => void;
  hide: () => void;
};

export async function focusPrTabIfPossible(
  meta: PrMeta | null,
): Promise<void> {
  if (!meta) return;
  const prefix = `https://github.com/${meta.owner}/${meta.repo}/pull/${meta.prId}`;
  try {
    const tabs = await chrome.tabs.query({ url: "https://github.com/*/*/pull/*" });
    for (const t of tabs) {
      if (t.id != null && t.url?.startsWith(prefix)) {
        await chrome.tabs.update(t.id, { active: true });
        return;
      }
    }
  } catch {
    /* ignore */
  }
}

export function showSuccessScreen(
  root: HTMLElement,
  appEl: HTMLElement | null,
  url: string,
  linkInserted: boolean,
  prMeta: PrMeta | null,
): void {
  if (appEl) appEl.hidden = true;
  const success = document.createElement("div");
  success.className = "pt-success";
  const h2 = document.createElement("h2");
  h2.textContent = "Done";
  success.appendChild(h2);

  if (linkInserted) {
    const pEl = document.createElement("p");
    pEl.textContent =
      "The video link was added to your PR comment box on GitHub. Switch to that tab to review or post your comment.";
    success.appendChild(pEl);
    void focusPrTabIfPossible(prMeta);
  } else {
    const pEl = document.createElement("p");
    pEl.textContent =
      "Upload finished. We couldn't reach your GitHub tab (it may be closed). Copy the link below and paste it into your PR comment.";
    success.appendChild(pEl);
    const row = document.createElement("div");
    row.className = "pt-success__row";
    const input = document.createElement("input");
    input.readOnly = true;
    input.value = url;
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "pt-btn pt-btn--primary";
    copyBtn.textContent = "Copy link";
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(url).then(
        () => { copyBtn.textContent = "Copied!"; },
        () => { copyBtn.textContent = "Select & copy"; input.select(); },
      );
    });
    row.append(input, copyBtn);
    success.appendChild(row);
    void focusPrTabIfPossible(prMeta);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "pt-btn pt-btn--outline";
  closeBtn.textContent = "Close this tab";
  closeBtn.addEventListener("click", () => window.close());
  success.appendChild(closeBtn);
  root.appendChild(success);

  window.setTimeout(() => {
    try { window.close(); } catch { /* user may have blocked */ }
  }, 8000);
}

export async function runUpload(
  blobKey: string,
  prMeta: PrMeta | null,
  state: EditorState,
  modal: ModalHandle,
  ui: {
    root: HTMLElement;
    appEl: HTMLElement | null;
    btnUpload: HTMLButtonElement;
    btnApply: HTMLButtonElement;
    btnDiscard: HTMLButtonElement;
    setInlineErr: (text: string) => void;
  },
): Promise<void> {
  if (state.uploadInFlight) return;
  state.uploadInFlight = true;
  ui.setInlineErr("");
  ui.btnUpload.disabled = true;
  ui.btnApply.disabled = true;
  ui.btnDiscard.disabled = true;

  modal.show({
    title: "Uploading…",
    infoHtml:
      "<strong>Keep this tab open</strong> until the upload finishes. Closing it may interrupt the transfer.",
    indeterminate: true,
  });

  const resetButtons = (): void => {
    state.uploadInFlight = false;
    modal.hide();
    ui.btnUpload.disabled = false;
    ui.btnApply.disabled = !state.durationKnown;
    ui.btnDiscard.disabled = false;
  };

  if (!prMeta) {
    resetButtons();
    ui.setInlineErr(
      "Missing PR context. Open a pull request on GitHub and start recording from the PullTalk button there.",
    );
    return;
  }

  if (!isFirebaseConfigured()) {
    resetButtons();
    ui.setInlineErr(
      "Firebase is not configured. Set VITE_FIREBASE_* in .env and rebuild.",
    );
    return;
  }

  const upBlob = await idbGetBlob(blobKey);
  let u = "";
  let linkInsertedInPrTab = false;

  try {
    if (!upBlob || upBlob.size === 0) throw new Error("Recording data missing");
    u = await uploadVideoBlob(upBlob, prMeta);
    await idbDeleteBlob(blobKey).catch(() => {});

    const notify = await new Promise<{ linkInsertedInPrTab?: boolean }>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "notify-pr-tab-recording-url",
          payload: { url: u, owner: prMeta.owner, repo: prMeta.repo, prId: prMeta.prId },
        } satisfies ExtensionMessage,
        (resp: { linkInsertedInPrTab?: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({ linkInsertedInPrTab: false });
            return;
          }
          resolve({ linkInsertedInPrTab: resp?.linkInsertedInPrTab });
        },
      );
    });
    linkInsertedInPrTab = notify.linkInsertedInPrTab === true;
    modal.setProgress(100);
  } catch (e) {
    const errText =
      e instanceof Error ? e.message : "Upload failed. Check Firebase config and try again.";
    void chrome.runtime.sendMessage({
      type: "notify-pr-tab-recording-error",
      payload: { message: errText, owner: prMeta.owner, repo: prMeta.repo, prId: prMeta.prId },
    } satisfies ExtensionMessage);
    resetButtons();
    ui.setInlineErr(errText);
    return;
  }

  resetButtons();
  showSuccessScreen(ui.root, ui.appEl, u, linkInsertedInPrTab, prMeta);
}

export async function runProcessAndUpload(
  blob: Blob,
  draftKey: string,
  prMeta: PrMeta | null,
  state: EditorState,
  modal: ModalHandle,
  ui: {
    root: HTMLElement;
    appEl: HTMLElement | null;
    btnUpload: HTMLButtonElement;
    btnApply: HTMLButtonElement;
    btnDiscard: HTMLButtonElement;
    setInlineErr: (text: string) => void;
  },
): Promise<void> {
  if (!state.durationKnown) return;
  ui.btnApply.disabled = true;
  ui.btnUpload.disabled = true;
  ui.btnDiscard.disabled = true;
  ui.setInlineErr("");

  modal.show({
    title: "Processing video…",
    eyebrow: "Encoding",
    infoHtml:
      "<strong>Keep this tab open</strong> while FFmpeg runs. Closing the tab cancels processing.",
    indeterminate: false,
  });

  try {
    const outBlob = await processVideo(blob, state, {
      onProgress: (pct) => modal.setProgress(pct),
      onStage: (eyebrow) => {
        modal.setProgress(0);
        modal.show({
          title: "Processing video…",
          eyebrow,
          infoHtml:
            "<strong>Keep this tab open</strong> while FFmpeg runs. Closing the tab cancels processing.",
          indeterminate: false,
        });
      },
    });
    const newKey = makeBlobKey();
    await idbPutBlob(newKey, outBlob);
    await idbDeleteBlob(draftKey);
    modal.hide();
    await runUpload(newKey, prMeta, state, modal, ui);
  } catch (e) {
    modal.hide();
    const errorText =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : `Processing failed: ${String(e)}`;
    const withHint =
      errorText && /processing failed|fallback|step 1|step 2/i.test(errorText)
        ? `${errorText}${PROCESSING_FINAL_HINT}`
        : (errorText || "Processing failed. Try upload without edits.");
    ui.setInlineErr(withHint);
    ui.btnApply.disabled = false;
    ui.btnUpload.disabled = false;
    ui.btnDiscard.disabled = false;
  }
}
