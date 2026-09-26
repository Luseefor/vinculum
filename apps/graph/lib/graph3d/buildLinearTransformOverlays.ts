// S28 transient linearTransform overlays: transformed-vector arrows and
// real eigendirection lines. Rendered into the shared analysis overlay
// root/cache under the `linear-transform:` namespace (own-prefix GC, no
// collisions with analysis:/curl:/scalar-slice:/streamline:/
// geometry-analysis: keys). All children disable raycast (PART 44/71 —
// never in the accessibility tree as separate objects, never blocking
// picks). O(1) resources, no workers, no sampling.
//
// Facts recompute live every tick from canonical sources; groups rebuild
// only on signature change, visibility flips are flag-only (PART 68).
// Eigen lines are finite symmetric segments through the origin with
// half-length tracking the longest transformed basis (min 1) —
// deterministic and camera-independent (PART 25/46).

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Object3D
} from "three";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import { disposeObject3D } from "./buildGraphObjectDisposal";
import { analyzeEigen } from "@/lib/math/matrixEigen";
import { resolveLinearTransform } from "@/lib/math/linearTransformResolve";
import { resolveVectorGeometry } from "@/lib/math/geometryResolve";
import { matrixVectorMultiply3 } from "@/lib/math/matrix";
import type { LinearTransformAnalysisConfig } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";
import {
  arrowProportions,
  buildArrowHead,
  orientUnitY,
  placeArrowHead
} from "./buildGraphGeometryPrimitives";

export const LINEAR_TRANSFORM_OVERLAY_PREFIX = "linear-transform:";
const EIGEN_STYLE = "#f59e0b";

export interface LinearTransformOverlayFrame {
  configs: Record<string, LinearTransformAnalysisConfig>;
  objects: readonly GraphObject[];
  overlayRoot: Group;
  cache: Map<string, { key: string; group: Group }>;
  params: Record<string, number>;
  clearAnalysis: (transformId: string) => void;
}

