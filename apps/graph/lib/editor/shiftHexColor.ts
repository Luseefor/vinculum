export function shiftHexColor(
  hex: string,
  options: {
    offset?: number;
    axisLocks?: { x: boolean; y: boolean; z: boolean };
  } = {}
): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return hex;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tint = Number.isFinite(options.offset) ? Math.round(options.offset ?? 28) : 28;
  const axisLocks = options.axisLocks ?? { x: true, y: true, z: true };
  const clampChannel = (v: number) => Math.max(0, Math.min(255, v));
  return `#${clampChannel(axisLocks.x ? r + tint : r)
    .toString(16)
    .padStart(2, "0")}${clampChannel(axisLocks.y ? g + tint : g)
    .toString(16)
    .padStart(2, "0")}${clampChannel(axisLocks.z ? b + tint : b)
    .toString(16)
    .padStart(2, "0")}`;
}
