import type { GraphObject } from "@vinculum/scene/types";
import { compileSurfaceExpression } from "../expressions/compileExpression";
import { compileParametricSurfaceExpressions } from "../expressions/compileParametricSurface";
import { computeImplicitSurfaceData } from "../surfaces/computeImplicitSurfaceData";
import { sampleSurface } from "../surfaces/sampleSurface";
import { sampleParametricSurface } from "../surfaces/sampleParametricSurface";
import { compilePlaneEquation, samplePlane } from "../surfaces/samplePlane";
import { worldToMath3D, type MathPoint3 } from "./coordinates";
import { getEffectiveSurfaceOrientation } from "../expressions/surfaceExpressionOrientation";
import { splitSingleMathEquality } from "../expressions/implicitEquation";
import { substituteFieldSymbols } from "../fields/polarFieldExpressions";
import { simplifyFieldExpression } from "../fields/fieldSolutions";

export type IntersectionSurface = Extract<GraphObject, { kind: "surface" | "parametricSurface" | "implicitSurface" | "plane" }>;
export interface SurfaceIntersectionResult {
  status: "curve" | "points" | "empty" | "overlap" | "unresolved";
  segments: Array<readonly [MathPoint3, MathPoint3]>;
  points: MathPoint3[];
  equations: [string, string];
  reducedEquation?: string;
  message: string;
}

type Vec = [number, number, number];
type Bounds = { min: Vec; max: Vec };
type Triangle = Bounds & { vertices: [Vec, Vec, Vec]; normal: Vec };
type Node = Bounds & { triangles?: Triangle[]; left?: Node; right?: Node };
type MeshData = { positions: Float32Array; indices: Uint16Array | Uint32Array };
const EPS = 1e-6;
const MAX_WORK = 250_000;
const MAX_SEGMENTS = 12_000;
const cache = new Map<string, SurfaceIntersectionResult>();

export function isIntersectionSurface(object: GraphObject): object is IntersectionSurface {
  return ["surface", "parametricSurface", "implicitSurface", "plane"].includes(object.kind);
}

export function surfaceSolutionEquation(object: IntersectionSurface, index = 1): string {
  if (object.kind === "parametricSurface") {
    const expressions = [object.xExpr,object.yExpr,object.zExpr].map(expr => expr.replace(/\bu\b/g, `u_${index}`).replace(/\bv\b/g, `v_${index}`));
    return `(x,y,z) = (${expressions.join(", ")})`;
  }
  if (object.kind === "surface") {
    const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(object.equation, object.orientation ?? "z");
    return `${effectiveOrientation} = ${body}`;
  }
  return object.equation.includes("=") ? object.equation : `${object.equation} = 0`;
}

/** Bounded mesh intersection over saved plot ranges. The inspector and 3D
 * overlay share this cache; appearances and camera motion do not resample. */
