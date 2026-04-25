import type { GraphObject, ParametricCurveObject, PlaneGraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { compile } from "mathjs";
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
  Object3D,
  SphereGeometry
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
import { getEditorParameterScope } from "@/lib/store/editorParameters";

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

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

export function isGraphObjectRenderable3D(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane") {
    return object.equation.trim().length > 0;
  }
  if (object.kind === "parametricCurve") {
    return [object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim().length > 0);
  }
  return false;
}

export function syncNonRenderableObjectNode(
  object: GraphObject,
  theme: ResolvedTheme,
  objectsRoot: Group,
  objectNodes: Map<string, Object3D>,
  objectSignatures: Map<string, string>,
  objectStructureSignatures: Map<string, string>
): boolean {
  if (isGraphObjectRenderable3D(object)) {
    return false;
  }

  const staleNode = objectNodes.get(object.id);
  if (staleNode) {
    objectsRoot.remove(staleNode);
    disposeObject3D(staleNode);
    objectNodes.delete(object.id);
  }

  const nonRenderableSignature = `${theme}:non-renderable`;
  objectSignatures.set(object.id, nonRenderableSignature);
  objectStructureSignatures.set(object.id, nonRenderableSignature);
  return true;
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

function buildImplicitSurfaceContour(object: SurfaceGraphObject, theme: ResolvedTheme): Group | null {
  const parts = splitImplicitEquation(object.equation);
  if (!parts) {
    return null;
  }

  const expression = `(${parts.left}) - (${parts.right})`;
  let compiled: CompiledMathExpression;
  try {
    compiled = compile(expression) as CompiledMathExpression;
  } catch {
    return null;
  }

  const vars = getUsedAxes(expression);
  if (vars.length !== 2) {
    return null;
  }

  const missingAxis = (["x", "y", "z"] as const).find((axis) => !vars.includes(axis));
  if (!missingAxis) {
    return null;
  }

  const uAxis = vars[0];
  const vAxis = vars[1];
  const uMin = Math.min(object.domain.xMin, object.domain.xMax);
  const uMax = Math.max(object.domain.xMin, object.domain.xMax);
  const vMin = Math.min(object.domain.yMin, object.domain.yMax);
  const vMax = Math.max(object.domain.yMin, object.domain.yMax);
  const resolution = Math.max(24, Math.min(220, Math.floor(object.resolution)));
  const stepU = (uMax - uMin) / resolution;
  const stepV = (vMax - vMin) / resolution;
  if (!Number.isFinite(stepU) || !Number.isFinite(stepV) || stepU <= 0 || stepV <= 0) {
    return null;
  }

  const sample = (u: number, v: number): number | null => {
    try {
      const scope: Record<string, number> = {
        x: 0,
        y: 0,
        z: 0,
        pi: Math.PI,
        e: Math.E,
        ...getEditorParameterScope()
      };
      scope[uAxis] = u;
      scope[vAxis] = v;
      scope[missingAxis] = 0;
      const value = compiled.evaluate(scope);
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    } catch {
      return null;
    }
  };

  const contourSegments: Array<{ u1: number; v1: number; u2: number; v2: number }> = [];
  const emitSegment = (
    ua: number,
    va: number,
    fa: number,
    ub: number,
    vb: number,
    fb: number,
    uc: number,
    vc: number,
    fc: number,
    ud: number,
    vd: number,
    fd: number
  ) => {
    const p1 = interpolateImplicitEdge(ua, va, fa, ub, vb, fb);
    const p2 = interpolateImplicitEdge(uc, vc, fc, ud, vd, fd);
    if (!p1 || !p2) {
      return;
    }
    contourSegments.push({ u1: p1.u, v1: p1.v, u2: p2.u, v2: p2.v });
  };

  for (let iy = 0; iy < resolution; iy += 1) {
    for (let ix = 0; ix < resolution; ix += 1) {
      const u0 = uMin + ix * stepU;
      const u1 = u0 + stepU;
      const v0 = vMin + iy * stepV;
      const v1 = v0 + stepV;

      const a = sample(u0, v0);
      const b = sample(u1, v0);
      const c = sample(u1, v1);
      const d = sample(u0, v1);
      if (a === null || b === null || c === null || d === null) {
        continue;
      }

      const mask = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (mask === 0 || mask === 15) {
        continue;
      }

      switch (mask) {
        case 1:
        case 14:
          emitSegment(u0, v1, d, u0, v0, a, u0, v1, d, u1, v1, c);
          break;
        case 2:
        case 13:
          emitSegment(u1, v1, c, u1, v0, b, u0, v1, d, u1, v1, c);
          break;
        case 3:
        case 12:
          emitSegment(u0, v0, a, u1, v0, b, u0, v1, d, u1, v1, c);
          break;
        case 4:
        case 11:
          emitSegment(u0, v0, a, u1, v0, b, u1, v0, b, u1, v1, c);
          break;
        case 5:
          emitSegment(u0, v0, a, u1, v0, b, u0, v0, a, u0, v1, d);
          emitSegment(u1, v0, b, u1, v1, c, u0, v1, d, u1, v1, c);
          break;
        case 6:
        case 9:
          emitSegment(u0, v0, a, u0, v1, d, u1, v0, b, u1, v1, c);
          break;
        case 7:
        case 8:
          emitSegment(u0, v0, a, u0, v1, d, u0, v0, a, u1, v0, b);
          break;
        case 10:
          emitSegment(u0, v0, a, u1, v0, b, u1, v0, b, u1, v1, c);
          emitSegment(u0, v0, a, u0, v1, d, u0, v1, d, u1, v1, c);
          break;
      }
    }
  }

  if (contourSegments.length === 0) {
    return null;
  }

  const extent = Math.max(2, Math.max(Math.abs(uMin), Math.abs(uMax), Math.abs(vMin), Math.abs(vMax)));
  const wMin = -extent;
  const wMax = extent;
  const edgePositions: number[] = [];
  const fillPositions: number[] = [];
  const fillIndices: number[] = [];

  const pushEdge = (p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }) => {
    edgePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  };

  for (const seg of contourSegments) {
    const a0 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u1, seg.v1, wMin);
    const a1 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u1, seg.v1, wMax);
    const b0 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u2, seg.v2, wMin);
    const b1 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u2, seg.v2, wMax);

    // Wireframe guides for readability.
    pushEdge(a0, b0);
    pushEdge(a1, b1);
    pushEdge(a0, a1);
    pushEdge(b0, b1);

    const baseIndex = fillPositions.length / 3;
    fillPositions.push(
      a0.x, a0.y, a0.z,
      a1.x, a1.y, a1.z,
      b1.x, b1.y, b1.z,
      b0.x, b0.y, b0.z
    );
    fillIndices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex, baseIndex + 2, baseIndex + 3
    );
  }

  const group = new Group();
  group.userData.vinculumId = object.id;

  if (fillPositions.length > 0 && fillIndices.length > 0) {
    const fillGeometry = new BufferGeometry();
    fillGeometry.setAttribute("position", new BufferAttribute(new Float32Array(fillPositions), 3));
    updateIndexAttributeUint32(fillGeometry, new Uint32Array(fillIndices));
    fillGeometry.computeVertexNormals();
    fillGeometry.computeBoundingSphere();
    const fillMaterial = new MeshBasicMaterial({
      color: object.color,
      transparent: true,
      opacity: theme === "dark" ? 0.18 : 0.2,
      side: DoubleSide
    });
    const fillMesh = new Mesh(fillGeometry, fillMaterial);
    fillMesh.userData.vinculumId = object.id;
    group.add(fillMesh);
  }

  if (edgePositions.length > 0) {
    const edgeGeometry = new BufferGeometry();
    edgeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(edgePositions), 3));
    edgeGeometry.computeBoundingSphere();
    const edgeMaterial = new LineBasicMaterial({
      color: object.color,
      transparent: true,
      opacity: theme === "dark" ? 0.92 : 0.88
    });
    const lines = new LineSegments(edgeGeometry, edgeMaterial);
    lines.userData.vinculumId = object.id;
    group.add(lines);
  }

  return group;
}

