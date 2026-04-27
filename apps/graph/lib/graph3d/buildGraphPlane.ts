import type { PlaneGraphObject } from "@vinculum/scene/types";
import {
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial
} from "three";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { updateFloat32Attribute, updateIndexAttributeUint32 } from "./bufferGeometryAttributes";

export function buildPlane(object: PlaneGraphObject, theme: ResolvedTheme): Group | null {
  if (!object.equation.trim()) {
    return null;
  }
  const compiled = compilePlaneEquation(object.equation);
  if (compiled.error || !compiled.coefficients) {
    return null;
  }

  let sampled;
  try {
    sampled = samplePlane(compiled.coefficients, object.size);
  } catch {
    return null;
  }

  if (!sampled || sampled.indices.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  updateFloat32Attribute(geometry, "position", sampled.positions, 3);
  updateIndexAttributeUint32(geometry, sampled.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.setDrawRange(0, sampled.indices.length);

  const group = new Group();
  group.userData.vinculumId = object.id;

  const planeOpacity = theme === "dark" ? 0.62 : 0.56;
  const material = new MeshBasicMaterial({
    color: object.color,
    transparent: true,
    opacity: planeOpacity,
    wireframe: object.appearance.wireframe,
    side: DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  const mesh = new Mesh(geometry, material);
  group.add(mesh);

  if (!object.appearance.wireframe) {
    const edgeMaterial = new LineBasicMaterial({
      color: theme === "dark" ? "#f8fafc" : "#0f172a",
      transparent: true,
      opacity: theme === "dark" ? 0.2 : 0.18,
      depthWrite: false
    });
    const edges = new LineSegments(geometry, edgeMaterial);
    edges.renderOrder = 5;
    group.add(edges);
  }

  return group;
}
