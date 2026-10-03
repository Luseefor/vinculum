import type {
  VectorFieldDimension,
  VectorFieldDomain2D,
  VectorFieldDomain3D
} from "@vinculum/scene/types";
import { compileVectorFieldExpressions } from "./compileVectorField";
import { traceStreamline, type StreamlineDomain } from "./streamlineIntegrate";
import { generateSeeds2D, generateSeeds3D } from "./streamlineSeeds";

// S23-style pure bounded streamline computer: compile → seed → trace →
// pack. No React/Three/stores/DOM — the same function runs in the S19
// worker and in unit tests (parity is structural). Only
// structured-clone-safe data crosses the worker boundary; the compiled
// evaluator never crosses (PART 39: the worker invokes the canonical
// vector compiler with identical S11 security, never a parallel
// compileStreamlineField).
//
// Output packing (PART 9): points Float32Array (2D: xy pairs, 3D: xyz
// triples), offsets Uint32Array of length streamlineCount + 1 (curve i
// spans point indices offsets[i]..offsets[i+1]-1), closed Uint8Array per
// curve. Polyline order follows +F (backward end → seed → forward end),
// so renderers can place direction markers along increasing index.

export type StreamlineLength = "short" | "medium" | "long";
export type StreamlineQuality = "low" | "medium" | "high";

export interface StreamlineComputeInput {
  dimension: VectorFieldDimension;
  pExpr: string;
  qExpr: string;
  rExpr: string;
  domain: VectorFieldDomain2D | VectorFieldDomain3D;
  seedDensity: number;
  length: StreamlineLength;
  quality: StreamlineQuality;
  params: Record<string, number>;
}

export type StreamlineComputeResult =
  | {
      status: "ok";
      points: Float32Array;
      offsets: Uint32Array;
      closed: Uint8Array;
      streamlineCount: number;
      totalPoints: number;
      evaluationCount: number;
    }
  | { status: "empty" }
  | { status: "budget-exceeded" }
  | { status: "error"; error: string };

// Quality → spatial step divisor of the minimum domain span (PART 2:
// ~1/80–1/120 of minimum span; high reaches finer). Internal only — the
// Inspector exposes Low/Medium/High, never raw step sizes.
const QUALITY_STEP_DIVISOR: Record<StreamlineQuality, number> = {
  low: 64,
  medium: 96,
  high: 144
};

// Trace length → factor of the domain diagonal (user-facing Short/Medium/
// Long; internally a geometric length cap per branch).
const LENGTH_FACTOR: Record<StreamlineLength, number> = {
  short: 0.75,
  medium: 1.5,
  long: 3
};

// Hard bounds (PART 8): per-branch step cap plus global point/evaluation
// budgets. Budgets bind first — exceeding either aborts with a clean
// budget-exceeded (no partial misleading field).
const MAX_STEPS_PER_BRANCH = 2048;
export const MAX_STREAMLINE_POINTS_TOTAL = 65536;
const MAX_STREAMLINE_EVALUATIONS_TOTAL = 4_000_000;

// Near-zero magnitude guard for normalization (PART 30): far below any
// legitimate small vector, so scaled fields like 1e-8·<x,y> keep their
// radial geometry while true zeros terminate cleanly.
const ZERO_MAGNITUDE_EPS = 1e-12;

export function streamlineStepSize(
  domain: VectorFieldDomain2D | VectorFieldDomain3D,
  dimension: VectorFieldDimension,
  quality: StreamlineQuality
): number {
  const spans = [Math.abs(domain.xMax - domain.xMin), Math.abs(domain.yMax - domain.yMin)];
  if (dimension === "3d") {
    spans.push(Math.abs((domain as VectorFieldDomain3D).zMax - (domain as VectorFieldDomain3D).zMin));
  }
  const minSpan = Math.min(...spans);
  if (!(minSpan > 0) || !Number.isFinite(minSpan)) {
    return 0;
  }
  return minSpan / QUALITY_STEP_DIVISOR[quality];
}

export function streamlineMaxLength(
  domain: VectorFieldDomain2D | VectorFieldDomain3D,
  dimension: VectorFieldDimension,
  length: StreamlineLength
): number {
  const spans = [Math.abs(domain.xMax - domain.xMin), Math.abs(domain.yMax - domain.yMin)];
  if (dimension === "3d") {
    spans.push(Math.abs((domain as VectorFieldDomain3D).zMax - (domain as VectorFieldDomain3D).zMin));
  }
  if (spans.some((span) => !Number.isFinite(span))) {
    return 0;
  }
  const diagonal = Math.sqrt(spans.reduce((sum, span) => sum + span * span, 0));
  return diagonal * LENGTH_FACTOR[length];
}

