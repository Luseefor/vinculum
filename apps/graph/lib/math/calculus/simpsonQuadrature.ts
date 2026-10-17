// S25 pure composite-Simpson quadrature (1D + tensor-product 2D). No
// React/Three/stores/DOM — the same functions run in the S19 worker and
// in unit tests. Deterministic, bounded, worker-safe.
//
// Strategy (PART 15): evaluate the FINE grid once; the fine Simpson sum
// uses all nodes while the coarse sum reuses every second fine node
// (exact nesting: fine N is always even, so N/2 is even too). The
// smooth-problem error estimate |fine − coarse| / 15 is returned as an
// ESTIMATE (never a guaranteed bound) for honest display.
//
// Signed-domain convention (S25-R1): inverted bounds (a > b) negate via
// the signed step h, exactly like analytic definite integrals —
// "length"/"area" over an inverted domain read negative. Scene inputs
// normally satisfy min ≤ max; nothing normalizes silently.
//
// Accumulation uses Kahan compensated summation (PART 47): small,
// materially stabilizing for thousands of weighted terms.
// Non-finite nodes or sums fail closed as non-finite (PART 3/46) —
// singular samples are never skipped, so improper integrals report
// unavailable instead of a wrong number.

export type QuadratureQuality = "low" | "medium" | "high";

// Fine subdivisions per quality (always even; coarse = half, also even).
// 1D high (256) and 2D high (96²) stay worker-comfortable; budgets below
// reject malformed payloads regardless.
export const SIMPSON_1D_FINE_N: Record<QuadratureQuality, number> = {
  low: 64,
  medium: 128,
  high: 256
};

export const SIMPSON_2D_FINE_N: Record<QuadratureQuality, number> = {
  low: 32,
  medium: 64,
  high: 96
};

export const MAX_SIMPSON_1D_N = 512;
export const MAX_SIMPSON_2D_N = 128;

export function isQuadratureQuality(value: unknown): value is QuadratureQuality {
  return value === "low" || value === "medium" || value === "high";
}

export function normalizeSimpsonCount(count: number, max: number): number | null {
  if (!Number.isFinite(count)) {
    return null;
  }
  const floored = Math.floor(count);
  if (floored < 2 || floored > max || floored % 2 !== 0) {
    return null;
  }
  return floored;
}

export type QuadratureStatus = "ok" | "non-finite";

export interface Simpson1DResult {
  status: QuadratureStatus;
  /** Fine-grid Simpson value. */
  value: number;
  /** Coarse-grid (every 2nd node) Simpson value. */
  coarseValue: number;
  /** Smooth-problem error estimate |fine − coarse| / 15 (estimate only). */
  estimatedError: number;
  /** Integrand evaluations performed. */
  evaluations: number;
}

function kahanAdd(sum: number, compensation: number, term: number): [number, number] {
  const adjusted = term - compensation;
  const updated = sum + adjusted;
  return [updated, updated - sum - adjusted];
}

function simpsonWeights(count: number): { weight: (index: number) => number } {
  return {
    weight: (index: number) => {
      if (index === 0 || index === count) {
        return 1;
      }
      return index % 2 === 1 ? 4 : 2;
    }
  };
}

export function integrateSimpson1D(
  evaluate: (x: number) => number,
  a: number,
  b: number,
  fineCount: number
): Simpson1DResult {
  const failed = (evaluations: number): Simpson1DResult => ({
    status: "non-finite",
    value: Number.NaN,
    coarseValue: Number.NaN,
    estimatedError: Number.NaN,
    evaluations
  });
  const n = normalizeSimpsonCount(fineCount, MAX_SIMPSON_1D_N);
  if (n === null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return failed(0);
  }
  const h = (b - a) / n;
  if (!Number.isFinite(h)) {
    return failed(0);
  }
  const { weight } = simpsonWeights(n);
  let fineSum = 0;
  let fineCompensation = 0;
  let coarseSum = 0;
  let coarseCompensation = 0;
  let evaluations = 0;
  for (let i = 0; i <= n; i += 1) {
    const x = a + i * h;
    let value: number;
    try {
      value = evaluate(x);
    } catch {
      return failed(evaluations);
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return failed(evaluations);
    }
    evaluations += 1;
    const fineTerm = weight(i) * value;
    if (!Number.isFinite(fineTerm)) {
      return failed(evaluations);
    }
    [fineSum, fineCompensation] = kahanAdd(fineSum, fineCompensation, fineTerm);
    if (!Number.isFinite(fineSum)) {
      return failed(evaluations);
    }
    if (i % 2 === 0) {
      // Coarse node: same value, coarse weight over the doubled step.
      const coarseIndex = i / 2;
      const coarseWeight = coarseIndex === 0 || coarseIndex === n / 2 ? 1 : coarseIndex % 2 === 1 ? 4 : 2;
      const coarseTerm = coarseWeight * value;
      if (!Number.isFinite(coarseTerm)) {
        return failed(evaluations);
      }
      [coarseSum, coarseCompensation] = kahanAdd(coarseSum, coarseCompensation, coarseTerm);
      if (!Number.isFinite(coarseSum)) {
        return failed(evaluations);
      }
    }
  }
  const value = (fineSum * h) / 3;
  const coarseValue = (coarseSum * 2 * h) / 3;
  if (!Number.isFinite(value) || !Number.isFinite(coarseValue)) {
    return failed(evaluations);
  }
  const estimatedError = Math.abs(value - coarseValue) / 15;
  return {
    status: "ok",
    value,
    coarseValue,
    estimatedError: Number.isFinite(estimatedError) ? estimatedError : Number.NaN,
    evaluations
  };
}

