import type { ParametricCurveObject } from "@vinculum/scene/types";
import {
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry
} from "three";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { createWideStroke } from "./graphWideStroke";
import { sampleCurve } from "@/lib/math/sampleCurve";

// Sample cap (8192 in MAX_PARAMETRIC_CURVE_SAMPLES) keeps every vertex index
// below 65536, so the compact Uint16 segment index below is always sufficient.
const MAX_CURVE_INDEX = 65536;

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

  // S5: render exactly the canonically connected segments — no chord through
  // invalid samples, no classified cross-pole segment. One instanced
  // wide-stroke draw with explicit segment pairs.
  const sampleCount = sampled.positions.length / 3;
  if (sampleCount > MAX_CURVE_INDEX) {
    return null;
  }
  const segmentIndex: number[] = [];
  for (let seg = 0; seg + 1 < sampleCount; seg += 1) {
    if (sampled.connectedSegments[seg] === 1) {
      segmentIndex.push(seg, seg + 1);
    }
  }
  if (segmentIndex.length === 0) {
    return null;
  }

  if (isDegenerateCurve(sampled.positions, sampled.validSamples)) {
    const pointGeometry = new SphereGeometry(0.12, 14, 14);
    const pointMaterial = new MeshBasicMaterial({
      color: object.color,
      transparent: true,
      opacity: 0.96
    });
    const point = new Mesh(pointGeometry, pointMaterial);
    const firstValid = findFirstValidSample(sampled.positions, sampled.validSamples);
    point.position.set(firstValid[0] ?? 0, firstValid[1] ?? 0, firstValid[2] ?? 0);
    point.userData.vinculumId = object.id;
    return point;
  }

  const segments = new Float32Array(segmentIndex.length * 3);
  segmentIndex.forEach((vertex, index) => segments.set(sampled.positions.subarray(vertex * 3, vertex * 3 + 3), index * 3));
  const lines = createWideStroke(segments, object.color);
  lines.userData.vinculumId = object.id;
  return lines;
}

function findFirstValidSample(positions: Float32Array, validSamples: Uint8Array): [number, number, number] {
  const sampleCount = positions.length / 3;
  for (let index = 0; index < sampleCount; index += 1) {
    if (validSamples[index] === 1) {
      return [positions[index * 3] ?? 0, positions[index * 3 + 1] ?? 0, positions[index * 3 + 2] ?? 0];
    }
  }
  return [positions[0] ?? 0, positions[1] ?? 0, positions[2] ?? 0];
}

function isDegenerateCurve(positions: Float32Array, validSamples: Uint8Array): boolean {
  const sampleCount = positions.length / 3;
  let firstValid = -1;
  for (let index = 0; index < sampleCount; index += 1) {
    if (validSamples[index] === 1) {
      firstValid = index;
      break;
    }
  }
  if (firstValid < 0) {
    return false;
  }
  const x0 = positions[firstValid * 3] ?? 0;
  const y0 = positions[firstValid * 3 + 1] ?? 0;
  const z0 = positions[firstValid * 3 + 2] ?? 0;
  for (let index = 0; index < sampleCount; index += 1) {
    if (validSamples[index] !== 1) {
      continue;
    }
    const dx = (positions[index * 3] ?? 0) - x0;
    const dy = (positions[index * 3 + 1] ?? 0) - y0;
    const dz = (positions[index * 3 + 2] ?? 0) - z0;
    if (Math.hypot(dx, dy, dz) > 1e-5) {
      return false;
    }
  }
  return true;
}
