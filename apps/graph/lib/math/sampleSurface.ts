import type { SurfaceDomain } from "@vinculum/scene/types";
import { normalizeSurfaceResolution } from "@vinculum/scene/defaults";
import type { SurfaceEvaluator } from "./compileExpression";

interface SampleSurfaceOptions {
  domain: SurfaceDomain;
  resolution: number;
  invalidHeight?: number;
  clampHeight?: number;
  orientation?: "x" | "y" | "z";
}

export interface SampledSurfaceMesh {
  positions: Float32Array;
  indices: Uint16Array;
  rejectedTriangles: number;
}

const DEFAULT_CLAMP_HEIGHT = 10_000;
const MAX_SURFACE_POSITION_BUFFER_BYTES = 2_000_000;
// S4 (F2): an axis-aligned edge is cut only on a strict +/-/+ (or -/+/-)
// sign flip vs both immediate neighbors AND a jump exceeding K times the
// skip-1 outer jumps. Measured: pole bridges show ratios >= 13.5 while smooth,
// steep, and saddle surfaces never double-flip at all; K = 8 separates the
// regimes with margin. K is intentionally internal (not scene schema / UI).
const DISCONTINUITY_OUTLIER_RATIO = 8;

export function sampleSurface(evaluate: SurfaceEvaluator, options: SampleSurfaceOptions): SampledSurfaceMesh {
  const resolution = normalizeSurfaceResolution(options.resolution);
  const invalidHeight = options.invalidHeight ?? 0;
  const clampHeight = Math.max(1, options.clampHeight ?? DEFAULT_CLAMP_HEIGHT);
  const orientation = options.orientation ?? "z";

  const xMin = Math.min(options.domain.xMin, options.domain.xMax);
  const xMax = Math.max(options.domain.xMin, options.domain.xMax);
  const yMin = Math.min(options.domain.yMin, options.domain.yMax);
  const yMax = Math.max(options.domain.yMin, options.domain.yMax);

  const stride = resolution + 1;
  const vertexCount = stride * stride;
  const estimatedPositionBytes = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
  if (estimatedPositionBytes > MAX_SURFACE_POSITION_BUFFER_BYTES) {
    const boundedResolution = Math.max(
      2,
      Math.floor(Math.sqrt(MAX_SURFACE_POSITION_BUFFER_BYTES / (3 * Float32Array.BYTES_PER_ELEMENT))) - 1
    );
    throw new Error(
      `Surface resolution ${resolution} exceeds memory budget. Use ${Math.min(resolution, boundedResolution)} or lower.`
    );
  }
  const positions = new Float32Array(vertexCount * 3);
  const validVertices = new Uint8Array(vertexCount);
  const heights = new Float32Array(vertexCount);

  let vertexOffset = 0;
  for (let yStep = 0; yStep <= resolution; yStep += 1) {
    const vValue = lerp(yMin, yMax, yStep / resolution);

    for (let xStep = 0; xStep <= resolution; xStep += 1) {
      const vertexIndex = yStep * stride + xStep;
      const uValue = lerp(xMin, xMax, xStep / resolution);
      const sampledHeight = evaluate(uValue, vValue);

      const isFinite = Number.isFinite(sampledHeight);
      const h = isFinite ? clamp(sampledHeight, -clampHeight, clampHeight) : invalidHeight;

      if (orientation === "x") {
        // x = f(y, z)
        // World mapping used throughout the scene:
        // - world.x = math.x
        // - world.y (up) = math.z
        // - world.z = math.y
        // uValue is math.y, vValue is math.z, h is math.x
        positions[vertexOffset] = h;          // math.x -> world.x
        positions[vertexOffset + 1] = vValue; // math.z -> world.y (up)
        positions[vertexOffset + 2] = uValue; // math.y -> world.z
      } else if (orientation === "y") {
        // y = f(x, z)
        // uValue is math.x, vValue is math.z, h is math.y
        positions[vertexOffset] = uValue;     // math.x -> world.x
        positions[vertexOffset + 1] = vValue; // math.z -> world.y (up)
        positions[vertexOffset + 2] = h;      // math.y -> world.z
      } else {
        // z = f(x, y)
        // uValue is math.x, vValue is math.y, h is math.z
        positions[vertexOffset] = uValue;     // math.x -> world.x
        positions[vertexOffset + 1] = h;      // math.z -> world.y (up)
        positions[vertexOffset + 2] = vValue; // math.y -> world.z
      }

      validVertices[vertexIndex] = isFinite ? 1 : 0;
      heights[vertexIndex] = h;
      vertexOffset += 3;
    }
  }

  const uDiscontinuity = flagDiscontinuousEdges(heights, validVertices, stride, resolution, true);
  const vDiscontinuity = flagDiscontinuousEdges(heights, validVertices, stride, resolution, false);

  const indices: number[] = [];
  let rejectedTriangles = 0;
  for (let yStep = 0; yStep < resolution; yStep += 1) {
    for (let xStep = 0; xStep < resolution; xStep += 1) {
      const a = yStep * stride + xStep;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;

      // Triangle (a, c, b) spans u-edge (yStep, xStep) and v-edge (xStep, yStep).
      if (validVertices[a] && validVertices[c] && validVertices[b]) {
        if (uDiscontinuity[yStep * resolution + xStep] === 1 || vDiscontinuity[xStep * resolution + yStep] === 1) {
          rejectedTriangles += 1;
        } else {
          indices.push(a, c, b);
        }
      }

      // Triangle (b, c, d) spans u-edge (yStep + 1, xStep) and v-edge (xStep + 1, yStep).
      if (validVertices[b] && validVertices[c] && validVertices[d]) {
        if (uDiscontinuity[(yStep + 1) * resolution + xStep] === 1 || vDiscontinuity[(xStep + 1) * resolution + yStep] === 1) {
          rejectedTriangles += 1;
        } else {
          indices.push(b, c, d);
        }
      }
    }
  }

  return {
    positions,
    indices: new Uint16Array(indices),
    rejectedTriangles
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
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

function gridJump(
  heights: Float32Array,
  validVertices: Uint8Array,
  stride: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  if (x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0 || x0 >= stride || y0 >= stride || x1 >= stride || y1 >= stride) {
    return Number.NaN;
  }
  const a = y0 * stride + x0;
  const b = y1 * stride + x1;
  if (a >= heights.length || b >= heights.length) {
    return Number.NaN;
  }
  if (validVertices[a] !== 1 || validVertices[b] !== 1) {
    return Number.NaN;
  }
  return (heights[b] ?? Number.NaN) - (heights[a] ?? Number.NaN);
}

// Flags axis-aligned edges whose height jump is an extreme local outlier
// with a strict +/-/+ (or -/+/-) flip vs immediate neighbors, confirmed
// against skip-1 outer jumps. Both orientations share one layout: each line
// holds `resolution` edge flags, so the flag for u-edge (ix, iy) lives at
// iy * resolution + ix and for v-edge (ix, iy) at ix * resolution + iy.
// The flag arrays are allocated once per call; inner loops use scalars only
// (no closures, objects, or per-edge allocation).
function flagDiscontinuousEdges(
  heights: Float32Array,
  validVertices: Uint8Array,
  stride: number,
  resolution: number,
  horizontal: boolean
): Uint8Array {
  const flags = new Uint8Array(resolution * stride);
  const lineCount = stride;

  for (let line = 0; line < lineCount; line += 1) {
    for (let edge = 0; edge < resolution; edge += 1) {
      let previous: number;
      let current: number;
      let next: number;
      let outerBefore: number;
      let outerAfter: number;
      if (horizontal) {
        previous = gridJump(heights, validVertices, stride, edge - 1, line, edge, line);
        current = gridJump(heights, validVertices, stride, edge, line, edge + 1, line);
        next = gridJump(heights, validVertices, stride, edge + 1, line, edge + 2, line);
        outerBefore = gridJump(heights, validVertices, stride, edge - 2, line, edge - 1, line);
        outerAfter = gridJump(heights, validVertices, stride, edge + 2, line, edge + 3, line);
      } else {
        previous = gridJump(heights, validVertices, stride, line, edge - 1, line, edge);
        current = gridJump(heights, validVertices, stride, line, edge, line, edge + 1);
        next = gridJump(heights, validVertices, stride, line, edge + 1, line, edge + 2);
        outerBefore = gridJump(heights, validVertices, stride, line, edge - 2, line, edge - 1);
        outerAfter = gridJump(heights, validVertices, stride, line, edge + 2, line, edge + 3);
      }
      const signPrevious = jumpSign(previous);
      const signCurrent = jumpSign(current);
      const signNext = jumpSign(next);
      if (signPrevious === 0 || signCurrent === 0 || signNext === 0) {
        continue;
      }
      if (!(signPrevious === signNext && signPrevious !== signCurrent)) {
        continue;
      }

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
        continue;
      }
      if (Math.abs(current) > DISCONTINUITY_OUTLIER_RATIO * outerMax) {
        flags[line * resolution + edge] = 1;
      }
    }
  }

  return flags;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
