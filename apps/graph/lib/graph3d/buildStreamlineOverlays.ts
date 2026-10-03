import {
  BufferGeometry,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Mesh,
  type Object3D
} from "three";
import type { GraphObject, VectorFieldDimension } from "@vinculum/scene/types";
import type { StreamlineVizConfig } from "@/types/graphUi";
import type { StreamlineResultEntry } from "@/lib/compute/streamlineResults";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { disposeObject3D } from "./buildGraphObjectDisposal";

// S24 3D streamline overlays: one Group per enabled source in the shared
// S21 overlay root (PART 15/47: Perspective/XY/XZ/YZ/Split/Quad render the
// same curves with no per-pane jobs or geometries). Each group holds one
// LineSegments (paired endpoints for every polyline segment) plus one
// InstancedMesh of direction cones (one per streamline, oriented along
// +F) — O(1) scene nodes independent of streamline count (PART 14).
// Cache keys live under `streamline:<sourceId>` (PART 45); the analysis
// GC carves this namespace out exactly like `curl:` and `scalar-slice:`.
// Raycast disabled everywhere so lines never block picks (PART 13).
// Config lifecycle belongs to store actions + the streamline sync
// backstop — never to this path (S23-R1 rule): stale sources only drop
// overlays here.

export const STREAMLINE_OVERLAY_KEY_PREFIX = "streamline:";

export function streamlineOverlayCacheKey(sourceId: string): string {
  return `${STREAMLINE_OVERLAY_KEY_PREFIX}${sourceId}`;
}

const CANONICAL_CONE_AXIS = new Vector3(0, 1, 0);

function disableRaycast(object: Object3D): void {
  (object as Mesh).raycast = () => {};
}

export interface StreamlineOverlayFrame {
  configs: Record<string, StreamlineVizConfig>;
  objects: readonly GraphObject[];
  objectNodes: Map<string, Object3D>;
  /** Namespaced worker results (`streamline:<sourceId>`). */
  results: Record<string, StreamlineResultEntry>;
  overlayRoot: Group;
  cache: Map<string, { key: string; group: Group }>;
  params: Record<string, number>;
}

export function updateStreamlineOverlays(frame: StreamlineOverlayFrame): void {
  const liveKeys = new Set<string>();
  for (const [sourceId, config] of Object.entries(frame.configs)) {
    const cacheKey = streamlineOverlayCacheKey(sourceId);
    liveKeys.add(cacheKey);
    const source = frame.objects.find((object) => object.id === sourceId);
    if (!source || source.kind !== "vectorField") {
      removeCachedStreamlineOverlay(frame, cacheKey);
      continue;
    }
    const node = frame.objectNodes.get(sourceId);
    const liveIdentity = vectorCalculusSourceIdentity(source, Object.keys(frame.params));
    if (liveIdentity === null || liveIdentity !== config.structure) {
      removeCachedStreamlineOverlay(frame, cacheKey);
      continue;
    }
    if (!config.enabled) {
      removeCachedStreamlineOverlay(frame, cacheKey);
      continue;
    }
    if (!node || !node.visible) {
      // Hidden sources hide lines but keep config + cache (PART 17):
      // unhiding returns instantly with 0 jobs.
      ensureStreamlineOverlayVisible(frame, cacheKey, false);
      continue;
    }
    const entry = frame.results[cacheKey];
    if (!entry || entry.result.status !== "ok") {
      // Pending or all-invalid: no lines (Inspector carries the state).
      ensureStreamlineOverlayVisible(frame, cacheKey, false);
      continue;
    }
    const result = entry.result;
    // Color changes recolor cached lines: the key carries source color so
    // the mesh rebuilds main-thread with 0 worker jobs (PART 19).
    const key = [config.structure, entry.signature, source.color].join("|");
    const cached = frame.cache.get(cacheKey);
    if (cached && cached.key === key) {
      ensureStreamlineOverlayVisible(frame, cacheKey, true);
      continue;
    }
    removeCachedStreamlineOverlay(frame, cacheKey);
    const group = buildStreamlineGroup(sourceId, source, result, source.color);
    if (!group) {
      continue;
    }
    group.visible = node.visible;
    frame.overlayRoot.add(group);
    frame.cache.set(cacheKey, { key, group });
    ensureStreamlineOverlayVisible(frame, cacheKey, true);
  }

  for (const [cacheKey] of frame.cache) {
    if (!cacheKey.startsWith(STREAMLINE_OVERLAY_KEY_PREFIX)) {
      continue;
    }
    if (!liveKeys.has(cacheKey)) {
      removeCachedStreamlineOverlay(frame, cacheKey);
    }
  }
}

