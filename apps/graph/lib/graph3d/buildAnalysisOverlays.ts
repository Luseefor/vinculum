import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D
} from "three";
import type { GraphObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import type { DifferentialAnalysisState } from "@/types/graphUi";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import {
  computeSurfaceAnalysis
} from "@/lib/math/surfaceDifferential";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { disposeObject3D } from "./buildGraphObjectDisposal";

// S21 derived overlays: one Group per analyzed source (`analysis:<id>`),
// living in a dedicated scene-level root — NEVER in objectsRoot and NEVER
// in the canonical object sync (PART 16). The shared scene membership
// carries overlays into every S16 pane automatically with no per-pane work.
//
// Resources per overlay stay tiny: ≤2 small meshes for the normal arrow +
// 1 quad (4 verts / 2 tris) + 1 edge lineset for the tangent patch. No
// worker, no sampling grid. All meshes disable raycast (PART 18) and skip
// shadow participation; the patch uses transparency + polygon offset
// against contact z-fighting (never a physical offset — the plane stays
// mathematically true).

export interface AnalysisOverlaySizes {
  patchSize: number;
  normalLength: number;
}

// Deterministic domain-relative sizing: 15% of the smallest domain span
// for the patch, 12% for the normal arrow, bounded so degenerate and huge
// domains stay sane. No user size control in S21.
export function analysisOverlaySizes(
  domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin?: number; zMax?: number },
  volumetric: boolean
): AnalysisOverlaySizes {
  const spans = [domain.xMax - domain.xMin, domain.yMax - domain.yMin];
  if (volumetric && domain.zMin !== undefined && domain.zMax !== undefined) {
    spans.push(domain.zMax - domain.zMin);
  }
  let minSpan = Number.POSITIVE_INFINITY;
  for (const span of spans) {
    if (Number.isFinite(span) && span < minSpan) {
      minSpan = span;
    }
  }
  if (!(minSpan > 0) || !Number.isFinite(minSpan)) {
    minSpan = 10;
  }
  const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
  return {
    patchSize: clamp(0.15 * minSpan, 0.5, 6),
    normalLength: clamp(0.12 * minSpan, 0.5, 4)
  };
}

export interface AnalysisOverlayGeometry {
  pointWorld: { x: number; y: number; z: number };
  normalWorld: { x: number; y: number; z: number };
  basisT1World: { x: number; y: number; z: number };
  basisT2World: { x: number; y: number; z: number };
  patchSize: number;
  normalLength: number;
}

const GLYPH_SHAFT_FRACTION = 0.72;
const GLYPH_HEAD_FRACTION = 0.28;
const GLYPH_SHAFT_RADIUS_FRACTION = 0.045;
const GLYPH_HEAD_RADIUS_FRACTION = 0.11;
const CANONICAL_GLYPH_AXIS = new Vector3(0, 1, 0);

function disableRaycast(object: Object3D): void {
  (object as Mesh).raycast = () => {};
}

export function buildAnalysisOverlayGroup(input: {
  sourceId: string;
  geometry: AnalysisOverlayGeometry;
  planeColor: string;
  normalColor: string;
  showNormal: boolean;
  showTangent: boolean;
  roughness: number;
  metalness: number;
}): Group | null {
  if (!input.showNormal && !input.showTangent) {
    return null;
  }
  const { pointWorld, normalWorld } = input.geometry;
  const finite = (v: number) => Number.isFinite(v);
  if (
    ![pointWorld.x, pointWorld.y, pointWorld.z, normalWorld.x, normalWorld.y, normalWorld.z].every(finite)
  ) {
    return null;
  }

  const group = new Group();
  group.userData.analysisSourceId = input.sourceId;

  if (input.showTangent) {
    const patch = buildTangentPatch(
      input.geometry,
      input.planeColor,
      input.roughness,
      input.metalness
    );
    if (patch) {
      group.add(patch);
    }
  }

  if (input.showNormal) {
    const arrow = buildNormalArrow(
      input.geometry,
      input.normalColor,
      input.roughness,
      input.metalness
    );
    if (arrow) {
      group.add(arrow);
    }
  }

  if (group.children.length === 0) {
    disposeObject3D(group);
    return null;
  }
  return group;
}

