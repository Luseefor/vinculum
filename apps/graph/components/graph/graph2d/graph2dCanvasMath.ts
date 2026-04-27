export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function alignToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

export function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}
