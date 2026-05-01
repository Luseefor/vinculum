import type { SurfaceGraphObject } from "@vinculum/scene/types";
import {
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial
} from "three";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { updateFloat32Attribute, updateIndexAttribute } from "./bufferGeometryAttributes";
import { buildImplicitSurfaceContour } from "./buildImplicitSurfaceContour";

export function buildSurface(
  object: SurfaceGraphObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Group | null {
  if (!object.equation.trim()) {
    return null;
  }
  const implicitContour = buildImplicitSurfaceContour(object, theme);
  if (implicitContour) {
    return implicitContour;
  }
  const { evaluator, error, effectiveOrientation } = compileSurfaceExpression(
    object.equation,
    object.orientation || "z"
  );
  if (error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleSurface(evaluator, {
      domain: object.domain,
      resolution: Math.max(2, Math.floor(object.resolution)),
      clampHeight: 10_000,
      orientation: effectiveOrientation
    });
  } catch {
    return null;
  }

  if (!sampled || sampled.indices.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  updateFloat32Attribute(geometry, "position", sampled.positions, 3);
  updateIndexAttribute(geometry, sampled.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.setDrawRange(0, geometry.getIndex()?.count ?? 0);

  const group = new Group();
  group.userData.vinculumId = object.id;

  const material = new MeshStandardMaterial({
    color: object.color,
    roughness: tokens.sceneSurfaceRoughness,
    metalness: tokens.sceneSurfaceMetalness,
    wireframe: object.appearance.wireframe,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  if (!object.appearance.wireframe) {
    const edgeMaterial = new LineBasicMaterial({
      color: theme === "dark" ? "#f8fafc" : "#0f172a",
      transparent: true,
      opacity: theme === "dark" ? 0.1 : 0.12,
      depthWrite: false
    });
    const edges = new LineSegments(geometry, edgeMaterial);
    edges.renderOrder = 5;
    group.add(edges);
  }

  return group;
}
