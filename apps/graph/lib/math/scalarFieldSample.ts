// S23 pure bounded 2D scalar-field sampler. No React, no Three, no stores,
// no DOM — only TypedArrays plus lightweight statistics, mirroring the S20
// computeVectorFieldData shape. The grid convention is (resolution + 1)^2
// samples with endpoints included, row-major (row j, column i at
// j * width + i), matching the S18 SampledImplicitField layout.
//
// Domain-neutral by construction: the compiler accepts expressions such as
// f(x,y) = 1/x over domains containing 0; samples that throw or evaluate
// non-finite are recorded invalid (validity mask 0) and every consumer
// (heat, contours, gradients) treats them as gaps — singularities are
// never smeared across.

export interface ScalarGridDomain {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export interface SampledScalarGrid {
  values: Float32Array;
  valid: Uint8Array;
  /** Nodes per axis (resolution + 1). */
  width: number;
  height: number;
  min: number;
  max: number;
  validCount: number;
  totalSamples: number;
}

// S23 grid budgets (PART 39): scalar grids are far denser than vector
// glyph grids. 257^2 Float32 values ~= 264 KB + 66 KB validity —
// browser-safe for one live grid per analyzed source. The worker computes
// at these resolutions; the 2D canvas only recolors cached grids.
export const DEFAULT_SCALAR_GRID_RESOLUTION = 128;
export const MAX_SCALAR_GRID_RESOLUTION = 256;
export const MIN_SCALAR_GRID_RESOLUTION = 8;

// 3D planar slices reuse the same 2D grid machinery over the projected
// plane domain. Slices span larger world extents, so the default is lower;
// the vertex-color mesh at 97^2 stays light in every S16 pane.
export const DEFAULT_SLICE_GRID_RESOLUTION = 96;
export const MAX_SLICE_GRID_RESOLUTION = 192;

export function clampScalarGridResolution(resolution: number, max: number): number {
  if (!Number.isFinite(resolution)) {
    return DEFAULT_SCALAR_GRID_RESOLUTION;
  }
  return Math.min(max, Math.max(MIN_SCALAR_GRID_RESOLUTION, Math.floor(resolution)));
}

// Exact live-grid memory (PART 39): values Float32 + validity mask.
export function scalarGridMemoryBytes(resolution: number): { values: number; validity: number } {
  const clamped = clampScalarGridResolution(resolution, MAX_SCALAR_GRID_RESOLUTION);
  const nodes = (clamped + 1) * (clamped + 1);
  return { values: nodes * 4, validity: nodes };
}

export type ScalarGridEvaluator = (u: number, v: number) => number;

export function sampleScalarGrid(
  evaluate: ScalarGridEvaluator,
  domain: ScalarGridDomain,
  resolution: number
): SampledScalarGrid {
  const clamped = clampScalarGridResolution(resolution, MAX_SCALAR_GRID_RESOLUTION);
  const width = clamped + 1;
  const height = clamped + 1;
  const totalSamples = width * height;
  const values = new Float32Array(totalSamples);
  const valid = new Uint8Array(totalSamples);
  if (
    !Number.isFinite(domain.uMin) ||
    !Number.isFinite(domain.uMax) ||
    !Number.isFinite(domain.vMin) ||
    !Number.isFinite(domain.vMax)
  ) {
    return { values, valid, width, height, min: 0, max: 0, validCount: 0, totalSamples };
  }
  // Inverted ranges traverse backward (S20 convention); degenerate ranges
  // collapse every sample onto one line/point without dividing by zero
  // (resolution >= MIN >= 2, so no division by zero by construction).
  const uStep = (domain.uMax - domain.uMin) / clamped;
  const vStep = (domain.vMax - domain.vMin) / clamped;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let validCount = 0;
  for (let j = 0; j < height; j += 1) {
    const v = domain.vMin + j * vStep;
    for (let i = 0; i < width; i += 1) {
      const u = domain.uMin + i * uStep;
      const index = j * width + i;
      let value: number;
      try {
        value = evaluate(u, v);
      } catch {
        continue;
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
        continue;
      }
      values[index] = value;
      valid[index] = 1;
      validCount += 1;
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
  }
  if (validCount === 0) {
    return { values, valid, width, height, min: 0, max: 0, validCount: 0, totalSamples };
  }
  return { values, valid, width, height, min, max, validCount, totalSamples };
}
