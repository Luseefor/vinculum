import type { ParametricSurfaceDomain } from "@vinculum/scene/types";
import { normalizeParametricSurfaceResolution } from "@vinculum/scene/defaults";
import { mathToWorld3D } from "./coordinates";
import type { ParametricSurfaceEvaluator } from "./compileParametricSurface";

interface SampleParametricSurfaceOptions {
  domain: ParametricSurfaceDomain;
  resolution: number;
  clampCoordinate?: number;
}

// Canonical sampled parametric-surface contract (S17): fixed (resolution+1)^2
// grid cardinality with renderer-independent validity metadata. positions
// keeps WORLD-frame finite/sanitized/clamped buffer semantics; invalid samples
// hold a (0,0,0) placeholder that no emitted triangle may reference.
// indices is Uint16: the 128 cap bounds vertices to 129 x 129 = 16641 < 65536.
export interface SampledParametricSurface {
  positions: Float32Array;
  indices: Uint16Array;
  rejectedTriangles: number;
}

const DEFAULT_CLAMP_COORDINATE = 10_000;
const MAX_PARAMETRIC_SURFACE_POSITION_BUFFER_BYTES = 2_000_000;
// S17: the S5 curve pole-straddle rule generalized to grid edges. An edge is
// cut only when one vector component independently double-flips (+/-/+ or
// -/+/-) against its neighbors with a jump exceeding K times the skip-1
// outer jumps. Same K = 8 as curves/surfaces: measured pole ratios sit far
// above it while smooth/steep controls never double-flip. K is internal
// (not scene schema / UI). Only finite samples participate: invalid vertices
// cut adjacent triangles separately via validity.
const PARAMETRIC_SURFACE_DISCONTINUITY_OUTLIER_RATIO = 8;