function buildTangentPatch(
  geometry: AnalysisOverlayGeometry,
  planeColor: string,
  roughness: number,
  metalness: number
): Group | null {
  const { pointWorld: p, basisT1World: t1, basisT2World: t2, patchSize: size } = geometry;
  if (!(size > 0)) {
    return null;
  }
  const half = size / 2;
  const corners = [
    [p.x - t1.x * half - t2.x * half, p.y - t1.y * half - t2.y * half, p.z - t1.z * half - t2.z * half],
    [p.x + t1.x * half - t2.x * half, p.y + t1.y * half - t2.y * half, p.z + t1.z * half - t2.z * half],
    [p.x + t1.x * half + t2.x * half, p.y + t1.y * half + t2.y * half, p.z + t1.z * half + t2.z * half],
    [p.x - t1.x * half + t2.x * half, p.y - t1.y * half + t2.y * half, p.z - t1.z * half + t2.z * half]
  ];
  if (!corners.flat().every((v) => Number.isFinite(v))) {
    return null;
  }
  const patchGeometry = new BufferGeometry();
  patchGeometry.setAttribute("position", new Float32BufferAttribute(corners.flat(), 3));
  patchGeometry.setIndex([0, 2, 1, 0, 3, 2]);
  patchGeometry.computeVertexNormals();
  patchGeometry.computeBoundingSphere();

  const material = new MeshStandardMaterial({
    color: planeColor,
    transparent: true,
    opacity: 0.32,
    side: DoubleSide,
    roughness,
    metalness,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: true
  });
  const mesh = new Mesh(patchGeometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  disableRaycast(mesh);

  const edges = new LineSegments(
    new EdgesGeometry(patchGeometry),
    new LineBasicMaterial({ color: planeColor, transparent: true, opacity: 0.9 })
  );
  disableRaycast(edges);

  const patch = new Group();
  patch.add(mesh);
  patch.add(edges);
  return patch;
}

function buildNormalArrow(
  geometry: AnalysisOverlayGeometry,
  normalColor: string,
  roughness: number,
  metalness: number
): Group | null {
  const { pointWorld: p, normalWorld: n, normalLength: length } = geometry;
  if (!(length > 0)) {
    return null;
  }
  const direction = new Vector3(n.x, n.y, n.z);
  if (!(direction.length() > 0)) {
    return null;
  }
  direction.normalize();
  const quaternion = new Quaternion().setFromUnitVectors(CANONICAL_GLYPH_AXIS, direction);
  if (![quaternion.x, quaternion.y, quaternion.z, quaternion.w].every((v) => Number.isFinite(v))) {
    return null;
  }

  const material = new MeshStandardMaterial({ color: normalColor, roughness, metalness });
  const shaftLength = GLYPH_SHAFT_FRACTION * length;
  const headLength = GLYPH_HEAD_FRACTION * length;
  const shaftRadius = GLYPH_SHAFT_RADIUS_FRACTION * length;
  const headRadius = GLYPH_HEAD_RADIUS_FRACTION * length;

  const shaftGeometry = new CylinderGeometry(1, 1, 1, 10, 1, false);
  shaftGeometry.translate(0, 0.5, 0);
  const shaft = new Mesh(shaftGeometry, material);
  const base = new Vector3(p.x, p.y, p.z);
  shaft.matrixAutoUpdate = false;
  shaft.matrix.compose(
    base,
    quaternion,
    new Vector3(shaftRadius, shaftLength, shaftRadius)
  );
  shaft.matrixWorldNeedsUpdate = true;

  const headGeometry = new ConeGeometry(1, 1, 10);
  headGeometry.translate(0, 0.5, 0);
  const head = new Mesh(headGeometry, material);
  const headBase = base.clone().addScaledVector(direction, shaftLength);
  head.matrixAutoUpdate = false;
  head.matrix.compose(
    headBase,
    quaternion,
    new Vector3(headRadius, headLength, headRadius)
  );
  head.matrixWorldNeedsUpdate = true;

  for (const mesh of [shaft, head]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    disableRaycast(mesh);
  }

  const arrow = new Group();
  arrow.add(shaft);
  arrow.add(head);
  return arrow;
}

export interface AnalysisOverlayFrame {
  analyses: Record<string, DifferentialAnalysisState>;
  objects: readonly GraphObject[];
  objectNodes: Map<string, Object3D>;
  overlayRoot: Group;
  cache: Map<string, { key: string; group: Group }>;
  theme: ResolvedTheme;
  params: Record<string, number>;
  tokens: { sceneSurfaceRoughness: number; sceneSurfaceMetalness: number };
  computeStatusOf: (sourceId: string) => "idle" | "pending" | "error";
  clearAnalysis: (sourceId: string) => void;
}

// Per-tick derived-overlay sync. Reads transient analysis records and the
// live scene; writes Three resources only on input change (keyed cache),
// never touches objectNodes/signatures, the compute manager, or scene
// state — except transition-only invalidation clears (stale/missing
// source). Analysis edits therefore rebuild zero source geometry and
// enqueue zero worker jobs by construction (no manager access exists here).
export function updateAnalysisOverlays(frame: AnalysisOverlayFrame): void {
  const liveIds = new Set<string>();
  for (const [sourceId, record] of Object.entries(frame.analyses)) {
    liveIds.add(sourceId);
    const source = frame.objects.find((object) => object.id === sourceId);
    if (!source || (source.kind !== "surface" && source.kind !== "implicitSurface")) {
      removeCachedOverlay(frame, sourceId);
      frame.clearAnalysis(sourceId);
      continue;
    }

    const node = frame.objectNodes.get(sourceId);
    const liveIdentity = analysisSourceIdentity(source);
    if (liveIdentity === null || liveIdentity !== record.structure) {
      removeCachedOverlay(frame, sourceId);
      frame.clearAnalysis(sourceId);
      continue;
    }

    const overlay = ensureOverlayVisible(frame, sourceId, false);
    if (frame.computeStatusOf(sourceId) !== "idle") {
      continue;
    }
    if (!node || !node.visible) {
      continue;
    }

    const outcome = computeSurfaceAnalysis(source, record.point, frame.params);
    if (outcome.status !== "ok") {
      ensureOverlayVisible(frame, sourceId, false);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug(`[analysis] no-overlay outcome=${outcome.status} id=${sourceId}`);
      }
      continue;
    }

    const sizes = analysisOverlaySizes(
      source.domain,
      source.kind === "implicitSurface"
    );
    const pointWorld = mathToWorld3D(outcome.plane.point);
    const normalWorld = mathVectorToWorld3D(outcome.unitNormal);
    const basisT1World = mathVectorToWorld3D(outcome.plane.basisT1);
    const basisT2World = mathVectorToWorld3D(outcome.plane.basisT2);
    const key = [
      record.structure,
      record.point.x,
      record.point.y,
      record.point.z,
      record.showNormal,
      record.showTangent,
      source.color,
      frame.theme,
      frame.tokens.sceneSurfaceRoughness,
      frame.tokens.sceneSurfaceMetalness,
      sizes.patchSize,
      sizes.normalLength
    ].join("|");

    const cached = frame.cache.get(sourceId);
    if (cached && cached.key === key) {
      ensureOverlayVisible(frame, sourceId, true);
      continue;
    }

    removeCachedOverlay(frame, sourceId);
    const group = buildAnalysisOverlayGroup({
      sourceId,
      geometry: {
        pointWorld,
        normalWorld,
        basisT1World,
        basisT2World,
        patchSize: sizes.patchSize,
        normalLength: sizes.normalLength
      },
      planeColor: source.color,
      normalColor: frame.theme === "dark" ? "#f8fafc" : "#0f172a",
      showNormal: record.showNormal,
      showTangent: record.showTangent,
      roughness: frame.tokens.sceneSurfaceRoughness,
      metalness: frame.tokens.sceneSurfaceMetalness
    });
    if (!group) {
      continue;
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[analysis] built overlay id=${sourceId} key=${key}`);
    }
    group.visible = node.visible;
    frame.overlayRoot.add(group);
    frame.cache.set(sourceId, { key, group });
    ensureOverlayVisible(frame, sourceId, true);
  }

  // Drop overlays whose records vanished (clear-all paths).
  for (const [sourceId] of frame.cache) {
    if (!liveIds.has(sourceId)) {
      removeCachedOverlay(frame, sourceId);
    }
  }
}

function ensureOverlayVisible(frame: AnalysisOverlayFrame, sourceId: string, visible: boolean): Group | null {
  const cached = frame.cache.get(sourceId);
  if (!cached) {
    return null;
  }
  cached.group.visible = visible;
  return cached.group;
}

function removeCachedOverlay(frame: AnalysisOverlayFrame, sourceId: string): void {
  const cached = frame.cache.get(sourceId);
  if (!cached) {
    return;
  }
  frame.cache.delete(sourceId);
  frame.overlayRoot.remove(cached.group);
  disposeObject3D(cached.group);
}
