// S26 Three.js builders for canonical geometric primitives. Each builder
// consumes a RESOLVED finite mathematical primitive (geometryResolve) and
// produces one small Group; scene state never holds Three objects. All
// mathematics resolve in MATH coordinates; mathToWorld3D /
// mathVectorToWorld3D apply once at the render boundary (PART 12/39).
//
// Resource model (PART 42): every object is O(1) — no sampling, no worker,
// no per-pane duplication (S16 shares the one node across panes).
// Infinite Line/Ray display a renderer-owned finite clip (PART 14);
// camera-driven endpoint refreshes happen in place via
// graphThreePrimitiveDisplay (no scene mutation, no recompile).

import type { LineObject, PointObject, RayObject, SegmentObject, VectorObject } from "@vinculum/scene/types";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Object3D
} from "three";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { BASE_AXIS_EXTENT } from "./graphThreeEngineConstants";
import {
  resolveLineGeometry,
  resolvePointGeometry,
  resolveRayGeometry,
  resolveSegmentGeometry,
  resolveVectorGeometry
} from "@/lib/math/geometryResolve";
import { clipLineToAabb, clipRayToAabb, type Line3, type Ray3 } from "@/lib/math/geometryPrimitives";

export const PRIMITIVE_PROXY_RADIUS = 0.15;
export const PRIMITIVE_ZERO_MARKER_RADIUS = 0.12;

const CANONICAL_UP = new Vector3(0, 1, 0);

export interface PrimitiveDisplayMath {
  kind: "line" | "ray";
  line: Line3;
  ray: Ray3 | null;
}

function stampPrimitiveGroup(group: Object3D, id: string): void {
  group.userData.vinculumId = id;
}

function makeInvisibleProxy(id: string): Mesh {
  const geometry = new CylinderGeometry(1, 1, 1, 6);
  const material = new MeshBasicMaterial();
  material.colorWrite = false;
  material.depthWrite = false;
  material.depthTest = false;
  const proxy = new Mesh(geometry, material);
  proxy.userData.vinculumId = id;
  proxy.userData.pickProxy = true;
  return proxy;
}

// Orients a unit-Y primitive (shaft/proxy/head) along a world direction.
const scratchDirection = new Vector3();
const scratchMidpoint = new Vector3();
const scratchQuaternion = new Quaternion();

function orientUnitY(
  target: Mesh,
  fromWorld: Vector3,
  directionWorld: Vector3,
  length: number,
  radius: number
): void {
  scratchDirection.copy(directionWorld).normalize();
  scratchQuaternion.setFromUnitVectors(CANONICAL_UP, scratchDirection);
  target.quaternion.copy(scratchQuaternion);
  scratchMidpoint.copy(fromWorld).addScaledVector(scratchDirection, length / 2);
  target.position.copy(scratchMidpoint);
  target.scale.set(radius, length, radius);
  target.updateMatrixWorld();
}

function placeProxyBetween(proxy: Mesh, fromWorld: Vector3, toWorld: Vector3): void {
  scratchDirection.copy(toWorld).sub(fromWorld);
  const length = scratchDirection.length();
  if (!Number.isFinite(length) || length <= 0) {
    proxy.visible = false;
    return;
  }
  proxy.visible = true;
  orientUnitY(proxy, fromWorld, scratchDirection, length, PRIMITIVE_PROXY_RADIUS);
}

function makePrimitiveLine(id: string, color: string): { line: Line; positions: Float32Array } {
  const positions = new Float32Array(6);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  const line = new Line(geometry, new LineBasicMaterial({ color: new Color(color) }));
  line.userData.vinculumId = id;
  line.frustumCulled = false;
  return { line, positions };
}

export function writePrimitiveLineEndpoints(
  positions: Float32Array,
  fromWorld: Vector3,
  toWorld: Vector3,
  geometry: BufferGeometry
): void {
  positions[0] = fromWorld.x;
  positions[1] = fromWorld.y;
  positions[2] = fromWorld.z;
  positions[3] = toWorld.x;
  positions[4] = toWorld.y;
  positions[5] = toWorld.z;
  geometry.attributes.position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

// Renderer-owned initial display box (PART 14): conservative math AABB
// from the existing grid/axis extent. Camera-driven refreshes replace it
// in place; canonical mathematics never change.
export function primitiveDisplayBox(halfExtent = BASE_AXIS_EXTENT): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} {
  return {
    min: { x: -halfExtent, y: -halfExtent, z: -halfExtent },
    max: { x: halfExtent, y: halfExtent, z: halfExtent }
  };
}