export function computeSurfaceIntersection(a: IntersectionSurface, b: IntersectionSurface, params: Record<string, number>): SurfaceIntersectionResult {
  const definition = (object: IntersectionSurface) => {
    const { id, color, visible, appearance, ...math } = object;
    return math;
  };
  const key = JSON.stringify([definition(a), definition(b), Object.entries(params).sort(([x], [y]) => x.localeCompare(y))]);
  const found = cache.get(key);
  if (found) { cache.delete(key); cache.set(key, found); return found; }
  const equations: [string, string] = [surfaceSolutionEquation(a,1), surfaceSolutionEquation(b,2)];
  let result: SurfaceIntersectionResult;
  try {
    result = intersectMeshes(sample(a, params), sample(b, params), equations);
    result.reducedEquation = reduceEquation(a,b,params) ?? undefined;
  } catch (error) {
    result = { status: "unresolved", segments: [], points: [], equations, message: error instanceof Error ? error.message : "Intersection could not be computed. Check the definitions and plot ranges." };
  }
  cache.set(key, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return result;
}

/** Substitute one explicit/parametric definition into the other equation.
 * This is an exact constraint reduction; it is not a closed-form solver. */
function reduceEquation(a: IntersectionSurface, b: IntersectionSurface, params: Record<string, number>, index = 1): string | null {
  if (a.kind === "parametricSurface" && b.kind === "parametricSurface") return null;
  if (b.kind === "parametricSurface" || a.kind === "implicitSurface" || a.kind === "plane") {
    if (b.kind === "surface" || b.kind === "parametricSurface") return reduceEquation(b,a,params,3-index);
    return null;
  }
  const coordinates: Record<string,string> = { x:"x",y:"y",z:"z" };
  if (a.kind === "parametricSurface") {
    Object.assign(coordinates,{x:a.xExpr,y:a.yExpr,z:a.zExpr});
  } else {
    const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(a.equation,a.orientation ?? "z");
    coordinates[effectiveOrientation]=body;
  }
  let residual: string;
  if (b.kind === "surface") {
    const { body,effectiveOrientation }=getEffectiveSurfaceOrientation(b.equation,b.orientation ?? "z");
    residual=`${effectiveOrientation} - (${body})`;
  } else {
    const equality=splitSingleMathEquality(b.equation);
    residual=equality ? `(${equality.lhs}) - (${equality.rhs})` : b.equation;
  }
  // Restrict optional symbolic work; numerical analysis still handles longer definitions.
  if (residual.length+Object.values(coordinates).join("").length > 256) return null;
  try {
    let expression=substituteFieldSymbols(residual,coordinates);
    if (a.kind === "parametricSurface") expression=substituteFieldSymbols(expression,{u:`u_${index}`,v:`v_${index}`});
    const reduced=simplifyFieldExpression(expression,["x","y","z","u_1","v_1","u_2","v_2"],params) ?? expression;
    return `${reduced} = 0`;
  } catch { return null; }
}

function sample(object: IntersectionSurface, params: Record<string, number>): MeshData {
  if (object.kind === "surface") {
    const compiled = compileSurfaceExpression(object.equation, object.orientation ?? "z", params);
    if (compiled.error) throw new Error(compiled.error);
    return sampleSurface(compiled.evaluator, { domain: object.domain, resolution: Math.min(object.resolution, 40), orientation: compiled.effectiveOrientation, clampHeight: Number.MAX_VALUE });
  }
  if (object.kind === "parametricSurface") {
    const compiled = compileParametricSurfaceExpressions(object.xExpr, object.yExpr, object.zExpr, params);
    if (compiled.error) throw new Error(compiled.error);
    return sampleParametricSurface(compiled.evaluator, { domain: object.domain, resolution: Math.min(object.resolution, 40), clampCoordinate: Number.MAX_VALUE });
  }
  if (object.kind === "implicitSurface") {
    const result = computeImplicitSurfaceData({ equation: object.equation, domain: object.domain, resolution: Math.min(object.resolution, 20), params });
    if (result.status === "error") throw new Error(result.error);
    if (result.status === "budget-exceeded") throw new Error("Intersection exceeded the sampling budget. Reduce the plot ranges.");
    return result.status === "ok" ? result : { positions: new Float32Array(), indices: new Uint16Array() };
  }
  const compiled = compilePlaneEquation(object.equation, params);
  if (!compiled.coefficients) throw new Error(compiled.error ?? "Check the plane equation.");
  const mesh = samplePlane(compiled.coefficients, object.size);
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = mesh.positions[i]; positions[i + 1] = mesh.positions[i + 2]; positions[i + 2] = mesh.positions[i + 1];
  }
  return { positions, indices: mesh.indices };
}

const sub = (a: Vec, b: Vec): Vec => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: Vec, b: Vec) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const length = (a: Vec) => Math.hypot(...a);
const mix = (a: Vec, b: Vec, t: number): Vec => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const point = (v: Vec): MathPoint3 => worldToMath3D({ x: v[0], y: v[1], z: v[2] });
const pointKey = (p: MathPoint3) => [p.x,p.y,p.z].map(v => Math.round(v / EPS)).join(",");
function bounds(vertices: Vec[]): Bounds {
  return { min: [0,1,2].map(i => Math.min(...vertices.map(v => v[i]))) as Vec, max: [0,1,2].map(i => Math.max(...vertices.map(v => v[i]))) as Vec };
}
function overlaps(a: Bounds, b: Bounds): boolean {
  return [0,1,2].every(i => a.max[i]+EPS >= b.min[i] && b.max[i]+EPS >= a.min[i]);
}
function triangles(mesh: MeshData): Triangle[] {
  const output: Triangle[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const vertices = [0,1,2].map(k => Array.from(mesh.positions.subarray(mesh.indices[i+k]*3, mesh.indices[i+k]*3+3)) as Vec) as [Vec,Vec,Vec];
    if (!vertices.flat().every(Number.isFinite)) continue;
    const normal = cross(sub(vertices[1],vertices[0]), sub(vertices[2],vertices[0]));
    const size = length(normal);
    if (size < 1e-12) continue;
    output.push({ vertices, normal: normal.map(v => v / size) as Vec, ...bounds(vertices) });
  }
  return output;
}
function tree(items: Triangle[]): Node | null {
  if (!items.length) return null;
  const box: Bounds = {
    min: [0,1,2].map(i => items.reduce((v,t) => Math.min(v,t.min[i]), Infinity)) as Vec,
    max: [0,1,2].map(i => items.reduce((v,t) => Math.max(v,t.max[i]), -Infinity)) as Vec
  };
  if (items.length <= 8) return { ...box, triangles: items };
  const axis = [0,1,2].sort((i,j) => (box.max[j]-box.min[j])-(box.max[i]-box.min[i]))[0];
  items.sort((a,b) => (a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));
  const middle = Math.floor(items.length/2);
  return { ...box, left: tree(items.slice(0,middle))!, right: tree(items.slice(middle))! };
}
function slice(triangle: Triangle, plane: Triangle): Vec[] {
  const distances = triangle.vertices.map(v => dot(plane.normal, sub(v,plane.vertices[0])));
  const hits: Vec[] = [];
  const append = (v: Vec) => { if (!hits.some(p => length(sub(p,v)) < EPS)) hits.push(v); };
  for (let i=0;i<3;i++) {
    const j=(i+1)%3;
    if (Math.abs(distances[i]) <= EPS) append(triangle.vertices[i]);
    if (distances[i]*distances[j] < 0) append(mix(triangle.vertices[i],triangle.vertices[j],distances[i]/(distances[i]-distances[j])));
  }
  return hits;
}

