import type { GraphObject } from "@vinculum/scene/types";
import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";

export interface GraphObjectRenderDescriptor {
  id: string;
  kind: GraphObject["kind"];
  visible: boolean;
  color: string;
  payload: Record<string, unknown>;
}

export function toGraphObjectRenderDescriptor(object: GraphObject): GraphObjectRenderDescriptor {
  if (object.kind === "surface") {
    const { effectiveOrientation } = getEffectiveSurfaceOrientation(
      object.equation,
      object.orientation ?? "z"
    );
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        equation: object.equation,
        orientation: effectiveOrientation,
        domain: object.domain,
        resolution: object.resolution,
        appearance: object.appearance
      }
    };
  }

  if (object.kind === "parametricCurve") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr,
        tMin: object.tMin,
        tMax: object.tMax,
        samples: object.samples
      }
    };
  }

  return {
    id: object.id,
    kind: object.kind,
    visible: object.visible,
    color: object.color,
    payload: {
      equation: object.equation,
      size: object.size,
      appearance: object.appearance
    }
  };
}

export function getRenderDescriptorSignature(descriptor: GraphObjectRenderDescriptor): string {
  return JSON.stringify({
    id: descriptor.id,
    kind: descriptor.kind,
    visible: descriptor.visible,
    color: descriptor.color,
    payload: descriptor.payload
  });
}

export function getStructureDescriptorSignature(descriptor: GraphObjectRenderDescriptor): string {
  return JSON.stringify({
    id: descriptor.id,
    kind: descriptor.kind,
    visible: descriptor.visible,
    payload: descriptor.payload
  });
}
