export const PULSE_MS = 600;

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Clamp zoom center within valid bounds for the current layout dimensions.
 */
export function clampCenter(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  layoutW: number,
  layoutH: number,
): { x: number; y: number } {
  const minX = halfW;
  const maxX = layoutW - halfW;
  const minY = halfH;
  const maxY = layoutH - halfH;
  return {
    x: minX <= maxX ? Math.min(maxX, Math.max(minX, cx)) : layoutW / 2,
    y: minY <= maxY ? Math.min(maxY, Math.max(minY, cy)) : layoutH / 2,
  };
}
