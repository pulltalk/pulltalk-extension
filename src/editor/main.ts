import "./editor.css";
import { idbDeleteBlob, idbGetBlob } from "@/shared/idb";
import type { ExtensionMessage } from "@/shared/messages";
import { createEditorState, type PrMeta } from "./editorState";
import { clampTrim, MIN_TRIM } from "./editorState";
import { formatClock } from "./time";
import { initTransport } from "./transport";
import { initTrimPanel } from "./trimPanel";
import { initCropOverlay } from "./cropOverlay";
import { getFFmpeg } from "./ffmpegProcessor";
import { runUpload, runProcessAndUpload, type ModalHandle } from "./uploadFlow";

/* ── Boot helpers ─────────────────────────────────────────────── */

const root = document.getElementById("root")!;
const bootEl = document.getElementById("pt-boot");
const appEl = document.getElementById("pt-app");

function showBoot(message: string, isError = false): void {
  if (!bootEl) {
    root.innerHTML = `<div class="pt-screen-msg"><p>${message}</p></div>`;
    return;
  }
  bootEl.innerHTML = `<div class="pt-screen-msg" style="min-height:100vh"><h1>${
    isError ? "Something went wrong" : "PullTalk"
  }</h1><p>${message}</p></div>`;
  bootEl.hidden = false;
  if (appEl) appEl.hidden = true;
}

function showApp(): void {
  if (bootEl) bootEl.hidden = true;
  if (appEl) appEl.hidden = false;
}

/* ── Modal ────────────────────────────────────────────────────── */

function setupModal(): ModalHandle {
  const overlay = document.getElementById("pt-modal-overlay");
  const fill = document.getElementById("pt-progress-fill");
  const pctEl = document.getElementById("pt-modal-pct");
  const titleEl = document.getElementById("pt-modal-title");
  const infoEl = document.getElementById("pt-modal-info");
  const eyebrowEl = document.getElementById("pt-modal-eyebrow");
  const banner = document.getElementById("pt-processing-banner");
  const bannerText = document.getElementById("pt-processing-banner-text");
  const bannerPct = document.getElementById("pt-processing-banner-pct");
  let fakeTimer: number | null = null;

  function clearTimers(): void {
    if (fakeTimer != null) { window.clearInterval(fakeTimer); fakeTimer = null; }
  }

  function setProgress(pct: number): void {
    const p = Math.max(0, Math.min(100, pct));
    if (fill) fill.style.width = `${p}%`;
    if (pctEl) pctEl.textContent = `${Math.round(p)}%`;
    if (bannerPct) bannerPct.textContent = `${Math.round(p)}%`;
  }

  return {
    show(o) {
      clearTimers();
      overlay?.removeAttribute("hidden");
      if (eyebrowEl) eyebrowEl.textContent = o.eyebrow ?? "Please wait";
      if (titleEl) titleEl.textContent = o.title;
      if (infoEl) infoEl.innerHTML = o.infoHtml;
      setProgress(0);
      banner?.removeAttribute("hidden");
      if (bannerText) {
        const e = o.eyebrow?.trim();
        bannerText.textContent = e ? `${e} · ${o.title}` : o.title;
      }
      if (o.indeterminate) {
        let p = 0;
        fakeTimer = window.setInterval(() => {
          p = Math.min(88, p + Math.random() * 6);
          setProgress(Math.round(p));
        }, 450);
      }
    },
    setProgress,
    hide() {
      clearTimers();
      overlay?.setAttribute("hidden", "");
      if (fill) fill.style.width = "0%";
      banner?.setAttribute("hidden", "");
      if (bannerText) bannerText.textContent = "";
      if (bannerPct) bannerPct.textContent = "";
    },
  };
}

