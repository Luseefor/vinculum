// S23 scalar→color policy (pure, renderer-side). The worker returns raw
// scalar grids; every theme recolors the cached grid with zero worker jobs
// (PART 25). One restrained ramp family — no rainbow/jet:
//
// - sequential: ColorBrewer-Blues-like, luminance strictly decreasing with
//   t, so scalar order is unambiguous from brightness alone;
// - diverging (only when min < 0 < max): blue → near-white → orange with
//   the data value 0 pinned at t = 0.5;
// - constant: the sequential mid color, full strength, never NaN;
// - invalid: fully transparent (singularities stay visible gaps).
//
// Contours are NOT part of this mapping: they stroke in theme ink with a
// contrasting underlay (see the 2D draw path), so they stay readable on
// every heat color in both themes.

export type ScalarRangeMode = "empty" | "constant" | "sequential" | "diverging";

export interface ScalarRange {
  mode: ScalarRangeMode;
  min: number;
  max: number;
}

export function resolveScalarRange(min: number, max: number, validCount: number): ScalarRange {
  if (!(validCount > 0) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return { mode: "empty", min: 0, max: 0 };
  }
  if (!(max > min)) {
    return { mode: "constant", min, max };
  }
  if (min < 0 && max > 0) {
    return { mode: "diverging", min, max };
  }
  return { mode: "sequential", min, max };
}

// Normalized position of a value in its range. Diverging maps 0 → 0.5
// exactly (piecewise linear on each side); sequential maps min→0, max→1.
// Returns null for values outside a usable range (empty/constant handled
// by callers: constant always renders the mid color).
export function scalarValueToT(value: number, range: ScalarRange): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (range.mode === "empty") {
    return null;
  }
  if (range.mode === "constant") {
    return 0.5;
  }
  if (range.mode === "diverging") {
    if (value <= range.min) {
      return 0;
    }
    if (value >= range.max) {
      return 1;
    }
    if (value < 0) {
      return 0.5 * (1 + value / Math.abs(range.min));
    }
    return 0.5 * (1 + value / range.max);
  }
  if (value <= range.min) {
    return 0;
  }
  if (value >= range.max) {
    return 1;
  }
  return (value - range.min) / (range.max - range.min);
}

type RgbStop = [number, number, number];

// Sequential Blues (light → dark); sampled luminance decreases
// monotonically so order reads from brightness alone.
const SEQUENTIAL_STOPS: RgbStop[] = [
  [247, 251, 255],
  [189, 215, 231],
  [107, 174, 214],
  [49, 130, 189],
  [8, 81, 156]
];

// Diverging blue → near-white → orange; data 0 sits at the neutral middle.
const DIVERGING_NEGATIVE: RgbStop[] = [
  [8, 81, 156],
  [107, 174, 214],
  [245, 245, 245]
];
const DIVERGING_POSITIVE: RgbStop[] = [
  [245, 245, 245],
  [253, 184, 99],
  [166, 54, 3]
];

function lerpStop(a: RgbStop, b: RgbStop, t: number): RgbStop {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function sampleRamp(stops: RgbStop[], t: number): RgbStop {
  const clamped = Math.min(1, Math.max(0, t));
  const segments = stops.length - 1;
  const position = clamped * segments;
  const index = Math.min(segments - 1, Math.floor(position));
  const first = stops[index] as RgbStop;
  const second = stops[index + 1] as RgbStop;
  return lerpStop(first, second, position - index);
}

// RGBA bytes for a normalized t. Alpha is full strength for finite data;
// callers write alpha 0 for invalid samples (transparent gaps). The ramp
// is theme-independent on purpose: the same data color in both themes
// keeps the legend truthful, while contours carry the theme adaptation.
export function scalarColorForT(t: number, mode: ScalarRangeMode): [number, number, number, number] {
  if (!Number.isFinite(t)) {
    return [0, 0, 0, 0];
  }
  if (mode === "diverging") {
    const stop = t < 0.5 ? sampleRamp(DIVERGING_NEGATIVE, t * 2) : sampleRamp(DIVERGING_POSITIVE, (t - 0.5) * 2);
    return [Math.round(stop[0]), Math.round(stop[1]), Math.round(stop[2]), 217];
  }
  const stop = sampleRamp(SEQUENTIAL_STOPS, mode === "constant" ? 0.5 : t);
  return [Math.round(stop[0]), Math.round(stop[1]), Math.round(stop[2]), 217];
}

// Convenience for renderers: value → premultiplied-bytes RGBA in one call.
// Invalid values yield transparent black (alpha 0); empty ranges yield
// transparent as well (nothing to show, never a crash).
export function scalarColorForValue(
  value: number,
  range: ScalarRange
): [number, number, number, number] {
  const t = scalarValueToT(value, range);
  if (t === null) {
    return [0, 0, 0, 0];
  }
  return scalarColorForT(t, range.mode);
}
