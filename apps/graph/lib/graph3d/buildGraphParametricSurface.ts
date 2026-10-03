import type { ParametricSurfaceObject } from "@vinculum/scene/types";
import { Group } from "three";
import { computeParametricSurfaceData } from "@/lib/math/computeParametricSurfaceData";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { buildIndexedSurfaceMeshGroup } from "./buildIndexedSurfaceMesh";

export function buildParametricSurface(
  object: ParametricSurfaceObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Group | null {
  if (![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim())) {
    return null;
  }
  // S19: numerical computation lives in computeParametricSurfaceData (shared
  // with the geometry worker); this builder only funnels its result into the
  // shared mesh construction. All failures stay silent nulls, as before.
  const result = computeParametricSurfaceData({
    xExpr: object.xExpr,
    yExpr: object.yExpr,
    zExpr: object.zExpr,
    domain: object.domain,
    resolution: object.resolution,
    clampCoordinate: 10_000,
    params: getEditorParameterScope()
  });
  if (result.status !== "ok") {
    return null;
  }

  // One canonical mesh shared by all S16 synchronized panes (Perspective /
  // XY / XZ / YZ): the multi-view renderer draws this single node once per
  // pane. No per-pane geometry is ever created here.
  return buildIndexedSurfaceMeshGroup({
    id: object.id,
    color: object.color,
    wireframe: object.appearance.wireframe,
    positions: result.positions,
    indices: result.indices,
    theme,
    tokens,
    repairZeroNormals: true
  });
}
