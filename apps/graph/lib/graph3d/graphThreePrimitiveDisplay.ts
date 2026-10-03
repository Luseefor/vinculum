// S26 renderer-owned display extents for infinite Line/Ray objects.
// Camera movement refreshes render-only endpoints IN PLACE: 0 scene
// mutations, 0 history entries, 0 expression recompiles, 0 worker jobs,
// 0 object replacement (PART 14/SHARED S16 REQUIREMENT). One shared node
// covers every pane, so the extent is the union over active views.
//
// Display bounds source (PART 14 decision): no canonical display AABB
// exists in the renderer, so the extent derives conservatively from live
// camera state — perspective distance plus active orthographic spans —
// clamped to a float-safe renderer-only range. Canonical mathematics
// never see these numbers.

import type { Object3D, PerspectiveCamera } from "three";
import { mathToWorld3D } from "@/lib/math/coordinates";
import { clipLineToAabb, type Line3 } from "@/lib/math/geometryPrimitives";
import { refreshLineDisplayNode } from "./buildGraphGeometryPrimitives";
import type { GeometryMultiViewState } from "./graphThreeGeometryMultiView";

export const PRIMITIVE_DISPLAY_MIN_HALF_EXTENT = 60;
export const PRIMITIVE_DISPLAY_MAX_HALF_EXTENT = 20_000;

// Union extent: perspective needs ~distance*3 to cover fov+aspect at the
// target; orthographic panes need ~span*2.5 to cover wide-pane diagonals.
// A symmetric math cube keeps every pane covered without per-pane nodes.
export function computePrimitiveDisplayHalfExtent(
  perspectiveDistance: number,
  activeOrthoSpans: number[]
): number {
  let halfExtent = PRIMITIVE_DISPLAY_MIN_HALF_EXTENT;
  if (Number.isFinite(perspectiveDistance)) {
    halfExtent = Math.max(halfExtent, perspectiveDistance * 3);
  }
  for (const span of activeOrthoSpans) {
    if (Number.isFinite(span)) {
      halfExtent = Math.max(halfExtent, span * 2.5);
    }
  }
  return Math.min(PRIMITIVE_DISPLAY_MAX_HALF_EXTENT, Math.max(PRIMITIVE_DISPLAY_MIN_HALF_EXTENT, halfExtent));
}

export function activeOrthoSpansForDisplay(multiView: GeometryMultiViewState): number[] {
  const panes = multiView.panes ?? ["perspective"];
  const spans: number[] = [];
  for (const pane of panes) {
    if (pane === "perspective") {
      continue;
    }
    spans.push(multiView.ortho.getState(pane).span);
  }
  return spans;
}

export function perspectiveDistanceForDisplay(camera: PerspectiveCamera): number {
  return Math.hypot(camera.position.x, camera.position.y, camera.position.z);
}

// Per-frame entry: refreshes Line/Ray nodes whose extent drifted >2%.
// Steady-state cost is one map scan; expression resolution never reruns.
export function updateGeometryPrimitiveDisplay(
  objectNodes: Map<string, Object3D>,
  halfExtent: number
): void {
  if (!Number.isFinite(halfExtent) || halfExtent <= 0) {
    return;
  }
  for (const node of objectNodes.values()) {
    const math = (node.userData as { primitive?: { kind?: unknown } }).primitive;
    if (!math || (math.kind !== "line" && math.kind !== "ray")) {
      continue;
    }
    const previous = (node.userData as { displayHalfExtent?: number }).displayHalfExtent;
    if (typeof previous === "number" && previous > 0 && Math.abs(halfExtent - previous) / previous < 0.02) {
      continue;
    }
    refreshLineDisplayNode(node, halfExtent);
  }
}

// Test seam: pure refresh math without Three scene traversal.
export function refreshLineDisplayEndpoints(
  line: Line3,
  halfExtent: number
): { entryWorld: { x: number; y: number; z: number }; exitWorld: { x: number; y: number; z: number } } | null {
  const clipped = clipLineToAabb(line, {
    min: { x: -halfExtent, y: -halfExtent, z: -halfExtent },
    max: { x: halfExtent, y: halfExtent, z: halfExtent }
  });
  if (!clipped) {
    return null;
  }
  return { entryWorld: mathToWorld3D(clipped.entry), exitWorld: mathToWorld3D(clipped.exit) };
}