function buildParametric(object: ParametricCurveObject): Object3D | null {
  if (![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim())) {
    return null;
  }
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

  if (isDegenerateCurve(sampled.positions)) {
    const pointGeometry = new SphereGeometry(0.12, 14, 14);
    const pointMaterial = new MeshBasicMaterial({
      color: object.color,
      transparent: true,
      opacity: 0.96
    });
    const point = new Mesh(pointGeometry, pointMaterial);
    point.position.set(sampled.positions[0] ?? 0, sampled.positions[1] ?? 0, sampled.positions[2] ?? 0);
    point.userData.vinculumId = object.id;
    return point;
  }

  const material = new LineBasicMaterial({
    color: object.color,
    transparent: true,
    opacity: 0.95
  });

  const line = new Line(geometry, material);
  line.userData.vinculumId = object.id;
  return line;
}

function isDegenerateCurve(positions: Float32Array): boolean {
  if (positions.length < 6) {
    return false;
  }
  const x0 = positions[0] ?? 0;
  const y0 = positions[1] ?? 0;
  const z0 = positions[2] ?? 0;
  for (let i = 3; i < positions.length; i += 3) {
    const dx = (positions[i] ?? 0) - x0;
    const dy = (positions[i + 1] ?? 0) - y0;
    const dz = (positions[i + 2] ?? 0) - z0;
    if (Math.hypot(dx, dy, dz) > 1e-5) {
      return false;
    }
  }
  return true;
}