export interface Simpson2DResult extends Simpson1DResult {
  evaluationsU: number;
  evaluationsV: number;
}

export function integrateSimpson2D(
  evaluate: (u: number, v: number) => number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  fineCountPerAxis: number
): Simpson2DResult {
  const failed = (evaluations: number): Simpson2DResult => ({
    status: "non-finite",
    value: Number.NaN,
    coarseValue: Number.NaN,
    estimatedError: Number.NaN,
    evaluations,
    evaluationsU: 0,
    evaluationsV: 0
  });
  const n = normalizeSimpsonCount(fineCountPerAxis, MAX_SIMPSON_2D_N);
  if (
    n === null ||
    !Number.isFinite(u0) ||
    !Number.isFinite(u1) ||
    !Number.isFinite(v0) ||
    !Number.isFinite(v1)
  ) {
    return failed(0);
  }
  const hu = (u1 - u0) / n;
  const hv = (v1 - v0) / n;
  if (!Number.isFinite(hu) || !Number.isFinite(hv)) {
    return failed(0);
  }
  const { weight } = simpsonWeights(n);
  let fineSum = 0;
  let fineCompensation = 0;
  let coarseSum = 0;
  let coarseCompensation = 0;
  let evaluations = 0;
  for (let j = 0; j <= n; j += 1) {
    const v = v0 + j * hv;
    const wv = weight(j);
    const coarseJ = j % 2 === 0 ? j / 2 : -1;
    const coarseWv = coarseJ < 0 ? 0 : coarseJ === 0 || coarseJ === n / 2 ? 1 : coarseJ % 2 === 1 ? 4 : 2;
    for (let i = 0; i <= n; i += 1) {
      const u = u0 + i * hu;
      let value: number;
      try {
        value = evaluate(u, v);
      } catch {
        return failed(evaluations);
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return failed(evaluations);
      }
      evaluations += 1;
      const fineTerm = weight(i) * wv * value;
      if (!Number.isFinite(fineTerm)) {
        return failed(evaluations);
      }
      [fineSum, fineCompensation] = kahanAdd(fineSum, fineCompensation, fineTerm);
      if (!Number.isFinite(fineSum)) {
        return failed(evaluations);
      }
      if (i % 2 === 0 && coarseJ >= 0) {
        const coarseI = i / 2;
        const coarseWu = coarseI === 0 || coarseI === n / 2 ? 1 : coarseI % 2 === 1 ? 4 : 2;
        const coarseTerm = coarseWu * coarseWv * value;
        if (!Number.isFinite(coarseTerm)) {
          return failed(evaluations);
        }
        [coarseSum, coarseCompensation] = kahanAdd(coarseSum, coarseCompensation, coarseTerm);
        if (!Number.isFinite(coarseSum)) {
          return failed(evaluations);
        }
      }
    }
  }
  const value = (fineSum * hu * hv) / 9;
  const coarseValue = (coarseSum * 2 * hu * 2 * hv) / 9;
  if (!Number.isFinite(value) || !Number.isFinite(coarseValue)) {
    return failed(evaluations);
  }
  const estimatedError = Math.abs(value - coarseValue) / 15;
  return {
    status: "ok",
    value,
    coarseValue,
    estimatedError: Number.isFinite(estimatedError) ? estimatedError : Number.NaN,
    evaluations,
    evaluationsU: n + 1,
    evaluationsV: n + 1
  };
}
