import type { EditorState } from "./editorState";
import { formatClock, pctFromTime } from "./time";

const PLAY_SVG = '<path d="M8 5v14l11-7z" fill="currentColor"/>';
const PAUSE_SVG =
  '<rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/>';

export type TransportElements = {
  video: HTMLVideoElement;
  playBtn: HTMLButtonElement;
  transportPlayIcon: HTMLElement;
  playOverlay: HTMLElement | null;
  skipBackBtn: HTMLButtonElement;
  skipFwdBtn: HTMLButtonElement;
  ptTimeCur: HTMLElement | null;
  ptTimeTotal: HTMLElement | null;
  rangeEl: HTMLElement;
  playheadEl: HTMLElement;
  handleStartEl: HTMLElement;
  handleEndEl: HTMLElement;
};

export function initTransport(els: TransportElements, state: EditorState): {
  updateTimecode: () => void;
  renderTimeline: () => void;
  syncPlayOverlay: () => void;
} {
  const {
    video, playBtn, transportPlayIcon, playOverlay,
    skipBackBtn, skipFwdBtn, ptTimeCur, ptTimeTotal,
    rangeEl, playheadEl, handleStartEl, handleEndEl,
  } = els;

  function setTransportIcon(playing: boolean): void {
    transportPlayIcon.innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function togglePlay(): void {
    if (video.paused) {
      if (
        state.durationKnown &&
        state.trimEnd > state.trimStart &&
        (video.currentTime < state.trimStart || video.currentTime >= state.trimEnd - 0.05)
      ) {
        video.currentTime = state.trimStart;
      }
      void video.play();
    } else {
      video.pause();
    }
  }

  function syncPlayOverlay(): void {
    if (!playOverlay) return;
    if (video.paused && !state.cropActive) {
      playOverlay.classList.remove("pt-play-overlay--hidden");
    } else {
      playOverlay.classList.add("pt-play-overlay--hidden");
    }
  }

  function renderTimeline(): void {
    if (!state.durationKnown || state.dur <= 0) {
      rangeEl.style.left = "0%";
      rangeEl.style.width = "0%";
      handleStartEl.style.left = "0%";
      handleEndEl.style.left = "0%";
      playheadEl.style.left = "0%";
      playheadEl.style.opacity = "0";
      return;
    }
    playheadEl.style.opacity = "1";
    const ls = pctFromTime(state.trimStart, state.dur, state.durationKnown);
    const le = pctFromTime(state.trimEnd, state.dur, state.durationKnown);
    rangeEl.style.left = `${ls}%`;
    rangeEl.style.width = `${Math.max(0, le - ls)}%`;
    handleStartEl.style.left = `${ls}%`;
    handleEndEl.style.left = `${le}%`;
    const ph = Math.min(100, pctFromTime(video.currentTime, state.dur, state.durationKnown));
    playheadEl.style.left = `${ph}%`;
  }

  function updateTimecode(): void {
    if (ptTimeCur) ptTimeCur.textContent = formatClock(video.currentTime);
    if (ptTimeTotal)
      ptTimeTotal.textContent = state.durationKnown ? formatClock(state.dur) : "--:--";
    renderTimeline();
  }

  playBtn.addEventListener("click", togglePlay);
  playOverlay?.addEventListener("click", () => {
    if (!state.cropActive) togglePlay();
  });
  skipBackBtn.addEventListener("click", () => {
    video.currentTime = Math.max(0, video.currentTime - 5);
    updateTimecode();
  });
  skipFwdBtn.addEventListener("click", () => {
    video.currentTime = Math.min(state.dur || video.duration || 0, video.currentTime + 5);
    updateTimecode();
  });

  video.addEventListener("play", () => { syncPlayOverlay(); setTransportIcon(true); });
  video.addEventListener("pause", () => { syncPlayOverlay(); setTransportIcon(false); });
  video.addEventListener("ended", () => { syncPlayOverlay(); setTransportIcon(false); });

  return { updateTimecode, renderTimeline, syncPlayOverlay };
}
