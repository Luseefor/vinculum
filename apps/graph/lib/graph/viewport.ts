import type { Viewport2D } from "@/types/graphUi";

export const DEFAULT_VIEWPORT_SCALE = 50;
export const MIN_VIEWPORT_SCALE = 1e-6;
export const MAX_VIEWPORT_SCALE = 1e9;

export function sanitizeViewportScale(value: unknown, fallback = DEFAULT_VIEWPORT_SCALE): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return clamp(fallback, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
  }

  return clamp(value, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
}

export function sanitizeViewportCenter(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

export function sanitizeViewportPatch(current: Viewport2D, patch: Partial<Viewport2D>): Viewport2D {
  return {
    centerX:
      patch.centerX === undefined
        ? current.centerX
        : sanitizeViewportCenter(patch.centerX, current.centerX),
    centerY:
      patch.centerY === undefined
        ? current.centerY
        : sanitizeViewportCenter(patch.centerY, current.centerY),
    scale:
      patch.scale === undefined
        ? current.scale
        : sanitizeViewportScale(patch.scale, current.scale)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
