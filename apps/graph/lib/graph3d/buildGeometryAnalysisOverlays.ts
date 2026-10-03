// S27 derived construction overlays: transient, source-attached pictures
// of relation facts (projection markers + connectors, intersection
// points, closest-point connectors, plane-plane lines). Rendered into the
// shared analysis overlay root/cache under the `geometry-analysis:`
// namespace (PART 23) — never colliding with analysis:/curl:/scalar-
// slice:/streamline: keys (PART 46 sweeps only our prefix). All children
// disable raycast (PART 44) so overlays never block source selection or
// probing. O(1) resources per analysis (PART 45), no workers, no sampling.
//
// Facts come from the SAME computeGeometryFacts the Inspector uses, so
// numbers and pictures agree by construction. Groups rebuild only when
// the facts signature changes; visibility toggles and source hiding flip
// a flag with zero recomputation (PART 32).

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Object3D
} from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { mathToWorld3D } from "@/lib/math/coordinates";
import { disposeObject3D } from "./buildGraphObjectDisposal";
import { BASE_AXIS_EXTENT } from "./graphThreeEngineConstants";
import { refreshLineDisplayNode } from "./buildGraphGeometryPrimitives";
import {
  computeGeometryFacts,
  geometryPairSupported,
  resolveGeometrySource,
  type GeometryAnalysisFacts
} from "@/lib/math/geometryAnalysis";
import type { GeometryAnalysisConfig } from "@/types/graphUi";

export const GEOMETRY_ANALYSIS_OVERLAY_PREFIX = "geometry-analysis:";
const OVERLAY_ACCENT = "#f59e0b";
const OVERLAY_MARKER_RADIUS = 0.09;

export interface GeometryAnalysisOverlayFrame {
  configs: Record<string, GeometryAnalysisConfig>;
  objects: readonly GraphObject[];
  overlayRoot: Group;
  cache: Map<string, { key: string; group: Group }>;
  params: Record<string, number>;
  halfExtent: number;
  clearAnalysis: (primaryId: string) => void;
}

function overlayKey(primaryId: string): string {
  return `${GEOMETRY_ANALYSIS_OVERLAY_PREFIX}${primaryId}`;
}

function disableOverlayRaycast(root: Object3D): void {
  root.traverse((child) => {
    (child as Mesh).raycast = () => {};
  });
}

function toWorld(point: { x: number; y: number; z: number }): Vector3 {
  const world = mathToWorld3D(point);
  return new Vector3(world.x, world.y, world.z);
}

function buildMarker(position: Vector3): Mesh {
  const marker = new Mesh(
    new SphereGeometry(OVERLAY_MARKER_RADIUS, 12, 12),
    new MeshBasicMaterial({ color: new Color(OVERLAY_ACCENT) })
  );
  marker.position.copy(position);
  return marker;
}

function buildConnector(from: Vector3, to: Vector3): Line {
  const positions = new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const connector = new Line(
    geometry,
    new LineBasicMaterial({ color: new Color(OVERLAY_ACCENT), transparent: true, opacity: 0.55 })
  );
  connector.frustumCulled = false;
  return connector;
}

function buildOverlayChildren(
  facts: GeometryAnalysisFacts,
  queryWorld: Vector3 | null
): Object3D[] | null {
  switch (facts.pair) {
    case "point-linear": {
      const children: Object3D[] = [buildMarker(toWorld(facts.projection.point))];
      if (queryWorld) {
        children.push(buildConnector(queryWorld, toWorld(facts.projection.point)));
      }
      return children;
    }
    case "point-plane": {
      const children: Object3D[] = [buildMarker(toWorld(facts.projection.projection))];
      if (queryWorld) {
        children.push(buildConnector(queryWorld, toWorld(facts.projection.projection)));
      }
      return children;
    }
    case "linear-linear": {
      const relation = facts.relation;
      if (relation.kind === "intersect") {
        return [buildMarker(toWorld(relation.point))];
      }
      if (relation.kind === "overlap") {
        if (relation.start && relation.end) {
          return [buildConnector(toWorld(relation.start), toWorld(relation.end))];
        }
        return null;
      }
      if (
        relation.kind === "disjoint" ||
        relation.kind === "skew" ||
        relation.kind === "parallel-disjoint"
      ) {
        return [
          buildMarker(toWorld(relation.pointA)),
          buildMarker(toWorld(relation.pointB)),
          buildConnector(toWorld(relation.pointA), toWorld(relation.pointB))
        ];
      }
      // Coincident: the whole line is shared — no finite overlay.
      return null;
    }
    case "linear-plane": {
      if (facts.intersection.kind === "point") {
        return [buildMarker(toWorld(facts.intersection.point))];
      }
      return null;
    }
    case "plane-plane": {
      // PART 26: infinite result line. Children allocate on first refresh
      // through the S26 renderer-owned clip path (no canonical object).
      return [];
    }
    default:
      return null;
  }
}

