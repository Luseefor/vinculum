import type { GraphObject } from "@vinculum/scene/types";
import { Group, type Object3D } from "three";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { getGraphObjectFor3D } from "./graphObject3dGuards";
import { buildImplicitCurve } from "./buildGraphImplicitCurve";
import { buildParametric } from "./buildGraphParametric";
import { buildParametricSurface } from "./buildGraphParametricSurface";
import { buildImplicitSurface } from "./buildGraphImplicitSurface";
import { buildPlane } from "./buildGraphPlane";
import { buildLinearTransform3D } from "./buildGraphLinearTransform";
import { buildSurface } from "./buildGraphSurface";
import {
  buildLinePrimitive,
  buildPointPrimitive,
  buildRayPrimitive,
  buildSegmentPrimitive,
  buildVectorPrimitive
} from "./buildGraphGeometryPrimitives";

export function buildGraphObjectsGroup(objects: GraphObject[], theme: ResolvedTheme): Group {
  const root = new Group();
  const tokens = getGraphThemeTokens(theme);

  for (const object of objects) {
    if (!object.visible) {
      continue;
    }

    const built = buildOne(object, theme, tokens);
    if (built) {
      root.add(built);
    }
  }

  return root;
}

export function buildGraphObject(object: GraphObject, theme: ResolvedTheme): Object3D | null {
  const tokens = getGraphThemeTokens(theme);
  return buildOne(object, theme, tokens);
}

function buildOne(
  object: GraphObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Object3D | null {
  object = getGraphObjectFor3D(object);
  if (object.kind === "implicitCurve") {
    return buildImplicitCurve(object);
  }
  if (object.kind === "surface") {
    return buildSurface(object, theme, tokens);
  }
  if (object.kind === "parametricCurve") {
    return buildParametric(object);
  }
  if (object.kind === "parametricSurface") {
    return buildParametricSurface(object, theme, tokens);
  }
  if (object.kind === "implicitSurface") {
    return buildImplicitSurface(object, theme, tokens);
  }
  if (object.kind === "plane") {
    return buildPlane(object, theme);
  }
  if (object.kind === "point") {
    return buildPointPrimitive(object);
  }
  if (object.kind === "vector") {
    return buildVectorPrimitive(object);
  }
  if (object.kind === "line") {
    return buildLinePrimitive(object);
  }
  if (object.kind === "ray") {
    return buildRayPrimitive(object);
  }
  if (object.kind === "segment") {
    return buildSegmentPrimitive(object);
  }
  if (object.kind === "linearTransform") {
    return buildLinearTransform3D(object);
  }
  return null;
}
