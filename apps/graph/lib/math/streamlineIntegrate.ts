// S24 pure bounded streamline integrator (classic RK4 over the
// NORMALIZED vector field). No React, no Three, no stores, no DOM — the
// same function runs in the S19 worker and in unit tests.
//
// Mathematical semantics: geometric streamlines solve dX/ds = F(X)/||F(X)||
// where F != 0 — the same integral curves as dX/dt = F(X) up to
// orientation-preserving reparameterization wherever the field is nonzero.
// Normalization is deliberate: spatial step size stays stable, huge
// magnitudes never create giant jumps, and trajectories are invariant
// under positive scalar multiplication of F. This is NOT a time
// trajectory: traversal speed is visualization-only, so user-facing copy
// must say "Streamlines", never "particle paths" or "simulation".
//
// Per-stage normalization: every RK stage evaluates F at its own point
// and normalizes independently — never once per step.

export type StreamlineVector = number[];

export type StreamlineEvaluator = (point: StreamlineVector) => StreamlineVector;

export interface StreamlineDomain {
  min: StreamlineVector;
  max: StreamlineVector;
}

export interface StreamlineIntegratorOptions {
  dimension: 2 | 3;
  /** Spatial increment per step (domain-relative, chosen by quality). */
  stepSize: number;
  /** Hard cap per branch (forward/backward separately). */
  maxStepsPerBranch: number;
  /** Geometric length cap per branch (stops long before steps when set). */
  maxLengthPerBranch: number;
  /** ||F|| below this terminates the branch (division guard). */
  zeroThreshold: number;
  /** Loop detection starts after this many accepted steps. */
  loopMinSteps: number;
  /** Seed-return radius, in step-size multiples. */
  loopRadiusSteps: number;
  /** Cosine of the tangent-alignment angle for loop closure. */
  loopAlignment: number;
  /** Micro-step stagnation guard, in minimum-span multiples. */
  stagnationEps: number;
  /** Consecutive micro-steps before stagnation termination. */
  stagnationLimit: number;
}

export type StreamlineStopReason =
  | "domain-exit"
  | "invalid-field"
  | "zero-field"
  | "max-steps"
  | "max-length"
  | "closed-loop"
  | "stagnation"
  | "non-finite"
  | "invalid-input";

export interface TracedBranch {
  /** Flat coordinates from the seed outward (seed first). */
  points: number[];
  closed: boolean;
  reason: StreamlineStopReason;
  evaluations: number;
}

export interface TracedStreamline {
  /** Joined polyline: backward end → seed → forward end (+F direction). */
  points: number[];
  closed: boolean;
  evaluations: number;
}

function vectorLengthSquared(vector: StreamlineVector): number {
  let sum = 0;
  for (const component of vector) {
    sum += component * component;
  }
  return sum;
}

function pointInDomain(point: StreamlineVector, domain: StreamlineDomain): boolean {
  for (let i = 0; i < point.length; i += 1) {
    const value = point[i] as number;
    const lo = Math.min(domain.min[i] as number, domain.max[i] as number);
    const hi = Math.max(domain.min[i] as number, domain.max[i] as number);
    if (!Number.isFinite(value) || value < lo || value > hi) {
      return false;
    }
  }
  return true;
}

