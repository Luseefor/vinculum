import {
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { computeIndexedBoundingSphereData } from "@/lib/math/indexedBounds";
import { repairZeroVertexNormals } from "@/lib/math/sampleParametricSurface";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { updateFloat32Attribute, updateIndexAttribute } from "./bufferGeometryAttributes";

interface IndexedSurfaceMeshInput {
  id: string;
  color: string;
  wireframe: boolean;
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  theme: ResolvedTheme;
  tokens: ReturnType<typeof getGraphThemeTokens>;
  /**
   * Repair exact-zero vertex normals from one-ring neighbors (degenerate
   * parameterization corners, e.g. sphere grid poles). Explicit surfaces
   * never need this; parametric surfaces do.
   */
  repairZeroNormals?: boolean;
  /** Implicit extraction repeats vertices at cell boundaries; weld before shading. */
  smoothNormals?: boolean;
}

/**
 * Shared indexed-surface mesh construction for explicit and parametric
 * surfaces: BufferGeometry + normals + INDEXED bounds + standard material +
 * smooth shading + disposal-safe group. Returns null when there is nothing
 * renderable (empty index, missing bounds, or zero-radius degenerate sheet).
 */
export function buildIndexedSurfaceMeshGroup(input: IndexedSurfaceMeshInput): Group | null {
  if (input.indices.length === 0) {
    return null;
  }

  let geometry = new BufferGeometry();
  updateFloat32Attribute(geometry, "position", input.positions, 3);
  updateIndexAttribute(geometry, input.indices);
  if (input.smoothNormals) {
    const original = geometry;
    geometry = mergeVertices(original, 1e-5);
    original.dispose();
  }
  geometry.computeVertexNormals();
  if (input.repairZeroNormals) {
    const normalAttribute = geometry.getAttribute("normal");
    if (normalAttribute) {
      repairZeroVertexNormals(normalAttribute.array as Float32Array, geometry.getIndex()!.array as Uint16Array | Uint32Array);
      normalAttribute.needsUpdate = true;
    }
  }
  // S8 (F7): bound INDEXED/RENDERED vertices only. Dead placeholder positions
  // (non-finite samples kept at the origin) must not distort the sphere.
  // Do NOT call computeBoundingSphere() here: it scans ALL stored positions.
  const indexedBounds = computeIndexedBoundingSphereData(input.positions, input.indices);
  if (!indexedBounds || indexedBounds.radius === 0) {
    geometry.dispose();
    return null;
  }
  geometry.boundingSphere = new Sphere(
    new Vector3(indexedBounds.centerX, indexedBounds.centerY, indexedBounds.centerZ),
    indexedBounds.radius
  );
  geometry.setDrawRange(0, geometry.getIndex()?.count ?? 0);

  const group = new Group();
  group.userData.vinculumId = input.id;

  const material = new MeshStandardMaterial({
    color: input.color,
    roughness: input.tokens.sceneSurfaceRoughness,
    metalness: input.tokens.sceneSurfaceMetalness,
    wireframe: input.wireframe,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);


  return group;
}
