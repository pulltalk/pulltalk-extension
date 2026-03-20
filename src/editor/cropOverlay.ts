import {
  type EditorState,
  clampCropToVideo,
  isCropFullFrame,
  MIN_CROP_PX,
} from "./editorState";

export type CropElements = {
  playerWrap: HTMLElement;
  cropOverlayEl: HTMLElement;
  cropRectEl: HTMLElement;
  cropBar: HTMLElement;
  cropResetBtn: HTMLButtonElement;
  cropDoneBtn: HTMLButtonElement;
  cardCrop: HTMLButtonElement;
  cardCropDesc: HTMLElement | null;
  playOverlay: HTMLElement | null;
};

export function initCropOverlay(
  els: CropElements,
  state: EditorState,
  callbacks: { syncPlayOverlay: () => void; updateCropCardDesc: () => void },
): {
  updateCropCardDesc: () => void;
} {
  const {
    playerWrap, cropOverlayEl, cropRectEl, cropBar,
    cropResetBtn, cropDoneBtn, cardCrop, cardCropDesc,
  } = els;
  const { syncPlayOverlay } = callbacks;

  function getVideoDisplayRect(): { x: number; y: number; w: number; h: number } {
    const cw = playerWrap.clientWidth;
    const ch = playerWrap.clientHeight;
    const scale = Math.min(cw / state.vNatW, ch / state.vNatH);
    const dw = state.vNatW * scale;
    const dh = state.vNatH * scale;
    return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh };
  }

  function renderCropRect(): void {
    const vdr = getVideoDisplayRect();
    const sx = vdr.w / state.vNatW;
    const sy = vdr.h / state.vNatH;
    cropRectEl.style.left = `${vdr.x + state.cropX * sx}px`;
    cropRectEl.style.top = `${vdr.y + state.cropY * sy}px`;
    cropRectEl.style.width = `${state.cropW * sx}px`;
    cropRectEl.style.height = `${state.cropH * sy}px`;
  }

  function updateCropCardDesc(): void {
    if (!cardCropDesc) return;
    const ready = state.vNatW > 1 || state.durationKnown;
    if (!ready) {
      cardCropDesc.textContent = "Preparing…";
      cardCropDesc.classList.add("pt-action-card__desc--loading");
      return;
    }
    cardCropDesc.classList.remove("pt-action-card__desc--loading");
    if (state.cropActive) {
      cardCropDesc.textContent = "Active — drag on video to crop";
    } else if (!isCropFullFrame(state)) {
      cardCropDesc.textContent = "Crop applied";
    } else {
      cardCropDesc.textContent = "Click to crop the video";
    }
  }

  function resetCrop(): void {
    state.cropX = 0;
    state.cropY = 0;
    state.cropW = state.vNatW;
    state.cropH = state.vNatH;
    renderCropRect();
    updateCropCardDesc();
  }

  const CROP_WARN_KEY = "pulltalk_crop_warned";

  function showCropWarningOnce(): void {
    try { if (localStorage.getItem(CROP_WARN_KEY)) return; } catch { return; }
    try { localStorage.setItem(CROP_WARN_KEY, "1"); } catch { /* noop */ }

    const toast = document.createElement("div");
    toast.className = "pt-crop-toast";
    toast.textContent = "Crop adds processing time and may fail on long clips.";
    cropBar.parentElement?.insertBefore(toast, cropBar.nextSibling);

    window.setTimeout(() => {
      toast.classList.add("pt-crop-toast--out");
      toast.addEventListener("transitionend", () => toast.remove());
    }, 4000);
  }

  function setCropMode(on: boolean): void {
    state.cropActive = on;
    cropOverlayEl.hidden = !on;
    cropBar.hidden = !on;
    cardCrop.classList.toggle("pt-action-card--active", on);
    if (on) {
      renderCropRect();
      showCropWarningOnce();
    }
    syncPlayOverlay();
    updateCropCardDesc();
  }

  cardCrop.addEventListener("click", () => {
    if (state.vNatW <= 1 && !state.durationKnown) return;
    setCropMode(!state.cropActive);
  });
  cropDoneBtn.addEventListener("click", () => setCropMode(false));
  cropResetBtn.addEventListener("click", () => resetCrop());

  cropRectEl.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).dataset.dir) return;
    e.preventDefault();
    e.stopPropagation();
    cropRectEl.setPointerCapture(e.pointerId);

    const vdr = getVideoDisplayRect();
    const sx = vdr.w / state.vNatW;
    const sy = vdr.h / state.vNatH;
    const startMX = e.clientX;
    const startMY = e.clientY;
    const startCX = state.cropX;
    const startCY = state.cropY;

    const move = (ev: PointerEvent): void => {
      const dx = (ev.clientX - startMX) / sx;
      const dy = (ev.clientY - startMY) / sy;
      state.cropX = Math.round(Math.max(0, Math.min(startCX + dx, state.vNatW - state.cropW)));
      state.cropY = Math.round(Math.max(0, Math.min(startCY + dy, state.vNatH - state.cropH)));
      renderCropRect();
    };
    const up = (): void => {
      cropRectEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      updateCropCardDesc();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  cropOverlayEl
    .querySelectorAll<HTMLElement>(".pt-crop-handle")
    .forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);

        const dir = handle.dataset.dir!;
        const vdr = getVideoDisplayRect();
        const sx = vdr.w / state.vNatW;
        const sy = vdr.h / state.vNatH;
        const startMX = e.clientX;
        const startMY = e.clientY;
        const sCX = state.cropX, sCY = state.cropY, sCW = state.cropW, sCH = state.cropH;

        const move = (ev: PointerEvent): void => {
          const dxV = (ev.clientX - startMX) / sx;
          const dyV = (ev.clientY - startMY) / sy;
          let nx = sCX, ny = sCY, nw = sCW, nh = sCH;

          if (dir.includes("w")) { nx = sCX + dxV; nw = sCW - dxV; }
          if (dir.includes("e")) { nw = sCW + dxV; }
          if (dir.includes("n")) { ny = sCY + dyV; nh = sCH - dyV; }
          if (dir.includes("s")) { nh = sCH + dyV; }

          if (nw < MIN_CROP_PX) { if (dir.includes("w")) nx = sCX + sCW - MIN_CROP_PX; nw = MIN_CROP_PX; }
          if (nh < MIN_CROP_PX) { if (dir.includes("n")) ny = sCY + sCH - MIN_CROP_PX; nh = MIN_CROP_PX; }
          if (nx < 0) { nw += nx; nx = 0; }
          if (ny < 0) { nh += ny; ny = 0; }
          if (nx + nw > state.vNatW) nw = state.vNatW - nx;
          if (ny + nh > state.vNatH) nh = state.vNatH - ny;

          state.cropX = Math.round(nx);
          state.cropY = Math.round(ny);
          state.cropW = Math.round(Math.max(MIN_CROP_PX, nw));
          state.cropH = Math.round(Math.max(MIN_CROP_PX, nh));
          clampCropToVideo(state);
          renderCropRect();
        };

        const up = (): void => {
          handle.releasePointerCapture(e.pointerId);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          updateCropCardDesc();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    });

  cropOverlayEl.addEventListener("pointerdown", (e) => {
    if (e.target !== cropOverlayEl) return;
    e.preventDefault();
    cropOverlayEl.setPointerCapture(e.pointerId);

    const vdr = getVideoDisplayRect();
    const overlayRect = cropOverlayEl.getBoundingClientRect();
    const sx = vdr.w / state.vNatW;
    const sy = vdr.h / state.vNatH;
    const rawStartX = e.clientX - overlayRect.left;
    const rawStartY = e.clientY - overlayRect.top;
    const startVX = (rawStartX - vdr.x) / sx;
    const startVY = (rawStartY - vdr.y) / sy;
    let dragging = false;

    const move = (ev: PointerEvent): void => {
      const rawX = ev.clientX - overlayRect.left;
      const rawY = ev.clientY - overlayRect.top;
      if (!dragging) {
        if (Math.hypot(rawX - rawStartX, rawY - rawStartY) < 4) return;
        dragging = true;
      }
      const endVX = (rawX - vdr.x) / sx;
      const endVY = (rawY - vdr.y) / sy;
      state.cropX = Math.round(Math.max(0, Math.min(startVX, endVX)));
      state.cropY = Math.round(Math.max(0, Math.min(startVY, endVY)));
      state.cropW = Math.round(Math.max(MIN_CROP_PX, Math.abs(endVX - startVX)));
      state.cropH = Math.round(Math.max(MIN_CROP_PX, Math.abs(endVY - startVY)));
      clampCropToVideo(state);
      renderCropRect();
    };

    const up = (): void => {
      cropOverlayEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (dragging) updateCropCardDesc();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  new ResizeObserver(() => {
    if (state.cropActive) renderCropRect();
  }).observe(playerWrap);

  return { updateCropCardDesc };
}