interface StreamlineOkResult {
  dimension: VectorFieldDimension;
  points: Float32Array;
  offsets: Uint32Array;
  streamlineCount: number;
  totalPoints: number;
}

function buildStreamlineGroup(
  sourceId: string,
  source: { dimension: VectorFieldDimension; domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin?: number; zMax?: number } },
  result: StreamlineOkResult,
  color: string
): Group | null {
  const dimension = source.dimension;
  const stride = dimension === "2d" ? 2 : 3;
  if (result.streamlineCount <= 0 || result.totalPoints < 2) {
    return null;
  }
  // LineSegments paired endpoints: (p0,p1),(p1,p2),... per curve.
  // Duplicates vertices but keeps one geometry / one draw call.
  let segmentCount = 0;
  for (let c = 0; c < result.streamlineCount; c += 1) {
    segmentCount += Math.max(
      0,
      (result.offsets[c + 1] as number) - (result.offsets[c] as number) - 1
    );
  }
  if (segmentCount <= 0) {
    return null;
  }
  const linePositions = new Float32Array(segmentCount * 6);
  let cursor = 0;
  const at = (pointIndex: number): { x: number; y: number; z: number } => ({
    x: result.points[pointIndex * stride] as number,
    y: result.points[pointIndex * stride + 1] as number,
    z: stride === 3 ? (result.points[pointIndex * stride + 2] as number) : 0
  });
  for (let c = 0; c < result.streamlineCount; c += 1) {
    const start = result.offsets[c] as number;
    const end = result.offsets[c + 1] as number;
    for (let p = start; p + 1 < end; p += 1) {
      const worldA = mathToWorld3D(at(p));
      const worldB = mathToWorld3D(at(p + 1));
      linePositions[cursor] = worldA.x;
      linePositions[cursor + 1] = worldA.y;
      linePositions[cursor + 2] = worldA.z;
      linePositions[cursor + 3] = worldB.x;
      linePositions[cursor + 4] = worldB.y;
      linePositions[cursor + 5] = worldB.z;
      cursor += 6;
    }
  }
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute("position", new Float32BufferAttribute(linePositions, 3));
  lineGeometry.computeBoundingSphere();
  const lineMaterial = new LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: true });
  const lines = new LineSegments(lineGeometry, lineMaterial);
  lines.renderOrder = 4;
  disableRaycast(lines);

  const group = new Group();
  group.userData.analysisSourceId = sourceId;
  group.userData.streamlines = true;
  group.add(lines);

  // One direction cone per streamline at its midpoint, oriented along +F
  // (increasing polyline index). Single InstancedMesh: bounded, O(1).
  // Head size derives from the source domain (stable across data shapes:
  // a perfectly straight line has zero data span but a fine domain).
  const heads = buildDirectionHeads(result, stride, color, domainHeadSpan(source));
  if (heads) {
    group.add(heads);
  }
  return group;
}

