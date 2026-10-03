import type { ImplicitSurfaceObject } from "@vinculum/scene/types";
import { Group } from "three";
import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
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
  const result = computeImplicitSurfaceData({
    equation: object.equation,
    domain: object.domain,
    resolution: object.resolution,
    params: getEditorParameterScope()
  });

  if (result.status === "error") {
    // S18 reporting preserved exactly: compile errors stay silent (inline
    // diagnostics already show them); unexpected sample/extract throws warn.
    if (result.stage !== "compile") {
      reportWarning(
        result.stage === "sample"
          ? "Implicit surface sampling failed unexpectedly."
          : "Implicit surface extraction failed unexpectedly.",
        {
          featureArea: "3d-viewport",
          operation:
            result.stage === "sample" ? "implicit-surface-sample-failed" : "implicit-surface-extract-failed",
          objectId: object.id,
          objectKind: object.kind,
          details: { message: result.error }
        }
      );
    }
    return null;
  }

  // No zero crossing in this box is a VALID object state (not an error):
  // F = 1 and off-domain spheres simply produce no mesh while the object
  // stays editable. A budget abort is reported so the empty viewport is
  // explainable; resolution/pressure UI already guides the user down.
  if (result.status === "budget-exceeded") {
    reportWarning("Implicit surface extraction exceeded the triangle budget.", {
      featureArea: "3d-viewport",
      operation: "implicit-surface-budget-exceeded"
    });
    return null;
  }
  if (result.status !== "ok") {
    return null;
  }

  // One canonical mesh shared by all S16 synchronized panes (Perspective /
  // XY / XZ / YZ): the multi-view renderer draws this single node once per
  // pane. No per-pane extraction ever happens here.
  return buildIndexedSurfaceMeshGroup({
    id: object.id,
    color: object.color,
    wireframe: object.appearance.wireframe,
    positions: result.positions,
    indices: result.indices,
    theme,
    tokens,
    repairZeroNormals: true,
    smoothNormals: true
  });
}