/* ── Main ─────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const draftKey = params.get("k");
  if (!draftKey) {
    showBoot("Missing recording. Open the editor from the recorder after you stop recording.", true);
    return;
  }

  showApp();

  const o = params.get("o") ?? "";
  const r = params.get("r") ?? "";
  const p = params.get("p") ?? "";
  const prMeta: PrMeta | null = o && r && p ? { owner: o, repo: r, prId: p } : null;

  const knownDurationMs = parseFloat(params.get("d") ?? "0");
  const knownDurationSec = knownDurationMs > 0 ? knownDurationMs / 1000 : 0;

  const manifest = chrome.runtime.getManifest();
  const ver = manifest?.version ?? "1.0.0";
  const versionLabel = document.getElementById("pt-version-label");
  if (versionLabel) versionLabel.textContent = `PullTalk v${ver}`;

  const blob = await idbGetBlob(draftKey);
  if (!blob || blob.size === 0) {
    showBoot("Recording not found. It may have been discarded or already uploaded.", true);
    return;
  }

  const modal = setupModal();

  /* ── DOM refs ───────────────────────────────────────────────── */

  const video = document.getElementById("pt-video") as HTMLVideoElement;
  const playerWrap = document.getElementById("pt-player-wrap") as HTMLElement;
  const playOverlay = document.getElementById("pt-play-overlay");

  const bcRepo = document.getElementById("pt-bc-repo");
  const bcPr = document.getElementById("pt-bc-pr");
  const statusText = document.getElementById("pt-status-text");
  const inlineErr = document.getElementById("pt-inline-err");
  const btnUpload = document.getElementById("pt-btn-upload") as HTMLButtonElement;
  const btnApply = document.getElementById("pt-btn-apply") as HTMLButtonElement;
  const btnDiscard = document.getElementById("pt-btn-discard") as HTMLButtonElement;
  const noAudioBtn = document.getElementById("pt-no-audio") as HTMLButtonElement;
  const cardTrimDesc = document.getElementById("pt-card-trim-desc");

  /* ── State ──────────────────────────────────────────────────── */

  const state = createEditorState(
    video.videoWidth || 1280,
    video.videoHeight || 720,
  );

  /* ── Sidebar card scroll navigation ─────────────────────────── */

  document
    .querySelectorAll<HTMLButtonElement>(".pt-action-card[data-scroll-target]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.scrollTarget;
        if (!id) return;
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    });

  /* ── Breadcrumb ─────────────────────────────────────────────── */

  if (bcRepo && bcPr) {
    if (prMeta) {
      bcRepo.textContent = `${prMeta.owner}/${prMeta.repo}`;
      bcPr.innerHTML = ` · <span class="pt-pr-tag">#${prMeta.prId}</span>`;
    } else {
      bcRepo.textContent = "No pull request context";
      bcPr.innerHTML = ` · <span class="pt-pr-tag">Record from a GitHub PR to upload</span>`;
    }
  }
  if (statusText) {
    statusText.textContent = prMeta
      ? `Ready to commit to PR #${prMeta.prId}`
      : "Ready — open a GitHub PR and record from there to upload";
  }

  /* ── Load video ─────────────────────────────────────────────── */

  const url = URL.createObjectURL(blob);
  video.src = url;
  video.playsInline = true;

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = (): void => res();
    video.onerror = (): void => rej(new Error("Video load failed"));
  });

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    state.vNatW = video.videoWidth;
    state.vNatH = video.videoHeight;
    state.cropW = state.vNatW;
    state.cropH = state.vNatH;
  }

  /* ── Readiness indicators ───────────────────────────────────── */

  function updateReadiness(): void {
    if (cardTrimDesc) {
      if (state.durationKnown) {
        const trimDur = state.trimEnd - state.trimStart;
        if (state.dur > 0 && trimDur < state.dur - 0.5) {
          cardTrimDesc.textContent = `${formatClock(trimDur)} of ${formatClock(state.dur)} selected`;
        } else {
          cardTrimDesc.textContent = "Set in and out, drag handles on the timeline";
        }
        cardTrimDesc.classList.remove("pt-action-card__desc--loading");
      } else {
        cardTrimDesc.textContent = "Preparing…";
        cardTrimDesc.classList.add("pt-action-card__desc--loading");
      }
    }
    cropCtrl.updateCropCardDesc();
  }

  /* ── Init sub-modules ───────────────────────────────────────── */

  const transport = initTransport({
    video,
    playBtn: document.getElementById("pt-play-btn") as HTMLButtonElement,
    transportPlayIcon: document.getElementById("pt-transport-play-icon")!,
    playOverlay,
    skipBackBtn: document.getElementById("pt-skip-back") as HTMLButtonElement,
    skipFwdBtn: document.getElementById("pt-skip-fwd") as HTMLButtonElement,
    ptTimeCur: document.getElementById("pt-time-cur"),
    ptTimeTotal: document.getElementById("pt-time-total"),
    rangeEl: document.getElementById("pt-range") as HTMLElement,
    playheadEl: document.getElementById("pt-playhead") as HTMLElement,
    handleStartEl: document.getElementById("pt-handle-start") as HTMLElement,
    handleEndEl: document.getElementById("pt-handle-end") as HTMLElement,
  }, state);

  const cropCtrl = initCropOverlay({
    playerWrap,
    cropOverlayEl: document.getElementById("pt-crop-overlay") as HTMLElement,
    cropRectEl: document.getElementById("pt-crop-rect") as HTMLElement,
    cropBar: document.getElementById("pt-crop-bar") as HTMLElement,
    cropResetBtn: document.getElementById("pt-crop-reset") as HTMLButtonElement,
    cropDoneBtn: document.getElementById("pt-crop-done") as HTMLButtonElement,
    cardCrop: document.getElementById("pt-card-crop") as HTMLButtonElement,
    cardCropDesc: document.getElementById("pt-card-crop-desc"),
    playOverlay,
  }, state, {
    syncPlayOverlay: transport.syncPlayOverlay,
    updateCropCardDesc: () => {},
  });

  const { syncDurationFromVideo } = initTrimPanel({
    video,
    trimStartIn: document.getElementById("pt-trim-start") as HTMLInputElement,
    trimEndIn: document.getElementById("pt-trim-end") as HTMLInputElement,
    scrubber: document.getElementById("pt-scrubber") as HTMLElement,
    handleStart: document.getElementById("pt-handle-start") as HTMLElement,
    handleEnd: document.getElementById("pt-handle-end") as HTMLElement,
    durationHint: document.getElementById("pt-duration-hint"),
    btnApply,
  }, state, {
    renderTimeline: transport.renderTimeline,
    updateTimecode: transport.updateTimecode,
    updateReadiness,
  }, knownDurationSec);

  syncDurationFromVideo();
  updateReadiness();

  /* ── Audio toggle ───────────────────────────────────────────── */

  noAudioBtn.addEventListener("click", () => {
    state.noAudio = !state.noAudio;
    noAudioBtn.setAttribute("aria-checked", state.noAudio ? "true" : "false");
  });

  /* ── Keyboard shortcuts ─────────────────────────────────────── */

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "KeyI" && state.durationKnown) {
      state.trimStart = Math.max(0, Math.min(video.currentTime, state.trimEnd - MIN_TRIM));
      clampTrim(state);
      transport.renderTimeline();
      updateReadiness();
    }
    if (e.code === "KeyO" && state.durationKnown) {
      state.trimEnd = Math.max(state.trimStart + MIN_TRIM, Math.min(video.currentTime, state.dur));
      clampTrim(state);
      transport.renderTimeline();
      updateReadiness();
    }
    if (e.code === "Space") { e.preventDefault(); (document.getElementById("pt-play-btn") as HTMLButtonElement).click(); }
    if (e.code === "ArrowLeft") { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 5); transport.updateTimecode(); }
    if (e.code === "ArrowRight") { e.preventDefault(); video.currentTime = Math.min(state.dur || video.duration || 0, video.currentTime + 5); transport.updateTimecode(); }
    if (e.code === "Escape" && state.cropActive) (document.getElementById("pt-crop-done") as HTMLButtonElement).click();
  });

  /* ── FFmpeg preload ─────────────────────────────────────────── */

  getFFmpeg().catch(() => {});

  /* ── Upload helpers ─────────────────────────────────────────── */

  function setInlineErr(text: string): void {
    if (!inlineErr) return;
    if (text) { inlineErr.hidden = false; inlineErr.textContent = text; }
    else { inlineErr.hidden = true; inlineErr.textContent = ""; }
  }

  const uploadUi = { root, appEl, btnUpload, btnApply, btnDiscard, setInlineErr };

  btnDiscard.addEventListener("click", () => {
    void idbDeleteBlob(draftKey);
    chrome.runtime.sendMessage({ type: "recording-edit-cancelled" } satisfies ExtensionMessage);
    window.close();
  });

  btnUpload.addEventListener("click", () => {
    void runUpload(draftKey, prMeta, state, modal, uploadUi);
  });

  btnApply.addEventListener("click", () => {
    void runProcessAndUpload(blob, draftKey, prMeta, state, modal, uploadUi);
  });
}

void main();
