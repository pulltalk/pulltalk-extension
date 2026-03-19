export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function effectiveVideoDuration(v: HTMLVideoElement): number {
  const d = v.duration;
  if (Number.isFinite(d) && d > 0 && d < 1e7) return d;
  try {
    if (v.seekable.length > 0) {
      const end = v.seekable.end(v.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    /* ignore */
  }
  return NaN;
}

export function pctFromTime(t: number, dur: number, durationKnown: boolean): number {
  if (!durationKnown || dur <= 0) return 0;
  return (t / dur) * 100;
}

export function timeFromScrubberX(
  clientX: number,
  scrubberEl: HTMLElement,
  dur: number,
): number {
  const rect = scrubberEl.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  return (x / rect.width) * dur;
}
