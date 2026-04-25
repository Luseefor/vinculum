import type { GraphObject, ParametricCurveObject, PlaneGraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D
} from "three";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { sampleSurface } from "@/lib/math/sampleSurface";
import {
  getRenderDescriptorSignature,
  getStructureDescriptorSignature,
  toGraphObjectRenderDescriptor
} from "@/lib/graph3d/renderDescriptors";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";

export function disposeObject3D(root: Object3D): void {
  root.traverse((child) => {
    if (child instanceof Mesh || child instanceof Line || child instanceof LineSegments) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}

export function buildGraphObjectsGroup(objects: GraphObject[], theme: ResolvedTheme): Group {
  const root = new Group();
  const tokens = getGraphThemeTokens(theme);

  for (const object of objects) {
    if (!object.visible) {
      continue;
    }

    const built = buildOne(object, theme, tokens);
    if (built) {
      root.add(built);
    }
  }

  return root;
}

export function buildGraphObject(object: GraphObject, theme: ResolvedTheme): Object3D | null {
  const tokens = getGraphThemeTokens(theme);
  return buildOne(object, theme, tokens);
}

export function getGraphObjectRenderSignature(object: GraphObject): string {
  return getRenderDescriptorSignature(toGraphObjectRenderDescriptor(object));
}

export function getGraphObjectStructureSignature(object: GraphObject): string {
  return getStructureDescriptorSignature(toGraphObjectRenderDescriptor(object));
}

export function applyObjectColorToNode(node: Object3D, colorHex: string): void {
  const color = new Color(colorHex);
  node.traverse((child) => {
    if (!(child instanceof Mesh || child instanceof Line || child instanceof LineSegments)) {
      return;
    }
    const material = child.material;
    const apply = (entry: unknown) => {
      if (entry && typeof entry === "object" && "color" in entry) {
        const maybeColor = (entry as { color?: unknown }).color;
        if (maybeColor instanceof Color) {
          maybeColor.copy(color);
        }
      }
    };
    if (Array.isArray(material)) {
      for (const entry of material) {
        apply(entry);
      }
    } else {
      apply(material);
    }
  });
}

function buildOne(
  object: GraphObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Object3D | null {
  if (object.kind === "surface") {
    return buildSurface(object, theme, tokens);
  }
  if (object.kind === "parametricCurve") {
    return buildParametric(object);
  }
  if (object.kind === "plane") {
    return buildPlane(object, theme);
  }
  return null;
}

function buildSurface(
  object: SurfaceGraphObject,
  theme: ResolvedTheme,
  tokens: ReturnType<typeof getGraphThemeTokens>
): Group | null {
  const { evaluator, error } = compileSurfaceExpression(object.equation, object.orientation || 'z');
  if (error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleSurface(evaluator, {
      domain: object.domain,
      resolution: Math.max(2, Math.floor(object.resolution)),
      clampHeight: 10_000,
      orientation: object.orientation
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

function buildParametric(object: ParametricCurveObject): Line | null {
  const compiled = compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr);
  if (compiled.error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleCurve(compiled.evaluator, {
      tMin: object.tMin,
      tMax: object.tMax,
      samples: Math.max(2, Math.floor(object.samples)),
      clampCoordinate: 10_000
    });
  } catch {
    return null;
  }

  if (!sampled || sampled.positions.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(sampled.positions, 3));
  geometry.computeBoundingSphere();
  geometry.setDrawRange(0, sampled.positions.length / 3);

  const material = new LineBasicMaterial({
    color: object.color,
    transparent: true,
    opacity: 0.95
  });

  const line = new Line(geometry, material);
  line.userData.vinculumId = object.id;
  return line;
}

function buildPlane(object: PlaneGraphObject, theme: ResolvedTheme): Group | null {
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

function updateFloat32Attribute(geometry: BufferGeometry, key: "position", data: Float32Array, itemSize: number) {
  const existing = geometry.getAttribute(key);
  if (
    existing instanceof BufferAttribute &&
    existing.array instanceof Float32Array &&
    existing.itemSize === itemSize &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setAttribute(key, new BufferAttribute(data, itemSize));
}

function updateIndexAttribute(geometry: BufferGeometry, data: Uint16Array | Uint32Array) {
  const existing = geometry.getIndex();
  if (
    existing instanceof BufferAttribute &&
    (existing.array instanceof Uint16Array || existing.array instanceof Uint32Array) &&
    existing.array.constructor === data.constructor &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setIndex(new BufferAttribute(data, 1));
}

function updateIndexAttributeUint32(geometry: BufferGeometry, data: Uint32Array) {
  const existing = geometry.getIndex();
  if (
    existing instanceof BufferAttribute &&
    existing.array instanceof Uint32Array &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setIndex(new BufferAttribute(data, 1));
}

export function sceneHasVisibleSurface(objects: GraphObject[]): boolean {
  return objects.some((object) => object.visible && object.kind === "surface");
}
