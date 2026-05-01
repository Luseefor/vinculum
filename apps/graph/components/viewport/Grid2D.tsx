"use client";

export interface GridSeries {
  start: number;
  step: number;
  count: number;
}

export function buildGridSeries(min: number, max: number, baseStep: number, maxCount: number): GridSeries | null {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(baseStep) || baseStep <= 0) {
    return null;
  }

  const span = max - min;
  if (!Number.isFinite(span) || span < 0) {
    return null;
  }

  const roughCount = span / baseStep + 1;
  if (!Number.isFinite(roughCount) || roughCount <= 0) {
    return null;
  }

  const stride = Math.max(1, Math.ceil(roughCount / maxCount));
  const step = baseStep * stride;
  if (!Number.isFinite(step) || step <= 0) {
    return null;
  }

  const start = Math.floor(min / step) * step;
  if (!Number.isFinite(start)) {
    return null;
  }

  const count = Math.min(maxCount, Math.max(0, Math.floor((max - start) / step) + 1));
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  return {
    start,
    step,
    count
  };
}
