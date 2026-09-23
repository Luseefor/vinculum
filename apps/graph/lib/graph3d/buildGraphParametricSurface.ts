import type { ParametricSurfaceObject } from "@vinculum/scene/types";
import { Group } from "three";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { sampleParametricSurface } from "@/lib/math/sampleParametricSurface";
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
  const compiled = compileParametricSurfaceExpressions(object.xExpr, object.yExpr, object.zExpr);
  if (compiled.error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleParametricSurface(compiled.evaluator, {
      domain: object.domain,
      resolution: Math.max(2, Math.floor(object.resolution)),
      clampCoordinate: 10_000
    });
  } catch {
    return null;
  }

  if (!sampled) {
    return null;
  }

  // One canonical mesh shared by all S16 synchronized panes (Perspective /
  // XY / XZ / YZ): the multi-view renderer draws this single node once per
  // pane. No per-pane geometry is ever created here.
  return buildIndexedSurfaceMeshGroup({
    id: object.id,
    color: object.color,
    wireframe: object.appearance.wireframe,
    positions: sampled.positions,
    indices: sampled.indices,
    theme,
    tokens,
    repairZeroNormals: true
  });
}