export function sampleParametricSurface(
  evaluate: ParametricSurfaceEvaluator,
  options: SampleParametricSurfaceOptions
): SampledParametricSurface {
  const resolution = normalizeParametricSurfaceResolution(options.resolution);
  const rawClamp = options.clampCoordinate ?? DEFAULT_CLAMP_COORDINATE;
  const clampCoordinate = Number.isFinite(rawClamp) ? Math.max(1, rawClamp) : DEFAULT_CLAMP_COORDINATE;

  // Inverted ranges follow the explicit-surface convention (min/max swap);
  // a zero span yields a degenerate-but-finite sheet (no span division
  // exists anywhere: interpolation divides only by resolution >= 2).
  const uMin = Math.min(options.domain.uMin, options.domain.uMax);
  const uMax = Math.max(options.domain.uMin, options.domain.uMax);
  const vMin = Math.min(options.domain.vMin, options.domain.vMax);
  const vMax = Math.max(options.domain.vMin, options.domain.vMax);

  const stride = resolution + 1;
  const vertexCount = stride * stride;
  const estimatedPositionBytes = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
  if (estimatedPositionBytes > MAX_PARAMETRIC_SURFACE_POSITION_BUFFER_BYTES) {
    const boundedResolution = Math.max(
      2,
      Math.floor(
        Math.sqrt(MAX_PARAMETRIC_SURFACE_POSITION_BUFFER_BYTES / (3 * Float32Array.BYTES_PER_ELEMENT))
      ) - 1
    );
    throw new Error(
      `Parametric surface resolution ${resolution} exceeds memory budget. Use ${Math.min(resolution, boundedResolution)} or lower.`
    );
  }

  const positions = new Float32Array(vertexCount * 3);
  const validVertices = new Uint8Array(vertexCount);
  // Transient raw math-frame coordinates for discontinuity classification
  // only. Max cost at the resolution cap: 129 x 129 x 3 x 4 bytes (~200KB),
  // freed per call. Sanitized/clamped buffer values must never participate
  // in classification (same rule as sampleCurve).
  const rawMath = new Float32Array(vertexCount * 3);

  let vertexOffset = 0;
  for (let vStep = 0; vStep <= resolution; vStep += 1) {
    const vValue = lerp(vMin, vMax, vStep / resolution);
    for (let uStep = 0; uStep <= resolution; uStep += 1) {
      const vertexIndex = vStep * stride + uStep;
      const uValue = lerp(uMin, uMax, uStep / resolution);
      const [x, y, z] = evaluate(uValue, vValue);

      const valid = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
      validVertices[vertexIndex] = valid ? 1 : 0;
      rawMath[vertexOffset] = x;
      rawMath[vertexOffset + 1] = y;
      rawMath[vertexOffset + 2] = z;

      if (valid) {
        const world = mathToWorld3D({
          x: clamp(x, -clampCoordinate, clampCoordinate),
          y: clamp(y, -clampCoordinate, clampCoordinate),
          z: clamp(z, -clampCoordinate, clampCoordinate)
        });
        positions[vertexOffset] = world.x;
        positions[vertexOffset + 1] = world.y;
        positions[vertexOffset + 2] = world.z;
      } else {
        // Placeholder: no emitted triangle may reference an invalid vertex,
        // so this storage is never rendered and never enters indexed bounds.
        positions[vertexOffset] = 0;
        positions[vertexOffset + 1] = 0;
        positions[vertexOffset + 2] = 0;
      }
      vertexOffset += 3;
    }
  }

  const uDiscontinuity = flagDiscontinuousGridEdges(rawMath, validVertices, stride, resolution, true);
  const vDiscontinuity = flagDiscontinuousGridEdges(rawMath, validVertices, stride, resolution, false);

  // Consistent grid triangulation mirroring sampleSurface's (a, c, b) /
  // (b, c, d) pattern. The canonical math -> world map (x, y, z) -> (x, z, y)
  // is a reflection (determinant -1), so the same index pattern that yields
  // up-normals for explicit surfaces yields outward normals for standard
  // sphere/torus parameterizations here (verified numerically).
  // Degenerate pole rows stay valid finite samples: their zero-area
  // triangles contribute nothing to computeVertexNormals while neighboring
  // non-degenerate triangles keep every referenced vertex normal finite.
  const indices: number[] = [];
  let rejectedTriangles = 0;
  for (let vStep = 0; vStep < resolution; vStep += 1) {
    for (let uStep = 0; uStep < resolution; uStep += 1) {
      const a = vStep * stride + uStep;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;

      // Triangle (a, c, b) spans u-edge (vStep, uStep) and v-edge (uStep, vStep).
      if (validVertices[a] && validVertices[c] && validVertices[b]) {
        if (uDiscontinuity[vStep * resolution + uStep] === 1 || vDiscontinuity[uStep * resolution + vStep] === 1) {
          rejectedTriangles += 1;
        } else {
          indices.push(a, c, b);
        }
      }

      // Triangle (b, c, d) spans u-edge (vStep + 1, uStep) and v-edge (uStep + 1, vStep).
      if (validVertices[b] && validVertices[c] && validVertices[d]) {
        if (uDiscontinuity[(vStep + 1) * resolution + uStep] === 1 || vDiscontinuity[(uStep + 1) * resolution + vStep] === 1) {
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

// Signed math-frame jump of one vector component along a grid line from
// vertex indexA to indexB. NaN unless both endpoints are raw-valid and the
// jump is finite, so sanitized placeholders can never participate.
function lineJump(
  rawMath: Float32Array,
  validVertices: Uint8Array,
  indexA: number,
  indexB: number,
  component: number
): number {
  if (indexA < 0 || indexB < 0 || indexA >= validVertices.length || indexB >= validVertices.length) {
    return Number.NaN;
  }
  if (validVertices[indexA] !== 1 || validVertices[indexB] !== 1) {
    return Number.NaN;
  }
  const a = rawMath[indexA * 3 + component] ?? Number.NaN;
  const b = rawMath[indexB * 3 + component] ?? Number.NaN;
  const jump = b - a;
  return Number.isFinite(jump) ? jump : Number.NaN;
}

function vertexAt(stride: number, uStep: number, vStep: number): number {
  return vStep * stride + uStep;
}

/**
 * Replace exact-zero vertex normals (degenerate pole corners whose only
 * adjacent faces have zero area, e.g. sphere grid vertex (0, 0)) with the
 * normalized sum of indexed one-ring neighbor normals. Fully degenerate
 * sheets (all neighbors zero too) are left untouched so the caller can
 * reject them via indexed bounds. Pure typed-array math, no renderer.
 * Returns the number of repaired vertices.
 */
export function repairZeroVertexNormals(
  normals: Float32Array,
  indices: Uint16Array | Uint32Array | number[]
): number {
  const vertexCount = normals.length / 3;
  const isZero = new Uint8Array(vertexCount);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = normals[vertex * 3] ?? 0;
    const y = normals[vertex * 3 + 1] ?? 0;
    const z = normals[vertex * 3 + 2] ?? 0;
    if (x === 0 && y === 0 && z === 0) {
      isZero[vertex] = 1;
    }
  }

  const sumX = new Float32Array(vertexCount);
  const sumY = new Float32Array(vertexCount);
  const sumZ = new Float32Array(vertexCount);
  const triangleCount = Math.floor(indices.length / 3);
  for (let tri = 0; tri < triangleCount; tri += 1) {
    const a = indices[tri * 3] ?? -1;
    const b = indices[tri * 3 + 1] ?? -1;
    const c = indices[tri * 3 + 2] ?? -1;
    const corners = [a, b, c];
    for (let k = 0; k < 3; k += 1) {
      const vertex = corners[k] ?? -1;
      if (vertex < 0 || vertex >= vertexCount || isZero[vertex] !== 1) {
        continue;
      }
      for (let m = 0; m < 3; m += 1) {
        if (m === k) {
          continue;
        }
        const neighbor = corners[m] ?? -1;
        if (neighbor < 0 || neighbor >= vertexCount) {
          continue;
        }
        sumX[vertex] += normals[neighbor * 3] ?? 0;
        sumY[vertex] += normals[neighbor * 3 + 1] ?? 0;
        sumZ[vertex] += normals[neighbor * 3 + 2] ?? 0;
      }
    }
  }

  let repaired = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (isZero[vertex] !== 1) {
      continue;
    }
    const x = sumX[vertex] ?? 0;
    const y = sumY[vertex] ?? 0;
    const z = sumZ[vertex] ?? 0;
    const length = Math.hypot(x, y, z);
    if (!(length > 0)) {
      continue;
    }
    normals[vertex * 3] = x / length;
    normals[vertex * 3 + 1] = y / length;
    normals[vertex * 3 + 2] = z / length;
    repaired += 1;
  }
  return repaired;
}

function isDiscontinuousLineComponent(
  rawMath: Float32Array,
  validVertices: Uint8Array,
  stride: number,
  uStep: number,
  vStep: number,
  component: number,
  horizontal: boolean
): boolean {
  const at = (du: number, dv: number): number => {
    const u = horizontal ? uStep + du : uStep;
    const v = horizontal ? vStep : vStep + dv;
    if (u < 0 || v < 0 || u >= stride || v >= stride) {
      return -1;
    }
    return vertexAt(stride, u, v);
  };
  const previous = lineJump(rawMath, validVertices, at(-1, -1), at(0, 0), component);
  const current = lineJump(rawMath, validVertices, at(0, 0), at(1, 1), component);
  const next = lineJump(rawMath, validVertices, at(1, 1), at(2, 2), component);
  const signPrevious = jumpSign(previous);
  const signCurrent = jumpSign(current);
  const signNext = jumpSign(next);
  if (signPrevious === 0 || signCurrent === 0 || signNext === 0) {
    return false;
  }
  if (!(signPrevious === signNext && signPrevious !== signCurrent)) {
    return false;
  }

  const outerBefore = lineJump(rawMath, validVertices, at(-2, -2), at(-1, -1), component);
  const outerAfter = lineJump(rawMath, validVertices, at(2, 2), at(3, 3), component);
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
  return Math.abs(current) > PARAMETRIC_SURFACE_DISCONTINUITY_OUTLIER_RATIO * outerMax;
}

// Flags grid edges whose vector jump proves a pole straddle in any single
// component (same per-component rule as sampleCurve segments). Each row
// (horizontal) holds `resolution` u-edge flags at vStep * resolution + uStep;
// each column holds `resolution` v-edge flags at uStep * resolution + vStep.
function flagDiscontinuousGridEdges(
  rawMath: Float32Array,
  validVertices: Uint8Array,
  stride: number,
  resolution: number,
  horizontal: boolean
): Uint8Array {
  const flags = new Uint8Array(resolution * stride);
  const lineCount = stride;

  for (let line = 0; line < lineCount; line += 1) {
    for (let edge = 0; edge < resolution; edge += 1) {
      const uStep = horizontal ? edge : line;
      const vStep = horizontal ? line : edge;
      let cut = false;
      for (let component = 0; component < 3 && !cut; component += 1) {
        cut = isDiscontinuousLineComponent(rawMath, validVertices, stride, uStep, vStep, component, horizontal);
      }
      if (cut) {
        flags[line * resolution + edge] = 1;
      }
    }
  }

  return flags;
}
