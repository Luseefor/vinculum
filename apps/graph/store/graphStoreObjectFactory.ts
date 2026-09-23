import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";
import {
  createSceneDocument,
  DEFAULT_SCENE_NAME,
  type SceneDocument
} from "@/lib/scene/sceneSchema";
import type { GraphObject, GraphObjectKind, VectorFieldDimension } from "@vinculum/scene/types";

export function isGraphObjectWithoutExpressions(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane" || object.kind === "implicitSurface") {
    return !object.equation.trim();
  }
  if (object.kind === "vectorField") {
    return ![object.pExpr, object.qExpr, object.rExpr].some((expr) => expr.trim());
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
    dimension?: VectorFieldDimension;
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

  if (kind === "parametricSurface") {
    return createParametricSurfaceGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible,
      xExpr: "",
      yExpr: "",
      zExpr: ""
    });
  }

  if (kind === "implicitSurface") {
    return createImplicitSurfaceGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible,
      equation: ""
    });
  }

  if (kind === "vectorField") {
    if (options.dimension === "3d") {
      return createVectorFieldGraph({
        colorIndex,
        id: options.id,
        color: options.color,
        visible: options.visible,
        dimension: "3d",
        pExpr: "",
        qExpr: "",
        rExpr: ""
      });
    }
    return createVectorFieldGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible,
      dimension: "2d",
      pExpr: "",
      qExpr: ""
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
    dimension?: VectorFieldDimension;
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

  if (kind === "parametricSurface") {
    return createParametricSurfaceGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible
    });
  }

  if (kind === "implicitSurface") {
    return createImplicitSurfaceGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible
    });
  }

  if (kind === "vectorField") {
    return createVectorFieldGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible,
      dimension: options.dimension ?? "2d"
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
