import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { Group } from "three";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { buildIndexedSurfaceMeshGroup } from "./buildIndexedSurfaceMesh";
import { buildImplicitSurfaceContour } from "./buildImplicitSurfaceContour";

export function buildSurface(
  object: SurfaceGraphObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Group | null {
  if (!object.equation.trim()) {
    return null;
  }
  const implicitContour = buildImplicitSurfaceContour(object, theme);
  if (implicitContour) {
    return implicitContour;
  }
  const { evaluator, error, effectiveOrientation } = compileSurfaceExpression(
    object.equation,
    object.orientation || "z"
  );
  if (error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleSurface(evaluator, {
      domain: object.domain,
      resolution: Math.max(2, Math.floor(object.resolution)),
      clampHeight: 10_000,
      orientation: effectiveOrientation
    });
  } catch {
    return null;
  }

  if (!sampled) {
    return null;
  }

  return buildIndexedSurfaceMeshGroup({
    id: object.id,
    color: object.color,
    wireframe: object.appearance.wireframe,
    positions: sampled.positions,
    indices: sampled.indices,
    theme,
    tokens
  });
}
