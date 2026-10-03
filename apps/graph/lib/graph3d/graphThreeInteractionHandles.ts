// S33 direct-manipulation drag handles (renderer-only, UI state).
//
// Handles appear only for the SELECTED canonical object, in orthographic
// panes, and only for literal-backed coordinates (see
// lib/interaction/dragEligibility). They live in an explicit `interaction`
// overlay namespace — separate from analysis overlays — so handle cleanup
// can never sweep analysis content and vice versa (PART 63).
//
// Handle markers are small spheres; invisible proxy spheres (S26 precedent)
// provide the grab area without giant visuals (PART 45). Zero-vector tip
// handles render slightly offset (visual only — math untouched) so the tip
// stays grabbable when it coincides with the origin (PART 20).

import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector3,
  type Object3D
} from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { mathToWorld3D, type MathPoint3 } from "@/lib/math/coordinates";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import {
  resolveLineGeometry,
  resolvePointGeometry,
  resolveRayGeometry,
  resolveSegmentGeometry,
  resolveVectorGeometry
} from "@/lib/math/geometryResolve";
import type { InteractionHandleKind } from "@/lib/interaction/dragEligibility";

export interface InteractionHandleHit {
  objectId: string;
  handle: InteractionHandleKind;
}

export interface HandleWorldPositions {
  point?: MathPoint3;
  origin?: MathPoint3;
  tip?: MathPoint3;
  start?: MathPoint3;
  end?: MathPoint3;
}

const HANDLE_NAMESPACE = "interaction-handles";
const HANDLE_MARKER_RADIUS = 0.09;
const HANDLE_PROXY_RADIUS = 0.35;
const ZERO_VECTOR_TIP_OFFSET_WORLD = 0.4;
function resolvePositions(object: GraphObject): HandleWorldPositions | null {
  const scope = getEditorParameterScope();
  if (object.kind === "point") {
    const resolved = resolvePointGeometry([object.xExpr, object.yExpr, object.zExpr], scope);
    if (resolved.status !== "ok") {
      return null;
    }
    return { point: { ...resolved.value } };
  }
  if (object.kind === "segment") {
    const start = resolvePointGeometry([object.axExpr, object.ayExpr, object.azExpr], scope);
    const end = resolvePointGeometry([object.bxExpr, object.byExpr, object.bzExpr], scope);
    if (start.status !== "ok" || end.status !== "ok") {
      return null;
    }
    return { start: { ...start.value }, end: { ...end.value } };
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
    const origin = { ...resolved.value.origin };
    const tip = {
      x: origin.x + resolved.value.vector.x,
      y: origin.y + resolved.value.vector.y,
      z: origin.z + resolved.value.vector.z
    };
    return { origin, tip };
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
    return { point: { ...resolved.value.point } };
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
    return { origin: { ...resolved.value.origin } };
  }
  return null;
}

/** Test seam: resolved math-frame handle positions (null when unresolvable). */
export function resolveHandleWorldPositions(object: GraphObject): HandleWorldPositions | null {
  return resolvePositions(object);
}

function handlePositionFor(
  positions: HandleWorldPositions,
  handle: InteractionHandleKind
): MathPoint3 | null {
  if (handle === "point") {
    return positions.point ?? null;
  }
  if (handle === "origin") {
    return positions.origin ?? null;
  }
  if (handle === "tip") {
    return positions.tip ?? null;
  }
  if (handle === "start") {
    return positions.start ?? null;
  }
  return positions.end ?? null;
}

let sharedMarkerGeometry: SphereGeometry | null = null;
let sharedProxyGeometry: BoxGeometry | null = null;

function markerGeometry(): SphereGeometry {
  if (!sharedMarkerGeometry) {
    sharedMarkerGeometry = new SphereGeometry(HANDLE_MARKER_RADIUS, 12, 12);
  }
  return sharedMarkerGeometry;
}

function proxyGeometry(): BoxGeometry {
  // Box (not sphere) grab proxies: an exactly-centered ray threads sphere
  // pole vertices where edge-exact barycentric hits are flaky (S33-R2);
  // boxes present clean faces on every axis (S26 proxy precedent).
  if (!sharedProxyGeometry) {
    const extent = HANDLE_PROXY_RADIUS * 2;
    sharedProxyGeometry = new BoxGeometry(extent, extent, extent);
  }
  return sharedProxyGeometry;
}

function stampHandle(node: Object3D, objectId: string, handle: InteractionHandleKind): void {
  node.userData.vinculumDragHandle = { objectId, handle } as InteractionHandleHit;
}

function readHandle(node: Object3D): InteractionHandleHit | null {
  const hit = (node.userData as { vinculumDragHandle?: unknown }).vinculumDragHandle;
  if (
    hit &&
    typeof hit === "object" &&
    typeof (hit as InteractionHandleHit).objectId === "string" &&
    typeof (hit as InteractionHandleHit).handle === "string"
  ) {
    return hit as InteractionHandleHit;
  }
  return null;
}

