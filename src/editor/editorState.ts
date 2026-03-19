export type PrMeta = {
  owner: string;
  repo: string;
  prId: string;
};

export type EditorState = {
  vNatW: number;
  vNatH: number;

  cropActive: boolean;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;

  dur: number;
  durationKnown: boolean;
  trimStart: number;
  trimEnd: number;

  noAudio: boolean;
  uploadInFlight: boolean;
};

export const MIN_CROP_PX = 20;
export const MIN_TRIM = 0.1;

export function createEditorState(natW: number, natH: number): EditorState {
  return {
    vNatW: natW,
    vNatH: natH,
    cropActive: false,
    cropX: 0,
    cropY: 0,
    cropW: natW,
    cropH: natH,
    dur: 0,
    durationKnown: false,
    trimStart: 0,
    trimEnd: 0,
    noAudio: false,
    uploadInFlight: false,
  };
}

export function isCropFullFrame(s: EditorState): boolean {
  return s.cropX === 0 && s.cropY === 0 && s.cropW === s.vNatW && s.cropH === s.vNatH;
}

export function clampCropToVideo(s: EditorState): void {
  s.cropX = Math.max(0, Math.min(s.cropX, s.vNatW - MIN_CROP_PX));
  s.cropY = Math.max(0, Math.min(s.cropY, s.vNatH - MIN_CROP_PX));
  s.cropW = Math.max(MIN_CROP_PX, Math.min(s.cropW, s.vNatW - s.cropX));
  s.cropH = Math.max(MIN_CROP_PX, Math.min(s.cropH, s.vNatH - s.cropY));
}

export function clampTrim(s: EditorState): void {
  if (!s.durationKnown || s.dur <= 0) return;
  s.trimStart = Math.max(0, Math.min(s.trimStart, s.dur - MIN_TRIM));
  s.trimEnd = Math.max(s.trimStart + MIN_TRIM, Math.min(s.trimEnd, s.dur));
}
