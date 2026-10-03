import type { ImplicitSurfaceDomain } from "@vinculum/scene/types";
import { normalizeImplicitSurfaceResolution } from "@vinculum/scene/defaults";
import type { ImplicitSurfaceEvaluator } from "./compileImplicitSurface";

interface SampleImplicitFieldOptions {
  domain: ImplicitSurfaceDomain;
  resolution: number;
}

// Canonical sampled implicit scalar field (S18): a bounded (resolution+1)^3
// grid evaluated exactly ONCE per sample per extraction. values holds the
// finite field value or NaN for invalid samples; valid marks finite samples.
// NaNs live only in this CPU-side grid and must never enter geometry,
// normals, bounds, or GPU attributes. Index order is documented: x fastest,
// then y, then z: index(ix, iy, iz) = (iz * stride + iy) * stride + ix.
export interface SampledImplicitField {
  values: Float32Array;
  valid: Uint8Array;
  stride: number;
  resolution: number;
  xMin: number;
  yMin: number;
  zMin: number;
  stepX: number;
  stepY: number;
  stepZ: number;
}

const MAX_IMPLICIT_FIELD_VALUES_BYTES = 2_000_000;

export function gridVertexIndex(stride: number, ix: number, iy: number, iz: number): number {
  return (iz * stride + iy) * stride + ix;
}

export function sampleImplicitScalarField(
  evaluate: ImplicitSurfaceEvaluator,
  options: SampleImplicitFieldOptions
): SampledImplicitField {
  const resolution = normalizeImplicitSurfaceResolution(options.resolution);

  const xMin = Math.min(options.domain.xMin, options.domain.xMax);
  const xMax = Math.max(options.domain.xMin, options.domain.xMax);
  const yMin = Math.min(options.domain.yMin, options.domain.yMax);
  const yMax = Math.max(options.domain.yMin, options.domain.yMax);
  const zMin = Math.min(options.domain.zMin, options.domain.zMax);
  const zMax = Math.max(options.domain.zMin, options.domain.zMax);

  const stride = resolution + 1;
  const sampleCount = stride * stride * stride;
  const estimatedBytes = sampleCount * Float32Array.BYTES_PER_ELEMENT;
  if (estimatedBytes > MAX_IMPLICIT_FIELD_VALUES_BYTES) {
    throw new Error(
      `Implicit surface resolution ${resolution} exceeds memory budget. Use a lower resolution.`
    );
  }

  // Inverted ranges follow the explicit-surface convention (min/max swap);
  // a zero span yields a degenerate-but-finite slice (no span division
  // exists anywhere: interpolation divides only by resolution >= 2).
  const stepX = (xMax - xMin) / resolution;
  const stepY = (yMax - yMin) / resolution;
  const stepZ = (zMax - zMin) / resolution;

  const batched = evaluate.sampleGrid?.({ xMin, xMax, yMin, yMax, zMin, zMax }, resolution);
  const values = new Float32Array(sampleCount);
  const valid = new Uint8Array(sampleCount);

  let offset = 0;
  for (let iz = 0; iz <= resolution; iz += 1) {
    const z = zMin + stepZ * iz;
    for (let iy = 0; iy <= resolution; iy += 1) {
      const y = yMin + stepY * iy;
      for (let ix = 0; ix <= resolution; ix += 1) {
        const x = xMin + stepX * ix;
        const value = batched ? batched[offset] : evaluate(x, y, z);
        if (Number.isFinite(value)) {
          values[offset] = value;
          valid[offset] = 1;
        } else {
          values[offset] = Number.NaN;
          valid[offset] = 0;
        }
        offset += 1;
      }
    }
  }

  return { values, valid, stride, resolution, xMin, yMin, zMin, stepX, stepY, stepZ };
}

export function gridVertexMathPosition(
  field: SampledImplicitField,
  vertexIndex: number
): { x: number; y: number; z: number } {
  const stride = field.stride;
  const iz = Math.floor(vertexIndex / (stride * stride));
  const remainder = vertexIndex - iz * stride * stride;
  const iy = Math.floor(remainder / stride);
  const ix = remainder - iy * stride;
  return {
    x: field.xMin + field.stepX * ix,
    y: field.yMin + field.stepY * iy,
    z: field.zMin + field.stepZ * iz
  };
}
