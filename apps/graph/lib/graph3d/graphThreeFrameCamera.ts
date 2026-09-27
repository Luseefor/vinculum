// S33 Frame Selected / Fit Scene camera behavior (presentation-only).
//
// Framing changes CAMERA ONLY — object math, domains, scene state, and
// analysis are never touched. Finite objects frame their renderer/canonical
// node bounds; infinite Line/Ray/Plane use LOCAL presentation bounds from
// lib/interaction/frameBounds (never the clipped 20,000-unit extent).
// Hidden objects are skipped (never frame what the user cannot see).

import type { OrthographicCamera, PerspectiveCamera } from "three";
import type { Vector3 } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { mathToWorld3D, worldToMath3D } from "@/lib/math/coordinates";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import {
  resolveLineGeometry,
  resolvePlaneGeometry,
  resolvePointGeometry,
  resolveRayGeometry,
  resolveSegmentGeometry,
  resolveVectorGeometry
} from "@/lib/math/geometryResolve";
import {
  frameBoundsFromPoints,
  frameBoundsLinePoint,
  frameBoundsPlaneAnchor,
  frameBoundsRayOrigin,
  unionFrameBounds,
  type FrameBounds
} from "@/lib/interaction/frameBounds";
import type { GeometryOrthoController } from "./graphThreeOrthoViews";
import type { OrthoView } from "./graphThreeOrthoViews";

export interface NodeBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Read-only node-box reader supplied by the engine (Box3 over the node). */
export type ReadNodeBox = (objectId: string) => NodeBox | null;

function triple(value: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: value.x, y: value.y, z: value.z };
}

/**
 * Presentation bounds for one object (math frame). Null when the object
 * has no meaningful framing (hidden, unresolvable, non-finite).
 */
export function frameBoundsForObject(
  object: GraphObject,
  readNodeBox: ReadNodeBox
): FrameBounds | null {
  if (object.visible === false) {
    return null;
  }
  const scope = getEditorParameterScope();
  if (object.kind === "point") {
    const resolved = resolvePointGeometry([object.xExpr, object.yExpr, object.zExpr], scope);
    if (resolved.status !== "ok") {
      return null;
    }
    return frameBoundsFromPoints([triple(resolved.value)]);
  }
  if (object.kind === "segment") {
    const start = resolvePointGeometry([object.axExpr, object.ayExpr, object.azExpr], scope);
    const end = resolvePointGeometry([object.bxExpr, object.byExpr, object.bzExpr], scope);
    if (start.status !== "ok" || end.status !== "ok") {
      return null;
    }
    return frameBoundsFromPoints([triple(start.value), triple(end.value)]);
  }
  if (object.kind === "vector") {
    const resolved = resolveVectorGeometry(
      [object.oxExpr, object.oyExpr, object.ozExpr],
      [object.vxExpr, object.vyExpr, object.vzExpr],
      scope
    );
    if (resolved.status !== "ok") {
      return null;
    }
    return frameBoundsFromPoints([
      triple(resolved.value.origin),
      {
        x: resolved.value.origin.x + resolved.value.vector.x,
        y: resolved.value.origin.y + resolved.value.vector.y,
        z: resolved.value.origin.z + resolved.value.vector.z
      }
    ]);
  }
  if (object.kind === "line") {
    const resolved = resolveLineGeometry(
      [object.pxExpr, object.pyExpr, object.pzExpr],
      [object.dxExpr, object.dyExpr, object.dzExpr],
      scope
    );
    if (resolved.status !== "ok") {
      return null;
    }
    return frameBoundsLinePoint(triple(resolved.value.point));
  }
  if (object.kind === "ray") {
    const resolved = resolveRayGeometry(
      [object.oxExpr, object.oyExpr, object.ozExpr],
      [object.dxExpr, object.dyExpr, object.dzExpr],
      scope
    );
    if (resolved.status !== "ok") {
      return null;
    }
    return frameBoundsRayOrigin(triple(resolved.value.origin), triple(resolved.value.direction));
  }
  if (object.kind === "plane") {
    const resolved = resolvePlaneGeometry(object.equation, scope);
    if (resolved.status !== "ok") {
      return null;
    }
    const { normal, constant } = resolved.value;
    const lengthSquared = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
    if (!(lengthSquared > 0)) {
      return null;
    }
    // Closest point on the plane to the origin (visible-region anchor).
    const scale = -constant / lengthSquared;
    return frameBoundsPlaneAnchor({
      x: normal.x * scale,
      y: normal.y * scale,
      z: normal.z * scale
    });
  }
  // Finite mesh kinds: renderer node bounds (read-only Box3, world frame —
  // convert the corners through the canonical mapping, never manual swaps).
  const box = readNodeBox(object.id);
  if (!box) {
    return null;
  }
  const cornerA = worldToMath3D({ x: box.min.x, y: box.min.y, z: box.min.z });
  const cornerB = worldToMath3D({ x: box.max.x, y: box.max.y, z: box.max.z });
  return frameBoundsFromPoints([
    { x: Math.min(cornerA.x, cornerB.x), y: Math.min(cornerA.y, cornerB.y), z: Math.min(cornerA.z, cornerB.z) },
    { x: Math.max(cornerA.x, cornerB.x), y: Math.max(cornerA.y, cornerB.y), z: Math.max(cornerA.z, cornerB.z) }
  ]);
}

/** Union bounds over visible objects for Fit Scene. */
export function fitSceneBounds(
  objects: GraphObject[],
  readNodeBox: ReadNodeBox
): FrameBounds | null {
  return unionFrameBounds(objects.map((object) => frameBoundsForObject(object, readNodeBox)));
}

export interface PerspectiveFrameControls {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

/**
 * Perspective framing: keeps the current viewing direction, retargets to
 * the bounds center, and sets distance from the bounds radius and fov.
 */
export function framePerspectiveCamera(
  camera: PerspectiveCamera,
  controls: PerspectiveFrameControls,
  bounds: FrameBounds
): boolean {
  const world = mathToWorld3D(bounds.center);
  if (!Number.isFinite(bounds.radius) || bounds.radius <= 0) {
    return false;
  }
  const direction = camera.position.clone().sub(controls.target);
  if (direction.lengthSq() <= 1e-12) {
    direction.set(1, 1, 1);
  }
  direction.normalize();
  const halfFov = (camera.fov * Math.PI) / 360;
  const distance = Math.min(
    Math.max((bounds.radius / Math.max(1e-6, Math.tan(halfFov))) * 1.2, controls.minDistance),
    controls.maxDistance
  );
  if (!Number.isFinite(distance)) {
    return false;
  }
  controls.target.set(world.x, world.y, world.z);
  camera.position.set(
    world.x + direction.x * distance,
    world.y + direction.y * distance,
    world.z + direction.z * distance
  );
  controls.update();
  return true;
}

/**
 * Orthographic framing: fits the bounds sphere into the pane without
 * rotating the camera (respects the current plane).
 */
export function frameOrthoPane(
  ortho: GeometryOrthoController,
  view: OrthoView,
  bounds: FrameBounds
): boolean {
  if (!Number.isFinite(bounds.radius) || bounds.radius <= 0) {
    return false;
  }
  const world = mathToWorld3D(bounds.center);
  const state = ortho.getState(view);
  state.center.set(world.x, world.y, world.z);
  const desiredSpan = bounds.radius * 2 * 1.3;
  const currentSpan = state.span;
  if (Number.isFinite(currentSpan) && currentSpan > 0 && Number.isFinite(desiredSpan)) {
    ortho.zoomByFactor(view, desiredSpan / currentSpan);
  }
  return true;
}