export function updateGeometryAnalysisOverlays(frame: GeometryAnalysisOverlayFrame): void {
  const liveKeys = new Set<string>();
  for (const [primaryId, config] of Object.entries(frame.configs)) {
    const key = overlayKey(primaryId);
    liveKeys.add(key);
    const primary = frame.objects.find((object) => object.id === primaryId);
    const secondary = frame.objects.find((object) => object.id === config.secondaryId);
    if (!primary || !secondary || !geometryPairSupported(primary.kind, secondary.kind)) {
      removeGeometryOverlay(frame, key);
      frame.clearAnalysis(primaryId);
      continue;
    }
    const resolvedPrimary = resolveGeometrySource(primary, frame.params);
    const resolvedSecondary = resolveGeometrySource(secondary, frame.params);
    const facts = computeGeometryFacts(resolvedPrimary, resolvedSecondary);
    const signature = JSON.stringify(facts);
    const cached = frame.cache.get(key);
    const wantVisible =
      config.showOverlay && primary.visible && secondary.visible && overlayBuildable(facts);
    if (cached && (cached.group.userData.factsSignature as string | undefined) === signature) {
      // Math unchanged: visibility only. Display lines (plane-plane,
      // ray overlaps) still track the camera through the shared in-place
      // refresh; allocations there re-enable raycast, so disarm again.
      cached.group.visible = wantVisible;
      if (wantVisible) {
        refreshDisplayLineOverlay(cached.group, facts, frame.halfExtent);
        disableOverlayRaycast(cached.group);
      }
      continue;
    }
    removeGeometryOverlay(frame, key);
    if (!wantVisible) {
      continue;
    }
    const group = new Group();
    group.userData.factsSignature = signature;
    const queryWorld = projectionQueryWorld(resolvedPrimary, resolvedSecondary);
    const children = buildOverlayChildren(facts, queryWorld);
    const displayLine = displayLineForFacts(facts);
    if (children === null && !displayLine) {
      continue;
    }
    for (const child of children ?? []) {
      group.add(child);
    }
    if (displayLine) {
      stampPlaneLineOverlay(group, primaryId, displayLine.point, displayLine.direction);
    }
    disableOverlayRaycast(group);
    group.visible = true;
    frame.cache.set(key, { key, group });
    frame.overlayRoot.add(group);
    refreshDisplayLineOverlay(group, facts, frame.halfExtent);
    disableOverlayRaycast(group);
  }
  // PART 46: sweep only our own namespace — S21/S22/S23/S24 keys and
  // groups are never touched here (and vice versa).
  for (const [cacheKey] of frame.cache) {
    if (!cacheKey.startsWith(GEOMETRY_ANALYSIS_OVERLAY_PREFIX)) {
      continue;
    }
    if (!liveKeys.has(cacheKey)) {
      removeGeometryOverlay(frame, cacheKey);
    }
  }
}

/** Pairs whose facts can produce overlay children at all. */
/** Pairs whose facts can produce overlay children at all. Mirrors the
 *  section toggle gate exactly — anything else skips allocation so no
 *  per-frame churn occurs for non-visualizable outcomes. */
function overlayBuildable(facts: GeometryAnalysisFacts): boolean {
  switch (facts.pair) {
    case "point-linear":
    case "point-plane":
      return true;
    case "linear-plane":
      return facts.intersection.kind === "point";
    case "linear-linear":
      return facts.relation.kind !== "coincident";
    case "plane-plane":
      return facts.intersection.kind === "line";
    default:
      return false;
  }
}

function projectionQueryWorld(
  primary: ReturnType<typeof resolveGeometrySource>,
  secondary: ReturnType<typeof resolveGeometrySource>
): Vector3 | null {
  const point = primary.kind === "point" ? primary.point : secondary.kind === "point" ? secondary.point : null;
  return point ? toWorld(point) : null;
}

function stampDisplayLineOverlay(group: Group, primaryId: string, facts: GeometryAnalysisFacts): void {
  const displayLine = displayLineForFacts(facts);
  if (!displayLine) {
    return;
  }
  stampPlaneLineOverlay(group, primaryId, displayLine.point, displayLine.direction);
}

/** Unbounded display-line cases (plane-plane lines, ray overlaps). */
function displayLineForFacts(
  facts: GeometryAnalysisFacts
): { point: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } } | null {
  if (facts.pair === "plane-plane" && facts.intersection.kind === "line") {
    return { point: facts.intersection.point, direction: facts.intersection.direction };
  }
  if (facts.pair === "linear-linear" && facts.relation.kind === "overlap" && facts.relation.bounded === "ray") {
    const finiteEnd = facts.relation.start ?? facts.relation.end;
    const direction = facts.relation.direction;
    if (finiteEnd && direction) {
      return { point: finiteEnd, direction };
    }
  }
  return null;
}

function stampPlaneLineOverlay(
  group: Group,
  primaryId: string,
  point: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number }
): void {
  group.userData.vinculumId = overlayKey(primaryId);
  group.userData.primitive = { kind: "line", line: { point, direction }, ray: null };
  group.userData.primitiveColor = OVERLAY_ACCENT;
  group.userData.displayHalfExtent = BASE_AXIS_EXTENT;
}

function refreshDisplayLineOverlay(group: Group, facts: GeometryAnalysisFacts, halfExtent: number): void {
  // Display-line cases: plane-plane intersection lines and ray overlaps
  // (one finite end + shared direction), both rendered through the S26
  // renderer-owned clip path with no canonical object.
  if (facts.pair === "plane-plane" && facts.intersection.kind === "line") {
    refreshLineDisplayNode(group, halfExtent);
    return;
  }
  if (facts.pair === "linear-linear" && facts.relation.kind === "overlap" && facts.relation.bounded === "ray") {
    refreshLineDisplayNode(group, halfExtent);
  }
}

function refreshPlaneLineOverlay(group: Group, facts: GeometryAnalysisFacts, halfExtent: number): void {
  refreshDisplayLineOverlay(group, facts, halfExtent);
}

function removeGeometryOverlay(
  frame: Pick<GeometryAnalysisOverlayFrame, "cache" | "overlayRoot">,
  key: string
): void {
  const cached = frame.cache.get(key);
  if (!cached) {
    return;
  }
  frame.cache.delete(key);
  frame.overlayRoot.remove(cached.group);
  disposeObject3D(cached.group);
}
