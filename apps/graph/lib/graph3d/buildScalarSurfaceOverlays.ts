import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D
} from "three";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import type { ScalarVizResultEntry } from "@/lib/compute/scalarVizResults";
import { MAX_CONTOUR_SEGMENTS, MAX_CONTOUR_LEVELS } from "@/lib/math/surfaces/marchingSquares";
import { getEffectiveSurfaceOrientation } from "@/lib/math/expressions/surfaceExpressionOrientation";
import { buildScalarFieldJob } from "@/lib/compute/scalarVizSync";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { removeCachedSliceOverlay, sliceDataTexture, type ScalarSliceOverlayFrame } from "./buildScalarSliceOverlays";
import { surfaceHeightClamp } from "./surfaceDisplayDomain";
import { buildVectorFieldGroup } from "./buildGraphVectorField";

// Scalar textures use a copy of the rendered source geometry. Contours cut
// that same triangulation at the worker levels, with no world-space lift.
// Both preserve the source mesh gaps and remain aligned at every resolution.

export const SCALAR_SURFACE_KEY_PREFIX = "scalar-surface:";

export function scalarSurfaceCacheKey(sourceId: string): string {
  return `${SCALAR_SURFACE_KEY_PREFIX}${sourceId}`;
}

export function scalarSurfaceContourCacheKey(sourceId: string): string {
  return `${SCALAR_SURFACE_KEY_PREFIX}${sourceId}-contour`;
}

export function scalarSurfaceGradientCacheKey(sourceId: string): string {
  return `${SCALAR_SURFACE_KEY_PREFIX}${sourceId}-gradient`;
}

type OkResult = Extract<ScalarVizResultEntry["result"], { status: "ok" }>;
type Orientation = NonNullable<SurfaceGraphObject["orientation"]>;

export function explicitSurfaceMathPoint(
  orientation: Orientation,
  u: number,
  v: number,
  f: number
): { x: number; y: number; z: number } {
  if (orientation === "x") {
    return { x: f, y: u, z: v };
  }
  if (orientation === "y") {
    return { x: u, y: f, z: v };
  }
  return { x: u, y: v, z: f };
}

function disableRaycast(object: Object3D): void {
  (object as Mesh).raycast = () => {};
}