export function computeStreamlineData(input: StreamlineComputeInput): StreamlineComputeResult {
  const { dimension, domain } = input;
  // Density caps mirror the glyph sampler's validated range loosely, but
  // streamline seeds use their own tighter bounds (2D ≤ 12², 3D ≤ 5³).
  if (!Number.isFinite(input.seedDensity)) {
    return { status: "error", error: "Seed density must be a finite number." };
  }
  // Seed counts clamp inside the generators (2D ≤ 12², 3D ≤ 5³); the
  // validated value here only gates finiteness.
  if (dimension === "2d" && input.rExpr.trim() !== "") {
    return { status: "error", error: "R belongs to 3D fields only." };
  }

  const compiled = compileVectorFieldExpressions(
    dimension,
    input.pExpr,
    input.qExpr,
    input.rExpr,
    input.params
  );
  if (compiled.error) {
    // Unsafe/invalid sources are rejected at the canonical level (PART
    // 41): the streamline layer reports the error, never a separate
    // unsafe-path message.
    return { status: "error", error: compiled.error };
  }

  const stepSize = streamlineStepSize(domain, dimension, input.quality);
  const maxLength = streamlineMaxLength(domain, dimension, input.length);
  if (!(stepSize > 0) || !(maxLength > 0)) {
    return { status: "error", error: "Streamline domain bounds must be finite with nonzero span." };
  }

  const seeds = dimension === "2d" ? generateSeeds2D(domain, input.seedDensity) : generateSeeds3D(domain as VectorFieldDomain3D, input.seedDensity);
  if (seeds.length === 0) {
    return { status: "empty" };
  }

  const dim = dimension === "2d" ? 2 : 3;
  const streamlineDomain: StreamlineDomain =
    dimension === "2d"
      ? { min: [domain.xMin, domain.yMin], max: [domain.xMax, domain.yMax] }
      : {
          min: [domain.xMin, domain.yMin, (domain as VectorFieldDomain3D).zMin],
          max: [domain.xMax, domain.yMax, (domain as VectorFieldDomain3D).zMax]
        };
  const evaluate =
    dimension === "2d"
      ? (point: number[]): number[] => {
          const [x, y] = (compiled.evaluate2D as NonNullable<typeof compiled.evaluate2D>)(point[0] as number, point[1] as number);
          return [x, y];
        }
      : (point: number[]): number[] => {
          const [x, y, z] = (
            compiled.evaluate3D as NonNullable<typeof compiled.evaluate3D>
          )(point[0] as number, point[1] as number, point[2] as number);
          return [x, y, z];
        };

  const minSpan = stepSize * QUALITY_STEP_DIVISOR[input.quality];
  const options = {
    dimension: dim as 2 | 3,
    stepSize,
    maxStepsPerBranch: MAX_STEPS_PER_BRANCH,
    maxLengthPerBranch: maxLength,
    zeroThreshold: ZERO_MAGNITUDE_EPS,
    loopMinSteps: 48,
    loopRadiusSteps: 2,
    loopAlignment: 0.7,
    stagnationEps: minSpan * 1e-12,
    stagnationLimit: 3
  };

  const packedPoints: number[] = [];
  const offsets: number[] = [0];
  const closedFlags: number[] = [];
  let evaluationCount = 0;
  for (const seed of seeds) {
    const traced = traceStreamline(evaluate, seed, streamlineDomain, options);
    evaluationCount += traced.evaluations;
    if (evaluationCount > MAX_STREAMLINE_EVALUATIONS_TOTAL) {
      return { status: "budget-exceeded" };
    }
    const pointCount = traced.points.length / dim;
    if (pointCount < 2) {
      // Seed-only traces (zero/invalid seeds) pack nothing: no
      // stationary repeated points, ever.
      continue;
    }
    if ((offsets[offsets.length - 1] as number) + pointCount > MAX_STREAMLINE_POINTS_TOTAL) {
      return { status: "budget-exceeded" };
    }
    for (const value of traced.points) {
      packedPoints.push(value);
    }
    offsets.push((offsets[offsets.length - 1] as number) + pointCount);
    closedFlags.push(traced.closed ? 1 : 0);
  }

  if (closedFlags.length === 0) {
    return { status: "empty" };
  }
  return {
    status: "ok",
    points: new Float32Array(packedPoints),
    offsets: new Uint32Array(offsets),
    closed: new Uint8Array(closedFlags),
    streamlineCount: closedFlags.length,
    totalPoints: packedPoints.length / dim,
    evaluationCount
  };
}
