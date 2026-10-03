import type { ParametricSurfaceDomain } from "@vinculum/scene/types";
import { compileParametricSurfaceExpressions } from "./compileParametricSurface";
import { sampleParametricSurface } from "./sampleParametricSurface";

// Pure numerical geometry data for one parametric surface (S19).
//
// Single source of truth shared by the main-thread builder and the geometry
// worker: compile → sample, returning transferable buffers plus status.
// Never touches Three.js, Zustand, the DOM, or the monitoring transport, so
// it is safe to run inside a Web Worker. Mesh construction (BufferGeometry,
// computeVertexNormals, zero-normal repair, bounds, materials) stays on the
// main thread in buildIndexedSurfaceMeshGroup.
export interface ParametricSurfaceDataInput {
  xExpr: string;
  yExpr: string;
  zExpr: string;
  domain: ParametricSurfaceDomain;
  resolution: number;
  clampCoordinate?: number;
  params: Record<string, number>;
}

export type ParametricSurfaceDataResult =
  | {
      status: "ok";
      positions: Float32Array;
      indices: Uint16Array;
      rejectedTriangles: number;
    }
  | { status: "empty" }
  | { status: "error"; error: string };

export function computeParametricSurfaceData(input: ParametricSurfaceDataInput): ParametricSurfaceDataResult {
  const compiled = compileParametricSurfaceExpressions(input.xExpr, input.yExpr, input.zExpr, input.params);
  if (compiled.error) {
    return { status: "error", error: compiled.error };
  }

  let sampled;
  try {
    sampled = sampleParametricSurface(compiled.evaluator, {
      domain: input.domain,
      resolution: Math.max(2, Math.floor(input.resolution)),
      clampCoordinate: input.clampCoordinate ?? 10_000
    });
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Parametric surface sampling failed."
    };
  }

  if (!sampled || sampled.indices.length === 0) {
    return { status: "empty" };
  }

  return {
    status: "ok",
    positions: sampled.positions,
    indices: sampled.indices,
    rejectedTriangles: sampled.rejectedTriangles
  };
}
