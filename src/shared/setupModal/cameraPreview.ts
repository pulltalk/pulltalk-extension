export function createCameraPreview(
  previewWrap: HTMLElement,
  videoEl: HTMLVideoElement,
  vbColorHint: HTMLElement,
  vbOffHint: HTMLElement,
  vbBlurHint: HTMLElement,
  swatch: HTMLElement,
  deniedEl: HTMLElement,
  colorInput: HTMLInputElement,
  bgEffectInput: HTMLInputElement,
  camCb: HTMLInputElement,
  vbCb: HTMLInputElement,
): { syncPreview: () => void; cleanup: () => void } {
  let previewStream: MediaStream | null = null;

  function updateSwatch(): void {
    const c = colorInput?.value ?? "#1a1a2e";
    swatch.style.background = c;
  }
  colorInput.addEventListener("input", updateSwatch);
  updateSwatch();

  function needsPreview(): boolean {
    return camCb.checked || vbCb.checked;
  }

  async function ensurePreviewStream(): Promise<void> {
    if (previewStream) return;
    deniedEl.style.display = "none";
    try {
      previewStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false,
      });
      videoEl.srcObject = previewStream;
      await videoEl.play().catch(() => {});
    } catch {
      deniedEl.style.display = "block";
    }
  }

  function stopPreviewStream(): void {
    previewStream?.getTracks().forEach((t) => t.stop());
    previewStream = null;
    videoEl.srcObject = null;
  }

  function syncPreview(): void {
    const show = needsPreview();
    previewWrap.style.display = show ? "block" : "none";
    if (show) void ensurePreviewStream();
    else stopPreviewStream();
    const vb = vbCb.checked;
    const effect = bgEffectInput.value === "blur" ? "blur" : "color";
    vbOffHint.style.display = vb ? "none" : "block";
    vbColorHint.style.display = vb && effect === "color" ? "block" : "none";
    vbBlurHint.style.display = vb && effect === "blur" ? "block" : "none";
    updateSwatch();
  }

  return { syncPreview, cleanup: stopPreviewStream };
}
