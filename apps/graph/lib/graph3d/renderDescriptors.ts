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

  if (object.kind === "vector") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        oxExpr: object.oxExpr,
        oyExpr: object.oyExpr,
        ozExpr: object.ozExpr,
        vxExpr: object.vxExpr,
        vyExpr: object.vyExpr,
        vzExpr: object.vzExpr
      }
    };
  }

  if (object.kind === "line") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        pxExpr: object.pxExpr,
        pyExpr: object.pyExpr,
        pzExpr: object.pzExpr,
        dxExpr: object.dxExpr,
        dyExpr: object.dyExpr,
        dzExpr: object.dzExpr
      }
    };
  }

  if (object.kind === "ray") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        oxExpr: object.oxExpr,
        oyExpr: object.oyExpr,
        ozExpr: object.ozExpr,
        dxExpr: object.dxExpr,
        dyExpr: object.dyExpr,
        dzExpr: object.dzExpr
      }
    };
  }

  if (object.kind === "point") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      }
    };
  }

  if (object.kind === "segment") {
    return {
      id: object.id,
      kind: object.kind,
      visible: object.visible,
      color: object.color,
      payload: {
        axExpr: object.axExpr,
        ayExpr: object.ayExpr,
        azExpr: object.azExpr,
        bxExpr: object.bxExpr,
        byExpr: object.byExpr,
        bzExpr: object.bzExpr
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