/**
 * Rebuild the handle overlay for the selected object. Callers invoke this
 * on selection / pane / scene-sync changes (never per pointermove):
 * positions derive from the same resolvers the renderer uses.
 *
 * proxyScale keeps the invisible grab area at a practical screen size as
 * the pane zooms (S34 PART 94: larger touch proxy without enlarging the
 * visual marker or touching canonical math). 1 = default span.
 */
export function syncInteractionHandles(
  root: Group,
  object: GraphObject | null,
  handles: InteractionHandleKind[],
  proxyScale = 1
): void {
  clearInteractionHandles(root);
  if (!object || handles.length === 0) {
    return;
  }
  const positions = resolvePositions(object);
  if (!positions) {
    return;
  }
  const namespace = new Group();
  namespace.userData.vinculumNamespace = HANDLE_NAMESPACE;
  for (const handle of handles) {
    const math = handlePositionFor(positions, handle);
    if (!math || !Number.isFinite(math.x) || !Number.isFinite(math.y) || !Number.isFinite(math.z)) {
      continue;
    }
    const world = mathToWorld3D(math);
    const marker = new Mesh(
      markerGeometry(),
      new MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.95 })
    );
    marker.position.set(world.x, world.y, world.z);
    // S33-R9: hidden objects show neither markers nor grab proxies (the
    // proxy line below already mirrors visibility; markers must match).
    marker.visible = object.visible !== false;
    stampHandle(marker, object.id, handle);    // Zero-vector tip coincides with the origin: offset the VISUAL only so
    // the tip stays grabbable (math untouched, PART 20).
    if (
      handle === "tip" &&
      positions.origin &&
      Math.hypot(math.x - positions.origin.x, math.y - positions.origin.y, math.z - positions.origin.z) <
        HANDLE_PROXY_RADIUS
    ) {
      marker.position.x += ZERO_VECTOR_TIP_OFFSET_WORLD;
    }
    const proxy = new Mesh(proxyGeometry(), new MeshBasicMaterial());
    proxy.material.colorWrite = false;
    proxy.material.depthWrite = false;
    proxy.material.depthTest = false;
    proxy.position.copy(marker.position);
    proxy.scale.setScalar(proxyScale);
    proxy.visible = object.visible !== false;
    stampHandle(proxy, object.id, handle);
    namespace.add(marker);
    namespace.add(proxy);
  }
  root.add(namespace);
}

/** Remove handle overlays; disposes per-handle materials (shared geometry kept). */
export function clearInteractionHandles(root: Group): void {
  for (let index = root.children.length - 1; index >= 0; index -= 1) {
    const child = root.children[index] as Object3D;
    if ((child.userData as { vinculumNamespace?: unknown }).vinculumNamespace !== HANDLE_NAMESPACE) {
      continue;
    }
    child.traverse((descendant) => {
      if (descendant instanceof Mesh) {
        const material = descendant.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material.dispose();
        }
      }
    });
    root.remove(child);
  }
}

/** Raycast handle proxies first (before body picking). */
export function pickInteractionHandle(
  raycaster: Raycaster,
  root: Group
): InteractionHandleHit | null {
  const proxies: Object3D[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh && readHandle(child) !== null && (child as Mesh).visible) {
      const material = (child as Mesh).material;
      const invisible = Array.isArray(material)
        ? material.every((entry) => entry.colorWrite === false)
        : material.colorWrite === false;
      if (invisible) {
        proxies.push(child);
      }
    }
  });
  if (proxies.length === 0) {
    return null;
  }
  const hits = raycaster.intersectObjects(proxies, false);
  for (const hit of hits) {
    const handle = readHandle(hit.object);
    if (handle) {
      return handle;
    }
  }
  return null;
}

/** Test seam: count live handle namespaces (resource-lifecycle assertions). */
export function countInteractionHandleNamespaces(root: Group): number {
  let count = 0;
  for (const child of root.children) {
    if ((child.userData as { vinculumNamespace?: unknown }).vinculumNamespace === HANDLE_NAMESPACE) {
      count += 1;
    }
  }
  return count;
}

/** Active-drag marker emphasis (slightly clearer while dragging). */
export function setActiveHandleEmphasis(root: Group, hit: InteractionHandleHit | null): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const handle = readHandle(child);
    if (!handle) {
      return;
    }
    const material = child.material;
    if (Array.isArray(material) || material.colorWrite === false) {
      return;
    }
    const active =
      hit !== null && handle.objectId === hit.objectId && handle.handle === hit.handle;
    child.scale.setScalar(active ? 1.35 : 1);
  });
}

/** World position of a handle marker (test seam for offsets). */
export function handleMarkerWorldPosition(
  root: Group,
  objectId: string,
  handle: InteractionHandleKind
): { x: number; y: number; z: number } | null {
  let found: { x: number; y: number; z: number } | null = null;
  const position = new Vector3();
  root.traverse((child) => {
    if (found || !(child instanceof Mesh)) {
      return;
    }
    const material = child.material;
    if (Array.isArray(material) || material.colorWrite === false) {
      return;
    }
    const entry = readHandle(child);
    if (entry && entry.objectId === objectId && entry.handle === handle) {
      child.getWorldPosition(position);
      found = { x: position.x, y: position.y, z: position.z };
    }
  });
  return found;
}
