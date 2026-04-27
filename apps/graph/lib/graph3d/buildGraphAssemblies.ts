import type { GraphObject } from "@vinculum/scene/types";
import { Group, type Object3D } from "three";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { buildParametric } from "./buildGraphParametric";
import { buildPlane } from "./buildGraphPlane";
import { buildSurface } from "./buildGraphSurface";

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
  if (object.kind === "surface") {
    return buildSurface(object, theme, tokens);
  }
  if (object.kind === "parametricCurve") {
    return buildParametric(object);
  }
  if (object.kind === "plane") {
    return buildPlane(object, theme);
  }
  return null;
}