// One normalized direction evaluation. Returns null when the branch must
// stop (invalid components or a below-threshold magnitude).
function normalizedDirection(
  evaluate: StreamlineEvaluator,
  point: StreamlineVector,
  zeroThreshold: number,
  evaluations: { count: number }
): StreamlineVector | null {
  let raw: StreamlineVector;
  try {
    raw = evaluate(point);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const direction: StreamlineVector = [];
  for (const component of raw) {
    if (typeof component !== "number" || !Number.isFinite(component)) {
      return null;
    }
    direction.push(component);
  }
  const squared = vectorLengthSquared(direction);
  if (!Number.isFinite(squared) || squared < zeroThreshold * zeroThreshold) {
    return null;
  }
  const length = Math.sqrt(squared);
  for (let i = 0; i < direction.length; i += 1) {
    direction[i] = (direction[i] as number) / length;
  }
  evaluations.count += 1;
  return direction;
}

// Cosine below which consecutive field directions indicate a jumped
// singularity (e.g. stepping over the 1/x pole): smooth fields at
// domain-relative steps never reverse this hard between stages.
const FIELD_REVERSAL_COS = -0.25;

interface SteppedResult {
  next: StreamlineVector;
  /** Normalized field direction at the step origin (== next step's k1). */
  entry: StreamlineVector;
}

function rk4Step(
  evaluate: StreamlineEvaluator,
  point: StreamlineVector,
  direction: 1 | -1,
  stepSize: number,
  zeroThreshold: number,
  evaluations: { count: number }
): SteppedResult | null {
  const dimension = point.length;
  const stage = (at: StreamlineVector): StreamlineVector | null =>
    normalizedDirection(evaluate, at, zeroThreshold, evaluations);
  const k1 = stage(point);
  if (!k1) {
    return null;
  }
  const p2 = point.map((value, i) => value + ((direction * stepSize) / 2) * (k1[i] as number));
  const k2 = stage(p2);
  if (!k2) {
    return null;
  }
  const p3 = point.map((value, i) => value + ((direction * stepSize) / 2) * (k2[i] as number));
  const k3 = stage(p3);
  if (!k3) {
    return null;
  }
  const p4 = point.map((value, i) => value + direction * stepSize * (k3[i] as number));
  const k4 = stage(p4);
  if (!k4) {
    return null;
  }
  const next: StreamlineVector = [];
  for (let i = 0; i < dimension; i += 1) {
    const value =
      (point[i] as number) +
      ((direction * stepSize) / 6) *
        ((k1[i] as number) + 2 * (k2[i] as number) + 2 * (k3[i] as number) + (k4[i] as number));
    if (!Number.isFinite(value)) {
      return null;
    }
    next.push(value);
  }
  return { next, entry: k1 };
}

export function traceStreamlineBranch(
  evaluate: StreamlineEvaluator,
  seed: StreamlineVector,
  direction: 1 | -1,
  domain: StreamlineDomain,
  options: StreamlineIntegratorOptions
): TracedBranch {
  const dimension = options.dimension;
  const evaluations = { count: 0 };
  const fail = (reason: StreamlineStopReason): TracedBranch => ({
    points: [...seed],
    closed: false,
    reason,
    evaluations: evaluations.count
  });
  if (seed.length !== dimension || domain.min.length !== dimension || domain.max.length !== dimension) {
    // S24-R1: dimension mismatch is a caller programming error, not a
    // numerical state — label it distinctly from "non-finite".
    return fail("invalid-input");
  }
  if (!pointInDomain(seed, domain)) {
    return fail("domain-exit");
  }
  const initial = normalizedDirection(evaluate, seed, options.zeroThreshold, evaluations);
  if (!initial) {
    // Seed at a zero/invalid vector produces no streamline (correct: do
    // not move the seed artificially, do not emit repeated points).
    return fail("zero-field");
  }
  const points: number[] = [...seed];
  let current = [...seed];
  let length = 0;
  let stagnation = 0;
  let steps = 0;
  let previousEntry: StreamlineVector | null = null;
  while (steps < options.maxStepsPerBranch) {
    const stepped = rk4Step(evaluate, current, direction, options.stepSize, options.zeroThreshold, evaluations);
    if (!stepped) {
      return { points, closed: false, reason: "invalid-field", evaluations: evaluations.count };
    }
    const { next, entry } = stepped;
    if (previousEntry) {
      let alignment = 0;
      for (let i = 0; i < dimension; i += 1) {
        alignment += (entry[i] as number) * (previousEntry[i] as number);
      }
      if (alignment < FIELD_REVERSAL_COS) {
        // The field reversed across the last segment: the trace jumped a
        // singularity (pole between samples, all stages finite). Drop the
        // crossed point and stop — never bridge.
        for (let i = 0; i < dimension; i += 1) {
          points.pop();
        }
        return { points, closed: false, reason: "invalid-field", evaluations: evaluations.count };
      }
    }
    previousEntry = entry;
    let movedSquared = 0;
    for (let i = 0; i < dimension; i += 1) {
      const delta = (next[i] as number) - (current[i] as number);
      movedSquared += delta * delta;
    }
    const moved = Math.sqrt(movedSquared);
    if (!(moved > options.stagnationEps)) {
      stagnation += 1;
      if (stagnation >= options.stagnationLimit) {
        return { points, closed: false, reason: "stagnation", evaluations: evaluations.count };
      }
      // A single micro-step is skipped (not appended): precision stalls
      // must never produce repeated identical samples.
      current = next;
      continue;
    }
    stagnation = 0;
    if (!pointInDomain(next, domain)) {
      return { points, closed: false, reason: "domain-exit", evaluations: evaluations.count };
    }
    length += moved;
    if (length > options.maxLengthPerBranch) {
      return { points, closed: false, reason: "max-length", evaluations: evaluations.count };
    }
    for (const value of next) {
      points.push(value);
    }
    steps += 1;
    // Unit travel direction of this step, for loop-closure alignment.
    const displacement = next.map((value, i) => (value - (current[i] as number)) / moved);
    current = next;
    // Closed-loop return: near the seed (scaled by step size, never
    // immediate) with tangent aligned to the initial direction.
    if (steps >= options.loopMinSteps) {
      let seedDistanceSquared = 0;
      for (let i = 0; i < dimension; i += 1) {
        const delta = (current[i] as number) - (seed[i] as number);
        seedDistanceSquared += delta * delta;
      }
      const loopRadius = options.loopRadiusSteps * options.stepSize;
      if (seedDistanceSquared <= loopRadius * loopRadius) {
        let alignment = 0;
        for (let i = 0; i < dimension; i += 1) {
          alignment += (displacement[i] as number) * (initial[i] as number) * direction;
        }
        if (alignment >= options.loopAlignment) {
          return { points, closed: true, reason: "closed-loop", evaluations: evaluations.count };
        }
      }
    }
  }
  return { points, closed: false, reason: "max-steps", evaluations: evaluations.count };
}

export function traceStreamline(
  evaluate: StreamlineEvaluator,
  seed: StreamlineVector,
  domain: StreamlineDomain,
  options: StreamlineIntegratorOptions
): TracedStreamline {
  const backward = traceStreamlineBranch(evaluate, seed, -1, domain, options);
  const forward = traceStreamlineBranch(evaluate, seed, 1, domain, options);
  // Join without duplicating the seed: the backward branch runs seed →
  // outward, so drop its seed head, reverse the tail, then append the
  // forward branch (seed first). Index order follows +F.
  const dimension = options.dimension;
  const backwardTail = backward.points.slice(dimension);
  const reversed: number[] = [];
  for (let i = backwardTail.length - dimension; i >= 0; i -= dimension) {
    for (let d = 0; d < dimension; d += 1) {
      reversed.push(backwardTail[i + d] as number);
    }
  }
  const joined = [...reversed, ...forward.points];
  if (joined.length / dimension < 2) {
    // Seed-only traces (zero/invalid seeds on both sides) pack nothing:
    // no stationary repeated points, ever.
    return { points: [], closed: false, evaluations: backward.evaluations + forward.evaluations };
  }
  return {
    points: joined,
    closed: backward.closed || forward.closed,
    evaluations: backward.evaluations + forward.evaluations
  };
}
