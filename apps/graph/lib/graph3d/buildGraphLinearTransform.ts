// S28 3D linear-transformation node (PART 15/16/63): reference basis +
// unit cube (subtle) beneath transformed basis arrows + wireframe
// parallelepiped (object color, stronger). One canonical transform
// object → one shared node (S16 free); 2D transforms embed at z=0.
// Rank collapse is wireframe-safe (degenerate edges, guarded arrowheads
// — never NaN normals/quaternions). Picking: bounded proxies on the
// transformed arrows only, all mapped to the transform id; reference
// geometry never captures selection (PART 17/44).

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Object3D
} from "three";
import type { LinearTransformObject } from "@vinculum/scene/types";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { resolveLinearTransform, transformedBasis3 } from "@/lib/math/linearTransformResolve";
import type { Matrix3 } from "@/lib/math/matrix";
import {
  arrowProportions,
  buildArrowHead,
  makeInvisibleProxy,
  orientUnitY,
  placeArrowHead,
  placeProxyBetween,
  stampPrimitiveGroup
} from "./buildGraphGeometryPrimitives";

const REFERENCE_COLOR = "#64748b";
const CUBE_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];
// Corner order x-major (index = x*4 + y*2 + z), shared by both cubes.
const UNIT_CUBE_CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
  [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]
];

function toWorld(point: { x: number; y: number; z: number }): Vector3 {
  const world = mathToWorld3D(point);
  return new Vector3(world.x, world.y, world.z);
}

function toWorldDirection(vector: { x: number; y: number; z: number }): Vector3 {
  const world = mathVectorToWorld3D(vector);
  return new Vector3(world.x, world.y, world.z);
}

function buildCubeEdges(cornersWorld: Vector3[], color: string, opacity: number): LineSegments {
  const positions = new Float32Array(CUBE_EDGES.length * 2 * 3);
  CUBE_EDGES.forEach(([a, b], index) => {
    const start = cornersWorld[a] as Vector3;
    const end = cornersWorld[b] as Vector3;
    positions.set([start.x, start.y, start.z], index * 6);
    positions.set([end.x, end.y, end.z], index * 6 + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return new LineSegments(
    geometry,
    new LineBasicMaterial({ color: new Color(color), transparent: opacity < 1, opacity })
  );
}

/** Arrow from the origin along a world direction; null when degenerate. */
function buildOriginArrow(
  id: string,
  color: string,
  directionWorld: Vector3,
  length: number,
  shaftRadius: number,
  standardMaterial: boolean
): { shaft: Mesh; head: Mesh; tip: Vector3 } | null {
  if (!(length > 1e-9) || !Number.isFinite(length)) {
    return null;
  }
  const origin = new Vector3(0, 0, 0);
  const { headLength, headRadius } = arrowProportions(length);
  const shaftLength = Math.max(length - headLength, length * 0.2);
  const shaft = new Mesh(
    new CylinderGeometry(1, 1, 1, 10),
    standardMaterial
      ? new MeshStandardMaterial({ color: new Color(color), roughness: 0.55, metalness: 0.15 })
      : new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.55 })
  );
  shaft.userData.vinculumId = id;
  orientUnitY(shaft, origin, directionWorld, shaftLength, shaftRadius);
  const tip = origin.clone().addScaledVector(directionWorld.clone().normalize(), length);
  const head = buildArrowHead(id, color);
  if (!standardMaterial) {
    head.material = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.55 });
  }
  placeArrowHead(head, tip, directionWorld, headLength, headRadius);
  return { shaft, head, tip };
}

export function buildLinearTransform3D(object: LinearTransformObject): Object3D | null {
  return buildLinearTransformNode(object.id, object.color, object.dimension, getEditorParameterScope(), entriesOf(object));
}

function entriesOf(object: LinearTransformObject): Record<string, string> {
  if (object.dimension === "2d") {
    return { m11: object.m11, m12: object.m12, m21: object.m21, m22: object.m22 };
  }
  return {
    m11: object.m11, m12: object.m12, m13: object.m13,
    m21: object.m21, m22: object.m22, m23: object.m23,
    m31: object.m31, m32: object.m32, m33: object.m33
  };
}

/** Shared node builder: resolved entries + explicit params (test seam). */
export function buildLinearTransformNode(
  id: string,
  color: string,
  dimension: "2d" | "3d",
  params: Record<string, number>,
  entries: Record<string, string>
): Object3D | null {
  const resolved = resolveLinearTransform({ dimension, entries }, params);
  if (resolved.status !== "ok") {
    return null;
  }
  // Work in 3×3 throughout: 2D embeds at z=0 (PART 15 decision).
  const matrix: Matrix3 =
    resolved.dimension === 2
      ? [resolved.matrix[0], resolved.matrix[1], 0, resolved.matrix[2], resolved.matrix[3], 0, 0, 0, 1]
      : resolved.matrix;
  const group = new Group();
  stampPrimitiveGroup(group, id);

  // Reference unit cube + basis (subtle, never selectable). Basis
  // vectors map through the same math→world boundary as everything.
  const referenceCorners = UNIT_CUBE_CORNERS.map(([x, y, z]) => toWorld({ x, y, z }));
  const referenceEdges = buildCubeEdges(referenceCorners, REFERENCE_COLOR, 0.45);
  referenceEdges.userData.vinculumId = id;
  group.add(referenceEdges);
  const referenceBasisMath = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 }
  ];
  for (const mathDirection of referenceBasisMath) {
    const arrow = buildOriginArrow(id, REFERENCE_COLOR, toWorldDirection(mathDirection), 1, 0.02, false);
    if (arrow) {
      group.add(arrow.shaft, arrow.head);
    }
  }

  // Transformed basis arrows + wireframe parallelepiped (strong).
  const basis = transformedBasis3(matrix);
  basis.forEach((column) => {
    const directionWorld = toWorldDirection(column);
    const length = directionWorld.length();
    if (!(length > 1e-9) || !Number.isFinite(length)) {
      // Collapsed basis direction: contributes a degenerate point, never
      // a zero-length quaternion (PART 15 rank-collapse safety).
      return;
    }
    const arrow = buildOriginArrow(id, color, directionWorld, length, 0.045, true);
    if (!arrow) {
      return;
    }
    const proxy = makeInvisibleProxy(id);
    placeProxyBetween(proxy, new Vector3(0, 0, 0), arrow.tip);
    group.add(arrow.shaft, arrow.head, proxy);
  });

  // Parallelepiped corners: origin + combinations of transformed basis
  // tips (math frame, mapped once at the boundary).
  const mathTips = basis.map((column) => ({ x: column.x, y: column.y, z: column.z }));
  const cornersMath = UNIT_CUBE_CORNERS.map(([x, y, z]) => ({
    x: x * mathTips[0]!.x + y * mathTips[1]!.x + z * mathTips[2]!.x,
    y: x * mathTips[0]!.y + y * mathTips[1]!.y + z * mathTips[2]!.y,
    z: x * mathTips[0]!.z + y * mathTips[1]!.z + z * mathTips[2]!.z
  }));
  const transformedEdges = buildCubeEdges(cornersMath.map(toWorld), color, 1);
  transformedEdges.userData.vinculumId = id;
  group.add(transformedEdges);
  return group;
}
