import type { ParametricCurveObject } from "@vinculum/scene/types";
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry
} from "three";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";

export function buildParametric(object: ParametricCurveObject): Object3D | null {
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
