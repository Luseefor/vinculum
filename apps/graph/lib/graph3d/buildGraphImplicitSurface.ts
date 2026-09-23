import type { ImplicitSurfaceObject } from "@vinculum/scene/types";
import { Group } from "three";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { sampleImplicitScalarField } from "@/lib/math/sampleImplicitField";
import { extractImplicitSurfaceMesh } from "@/lib/math/marchingTetrahedra";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { reportWarning } from "@/lib/monitoring/errorReporting";
import { buildIndexedSurfaceMeshGroup } from "./buildIndexedSurfaceMesh";

export function buildImplicitSurface(
  object: ImplicitSurfaceObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Group | null {
  if (!object.equation.trim()) {
    return null;
  }
  const compiled = compileImplicitSurfaceExpression(object.equation);
  if (compiled.error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleImplicitScalarField(compiled.evaluator, {
      domain: object.domain,
      resolution: Math.max(2, Math.floor(object.resolution))
    });
  } catch (error) {
    // Unreachable at capped resolutions (the sampler's 2MB guard throws
    // before allocation), but log unexpected throws for diagnosability
    // instead of failing silently.
    reportWarning("Implicit surface sampling failed unexpectedly.", {
      featureArea: "3d-viewport",
      operation: "implicit-surface-sample-failed",
      objectId: object.id,
      objectKind: object.kind,
      details: { message: error instanceof Error ? error.message : String(error) }
    });
    return null;
  }

  let extracted;
  try {
    extracted = extractImplicitSurfaceMesh({ field: sampled, evaluate: compiled.evaluator });
  } catch (error) {
    reportWarning("Implicit surface extraction failed unexpectedly.", {
      featureArea: "3d-viewport",
      operation: "implicit-surface-extract-failed",
      objectId: object.id,
      objectKind: object.kind,
      details: { message: error instanceof Error ? error.message : String(error) }
    });
    return null;
  }

  // No zero crossing in this box is a VALID object state (not an error):
  // F = 1 and off-domain spheres simply produce no mesh while the object
  // stays editable. A budget abort is reported so the empty viewport is
  // explainable; resolution/pressure UI already guides the user down.
  if (extracted.status === "budget-exceeded") {
    reportWarning("Implicit surface extraction exceeded the triangle budget.", {
      featureArea: "3d-viewport",
      operation: "implicit-surface-budget-exceeded"
    });
    return null;
  }
  if (extracted.status !== "ok") {
    return null;
  }

  // One canonical mesh shared by all S16 synchronized panes (Perspective /
  // XY / XZ / YZ): the multi-view renderer draws this single node once per
  // pane. No per-pane extraction ever happens here.
  return buildIndexedSurfaceMeshGroup({
    id: object.id,
    color: object.color,
    wireframe: object.appearance.wireframe,
    positions: extracted.positions,
    indices: extracted.indices,
    theme,
    tokens,
    repairZeroNormals: true
  });
}