function buildPlane(object: PlaneGraphObject, theme: ResolvedTheme): Group | null {
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

function splitImplicitEquation(equation: string): { left: string; right: string } | null {
  const trimmed = equation.trim();
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex < 0) {
    return null;
  }
  if (trimmed.indexOf("=", eqIndex + 1) !== -1) {
    return null;
  }
  const left = trimmed.slice(0, eqIndex).trim() || "0";
  const right = trimmed.slice(eqIndex + 1).trim() || "0";
  const explicitAxisAssign = /^[xyz]\s*=/i.test(trimmed);
  if (explicitAxisAssign) {
    return null;
  }
  return { left, right };
}

function getUsedAxes(expression: string): ("x" | "y" | "z")[] {
  const matches = expression.match(/\b[xyz]\b/gi) ?? [];
  const set = new Set<"x" | "y" | "z">();
  for (const match of matches) {
    const axis = match.toLowerCase();
    if (axis === "x" || axis === "y" || axis === "z") {
      set.add(axis);
    }
  }
  return [...set];
}

function interpolateImplicitEdge(
  u1: number,
  v1: number,
  f1: number,
  u2: number,
  v2: number,
  f2: number
): { u: number; v: number } | null {
  if (!Number.isFinite(f1) || !Number.isFinite(f2)) {
    return null;
  }
  if (Math.abs(f1 - f2) < 1e-12) {
    return { u: (u1 + u2) * 0.5, v: (v1 + v2) * 0.5 };
  }
  const t = Math.min(1, Math.max(0, f1 / (f1 - f2)));
  return {
    u: u1 + (u2 - u1) * t,
    v: v1 + (v2 - v1) * t
  };
}

function mapMathToWorldFromAxes(
  uAxis: "x" | "y" | "z",
  vAxis: "x" | "y" | "z",
  fixedAxis: "x" | "y" | "z",
  u: number,
  v: number,
  fixedValue = 0
): { x: number; y: number; z: number } {
  const math = { x: 0, y: 0, z: 0 };
  math[uAxis] = u;
  math[vAxis] = v;
  math[fixedAxis] = fixedValue;
  // Math -> Three mapping used across renderer: world.x = math.x, world.y = math.z, world.z = math.y.
  return {
    x: math.x,
    y: math.z,
    z: math.y
  };
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
  return objects.some(
    (object) => object.visible && object.kind === "surface" && isGraphObjectRenderable3D(object)
  );
}
