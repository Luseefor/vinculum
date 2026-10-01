import {
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type Object3D
} from "three";
import type { GraphObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import type { ScalarVizConfig } from "@/types/graphUi";
import type { ScalarVizResultEntry } from "@/lib/compute/scalarVizResults";
import { mathToWorld3D } from "@/lib/math/coordinates";
import { resolveScalarRange, scalarColorForValue } from "@/lib/math/scalarColorPolicy";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { disposeObject3D } from "./buildGraphObjectDisposal";

// S23 3D planar scalar slices for implicit sources. One shared overlay
// group per slice-enabled source in the S21 overlay root (PART 45: the
// same mesh/texture serves Perspective/XY/XZ/YZ/Split/Quad with no
// per-pane work), keyed `scalar-slice:<id>` (+ `-contour` for the lines).
//
// Rendering: a single BufferGeometry grid textured with an RGBA
// DataTexture recolored from the cached worker grid (theme changes
// re-upload, zero recompute), plus one LineSegments for slice contours
// mapped through mathToWorld3D. Slight transparency preserves depth
// perception; polygon offset + render order keep contours off the plane
// without mathematically displacing them. Raycast disabled everywhere so
// slices never block surface picks (PART 30).

export const SCALAR_SLICE_KEY_PREFIX = "scalar-slice:";

export function scalarSliceCacheKey(sourceId: string): string {
  return `${SCALAR_SLICE_KEY_PREFIX}${sourceId}`;
}

export function scalarSliceContourCacheKey(sourceId: string): string {
  return `${SCALAR_SLICE_KEY_PREFIX}${sourceId}-contour`;
}

function disableRaycast(object: Object3D): void {
  (object as Mesh).raycast = () => {};
}

export interface ScalarSliceOverlayFrame {
  configs: Record<string, ScalarVizConfig>;
  objects: readonly GraphObject[];
  objectNodes: Map<string, Object3D>;
  /** Namespaced worker results (`slice:<sourceId>`). */
  results: Record<string, ScalarVizResultEntry>;
  overlayRoot: Group;
  cache: Map<string, { key: string; group: Group }>;
  theme: ResolvedTheme;
  params: Record<string, number>;
}

interface SlicePlaneFrame {
  /** Math coordinate of grid node (u, v). */
  mathPoint: (u: number, v: number) => { x: number; y: number; z: number };
}

export function slicePlaneFrame(
  plane: "xy" | "xz" | "yz",
  planeValue: number
): SlicePlaneFrame {
  if (plane === "xz") {
    return { mathPoint: (u, v) => ({ x: u, y: planeValue, z: v }) };
  }
  if (plane === "yz") {
    return { mathPoint: (u, v) => ({ x: planeValue, y: u, z: v }) };
  }
  return { mathPoint: (u, v) => ({ x: u, y: v, z: planeValue }) };
}

export function updateScalarSliceOverlays(frame: ScalarSliceOverlayFrame): void {
  const liveKeys = new Set<string>();
  for (const [sourceId, config] of Object.entries(frame.configs)) {
    const meshKey = scalarSliceCacheKey(sourceId);
    const contourKey = scalarSliceContourCacheKey(sourceId);
    liveKeys.add(meshKey);
    liveKeys.add(contourKey);
    const source = frame.objects.find((object) => object.id === sourceId);
    // S23-R1: this sync OWNS NO config lifecycle. Configs are dual-purpose
    // (2D heat/contours/gradients + slice); clearing here wiped legitimate
    // surface heat the moment the 3D tick ran. Deletion, kind switches,
    // math edits, and identity drift are pruned by store actions and the
    // syncScalarViz backstop — this path only skips and drops overlays.
    if (!source || source.kind !== "implicitSurface") {
      removeCachedSliceOverlay(frame, meshKey);
      removeCachedSliceOverlay(frame, contourKey);
      continue;
    }
    const node = frame.objectNodes.get(sourceId);
    const liveIdentity = scalarVizMathIdentity(source, Object.keys(frame.params));
    if (liveIdentity === null || liveIdentity !== config.structure) {
      removeCachedSliceOverlay(frame, meshKey);
      removeCachedSliceOverlay(frame, contourKey);
      continue;
    }
    if (!config.sliceEnabled) {
      removeCachedSliceOverlay(frame, meshKey);
      removeCachedSliceOverlay(frame, contourKey);
      continue;
    }
    if (!node || !node.visible) {
      // Derived layers hide with the source (PART 31); the config and
      // cached grid stay valid for instant return.
      setSliceOverlayVisible(frame, meshKey, false);
      setSliceOverlayVisible(frame, contourKey, false);
      continue;
    }
    const entry = frame.results[`slice:${sourceId}`];
    if (!entry || entry.result.status !== "ok") {
      // Pending or all-invalid: no mesh (Inspector carries the state).
      setSliceOverlayVisible(frame, meshKey, false);
      setSliceOverlayVisible(frame, contourKey, false);
      continue;
    }
    const result = entry.result;
    // Data colors are theme-independent (contours carry the theme
    // adaptation), so the mesh key omits the theme: theme switches
    // re-render without re-uploading. Neither key change enqueues work.
    const meshKeyValue = [config.structure, entry.signature].join("|");
    const contourKeyValue = [meshKeyValue, frame.theme].join("|");
    const cachedMesh = frame.cache.get(meshKey);
    const cachedContour = frame.cache.get(contourKey);
    const wantMesh = config.showSliceHeatmap;
    const wantContours =
      config.showSliceContours && result.contourStatus === "ok" && result.contourSegmentCount > 0;
    if (
      (!wantMesh || (cachedMesh && cachedMesh.key === meshKeyValue)) &&
      (!wantContours || (cachedContour && cachedContour.key === contourKeyValue))
    ) {
      setSliceOverlayVisible(frame, meshKey, wantMesh);
      setSliceOverlayVisible(frame, contourKey, wantContours);
      continue;
    }
    removeCachedSliceOverlay(frame, meshKey);
    removeCachedSliceOverlay(frame, contourKey);
    const planeFrame = slicePlaneFrame(config.slicePlane, config.sliceValue);
    if (wantMesh) {
      const mesh = buildSliceMesh(sourceId, result, planeFrame);
      if (mesh) {
        mesh.visible = node.visible;
        frame.overlayRoot.add(mesh);
        frame.cache.set(meshKey, { key: meshKeyValue, group: mesh });
      }
    }
    if (wantContours) {
      const contours = buildSliceContours(sourceId, result, planeFrame, frame.theme);
      if (contours) {
        contours.visible = node.visible;
        frame.overlayRoot.add(contours);
        frame.cache.set(contourKey, { key: contourKeyValue, group: contours });
      }
    }
  }

  for (const [cacheKey] of frame.cache) {
    if (!cacheKey.startsWith(SCALAR_SLICE_KEY_PREFIX)) {
      continue;
    }
    if (!liveKeys.has(cacheKey)) {
      removeCachedSliceOverlay(frame, cacheKey);
    }
  }
}

function buildSliceMesh(
  sourceId: string,
  result: Extract<ScalarVizResultEntry["result"], { status: "ok" }>,
  planeFrame: SlicePlaneFrame
): Group | null {
  const { width, height } = result;
  if (width < 2 || height < 2 || result.validCount === 0) {
    return null;
  }
  const positions = new Float32Array(width * height * 3);
  const uvs = new Float32Array(width * height * 2);
  const domain = result.domain;
  let cursor = 0;
  let uvCursor = 0;
  for (let j = 0; j < height; j += 1) {
    const v = domain.vMin + ((domain.vMax - domain.vMin) * j) / (height - 1);
    for (let i = 0; i < width; i += 1) {
      const u = domain.uMin + ((domain.uMax - domain.uMin) * i) / (width - 1);
      const math = planeFrame.mathPoint(u, v);
      const world = mathToWorld3D(math);
      positions[cursor] = world.x;
      positions[cursor + 1] = world.y;
      positions[cursor + 2] = world.z;
      cursor += 3;
      uvs[uvCursor] = i / (width - 1);
      uvs[uvCursor + 1] = j / (height - 1);
      uvCursor += 2;
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < height - 1; j += 1) {
    for (let i = 0; i < width - 1; i += 1) {
      const a = j * width + i;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const texture = sliceDataTexture(result);
  if (!texture) {
    geometry.dispose();
    return null;
  }
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    side: DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  disableRaycast(mesh);
  const group = new Group();
  group.userData.analysisSourceId = sourceId;
  group.userData.scalarSlice = true;
  group.add(mesh);
  return group;
}

export function sliceDataTexture(
  result: Extract<ScalarVizResultEntry["result"], { status: "ok" }>
): DataTexture | null {
  const range = resolveScalarRange(result.min, result.max, result.validCount);
  if (range.mode === "empty") {
    return null;
  }
  const data = new Uint8Array(result.width * result.height * 4);
  for (let j = 0; j < result.height; j += 1) {
    for (let i = 0; i < result.width; i += 1) {
      const srcIndex = j * result.width + i;
      const destIndex = (j * result.width + i) * 4;
      if (result.valid[srcIndex] === 0) {
        data[destIndex + 3] = 0;
        continue;
      }
      const [r, g, b, a] = scalarColorForValue(result.values[srcIndex] as number, range);
      data[destIndex] = r;
      data[destIndex + 1] = g;
      data[destIndex + 2] = b;
      data[destIndex + 3] = a;
    }
  }
  const texture = new DataTexture(data, result.width, result.height, RGBAFormat, UnsignedByteType);
  texture.flipY = false;
  // S23-R1: ramp bytes are authored in sRGB — tag the texture so the
  // renderer converts on sample (no repo texture precedent; this is the
  // three-canonical choice for color maps).
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function buildSliceContours(
  sourceId: string,
  result: Extract<ScalarVizResultEntry["result"], { status: "ok" }>,
  planeFrame: SlicePlaneFrame,
  theme: ResolvedTheme
): Group | null {
  const count = result.contourSegmentCount;
  if (count <= 0) {
    return null;
  }
  const positions = new Float32Array(count * 6);
  for (let s = 0; s < count; s += 1) {
    const mathA = planeFrame.mathPoint(
      result.contourSegments[s * 4] as number,
      result.contourSegments[s * 4 + 1] as number
    );
    const mathB = planeFrame.mathPoint(
      result.contourSegments[s * 4 + 2] as number,
      result.contourSegments[s * 4 + 3] as number
    );
    const worldA = mathToWorld3D(mathA);
    const worldB = mathToWorld3D(mathB);
    positions[s * 6] = worldA.x;
    positions[s * 6 + 1] = worldA.y;
    positions[s * 6 + 2] = worldA.z;
    positions[s * 6 + 3] = worldB.x;
    positions[s * 6 + 4] = worldB.y;
    positions[s * 6 + 5] = worldB.z;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new LineBasicMaterial({
    color: theme === "dark" ? 0xf1f5f9 : 0x0f172a,
    transparent: true,
    opacity: 0.85,
    depthTest: true
  });
  const lines = new LineSegments(geometry, material);
  lines.renderOrder = 3;
  disableRaycast(lines);
  const group = new Group();
  group.userData.analysisSourceId = sourceId;
  group.userData.scalarSliceContour = true;
  group.add(lines);
  return group;
}

function setSliceOverlayVisible(
  frame: Pick<ScalarSliceOverlayFrame, "cache">,
  cacheKey: string,
  visible: boolean
): void {
  const cached = frame.cache.get(cacheKey);
  if (cached) {
    cached.group.visible = visible;
  }
}

export function removeCachedSliceOverlay(
  frame: Pick<ScalarSliceOverlayFrame, "cache" | "overlayRoot">,
  cacheKey: string
): void {
  const cached = frame.cache.get(cacheKey);
  if (!cached) {
    return;
  }
  frame.cache.delete(cacheKey);
  frame.overlayRoot.remove(cached.group);
  // S23-R1: disposeObject3D releases geometry/materials but never textures
  // (it predates texture users). Slice meshes own their DataTexture, so
  // release it here explicitly — otherwise every slice move leaks one.
  cached.group.traverse((child) => {
    const mesh = child as { material?: { map?: { dispose?: () => void } | null } | { dispose?: () => void }[] };
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials) {
      const map = (material as { map?: { dispose?: () => void } | null }).map;
      if (map && typeof map.dispose === "function") {
        map.dispose();
      }
    }
  });
  disposeObject3D(cached.group);
}