function worldOf(math: { x: number; y: number; z: number }): Vector3 {
  const world = mathToWorld3D(math);
  return new Vector3(world.x, world.y, world.z);
}

function directionWorldOf(vector: { x: number; y: number; z: number }): Vector3 {
  const world = mathVectorToWorld3D(vector);
  return new Vector3(world.x, world.y, world.z);
}

// Arrow proportions: head length clamped (never a giant arrowhead, never
// zero), shaft radius mildly magnitude-coupled but bounded (PART 12:
// restrained thickness independent of magnitude within reason).
function arrowProportions(length: number): { headLength: number; shaftRadius: number; headRadius: number } {
  const headLength = Math.min(Math.min(Math.max(length * 0.25, 0.12), 0.6), Math.max(length * 0.8, 1e-9));
  const shaftRadius = Math.min(Math.max(length * 0.015, 0.012), 0.06);
  return { headLength, shaftRadius, headRadius: shaftRadius * 2.8 };
}

function buildArrowHead(id: string, color: string): Mesh {
  const head = new Mesh(
    new ConeGeometry(1, 1, 12),
    new MeshStandardMaterial({ color: new Color(color), roughness: 0.55, metalness: 0.15 })
  );
  head.userData.vinculumId = id;
  return head;
}

function placeArrowHead(head: Mesh, tipWorld: Vector3, directionWorld: Vector3, headLength: number, headRadius: number): void {
  scratchDirection.copy(directionWorld).normalize();
  scratchQuaternion.setFromUnitVectors(CANONICAL_UP, scratchDirection);
  head.quaternion.copy(scratchQuaternion);
  head.position.copy(tipWorld).addScaledVector(scratchDirection, -headLength / 2);
  head.scale.set(headRadius, headLength, headRadius);
  head.updateMatrixWorld();
}

function buildZeroMarker(id: string, color: string): Mesh {
  const marker = new Mesh(
    new SphereGeometry(PRIMITIVE_ZERO_MARKER_RADIUS, 14, 14),
    new MeshBasicMaterial({ color: new Color(color) })
  );
  marker.userData.vinculumId = id;
  marker.userData.pointMarker = true;
  return marker;
}

export function buildPointPrimitive(object: PointObject): Object3D | null {
  const resolved = resolvePointGeometry([object.xExpr, object.yExpr, object.zExpr], getEditorParameterScope());
  if (resolved.status !== "ok") {
    return null;
  }
  // S27: one small O(1) marker reusing the point-like/degenerate visual
  // style. The visible mesh carries pointMarker so canvas clean-clicks
  // select it through the shared primitive picker.
  const group = new Group();
  stampPrimitiveGroup(group, object.id);
  const marker = buildZeroMarker(object.id, object.color);
  marker.position.copy(worldOf(resolved.value));
  group.add(marker);
  return group;
}

export function buildVectorPrimitive(object: VectorObject): Object3D | null {
  const resolved = resolveVectorGeometry(
    [object.oxExpr, object.oyExpr, object.ozExpr],
    [object.vxExpr, object.vyExpr, object.vzExpr],
    getEditorParameterScope()
  );
  if (resolved.status !== "ok") {
    return null;
  }
  const group = new Group();
  stampPrimitiveGroup(group, object.id);
  const originWorld = worldOf(resolved.value.origin);
  if (resolved.degenerate) {
    // Zero vector: valid point marker at the origin (PART 5). Never a
    // zero-length arrow quaternion.
    const marker = buildZeroMarker(object.id, object.color);
    marker.position.copy(originWorld);
    group.add(marker);
    return group;
  }
  const directionWorld = directionWorldOf(resolved.value.vector);
  const length = directionWorld.length();
  if (!Number.isFinite(length) || length <= 0) {
    return null;
  }
  // True magnitude in scene units (PART 12): no S20-style normalization.
  const { headLength, shaftRadius, headRadius } = arrowProportions(length);
  const shaftLength = Math.max(length - headLength, length * 0.2);
  const shaft = new Mesh(
    new CylinderGeometry(1, 1, 1, 12),
    new MeshStandardMaterial({ color: new Color(object.color), roughness: 0.55, metalness: 0.15 })
  );
  shaft.userData.vinculumId = object.id;
  orientUnitY(shaft, originWorld, directionWorld, shaftLength, shaftRadius);
  const head = buildArrowHead(object.id, object.color);
  scratchDirection.copy(directionWorld).normalize();
  const tipWorld = originWorld.clone().addScaledVector(scratchDirection, length);
  placeArrowHead(head, tipWorld, directionWorld, headLength, headRadius);
  const proxy = makeInvisibleProxy(object.id);
  placeProxyBetween(proxy, originWorld, tipWorld);
  group.add(shaft, head, proxy);
  return group;
}

