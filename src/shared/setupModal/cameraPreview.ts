export function createCameraPreview(
  previewWrap: HTMLElement,
  videoEl: HTMLVideoElement,
  vbOnHint: HTMLElement,
  vbOffHint: HTMLElement,
  swatch: HTMLElement,
  deniedEl: HTMLElement,
  colorInput: HTMLInputElement,
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
    vbOnHint.style.display = vb ? "block" : "none";
    vbOffHint.style.display = vb ? "none" : "block";
    updateSwatch();
  }

  return { syncPreview, cleanup: stopPreviewStream };
}