/** Coordinate-plane slices reuse the same triangle/plane intersection kernel. Mesh is world-frame. */
export function sliceSurfaceMesh(mesh: MeshData, horizontal: "x" | "y" | "z", vertical: "x" | "y" | "z") {
  const fixed = horizontal !== "x" && vertical !== "x" ? "x" : horizontal !== "y" && vertical !== "y" ? "y" : "z";
  const axis = fixed === "x" ? 0 : fixed === "y" ? 1 : 2;
  const hi = horizontal === "x" ? 0 : horizontal === "y" ? 1 : 2;
  const vi = vertical === "x" ? 0 : vertical === "y" ? 1 : 2;
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < positions.length; i += 3) { positions[i] = mesh.positions[i]; positions[i + 1] = mesh.positions[i + 2]; positions[i + 2] = mesh.positions[i + 1]; }
  const plane: Triangle = { vertices: [[0,0,0], [0,0,0], [0,0,0]], normal: [0,0,0], min: [0,0,0], max: [0,0,0] };
  plane.normal[axis] = 1;
  const points: number[] = [], areaPoints: number[] = [], areaIndices: number[] = [];
  const contacts = new Map<string, { x: number; y: number }>();
  const connected = new Set<string>();
  for (const triangle of triangles({ positions, indices: mesh.indices })) {
    if (triangle.vertices.every(vertex => Math.abs(vertex[axis]) <= EPS)) {
      const start = areaPoints.length / 2;
      triangle.vertices.forEach(vertex => { areaPoints.push(vertex[hi], vertex[vi]); connected.add(pointKey(point(vertex))); });
      const [a,b,c] = triangle.vertices;
      const winding = (b[hi]-a[hi])*(c[vi]-a[vi])-(b[vi]-a[vi])*(c[hi]-a[hi]);
      areaIndices.push(start, start + (winding < 0 ? 2 : 1), start + (winding < 0 ? 1 : 2));
      continue;
    }
    const hits = slice(triangle, plane);
    if (hits.length >= 2) {
      points.push(hits[0][hi], hits[0][vi], hits[1][hi], hits[1][vi]);
      hits.forEach(vertex => connected.add(pointKey(point(vertex))));
    }
    else if (hits.length === 1) contacts.set(pointKey(point(hits[0])), { x: hits[0][hi], y: hits[0][vi] });
  }
  const connectedSegments = new Uint8Array(Math.max(0, points.length / 2 - 1));
  for (let i = 0; i < connectedSegments.length; i += 2) connectedSegments[i] = 1;
  return { points: new Float64Array(points), connectedSegments, areaPoints: new Float64Array(areaPoints), areaIndices: new Uint32Array(areaIndices), contacts: [...contacts.entries()].filter(([key]) => !connected.has(key)).map(([,value]) => value) };
}
/** Strict separating-axis test distinguishes shared area from coplanar
 * triangles that merely share an edge, which is not a surface overlap. */
function coplanarArea(a: Triangle, b: Triangle): boolean {
  return [a,b].every(t => t.vertices.every((v,i) => {
    const axis = cross(t.normal,sub(t.vertices[(i+1)%3],v));
    const size = length(axis);
    if (size < EPS) return true;
    const pa=a.vertices.map(p => dot(p,axis)/size), pb=b.vertices.map(p => dot(p,axis)/size);
    return Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb)) > EPS;
  }));
}
/** Clip one coplanar triangle by the other's half planes. Degenerate
 * polygons retain the shared edge or vertex instead of losing contact. */
