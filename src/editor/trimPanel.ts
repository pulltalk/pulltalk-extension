import { type EditorState, clampTrim, MIN_TRIM } from "./editorState";
import { round2, effectiveVideoDuration, timeFromScrubberX } from "./time";

export type TrimElements = {
  video: HTMLVideoElement;
  trimStartIn: HTMLInputElement;
  trimEndIn: HTMLInputElement;
  scrubber: HTMLElement;
  handleStart: HTMLElement;
  handleEnd: HTMLElement;
  durationHint: HTMLElement | null;
  btnApply: HTMLButtonElement;
};

export function initTrimPanel(
  els: TrimElements,
  state: EditorState,
  callbacks: {
    renderTimeline: () => void;
    updateTimecode: () => void;
    updateReadiness: () => void;
  },
  knownDurationSec: number,
): {
  syncDurationFromVideo: () => void;
} {
  const {
    video, trimStartIn, trimEndIn, scrubber,
    handleStart, handleEnd, durationHint, btnApply,
  } = els;
  const { renderTimeline, updateTimecode, updateReadiness } = callbacks;

  function applyDurationUiState(): void {
    if (!state.durationKnown) {
      trimStartIn.disabled = true;
      trimEndIn.disabled = true;
      scrubber.style.opacity = "0.55";
      scrubber.classList.add("pt-scrubber--unknown-duration");
      handleStart.style.pointerEvents = "none";
      handleEnd.style.pointerEvents = "none";
      btnApply.disabled = true;
      if (durationHint) {
        durationHint.textContent =
          "Detecting duration… If this stays stuck, use Upload without edits or re-record.";
      }
    } else {
      trimStartIn.disabled = false;
      trimEndIn.disabled = false;
      scrubber.style.opacity = "1";
      scrubber.classList.remove("pt-scrubber--unknown-duration");
      handleStart.style.pointerEvents = "auto";
      handleEnd.style.pointerEvents = "auto";
      btnApply.disabled = false;
      if (durationHint) {
        durationHint.textContent =
          "Drag the green handles or edit start/end. Press I / O to set in/out at the playhead.";
      }
    }
  }

  function writeTrimInputs(): void {
    trimStartIn.value = String(round2(state.trimStart));
    trimEndIn.value = String(round2(state.trimEnd));
  }

  function syncDurationFromVideo(): void {
    let next = effectiveVideoDuration(video);
    let known = Number.isFinite(next) && next > 0;

    if (!known && knownDurationSec > 0) {
      next = knownDurationSec;
      known = true;
    }

    if (!known) {
      state.durationKnown = false;
      state.dur = 0;
      state.trimStart = 0;
      state.trimEnd = 0;
      trimStartIn.value = "0";
      trimEndIn.value = "0";
      applyDurationUiState();
      updateTimecode();
      updateReadiness();
      return;
    }
    const wasUnknown = !state.durationKnown;
    state.durationKnown = true;
    state.dur = next;
    if (wasUnknown) {
      state.trimStart = 0;
      state.trimEnd = state.dur;
      writeTrimInputs();
    } else {
      clampTrim(state);
      writeTrimInputs();
    }
    applyDurationUiState();
    updateTimecode();
    updateReadiness();
  }

  trimStartIn.addEventListener("change", () => {
    if (!state.durationKnown) return;
    state.trimStart = parseFloat(trimStartIn.value) || 0;
    clampTrim(state);
    writeTrimInputs();
    renderTimeline();
    updateReadiness();
  });
  trimEndIn.addEventListener("change", () => {
    if (!state.durationKnown) return;
    state.trimEnd = parseFloat(trimEndIn.value) || state.dur;
    clampTrim(state);
    writeTrimInputs();
    renderTimeline();
    updateReadiness();
  });

  scrubber.addEventListener("click", (ev) => {
    if (!state.durationKnown) return;
    if ((ev.target as HTMLElement).closest(".pt-handle")) return;
    const t = timeFromScrubberX(ev.clientX, scrubber, state.dur);
    video.currentTime = Math.max(state.trimStart, Math.min(state.trimEnd, t));
    updateTimecode();
  });

  function bindHandle(el: HTMLElement, which: "start" | "end"): void {
    el.addEventListener("pointerdown", (e) => {
      if (!state.durationKnown) return;
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent): void => {
        const t = timeFromScrubberX(ev.clientX, scrubber, state.dur);
        if (which === "start") state.trimStart = Math.min(t, state.trimEnd - MIN_TRIM);
        else state.trimEnd = Math.max(t, state.trimStart + MIN_TRIM);
        clampTrim(state);
        writeTrimInputs();
        renderTimeline();
        updateReadiness();
      };
      const up = (): void => {
        el.releasePointerCapture(e.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }
  bindHandle(handleStart, "start");
  bindHandle(handleEnd, "end");

  video.addEventListener("durationchange", syncDurationFromVideo);
  video.addEventListener("progress", syncDurationFromVideo);
  video.addEventListener("loadeddata", syncDurationFromVideo);
  window.setTimeout(syncDurationFromVideo, 120);
  window.setTimeout(syncDurationFromVideo, 600);
  window.setTimeout(syncDurationFromVideo, 2000);
  window.setTimeout(() => {
    syncDurationFromVideo();
    if (!state.durationKnown && durationHint) {
      durationHint.textContent =
        "Duration unknown for this file — trim is off. Use Upload without edits or re-record.";
    }
  }, 5000);

  video.addEventListener("timeupdate", () => {
    updateTimecode();
    if (state.durationKnown && !video.paused && state.trimEnd > state.trimStart) {
      if (video.currentTime >= state.trimEnd - 0.05) {
        video.currentTime = state.trimStart;
      }
    }
    updateReadiness();
  });

  video.addEventListener("resize", () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      const oldW = state.vNatW;
      const oldH = state.vNatH;
      state.vNatW = video.videoWidth;
      state.vNatH = video.videoHeight;
      if (oldW !== state.vNatW || oldH !== state.vNatH) {
        state.cropX = 0;
        state.cropY = 0;
        state.cropW = state.vNatW;
        state.cropH = state.vNatH;
      }
    }
    updateReadiness();
  });
  video.addEventListener("canplay", updateReadiness);

  return { syncDurationFromVideo };
}