export function buildSegmentPrimitive(object: SegmentObject): Object3D | null {
  const resolved = resolveSegmentGeometry(
    [object.axExpr, object.ayExpr, object.azExpr],
    [object.bxExpr, object.byExpr, object.bzExpr],
    getEditorParameterScope()
  );
  if (resolved.status !== "ok") {
    return null;
  }
  const group = new Group();
  stampPrimitiveGroup(group, object.id);
  if (resolved.degenerate) {
    // Coincident endpoints: valid point-degenerate segment rendered with
    // Point visual conventions (PART 8).
    const marker = buildZeroMarker(object.id, object.color);
    marker.position.copy(worldOf(resolved.value.start));
    group.add(marker);
    return group;
  }
  const { line, positions } = makePrimitiveLine(object.id, object.color);
  const startWorld = worldOf(resolved.value.start);
  const endWorld = worldOf(resolved.value.end);
  writePrimitiveLineEndpoints(positions, startWorld, endWorld, line.geometry);
  const proxy = makeInvisibleProxy(object.id);
  placeProxyBetween(proxy, startWorld, endWorld);
  group.add(line, proxy);
  return group;
}

// Builds the visible display children for a Line/Ray group from already-
// clipped world endpoints. Exported so camera-driven refreshes allocate
// the identical children when a previously-outside primitive enters the
// display volume (no builder/state duplication).
export function allocateLineDisplayChildren(
  group: Object3D,
  id: string,
  color: string,
  entryWorld: Vector3,
  exitWorld: Vector3,
  directionWorld: Vector3 | null
): void {
  const { line, positions } = makePrimitiveLine(id, color);
  writePrimitiveLineEndpoints(positions, entryWorld, exitWorld, line.geometry);
  group.add(line);
  if (directionWorld) {
    const { headLength, headRadius } = arrowProportions(entryWorld.distanceTo(exitWorld));
    const head = buildArrowHead(id, color);
    placeArrowHead(head, exitWorld, directionWorld, headLength, headRadius);
    group.add(head);
  }
  const proxy = makeInvisibleProxy(id);
  placeProxyBetween(proxy, entryWorld, exitWorld);
  group.add(proxy);
}

export function removeLineDisplayChildren(group: Object3D): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((descendant) => {
      const geometry = (descendant as Mesh).geometry as { dispose?: () => void } | undefined;
      geometry?.dispose?.();
      const material = (descendant as Mesh).material as { dispose?: () => void } | undefined;
      material?.dispose?.();
    });
  }
}

function findDisplayLine(group: Object3D): Line | null {
  for (const child of group.children) {
    if (child instanceof Line) {
      return child;
    }
  }
  return null;
}

function findDisplayProxy(group: Object3D): Mesh | null {
  for (const child of group.children) {
    if ((child as Mesh).isMesh && (child.userData as { pickProxy?: unknown }).pickProxy === true) {
      return child as Mesh;
    }
  }
  return null;
}

function findDisplayHead(group: Object3D): Mesh | null {
  for (const child of group.children) {
    if ((child as Mesh).isMesh && (child.userData as { pickProxy?: unknown }).pickProxy !== true) {
      return child as Mesh;
    }
  }
  return null;
}

