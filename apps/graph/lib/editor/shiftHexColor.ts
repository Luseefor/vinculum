export function shiftHexColor(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return hex;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tint = 28;
  const clampChannel = (v: number) => Math.max(0, Math.min(255, v));
  return `#${clampChannel(r + tint).toString(16).padStart(2, "0")}${clampChannel(g + tint).toString(16).padStart(2, "0")}${clampChannel(b + tint)
    .toString(16)
    .padStart(2, "0")}`;
}
