export function readThemeVar(name: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function readThemeNumber(name: string, fallback: number): number {
  const parsed = Number(readThemeVar(name, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readThemeRgb(name: string, fallback: [number, number, number]): [number, number, number] {
  const raw = readThemeVar(name, `${fallback[0]}, ${fallback[1]}, ${fallback[2]}`);
  const parts = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));

  if (parts.length !== 3) {
    return fallback;
  }

  return [parts[0], parts[1], parts[2]];
}
