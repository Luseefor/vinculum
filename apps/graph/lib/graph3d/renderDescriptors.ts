import type { GraphObject } from "@vinculum/scene/types";
import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";

export interface GraphObjectRenderDescriptor {
  id: string;
  kind: GraphObject["kind"];
  visible: boolean;
  color: string;
  // S20 vectorField only. Render-only glyph sizing rides top-level next to
  // color (not inside payload) so the render signature changes on
  // scale/normalize toggles while the structure signature — {id, kind,
  // payload} — is untouched and no worker job enqueues.
  scale?: number;
  normalize?: boolean;
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

  if (object.kind === "parametricSurface") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr,
        domain: object.domain,
        resolution: object.resolution,
        appearance: object.appearance
      }
    };
  }

  if (object.kind === "implicitSurface") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        equation: object.equation,
        domain: object.domain,
        resolution: object.resolution,
        appearance: object.appearance
      }
    };
  }

  if (object.kind === "vectorField") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      scale: object.scale,
      normalize: object.normalize,
      payload: {
        dimension: object.dimension,
        pExpr: object.pExpr,
        qExpr: object.qExpr,
        rExpr: object.rExpr,
        domain: object.domain,
        density: object.density
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
    color: descriptor.color,
    // JSON.stringify drops undefined values, so every pre-S20 kind keeps
    // its exact historical signature bytes.
    scale: descriptor.scale,
    normalize: descriptor.normalize,
    payload: descriptor.payload
  });
}

export function getStructureDescriptorSignature(descriptor: GraphObjectRenderDescriptor): string {
  return JSON.stringify({
    id: descriptor.id,
    kind: descriptor.kind,
    payload: descriptor.payload
  });
}
