export function snapWorldPoint(
  point: { x: number; y: number; z: number },
  options: { enabled: boolean; step: number }
): { x: number; y: number; z: number } {
  if (!options.enabled || !Number.isFinite(options.step) || options.step <= 0) {
    return point;
  }
  const step = options.step;
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
    z: Math.round(point.z / step) * step
  };
}
