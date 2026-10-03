import type { ImplicitSurfaceDomain } from "@vinculum/scene/types";
import { compileImplicitSurfaceExpression } from "./compileImplicitSurface";
import { extractImplicitSurfaceMesh } from "./marchingTetrahedra";
import { sampleImplicitScalarField } from "./sampleImplicitField";

// Pure numerical geometry data for one implicit surface (S19).
//
// This is the single source of truth for implicit-surface computation,
// shared by the main-thread builder and the geometry worker. It performs
// compile → sample → extract and returns transferable buffers plus status.
// It never touches Three.js, Zustand, the DOM, or the monitoring transport
// (unexpected throws are captured as data), so it is safe to run inside a
// Web Worker. Mesh construction (BufferGeometry, normals, materials, bounds)
// stays on the main thread in buildIndexedSurfaceMeshGroup.
export interface ImplicitSurfaceDataInput {
  equation: string;
  domain: ImplicitSurfaceDomain;
  resolution: number;
  params: Record<string, number>;
}

export type ImplicitSurfaceDataResult =
  | {
      status: "ok";
      positions: Float32Array;
      indices: Uint16Array | Uint32Array;
      vertexCount: number;
      triangleCount: number;
    }
  | { status: "empty" }
  | { status: "budget-exceeded" }
  // `stage` lets the main-thread builder preserve exact S18 reporting:
  // compile errors stay silent (inline diagnostics already show them) while
  // unexpected sample/extract throws are reported. The worker maps every
  // error status to its own diagnostic path.
  | { status: "error"; error: string; stage: "compile" | "sample" | "extract" };

export function computeImplicitSurfaceData(input: ImplicitSurfaceDataInput): ImplicitSurfaceDataResult {
  const compiled = compileImplicitSurfaceExpression(input.equation, input.params);
  if (compiled.error) {
    return { status: "error", error: compiled.error, stage: "compile" };
  }

  let sampled;
  try {
    sampled = sampleImplicitScalarField(compiled.evaluator, {
      domain: input.domain,
      resolution: Math.max(2, Math.floor(input.resolution))
    });
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Implicit surface sampling failed.",
      stage: "sample"
    };
  }

  let extracted;
  try {
    extracted = extractImplicitSurfaceMesh({ field: sampled, evaluate: compiled.evaluator });
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Implicit surface extraction failed.",
      stage: "extract"
    };
  }

  if (extracted.status === "budget-exceeded") {
    return { status: "budget-exceeded" };
  }
  if (extracted.status !== "ok") {
    return { status: "empty" };
  }

  return {
    status: "ok",
    positions: extracted.positions,
    indices: extracted.indices,
    vertexCount: extracted.vertexCount,
    triangleCount: extracted.triangleCount
  };
}
