import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import {
  createSceneDocument,
  DEFAULT_SCENE_NAME,
  type SceneDocument
} from "@/lib/scene/sceneSchema";
import type { GraphObject, GraphObjectKind } from "@vinculum/scene/types";

export function isGraphObjectWithoutExpressions(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane") {
    return !object.equation.trim();
  }
  return ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
}

export function createEmptyGraphObject(
  kind: GraphObjectKind,
  colorIndex: number,
  options: {
    id?: string;
    color?: string;
    visible?: boolean;
  } = {}
): GraphObject {
  if (kind === "parametricCurve") {
    return createParametricCurve({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible,
      xExpr: "",
      yExpr: "",
      zExpr: "",
      tMin: 0,
      tMax: 1,
      samples: 2
    });
  }

  if (kind === "plane") {
    return createPlaneGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible,
      equation: ""
    });
  }

  return createSurfaceGraph({
    colorIndex,
    id: options.id,
    color: options.color,
    visible: options.visible,
    equation: ""
  });
}

export function createGraphObject(
  kind: GraphObjectKind,
  colorIndex: number,
  options: {
    id?: string;
    color?: string;
    visible?: boolean;
  } = {}
): GraphObject {
  if (kind === "parametricCurve") {
    return createParametricCurve({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible
    });
  }

  if (kind === "plane") {
    return createPlaneGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible
    });
  }

  return createSurfaceGraph({
    colorIndex,
    id: options.id,
    color: options.color,
    visible: options.visible
  });
}

export function createInitialSceneDocument(): SceneDocument {
  return createSceneDocument({
    metadata: {
      name: DEFAULT_SCENE_NAME
    },
    objects: []
  });
}