function clampHeight(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function findSurfaceGeometry(node: Object3D | undefined): BufferGeometry | null {
  let geometry: BufferGeometry | null = null;
  node?.traverse(child => {
    if (!geometry && child instanceof Mesh && child.geometry.index) geometry = child.geometry;
  });
  return geometry;
}

export function updateScalarSurfaceOverlays(frame: ScalarSliceOverlayFrame): void {
  const liveKeys = new Set<string>();
  for (const [sourceId, config] of Object.entries(frame.configs)) {
    const source = frame.objects.find((object) => object.id === sourceId);
    if (!source || source.kind !== "surface") {
      continue;
    }
    const meshKey = scalarSurfaceCacheKey(sourceId);
    const contourKey = scalarSurfaceContourCacheKey(sourceId);
    const gradientKey = scalarSurfaceGradientCacheKey(sourceId);
    const liveIdentity = scalarVizMathIdentity(source, Object.keys(frame.params));
    if (liveIdentity === null || liveIdentity !== config.structure) {
      continue;
    }
    const entry = frame.results[`scalar:${sourceId}`];
    const desired = buildScalarFieldJob(source, config, frame.params, frame.displayDomains?.[sourceId]);
    const result = entry?.signature === desired?.signature && entry?.result.status === "ok" ? entry.result : null;
    const node = frame.objectNodes.get(sourceId);
    const surfaceGeometry = findSurfaceGeometry(node);
    if (!surfaceGeometry) continue;
    const wantMesh = config.showHeatmap && result !== null && result.validCount > 0;
    const wantContours =
      config.showContours && result !== null && result.contourStatus === "ok" && result.contourSegmentCount > 0;
    const visible = Boolean(node?.visible);
    const { effectiveOrientation: orientation } = getEffectiveSurfaceOrientation(source.equation, source.orientation);
    const meshKeyValue = [config.structure, entry?.signature ?? "", orientation, surfaceGeometry.uuid].join("|");
    const contourKeyValue = [meshKeyValue, frame.theme].join("|");

    if (config.showGradient && result?.gradientStatus === "ok" && result.gradientValidCount > 0) {
      liveKeys.add(gradientKey);
      const key = [meshKeyValue, config.gradientScale, config.gradientNormalize, config.gradientDensity, frame.theme].join("|");
      if (frame.cache.get(gradientKey)?.key !== key) {
        removeCachedSliceOverlay(frame, gradientKey);
        const group = buildSurfaceGradient(sourceId, result, orientation, config.gradientDensity,
          config.gradientScale, config.gradientNormalize, frame.theme, surfaceHeightClamp(source));
        frame.overlayRoot.add(group);
        frame.cache.set(gradientKey, { key, group });
      }
      frame.cache.get(gradientKey)!.group.visible = visible;
    }

    if (wantMesh && result) {
      liveKeys.add(meshKey);
      const cached = frame.cache.get(meshKey);
      if (!cached || cached.key !== meshKeyValue) {
        removeCachedSliceOverlay(frame, meshKey);
        const mesh = buildSurfaceHeatMesh(sourceId, result, orientation, surfaceGeometry);
        if (mesh) {
          frame.overlayRoot.add(mesh);
          frame.cache.set(meshKey, { key: meshKeyValue, group: mesh });
        }
      }
      const current = frame.cache.get(meshKey);
      if (current) {
        current.group.visible = visible;
      }
    }
    if (wantContours && result) {
      liveKeys.add(contourKey);
      const cached = frame.cache.get(contourKey);
      if (!cached || cached.key !== contourKeyValue) {
        removeCachedSliceOverlay(frame, contourKey);
        // Cache empty/budget-limited cuts too, rather than retrying every frame.
        const lines = buildSurfaceContours(sourceId, result, orientation, frame.theme, surfaceGeometry) ?? new Group();
        frame.overlayRoot.add(lines);
        frame.cache.set(contourKey, { key: contourKeyValue, group: lines });
      }
      const current = frame.cache.get(contourKey);
      if (current) {
        current.group.visible = visible;
      }
    }
  }

  for (const [cacheKey] of frame.cache) {
    if (cacheKey.startsWith(SCALAR_SURFACE_KEY_PREFIX) && !liveKeys.has(cacheKey)) {
      removeCachedSliceOverlay(frame, cacheKey);
    }
  }
}

function independentWorldAxes(orientation: Orientation): [number, number] {
  return orientation === "x" ? [2, 1] : orientation === "y" ? [0, 1] : [0, 2];
}

function buildSurfaceHeatMesh(sourceId: string, result: OkResult, orientation: Orientation,
  sourceGeometry: BufferGeometry): Group | null {
  const texture = sliceDataTexture(result);
  if (!texture) return null;
  const geometry = sourceGeometry.clone();
  const positions = geometry.getAttribute("position");
  const uvs = new Float32Array(positions.count * 2);
  const [uAxis, vAxis] = independentWorldAxes(orientation);
  const { domain } = result;
  for (let i = 0; i < positions.count; i++) {
    uvs[i * 2] = (positions.getComponent(i, uAxis) - domain.uMin) / (domain.uMax - domain.uMin);
    uvs[i * 2 + 1] = (positions.getComponent(i, vAxis) - domain.vMin) / (domain.vMax - domain.vMin);
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  const material = new MeshStandardMaterial({
    map: texture,
    roughness: 0.7,
    metalness: 0,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 0.5,
    polygonOffsetUnits: 0.5
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 2;
  disableRaycast(mesh);
  const group = new Group();
  group.userData.analysisSourceId = sourceId;
  group.userData.scalarSurfaceHeat = true;
  group.add(mesh);
  return group;
}

// Bilinear sample of the value grid at math (u, v); null when any corner is
// invalid (contours never cross invalid cells, so this only guards edges).
function sampleGrid(result: OkResult, u: number, v: number): number | null {
  const { domain, width, height } = result;
  const fx = ((u - domain.uMin) / (domain.uMax - domain.uMin)) * (width - 1);
  const fy = ((v - domain.vMin) / (domain.vMax - domain.vMin)) * (height - 1);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
    return null;
  }
  const i0 = Math.max(0, Math.min(width - 2, Math.floor(fx)));
  const j0 = Math.max(0, Math.min(height - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - i0));
  const ty = Math.max(0, Math.min(1, fy - j0));
  const a = j0 * width + i0;
  const b = a + 1;
  const c = a + width;
  const d = c + 1;
  if (!result.valid[a] || !result.valid[b] || !result.valid[c] || !result.valid[d]) {
    return null;
  }
  const top = (result.values[a] as number) * (1 - tx) + (result.values[b] as number) * tx;
  const bottom = (result.values[c] as number) * (1 - tx) + (result.values[d] as number) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Function gradient in the independent-coordinate plane, anchored on f(u,v).
 * The dependent component stays zero: these are not surface normals. */
function buildSurfaceGradient(sourceId: string, result: OkResult, orientation: Orientation,
  density: number, scale: number, normalize: boolean, theme: ResolvedTheme, heightLimit: number): Group {
  const positions = new Float32Array(result.gradientValidCount * 3);
  const vectors = new Float32Array(positions.length);
  const magnitudes = new Float32Array(result.gradientValidCount);
  let count = 0;
  for (let i = 0; i < result.gradientValidCount; i++) {
    const u = result.gradientPositions[i * 3] as number;
    const v = result.gradientPositions[i * 3 + 1] as number;
    const f = sampleGrid(result, u, v);
    if (f === null) continue;
    const point = explicitSurfaceMathPoint(orientation, u, v, clampHeight(f, heightLimit));
    const vector = explicitSurfaceMathPoint(orientation, result.gradientVectors[i * 3] as number,
      result.gradientVectors[i * 3 + 1] as number, 0);
    positions.set([point.x, point.y, point.z], count * 3);
    vectors.set([vector.x, vector.y, vector.z], count * 3);
    magnitudes[count++] = result.gradientMagnitudes[i] as number;
  }
  const cell = Math.min(result.domain.uMax - result.domain.uMin, result.domain.vMax - result.domain.vMin) / Math.max(1, density - 1);
  const group = buildVectorFieldGroup({ id: `gradient:${sourceId}`, color: theme === "dark" ? "#fbbf24" : "#9a3412",
    scale, normalize, roughness: 0.6, metalness: 0, samples: { positions, vectors, magnitudes,
      validCount: count, maxMagnitude: result.gradientMaxMagnitude, cell } });
  group.userData.analysisSourceId = sourceId;
  group.userData.scalarSurfaceGradient = true;
  // Input-plane arrows can enter the surface. Draw them as readable analysis
  // glyphs above the surface shading without changing their mathematical direction.
  group.traverse(child => {
    if (child instanceof Mesh) {
      child.renderOrder = 4;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => { material.depthTest = false; material.depthWrite = false; });
    }
  });
  return group;
}

function buildSurfaceContours(
  sourceId: string,
  result: OkResult,
  orientation: Orientation,
  theme: ResolvedTheme,
  sourceGeometry: BufferGeometry
): Group | null {
  const vertices = sourceGeometry.getAttribute("position");
  const indices = sourceGeometry.getIndex();
  if (!indices) return null;
  const dependentAxis = orientation === "x" ? 0 : orientation === "y" ? 2 : 1;
  const positions: number[] = [];
  // Intersect only rendered triangles: no bridging invalid cells, no second
  // displaced copy, and both endpoints and the whole segment lie on the face.
  for (const level of result.levels.subarray(0, MAX_CONTOUR_LEVELS)) {
    for (let triangle = 0; triangle < indices.count; triangle += 3) {
      const aIndex = indices.getX(triangle), bIndex = indices.getX(triangle + 1), cIndex = indices.getX(triangle + 2);
      const aHeight = vertices.getComponent(aIndex, dependentAxis), bHeight = vertices.getComponent(bIndex, dependentAxis), cHeight = vertices.getComponent(cIndex, dependentAxis);
      if (level < Math.min(aHeight, bHeight, cHeight) || level >= Math.max(aHeight, bHeight, cHeight)) continue;
      const ids = [aIndex, bIndex, cIndex];
      const hits: number[][] = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = ids[edge], b = ids[(edge + 1) % 3];
        const fa = vertices.getComponent(a, dependentAxis), fb = vertices.getComponent(b, dependentAxis);
        if (!((fa <= level && fb > level) || (fb <= level && fa > level))) continue;
        const t = (level - fa) / (fb - fa);
        hits.push([0, 1, 2].map(axis => vertices.getComponent(a, axis) * (1 - t) + vertices.getComponent(b, axis) * t));
      }
      if (hits.length === 2 && hits[0].some((value, axis) => Math.abs(value - hits[1][axis]) > 1e-9)) {
        if (positions.length / 6 >= MAX_CONTOUR_SEGMENTS) return null;
        positions.push(...hits[0], ...hits[1]);
      }
    }
  }
  if (positions.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new LineBasicMaterial({
    color: theme === "dark" ? 0xf1f5f9 : 0x0f172a,
    transparent: true,
    opacity: 0.8,
    depthTest: true,
    depthWrite: false
  });
  const lines = new LineSegments(geometry, material);
  lines.renderOrder = 3;
  disableRaycast(lines);
  const group = new Group();
  group.userData.analysisSourceId = sourceId;
  group.userData.scalarSurfaceContour = true;
  group.add(lines);
  return group;
}
