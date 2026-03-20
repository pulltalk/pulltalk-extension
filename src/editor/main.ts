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
const DEV_SAMPLE_DRAFT_KEY = "pulltalk_dev_fixture";

function isEditorDevToolsEnabled(): boolean {
  return (
    Boolean(import.meta.env.DEV)
    || import.meta.env.VITE_PULLTALK_EDITOR_DEV_TOOLS === "true"
  );
}
import { runUpload, runProcessAndUpload, type ModalHandle } from "./uploadFlow";

/* ── Boot helpers ─────────────────────────────────────────────── */

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el;
}

const root = requireElement("root");
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
  /** Last known % from real progress or indeterminate pulse (for handoff between stages). */
  let lastProgress = 0;

  function clearTimers(): void {
    if (fakeTimer != null) { window.clearInterval(fakeTimer); fakeTimer = null; }
  }

  function applyProgressVisual(pct: number): void {
    lastProgress = Math.max(0, Math.min(100, pct));
    if (fill) fill.style.width = `${lastProgress}%`;
    if (pctEl) pctEl.textContent = `${Math.round(lastProgress)}%`;
    if (bannerPct) bannerPct.textContent = `${Math.round(lastProgress)}%`;
  }

  /** Definite progress from FFmpeg / pipeline — stops indeterminate animation. */
  function setProgress(pct: number): void {
    clearTimers();
    applyProgressVisual(pct);
  }

  function syncBannerSubtitle(): void {
    if (!bannerText || !titleEl) return;
    const e = eyebrowEl?.textContent?.trim() ?? "";
    const t = titleEl.textContent?.trim() ?? "";
    bannerText.textContent = e ? `${e} · ${t}` : t;
  }

  return {
    show(o): void {
      clearTimers();
      overlay?.removeAttribute("hidden");
      if (eyebrowEl) eyebrowEl.textContent = o.eyebrow ?? "Please wait";
      if (titleEl) titleEl.textContent = o.title;
      if (infoEl) infoEl.innerHTML = o.infoHtml;
      applyProgressVisual(0);
      banner?.removeAttribute("hidden");
      syncBannerSubtitle();
      if (o.indeterminate) {
        let p = 0;
        fakeTimer = window.setInterval(() => {
          p = Math.min(88, p + Math.random() * 6);
          applyProgressVisual(Math.round(p));
        }, 450);
      }
    },
    setProgress,
    setProcessingStage(o): void {
      clearTimers();
      if (eyebrowEl) eyebrowEl.textContent = o.eyebrow;
      if (o.infoHtml != null && infoEl) infoEl.innerHTML = o.infoHtml;
      syncBannerSubtitle();
      if (o.indeterminate) {
        let p = lastProgress;
        fakeTimer = window.setInterval(() => {
          p = Math.min(94, p + Math.random() * 3.5);
          applyProgressVisual(Math.round(p));
        }, 520);
      }
    },
    hide(): void {
      clearTimers();
      lastProgress = 0;
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
  const wantDevSample = params.get("devSample") === "1";
  let draftKey: string;
  let blob: Blob;

  if (wantDevSample) {
    if (!isEditorDevToolsEnabled()) {
      showBoot(
        "Editor dev sample is disabled. Add VITE_PULLTALK_EDITOR_DEV_TOOLS=true to .env, rebuild, "
          + "or run npm run dev. See README → Faster editor testing.",
        true,
      );
      return;
    }
    showBoot("Preparing dev sample WebM… (first time only, then cached in IndexedDB)", false);
    try {
      draftKey = DEV_SAMPLE_DRAFT_KEY;
      const { loadOrCreateDevSampleBlob } = await import("./devSample");
      blob = await loadOrCreateDevSampleBlob();
    } catch (e) {
      showBoot(
        e instanceof Error ? e.message : "Could not create dev sample WebM.",
        true,
      );
      return;
    }
    showApp();
  } else {
    const k = params.get("k");
    if (!k) {
      showBoot("Missing recording. Open the editor from the recorder after you stop recording.", true);
      return;
    }
    draftKey = k;
    showApp();
    const fromIdb = await idbGetBlob(draftKey);
    if (!fromIdb || fromIdb.size === 0) {
      showBoot("Recording not found. It may have been discarded or already uploaded.", true);
      return;
    }
    blob = fromIdb;
  }

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

  if (wantDevSample) {
    const devBanner = document.getElementById("pt-dev-banner");
    if (devBanner) {
      devBanner.hidden = false;
      devBanner.textContent =
        "Dev sample mode — bookmark this URL to reopen without recording. "
          + "Discard removes the cached sample from IndexedDB.";
    }
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
    transportPlayIcon: document.getElementById("pt-transport-play-icon") ?? document.createElement("span"),
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
    void chrome.runtime.sendMessage({ type: "recording-edit-cancelled" } satisfies ExtensionMessage);
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
