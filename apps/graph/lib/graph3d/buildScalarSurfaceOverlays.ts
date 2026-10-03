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
import { mathToWorld3D } from "@/lib/math/coordinates";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { removeCachedSliceOverlay, sliceDataTexture, type ScalarSliceOverlayFrame } from "./buildScalarSliceOverlays";
import { buildVectorFieldGroup } from "./buildGraphVectorField";

// 3D heat map + contours for explicit surfaces. The worker grid (`scalar:<id>`,
// shared with the 2D canvas) is lifted onto the graph f(u,v): the heat layer is
// a lit mesh drawn a hair in front of the source surface (polygon offset), and
// each contour segment is lifted to its interpolated height. Keyed
// `scalar-surface:<id>` / `-contour` in the shared overlay root; raycast
// disabled so overlays never steal surface picks.

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

// Must match sampleSurface's clamp so the heat layer tracks the drawn surface.
const CLAMP_HEIGHT = 10_000;

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

function clampHeight(value: number): number {
  return Math.max(-CLAMP_HEIGHT, Math.min(CLAMP_HEIGHT, value));
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
    const result = entry?.result.status === "ok" ? entry.result : null;
    const wantMesh = config.showHeatmap && result !== null && result.validCount > 0;
    const wantContours =
      config.showContours && result !== null && result.contourStatus === "ok" && result.contourSegmentCount > 0;
    const node = frame.objectNodes.get(sourceId);
    const visible = Boolean(node?.visible);
    const orientation = source.orientation ?? "z";
    const meshKeyValue = [config.structure, entry?.signature ?? "", orientation].join("|");
    const contourKeyValue = [meshKeyValue, frame.theme].join("|");

    if (config.showGradient && result?.gradientStatus === "ok" && result.gradientValidCount > 0) {
      liveKeys.add(gradientKey);
      const key = [meshKeyValue, config.gradientScale, config.gradientNormalize, config.gradientDensity, frame.theme].join("|");
      if (frame.cache.get(gradientKey)?.key !== key) {
        removeCachedSliceOverlay(frame, gradientKey);
        const group = buildSurfaceGradient(sourceId, result, orientation, config.gradientDensity,
          config.gradientScale, config.gradientNormalize, frame.theme);
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
        const mesh = buildSurfaceHeatMesh(sourceId, result, orientation);
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
        const lines = buildSurfaceContours(sourceId, result, orientation, frame.theme);
        if (lines) {
          frame.overlayRoot.add(lines);
          frame.cache.set(contourKey, { key: contourKeyValue, group: lines });
        }
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

function gridCoord(result: OkResult, i: number, j: number): { u: number; v: number } {
  const { domain, width, height } = result;
  return {
    u: domain.uMin + ((domain.uMax - domain.uMin) * i) / (width - 1),
    v: domain.vMin + ((domain.vMax - domain.vMin) * j) / (height - 1)
  };
}

function buildSurfaceHeatMesh(sourceId: string, result: OkResult, orientation: Orientation): Group | null {
  const { width, height } = result;
  if (width < 2 || height < 2) {
    return null;
  }
  const positions = new Float32Array(width * height * 3);
  const uvs = new Float32Array(width * height * 2);
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const index = j * width + i;
      const { u, v } = gridCoord(result, i, j);
      const f = result.valid[index] === 1 ? clampHeight(result.values[index] as number) : 0;
      const world = mathToWorld3D(explicitSurfaceMathPoint(orientation, u, v, f));
      positions[index * 3] = world.x;
      positions[index * 3 + 1] = world.y;
      positions[index * 3 + 2] = world.z;
      uvs[index * 2] = i / (width - 1);
      uvs[index * 2 + 1] = j / (height - 1);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < height - 1; j += 1) {
    for (let i = 0; i < width - 1; i += 1) {
      const a = j * width + i;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      if (result.valid[a] && result.valid[b] && result.valid[c] && result.valid[d]) {
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  if (indices.length === 0) {
    return null;
  }
  const texture = sliceDataTexture(result);
  if (!texture) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new MeshStandardMaterial({
    map: texture,
    roughness: 0.7,
    metalness: 0,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
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
  density: number, scale: number, normalize: boolean, theme: ResolvedTheme): Group {
  const positions = new Float32Array(result.gradientValidCount * 3);
  const vectors = new Float32Array(positions.length);
  const magnitudes = new Float32Array(result.gradientValidCount);
  let count = 0;
  for (let i = 0; i < result.gradientValidCount; i++) {
    const u = result.gradientPositions[i * 3] as number;
    const v = result.gradientPositions[i * 3 + 1] as number;
    const f = sampleGrid(result, u, v);
    if (f === null) continue;
    const point = explicitSurfaceMathPoint(orientation, u, v, clampHeight(f));
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
  theme: ResolvedTheme
): Group | null {
  const count = result.contourSegmentCount;
  if (count <= 0) {
    return null;
  }
  // Lines coincide with the surface, so draw one copy lifted slightly along
  // each side of the dependent axis: visible from above and below, no z-fight.
  const span = Math.max(
    Math.abs(result.domain.uMax - result.domain.uMin),
    Math.abs(result.domain.vMax - result.domain.vMin),
    Math.abs(result.max - result.min)
  );
  const lift = Math.max(1e-4, span * 0.003);
  const positions: number[] = [];
  for (let s = 0; s < count; s += 1) {
    const ua = result.contourSegments[s * 4] as number;
    const va = result.contourSegments[s * 4 + 1] as number;
    const ub = result.contourSegments[s * 4 + 2] as number;
    const vb = result.contourSegments[s * 4 + 3] as number;
    const fa = sampleGrid(result, ua, va);
    const fb = sampleGrid(result, ub, vb);
    if (fa === null || fb === null) {
      continue;
    }
    for (const offset of [lift, -lift]) {
      const worldA = mathToWorld3D(explicitSurfaceMathPoint(orientation, ua, va, clampHeight(fa) + offset));
      const worldB = mathToWorld3D(explicitSurfaceMathPoint(orientation, ub, vb, clampHeight(fb) + offset));
      positions.push(worldA.x, worldA.y, worldA.z, worldB.x, worldB.y, worldB.z);
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new LineBasicMaterial({
    color: theme === "dark" ? 0xf1f5f9 : 0x0f172a,
    transparent: true,
    opacity: 0.8
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