function coplanarContacts(a: Triangle, b: Triangle): Vec[] {
  let polygon: Vec[] = [...a.vertices];
  for (let i = 0; i < 3 && polygon.length; i++) {
    const origin = b.vertices[i];
    const axis = cross(b.normal, sub(b.vertices[(i + 1) % 3], origin));
    const magnitude = length(axis);
    const distance = (p: Vec) => dot(sub(p, origin), axis) / magnitude;
    const output: Vec[] = [];
    let previous = polygon[polygon.length - 1], previousDistance = distance(previous);
    for (const current of polygon) {
      const currentDistance = distance(current);
      if ((previousDistance >= -EPS) !== (currentDistance >= -EPS)) {
        output.push(mix(previous, current, Math.max(0, Math.min(1, previousDistance / (previousDistance - currentDistance)))));
      }
      if (currentDistance >= -EPS) output.push(current);
      previous = current; previousDistance = currentDistance;
    }
    polygon = output;
  }
  return polygon;
}
function intersectMeshes(a: MeshData, b: MeshData, equations: [string,string]): SurfaceIntersectionResult {
  const segments: SurfaceIntersectionResult["segments"] = [], points: MathPoint3[] = [];
  const segmentKeys = new Set<string>(), pointKeys = new Set<string>();
  const root=tree(triangles(b));
  let work=0, sharedArea=false;
  const addPoint=(v: Vec) => { const p=point(v), key=pointKey(p); if (!pointKeys.has(key)) { pointKeys.add(key); points.push(p); } };
  const addSegment = (first: Vec, last: Vec) => {
    const p = point(first), q = point(last), key = [pointKey(p), pointKey(q)].sort().join(";");
    if (!segmentKeys.has(key)) { segmentKeys.add(key); segments.push([p, q]); }
  };
  const visit=(a: Triangle,node: Node): void => {
    if (++work > MAX_WORK || segments.length > MAX_SEGMENTS || points.length > MAX_SEGMENTS) throw new Error("Intersection exceeded the computation budget. Reduce the plot ranges or simplify the surfaces.");
    if (!overlaps(a,node)) return;
    if (!node.triangles) { visit(a,node.left!); visit(a,node.right!); return; }
    for (const b of node.triangles) {
      if (++work > MAX_WORK) throw new Error("Intersection exceeded the computation budget. Reduce the plot ranges or simplify the surfaces.");
      if (!overlaps(a,b)) continue;
      const direction=cross(a.normal,b.normal), size=length(direction);
      if (size < 1e-8) {
        if (Math.abs(dot(a.normal,sub(b.vertices[0],a.vertices[0]))) < EPS) {
          if (coplanarArea(a,b)) { sharedArea = true; continue; }
          const contacts = coplanarContacts(a, b);
          if (contacts.length) {
            let first = contacts[0], last = first, longest = 0;
            for (const p of contacts) for (const q of contacts) {
              const distance = length(sub(p, q));
              if (distance > longest) { longest = distance; first = p; last = q; }
            }
            if (longest > EPS) addSegment(first, last); else addPoint(first);
          }
        }
        continue;
      }
      const sa=slice(a,b), sb=slice(b,a);
      if (!sa.length || !sb.length) continue;
      const axis=direction.map(v => v/size) as Vec;
      sa.sort((p,q) => dot(p,axis)-dot(q,axis)); sb.sort((p,q) => dot(p,axis)-dot(q,axis));
      const lo=Math.max(dot(sa[0],axis),dot(sb[0],axis)), hi=Math.min(dot(sa[sa.length-1],axis),dot(sb[sb.length-1],axis));
      if (hi < lo-EPS) continue;
      const origin=sa[0], end=sa[sa.length-1], span=dot(sub(end,origin),axis);
      if (span < EPS) { addPoint(origin); continue; }
      if (hi-lo < EPS) { addPoint(mix(origin,end,(lo-dot(origin,axis))/span)); continue; }
      addSegment(mix(origin,end,(lo-dot(origin,axis))/span), mix(origin,end,(hi-dot(origin,axis))/span));
    }
  };
  if (root) for (const t of triangles(a)) visit(t,root);
  const status=sharedArea ? "overlap" : segments.length ? "curve" : points.length ? "points" : "empty";
  return { status, segments: sharedArea ? [] : segments, points: sharedArea ? [] : points,
    equations, message: sharedArea ? "The sampled surfaces share an area; there is no unique intersection curve." : status === "empty" ? "No intersection found in the sampled plot ranges. Small or tangent intersections may be missed; adjust the ranges." : "Approximate solution within the saved plot ranges. Curves and contact points are computed from sampled surfaces." };
}
