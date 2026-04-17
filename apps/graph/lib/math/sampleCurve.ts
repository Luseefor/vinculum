import type { ParametricEvaluator } from "./compileParametric";

interface SampleCurveOptions {
  tMin: number;
  tMax: number;
  samples: number;
  clampCoordinate?: number;
}

export interface SampledCurve {
  positions: Float32Array;
}

const DEFAULT_CLAMP_COORDINATE = 10_000;

export function sampleCurve(evaluate: ParametricEvaluator, options: SampleCurveOptions): SampledCurve {
  const samples = Math.max(2, Math.floor(options.samples));
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
  let previousPoint: [number, number, number] = [0, 0, 0];

  for (let index = 0; index < samples; index += 1) {
    const t = lerp(tMin, tMax, index / (samples - 1));
    const [x, y, z] = evaluate(t);

    const point = sanitizePoint([x, y, z], previousPoint, clampCoordinate);
    positions[index * 3] = point[0];
    positions[index * 3 + 1] = point[1];
    positions[index * 3 + 2] = point[2];

    previousPoint = point;
  }

  return { positions };
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