// Camera-driven in-place refresh (PART 14): reclips stored MATH against
// the new renderer-owned half-extent, rewrites endpoints/proxy/head, and
// allocates or drops children on visibility transitions. No scene
// mutation, no recompilation, no per-frame allocation in steady state.
export function refreshLineDisplayNode(group: Object3D, halfExtent: number): void {
  const math = group.userData.primitive as PrimitiveDisplayMath | undefined;
  const id = group.userData.vinculumId as string | undefined;
  const color = group.userData.primitiveColor as string | undefined;
  if (!math || !id || !color || !Number.isFinite(halfExtent) || halfExtent <= 0) {
    return;
  }
  const box = primitiveDisplayBox(halfExtent);
  const clipped =
    math.kind === "line" ? clipLineToAabb(math.line, box) : clipRayToAabb(math.ray as Ray3, box);
  if (!clipped) {
    if (findDisplayLine(group)) {
      removeLineDisplayChildren(group);
    }
    group.userData.displayHalfExtent = halfExtent;
    return;
  }
  const entryWorld = worldOf(clipped.entry);
  const exitWorld = worldOf(clipped.exit);
  const directionWorld =
    math.kind === "ray" && math.ray ? directionWorldOf(math.ray.direction) : null;
  const line = findDisplayLine(group);
  if (!line) {
    allocateLineDisplayChildren(group, id, color, entryWorld, exitWorld, directionWorld);
    group.userData.displayHalfExtent = halfExtent;
    return;
  }
  const positions = (line.geometry.getAttribute("position") as BufferAttribute).array as Float32Array;
  writePrimitiveLineEndpoints(positions, entryWorld, exitWorld, line.geometry);
  const proxy = findDisplayProxy(group);
  if (proxy) {
    placeProxyBetween(proxy, entryWorld, exitWorld);
  }
  if (directionWorld) {
    const head = findDisplayHead(group);
    if (head) {
      const { headLength, headRadius } = arrowProportions(entryWorld.distanceTo(exitWorld));
      placeArrowHead(head, exitWorld.clone(), directionWorld, headLength, headRadius);
    }
  }
  group.userData.displayHalfExtent = halfExtent;
}

function stampLineGroup(group: Object3D, id: string, color: string, math: PrimitiveDisplayMath): void {
  stampPrimitiveGroup(group, id);
  group.userData.primitive = math;
  group.userData.primitiveColor = color;
  group.userData.displayHalfExtent = BASE_AXIS_EXTENT;
}

export function buildLinePrimitive(object: LineObject): Object3D | null {
  const resolved = resolveLineGeometry(
    [object.pxExpr, object.pyExpr, object.pzExpr],
    [object.dxExpr, object.dyExpr, object.dzExpr],
    getEditorParameterScope()
  );
  if (resolved.status !== "ok") {
    return null;
  }
  const group = new Group();
  stampLineGroup(
    group,
    object.id,
    object.color,
    { kind: "line", line: resolved.value, ray: null } satisfies PrimitiveDisplayMath
  );
  // Outside the initial display box: valid object, empty stamped node —
  // camera refreshes revive it in place (PART 15).
  const clipped = clipLineToAabb(resolved.value, primitiveDisplayBox());
  if (clipped) {
    allocateLineDisplayChildren(
      group,
      object.id,
      object.color,
      worldOf(clipped.entry),
      worldOf(clipped.exit),
      null
    );
  }
  return group;
}

export function buildRayPrimitive(object: RayObject): Object3D | null {
  const resolved = resolveRayGeometry(
    [object.oxExpr, object.oyExpr, object.ozExpr],
    [object.dxExpr, object.dyExpr, object.dzExpr],
    getEditorParameterScope()
  );
  if (resolved.status !== "ok") {
    return null;
  }
  const group = new Group();
  stampLineGroup(group, object.id, object.color, {
    kind: "ray",
    line: { point: resolved.value.origin, direction: resolved.value.direction },
    ray: resolved.value
  } satisfies PrimitiveDisplayMath);
  // Outside the initial display box: valid object, empty stamped node —
  // camera refreshes revive it in place (PART 15).
  const clipped = clipRayToAabb(resolved.value, primitiveDisplayBox());
  if (clipped) {
    allocateLineDisplayChildren(
      group,
      object.id,
      object.color,
      worldOf(clipped.entry),
      worldOf(clipped.exit),
      directionWorldOf(resolved.value.direction)
    );
  }
  return group;
}