function overlayKey(transformId: string): string {
  return `${LINEAR_TRANSFORM_OVERLAY_PREFIX}${transformId}`;
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

function toWorldDirection(vector: { x: number; y: number; z: number }): Vector3 {
  const world = mathVectorToWorld3D(vector);
  return new Vector3(world.x, world.y, world.z);
}

interface OverlayFacts {
  entries: number[];
  dimension: 2 | 3;
  vectorOrigin: { x: number; y: number; z: number } | null;
  vectorComponents: { x: number; y: number; z: number } | null;
  transformed: { x: number; y: number; z: number } | null;
  eigenDirections: Array<[number, number, number]>;
  showVector: boolean;
  showEigen: boolean;
}

function computeOverlayFacts(
  transform: Extract<GraphObject, { kind: "linearTransform" }>,
  objects: readonly GraphObject[],
  config: LinearTransformAnalysisConfig,
  params: Record<string, number>
): OverlayFacts | null {
  const entryMap: Record<string, string> = transform.dimension === "2d"
    ? { m11: transform.m11, m12: transform.m12, m21: transform.m21, m22: transform.m22 }
    : {
        m11: transform.m11, m12: transform.m12, m13: transform.m13,
        m21: transform.m21, m22: transform.m22, m23: transform.m23,
        m31: transform.m31, m32: transform.m32, m33: transform.m33
      };
  const resolved = resolveLinearTransform({ dimension: transform.dimension, entries: entryMap }, params);
  if (resolved.status !== "ok") {
    return null;
  }
  const entries = [...resolved.matrix] as number[];
  const dimension = resolved.dimension;
  let vectorOrigin: OverlayFacts["vectorOrigin"] = null;
  let vectorComponents: OverlayFacts["vectorComponents"] = null;
  let transformed: OverlayFacts["transformed"] = null;
  if (config.vectorId) {
    const source = objects.find((object) => object.id === config.vectorId);
    if (source?.kind === "vector") {
      const vector = resolveVectorGeometry(
        [source.oxExpr, source.oyExpr, source.ozExpr],
        [source.vxExpr, source.vyExpr, source.vzExpr],
        params
      );
      if (vector.status === "ok") {
        vectorOrigin = { ...vector.value.origin };
        vectorComponents = { ...vector.value.vector };
        // Components multiply; origin anchors the comparison arrow
        // (PART 19). 2D transforms act on XY with z passing through.
        transformed =
          dimension === 2
            ? {
                x: entries[0]! * vector.value.vector.x + entries[1]! * vector.value.vector.y,
                y: entries[2]! * vector.value.vector.x + entries[3]! * vector.value.vector.y,
                z: vector.value.vector.z
              }
            : matrixVectorMultiply3(
                entries as [number, number, number, number, number, number, number, number, number],
                vector.value.vector
              );
      }
    }
  }
  const eigenDirections: Array<[number, number, number]> = [];
  if (config.showEigen) {
    const analysis = analyzeEigen(entries, dimension);
    for (const entry of analysis.entries) {
      if (entry.kind === "real" && entry.vector.length === dimension) {
        eigenDirections.push(
          dimension === 2
            ? [entry.vector[0] as number, entry.vector[1] as number, 0]
            : [entry.vector[0] as number, entry.vector[1] as number, entry.vector[2] as number]
        );
      }
    }
  }
  return {
    entries,
    dimension,
    vectorOrigin,
    vectorComponents,
    transformed,
    eigenDirections,
    showVector: config.showVector,
    showEigen: config.showEigen
  };
}

function buildTransformedVectorArrow(facts: OverlayFacts, color: string): Group | null {
  if (!facts.showVector || !facts.vectorOrigin || !facts.transformed) {
    return null;
  }
  const originWorld = toWorld(facts.vectorOrigin);
  const directionWorld = toWorldDirection(facts.transformed);
  const length = directionWorld.length();
  if (!(length > 1e-9) || !Number.isFinite(length)) {
    return null;
  }
  const group = new Group();
  const { headLength, shaftRadius, headRadius } = arrowProportions(length);
  const shaftLength = Math.max(length - headLength, length * 0.2);
  const shaft = new Mesh(
    new CylinderGeometry(1, 1, 1, 10),
    new MeshStandardMaterial({ color: new Color(color), roughness: 0.55, metalness: 0.15 })
  );
  orientUnitY(shaft, originWorld, directionWorld, shaftLength, shaftRadius);
  const tip = originWorld.clone().addScaledVector(directionWorld.clone().normalize(), length);
  const head = buildArrowHead("linear-transform-vector", color);
  placeArrowHead(head, tip, directionWorld, headLength, headRadius);
  group.add(shaft, head);
  return group;
}

function buildEigenLines(facts: OverlayFacts, longestBasis: number): Group | null {
  if (!facts.showEigen || facts.eigenDirections.length === 0) {
    return null;
  }
  const halfLength = Math.max(1, longestBasis);
  const group = new Group();
  for (const [dx, dy, dz] of facts.eigenDirections) {
    const from = toWorld({ x: -dx * halfLength, y: -dy * halfLength, z: -dz * halfLength });
    const to = toWorld({ x: dx * halfLength, y: dy * halfLength, z: dz * halfLength });
    const positions = new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const segment = new Line(geometry, new LineBasicMaterial({ color: new Color(EIGEN_STYLE) }));
    segment.frustumCulled = false;
    group.add(segment);
  }
  return group;
}

export function updateLinearTransformOverlays(frame: LinearTransformOverlayFrame): void {
  const liveKeys = new Set<string>();
  for (const [transformId, config] of Object.entries(frame.configs)) {
    const key = overlayKey(transformId);
    liveKeys.add(key);
    const transform = frame.objects.find((object) => object.id === transformId);
    if (!transform || transform.kind !== "linearTransform") {
      removeLinearTransformOverlay(frame, key);
      frame.clearAnalysis(transformId);
      continue;
    }
    const facts = computeOverlayFacts(transform, frame.objects, config, frame.params);
    if (!facts) {
      removeLinearTransformOverlay(frame, key);
      continue;
    }
    const signature = JSON.stringify({
      entries: facts.entries,
      vectorOrigin: facts.vectorOrigin,
      vectorComponents: facts.vectorComponents,
      showVector: facts.showVector,
      showEigen: facts.showEigen,
      eigenCount: facts.eigenDirections.length
    });
    const cached = frame.cache.get(key);
    const vectorSource = config.vectorId
      ? frame.objects.find((object) => object.id === config.vectorId)
      : null;
    const wantVisible =
      (facts.showVector || facts.showEigen) &&
      transform.visible &&
      (!config.vectorId || (vectorSource?.visible ?? false));
    if (cached && (cached.group.userData.factsSignature as string | undefined) === signature) {
      cached.group.visible = wantVisible;
      continue;
    }
    removeLinearTransformOverlay(frame, key);
    if (!wantVisible) {
      continue;
    }
    const group = new Group();
    group.userData.factsSignature = signature;
    const arrow = buildTransformedVectorArrow(facts, transform.color);
    if (arrow) {
      group.add(arrow);
    }
    // Eigen half-length tracks the longest transformed basis column.
    const eigen = buildEigenLines(facts, longestBasisLength(facts));
    if (eigen) {
      group.add(eigen);
    }
    if (group.children.length === 0) {
      continue;
    }
    disableOverlayRaycast(group);
    group.visible = true;
    frame.cache.set(key, { key, group });
    frame.overlayRoot.add(group);
  }
  for (const [cacheKey] of frame.cache) {
    if (!cacheKey.startsWith(LINEAR_TRANSFORM_OVERLAY_PREFIX)) {
      continue;
    }
    if (!liveKeys.has(cacheKey)) {
      removeLinearTransformOverlay(frame, cacheKey);
    }
  }
}

function longestBasisLength(facts: OverlayFacts): number {
  const dimension = facts.dimension;
  let longest = 1;
  for (let col = 0; col < dimension; col += 1) {
    let sum = 0;
    for (let row = 0; row < dimension; row += 1) {
      const entry = facts.entries[row * dimension + col] ?? 0;
      sum += entry * entry;
    }
    longest = Math.max(longest, Math.sqrt(sum));
  }
  return longest;
}

function removeLinearTransformOverlay(
  frame: Pick<LinearTransformOverlayFrame, "cache" | "overlayRoot">,
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