// S24-R1: head sizing from the source domain extents — data extents
// collapse for straight lines (zero y-span) and pad z=0 for 2D results,
// either of which silently killed cones.
function domainHeadSpan(source: {
  dimension: VectorFieldDimension;
  domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin?: number; zMax?: number };
}): number {
  const spans = [
    Math.abs(source.domain.xMax - source.domain.xMin),
    Math.abs(source.domain.yMax - source.domain.yMin)
  ];
  if (source.dimension === "3d" && source.domain.zMin !== undefined && source.domain.zMax !== undefined) {
    spans.push(Math.abs(source.domain.zMax - source.domain.zMin));
  }
  const finite = spans.filter((span) => Number.isFinite(span) && span > 0);
  if (finite.length === 0) {
    return 0;
  }
  return Math.min(...finite);
}

function buildDirectionHeads(
  result: StreamlineOkResult,
  stride: number,
  color: string,
  minSpan: number
): InstancedMesh | null {
  const placements: { position: Vector3; quaternion: Quaternion; scale: Vector3 }[] = [];
  if (!(minSpan > 0) || !Number.isFinite(minSpan)) {
    return null;
  }
  const headHeight = minSpan / 36;
  const headRadius = headHeight * 0.35;
  const at = (pointIndex: number): { x: number; y: number; z: number } => ({
    x: result.points[pointIndex * stride] as number,
    y: result.points[pointIndex * stride + 1] as number,
    z: stride === 3 ? (result.points[pointIndex * stride + 2] as number) : 0
  });
  for (let c = 0; c < result.streamlineCount; c += 1) {
    const start = result.offsets[c] as number;
    const end = result.offsets[c + 1] as number;
    if (end - start < 2) {
      continue;
    }
    const middle = start + Math.floor((end - start) / 2);
    const mathBefore = at(middle - 1);
    const mathAfter = at(middle);
    const delta = {
      x: mathAfter.x - mathBefore.x,
      y: mathAfter.y - mathBefore.y,
      z: mathAfter.z - mathBefore.z
    };
    if (!(Math.hypot(delta.x, delta.y, delta.z) > 0)) {
      continue;
    }
    const worldDir = mathVectorToWorld3D(delta);
    const direction = new Vector3(worldDir.x, worldDir.y, worldDir.z);
    if (!(direction.length() > 0)) {
      continue;
    }
    direction.normalize();
    const quaternion = new Quaternion().setFromUnitVectors(CANONICAL_CONE_AXIS, direction);
    if (![quaternion.x, quaternion.y, quaternion.z, quaternion.w].every((v) => Number.isFinite(v))) {
      continue;
    }
    const worldMid = mathToWorld3D(at(middle));
    const base = new Vector3(worldMid.x, worldMid.y, worldMid.z).addScaledVector(direction, -headHeight / 2);
    placements.push({
      position: base,
      quaternion,
      scale: new Vector3(headRadius, headHeight, headRadius)
    });
  }
  if (placements.length === 0) {
    return null;
  }
  const headGeometry = new ConeGeometry(1, 1, 10);
  headGeometry.translate(0, 0.5, 0);
  const headMaterial = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const heads = new InstancedMesh(headGeometry, headMaterial, placements.length);
  const matrix = new Matrix4();
  placements.forEach((placement, index) => {
    heads.setMatrixAt(index, matrix.compose(placement.position, placement.quaternion, placement.scale));
  });
  heads.count = placements.length;
  heads.instanceMatrix.needsUpdate = true;
  heads.computeBoundingSphere();
  heads.castShadow = false;
  heads.receiveShadow = false;
  disableRaycast(heads);
  return heads;
}

function ensureStreamlineOverlayVisible(
  frame: Pick<StreamlineOverlayFrame, "cache">,
  cacheKey: string,
  visible: boolean
): void {
  const cached = frame.cache.get(cacheKey);
  if (cached) {
    cached.group.visible = visible;
  }
}

function removeCachedStreamlineOverlay(
  frame: Pick<StreamlineOverlayFrame, "cache" | "overlayRoot">,
  cacheKey: string
): void {
  const cached = frame.cache.get(cacheKey);
  if (!cached) {
    return;
  }
  frame.cache.delete(cacheKey);
  frame.overlayRoot.remove(cached.group);
  disposeObject3D(cached.group);
}
