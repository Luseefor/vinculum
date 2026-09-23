import {
  MAX_VECTOR_FIELD_2D_DENSITY,
  MAX_VECTOR_FIELD_3D_DENSITY,
  MIN_VECTOR_FIELD_DENSITY
} from "@vinculum/scene/defaults";
import type {
  VectorFieldDimension,
  VectorFieldDomain2D,
  VectorFieldDomain3D
} from "@vinculum/scene/types";
import { compileVectorFieldExpressions } from "./compileVectorField";

// S20: pure bounded vector-field sampler. No React/Three/buffer objects —
// only TypedArrays plus lightweight statistics. Invalid samples (throw,
// non-number, NaN, ±Infinity on ANY required component, or a non-finite
// magnitude from finite-component overflow) are dropped; zero vectors stay
// valid with magnitude 0. Output buffers are compacted to valid samples so
// renderers iterate them directly with no mask indirection.
export interface VectorFieldDataInput {
  dimension: VectorFieldDimension;
  pExpr: string;
  qExpr: string;
  rExpr: string;
  domain: VectorFieldDomain2D | VectorFieldDomain3D;
  density: number;
  params: Record<string, number>;
}

export type VectorFieldDataResult =
  | {
      status: "ok";
      positions: Float32Array;
      vectors: Float32Array;
      magnitudes: Float32Array;
      validCount: number;
      totalSamples: number;
      invalidCount: number;
      maxMagnitude: number;
    }
  | { status: "empty" }
  | { status: "error"; error: string };

// Backstop against handmade over-budget requests: validated densities cap
// 2D at 32^2 = 1024 and 3D at 12^3 = 1728 samples.
const MAX_VECTOR_FIELD_SAMPLES = 2048;

export function computeVectorFieldData(input: VectorFieldDataInput): VectorFieldDataResult {
  const { dimension, domain } = input;
  const density = Math.floor(input.density);
  const maxDensity = dimension === "2d" ? MAX_VECTOR_FIELD_2D_DENSITY : MAX_VECTOR_FIELD_3D_DENSITY;
  // S20-R7: fractional densities floor (mirrors parseInteger); only
  // non-finite and out-of-range values error.
  if (!Number.isFinite(input.density) || density < MIN_VECTOR_FIELD_DENSITY || density > maxDensity) {
    return { status: "error", error: `Density must be between ${MIN_VECTOR_FIELD_DENSITY} and ${maxDensity}.` };
  }

  const totalSamples = dimension === "2d" ? density * density : density * density * density;
  if (totalSamples > MAX_VECTOR_FIELD_SAMPLES) {
    return { status: "error", error: "Field sample count exceeds the sampling budget." };
  }

  const compiled = compileVectorFieldExpressions(
    dimension,
    input.pExpr,
    input.qExpr,
    input.rExpr,
    input.params
  );
  if (compiled.error) {
    return { status: "error", error: compiled.error };
  }

  const xStep = gridStep(domain.xMin, domain.xMax, density);
  const yStep = gridStep(domain.yMin, domain.yMax, density);
  const domain3D = dimension === "3d" ? (domain as VectorFieldDomain3D) : null;
  const zStep = domain3D ? gridStep(domain3D.zMin, domain3D.zMax, density) : 0;
  if (![xStep, yStep, zStep].every(Number.isFinite)) {
    return { status: "error", error: "Field domain bounds must be finite numbers." };
  }

  // Exactly `density` points per axis, endpoints included (density >= 2, so
  // no division by zero). S20 spec pins density 12 -> 12^3 glyphs.
  const positions: number[] = [];
  const vectors: number[] = [];
  const magnitudes: number[] = [];
  let maxMagnitude = 0;

  const visit = (x: number, y: number, z: number) => {
    const components =
      dimension === "2d"
        ? (compiled.evaluate2D as NonNullable<typeof compiled.evaluate2D>)(x, y)
        : (compiled.evaluate3D as NonNullable<typeof compiled.evaluate3D>)(x, y, z);
    for (const component of components) {
      if (!Number.isFinite(component)) {
        return;
      }
    }
    const magnitude = Math.sqrt(components.reduce((sum, component) => sum + component * component, 0));
    if (!Number.isFinite(magnitude)) {
      return;
    }
    if (dimension === "2d") {
      positions.push(x, y, 0);
      vectors.push(components[0] as number, components[1] as number, 0);
    } else {
      positions.push(x, y, z);
      vectors.push(components[0] as number, components[1] as number, components[2] as number);
    }
    magnitudes.push(magnitude);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
    }
  };

  if (domain3D === null) {
    for (let j = 0; j < density; j += 1) {
      const y = domain.yMin + j * yStep;
      for (let i = 0; i < density; i += 1) {
        visit(domain.xMin + i * xStep, y, 0);
      }
    }
  } else {
    for (let k = 0; k < density; k += 1) {
      const z = domain3D.zMin + k * zStep;
      for (let j = 0; j < density; j += 1) {
        const y = domain.yMin + j * yStep;
        for (let i = 0; i < density; i += 1) {
          visit(domain.xMin + i * xStep, y, z);
        }
      }
    }
  }

  const validCount = magnitudes.length;
  if (validCount === 0) {
    return { status: "empty" };
  }

  return {
    status: "ok",
    positions: new Float32Array(positions),
    vectors: new Float32Array(vectors),
    magnitudes: new Float32Array(magnitudes),
    validCount,
    totalSamples,
    invalidCount: totalSamples - validCount,
    maxMagnitude
  };
}

function gridStep(min: number, max: number, density: number): number {
  // Degenerate (min === max) and inverted domains stay finite: every sample
  // lands on the same point or traverses backward. No NaN by construction
  // (density >= 2, so no division by zero); non-finite bounds are rejected
  // by the caller before sampling.
  return (max - min) / (density - 1);
}
