import type { ParametricEvaluator } from "./compileParametric";
import { MAX_PARAMETRIC_CURVE_SAMPLES } from "./expressionSafety";

interface SampleCurveOptions {
  tMin: number;
  tMax: number;
  samples: number;
  clampCoordinate?: number;
}

// Canonical sampled-curve contract (S5): fixed sample cardinality with
// renderer-independent continuity metadata. positions keeps the historical
// WORLD-frame finite/sanitized/clamped buffer semantics; validSamples marks
// raw-finite samples; connectedSegments marks drawable i -> i+1 segments.
export interface SampledCurve {
  positions: Float32Array;
  validSamples: Uint8Array;
  connectedSegments: Uint8Array;
}

const DEFAULT_CLAMP_COORDINATE = 10_000;
// S5 (F3-B): same outlier rationale as the S4 surface rule — a pole-straddling
// segment double-flips against its neighbors with a large relative magnitude.
// Measured curve matrices: pole ratios >= 15 with zero double-flips on all
// smooth/steep controls; K = 8 separates with margin. Internal only.
const PARAMETRIC_DISCONTINUITY_OUTLIER_RATIO = 8;

export function sampleCurve(evaluate: ParametricEvaluator, options: SampleCurveOptions): SampledCurve {
  const requestedSamples = Math.floor(options.samples);
  if (!Number.isFinite(requestedSamples) || requestedSamples > MAX_PARAMETRIC_CURVE_SAMPLES) {
    throw new Error(`Resolution is too high. Use ${MAX_PARAMETRIC_CURVE_SAMPLES} or lower.`);
  }

  const samples = Math.max(2, requestedSamples);
  const rawTMin = Number.isFinite(options.tMin) ? options.tMin : -1;
  const rawTMax = Number.isFinite(options.tMax) ? options.tMax : 1;
  let tMin = Math.min(rawTMin, rawTMax);
  let tMax = Math.max(rawTMin, rawTMax);
  if (Math.abs(tMax - tMin) < 1e-10) {
    tMin = -1;
    tMax = 1;
  }
  const clampCoordinate = Math.max(1, options.clampCoordinate ?? DEFAULT_CLAMP_COORDINATE);

  const positions = new Float32Array(samples * 3);
  const validSamples = new Uint8Array(samples);
  // Transient raw math-frame coordinates for continuity classification only.
  // Max cost at the sample cap: 8192 * 3 * 4 bytes (~98KB), freed per call.
  const rawMath = new Float32Array(samples * 3);
  let previousPoint: [number, number, number] = [0, 0, 0];

  for (let index = 0; index < samples; index += 1) {
    const t = lerp(tMin, tMax, index / (samples - 1));
    const [x, y, z] = evaluate(t);

    const valid = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
    validSamples[index] = valid ? 1 : 0;
    rawMath[index * 3] = x;
    rawMath[index * 3 + 1] = y;
    rawMath[index * 3 + 2] = z;

    const point = sanitizePoint([x, y, z], previousPoint, clampCoordinate);
    positions[index * 3] = point[0];     // Math X -> Three.X
    positions[index * 3 + 1] = point[2]; // Math Z -> Three.Y (up)
    positions[index * 3 + 2] = point[1]; // Math Y -> Three.Z

    previousPoint = point;
  }

  return {
    positions,
    validSamples,
    connectedSegments: classifyCurveSegments(rawMath, validSamples, samples)
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function sanitizePoint(
  point: [number, number, number],
  fallback: [number, number, number],
  clampCoordinate: number
): [number, number, number] {
  const sanitized = point.map((value, axisIndex) => {
    if (!Number.isFinite(value)) {
      return fallback[axisIndex];
    }

    return clamp(value, -clampCoordinate, clampCoordinate);
  }) as [number, number, number];

  return sanitized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function jumpSign(value: number): number {
  if (value > 0) {
    return 1;
  }
  if (value < 0) {
    return -1;
  }
  return 0;
}

// Signed math-frame jump of one component from sample seg to seg + 1.
// NaN unless both endpoints are raw-valid and the jump is finite, so
// sanitized fallback coordinates can never participate in classification.
function componentJump(
  rawMath: Float32Array,
  validSamples: Uint8Array,
  samples: number,
  component: number,
  seg: number
): number {
  if (seg < 0 || seg + 1 >= samples) {
    return Number.NaN;
  }
  if (validSamples[seg] !== 1 || validSamples[seg + 1] !== 1) {
    return Number.NaN;
  }
  const a = rawMath[seg * 3 + component] ?? Number.NaN;
  const b = rawMath[(seg + 1) * 3 + component] ?? Number.NaN;
  const jump = b - a;
  return Number.isFinite(jump) ? jump : Number.NaN;
}

function isDiscontinuousComponent(
  rawMath: Float32Array,
  validSamples: Uint8Array,
  samples: number,
  component: number,
  seg: number
): boolean {
  const previous = componentJump(rawMath, validSamples, samples, component, seg - 1);
  const current = componentJump(rawMath, validSamples, samples, component, seg);
  const next = componentJump(rawMath, validSamples, samples, component, seg + 1);
  const signPrevious = jumpSign(previous);
  const signCurrent = jumpSign(current);
  const signNext = jumpSign(next);
  if (signPrevious === 0 || signCurrent === 0 || signNext === 0) {
    return false;
  }
  if (!(signPrevious === signNext && signPrevious !== signCurrent)) {
    return false;
  }

  const outerBefore = componentJump(rawMath, validSamples, samples, component, seg - 2);
  const outerAfter = componentJump(rawMath, validSamples, samples, component, seg + 2);
  let outerMax = 0;
  let haveOuter = false;
  if (Number.isFinite(outerBefore)) {
    outerMax = Math.max(outerMax, Math.abs(outerBefore));
    haveOuter = true;
  }
  if (Number.isFinite(outerAfter)) {
    outerMax = Math.max(outerMax, Math.abs(outerAfter));
    haveOuter = true;
  }
  if (!haveOuter || outerMax === 0) {
    return false;
  }
  return Math.abs(current) > PARAMETRIC_DISCONTINUITY_OUTLIER_RATIO * outerMax;
}

// Canonical connectivity: segment i -> i+1 is drawable only when both
// endpoints are raw-valid (F3-A) and no math component independently proves a
// pole straddle (F3-B). Scalar-only, O(samples), no per-sample allocation.
function classifyCurveSegments(
  rawMath: Float32Array,
  validSamples: Uint8Array,
  samples: number
): Uint8Array {
  const connected = new Uint8Array(Math.max(0, samples - 1));
  for (let seg = 0; seg + 1 < samples; seg += 1) {
    if (validSamples[seg] !== 1 || validSamples[seg + 1] !== 1) {
      continue;
    }
    let cut = false;
    for (let component = 0; component < 3 && !cut; component += 1) {
      cut = isDiscontinuousComponent(rawMath, validSamples, samples, component, seg);
    }
    connected[seg] = cut ? 0 : 1;
  }
  return connected;
}
