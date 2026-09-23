import { mathToWorld3D } from "./coordinates";
import type { ImplicitSurfaceEvaluator } from "./compileImplicitSurface";
import {
  gridVertexIndex,
  gridVertexMathPosition,
  type SampledImplicitField
} from "./sampleImplicitField";

// Marching-tetrahedra zero-level-set extraction (S18).
//
// ALGORITHM: each grid cube is split into 6 tetrahedra around the main
// diagonal (local corners c0-c6). This decomposition is globally conforming:
// every cube face uses the diagonal from its local min corner to its local
// max corner, and the adjacent cube across that face uses the same world
// diagonal (verified per axis + empirical crack tests). Interior 2-vs-2 quad
// diagonals never cross cell boundaries, so no cross-cell ambiguity exists.
// There is no 256-case table; each tet resolves by inside/outside counts.
//
// Cube corner order (offsets from the cube base):
//   c0=(0,0,0) c1=(1,0,0) c2=(1,1,0) c3=(0,1,0)
//   c4=(0,0,1) c5=(1,0,1) c6=(1,1,1) c7=(0,1,1)
// Tetrahedra (all share the c0-c6 body diagonal):
//   [0,1,2,6] [0,2,3,6] [0,3,7,6] [0,7,4,6] [0,4,5,6] [0,5,1,6]
//
// Classification: inside = value < 0 (strict); exact zero counts as outside
// so grid-aligned planes interpolate deterministically through exact grid
// vertices. Winding targets outward normals (toward increasing F); the
// math->world reflection (det -1) is compensated at emission and proven by
// outward-normal tests.

export interface ExtractImplicitSurfaceOptions {
  field: SampledImplicitField;
  evaluate: ImplicitSurfaceEvaluator;
  /** Extra bisection witness on crossing edges for finite-pole rejection. */
  witnessBisections?: number;
  /** Hard output cap; extraction aborts cleanly past it. */
  maxTriangles?: number;
}

export interface ExtractedImplicitSurface {
  /** WORLD-frame finite positions (mathToWorld3D applied at emission). */
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
  triangleCount: number;
  status: "ok" | "empty" | "budget-exceeded";
}

export const IMPLICIT_WITNESS_BISECTIONS = 3;
// Calibrated in PART 44 measurements (gyroid at max resolution); aborts with
// status budget-exceeded instead of unbounded array growth.
export const MAX_IMPLICIT_SURFACE_TRIANGLES = 750_000;

const CUBE_CORNER_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1]
];

const CUBE_TETRAHEDRA: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
  [0, 5, 1, 6]
];

interface MathPoint {
  x: number;
  y: number;
  z: number;
}

export function extractImplicitSurfaceMesh(options: ExtractImplicitSurfaceOptions): ExtractedImplicitSurface {
  const { field } = options;
  const witnessBisections = options.witnessBisections ?? IMPLICIT_WITNESS_BISECTIONS;
  const maxTriangles = options.maxTriangles ?? MAX_IMPLICIT_SURFACE_TRIANGLES;
  const { stride, resolution } = field;
  const gridVertexCount = stride * stride * stride;

  const extractor = new TetraExtractor(field, options.evaluate, witnessBisections);

  for (let iz = 0; iz < resolution; iz += 1) {
    for (let iy = 0; iy < resolution; iy += 1) {
      for (let ix = 0; ix < resolution; ix += 1) {
        extractor.extractCube(ix, iy, iz);
        // Bounded waste: abort as soon as the cap is crossed (checked per
        // cube, so overshoot stays under one cube of output).
        if (extractor.triangleCount > maxTriangles) {
          return {
            positions: new Float32Array(0),
            indices: new Uint16Array(0),
            vertexCount: 0,
            triangleCount: extractor.triangleCount,
            status: "budget-exceeded"
          };
        }
      }
    }
  }

  const { positions, indices, vertexCount, triangleCount } = extractor.finish();
  if (triangleCount === 0) {
    return { positions: new Float32Array(0), indices: new Uint16Array(0), vertexCount: 0, triangleCount: 0, status: "empty" };
  }
  return { positions, indices, vertexCount, triangleCount, status: "ok" };
}

class TetraExtractor {
  triangleCount = 0;
  private readonly worldPositions: number[] = [];
  private readonly indices: number[] = [];
  private readonly edgeVertexCache = new Map<number, number>();
  private readonly gridVertexCache = new Map<number, number>();
  // Witness verdicts are deterministic per grid edge (field values are
  // fixed), so memoize them: a shared edge incident to up to 6 tets would
  // otherwise pay the bisection evaluations up to 6 times.
  private readonly witnessCache = new Map<number, boolean>();
  private readonly gridVertexCount: number;

  constructor(
    private readonly field: SampledImplicitField,
    private readonly evaluate: ImplicitSurfaceEvaluator,
    private readonly witnessBisections: number
  ) {
    const { stride } = field;
    this.gridVertexCount = stride * stride * stride;
  }

  extractCube(ix: number, iy: number, iz: number): void {
    const { stride } = this.field;
    const corners = CUBE_CORNER_OFFSETS.map(([dx, dy, dz]) =>
      gridVertexIndex(stride, ix + dx, iy + dy, iz + dz)
    );
    for (const tetra of CUBE_TETRAHEDRA) {
      this.extractTetrahedron([
        corners[tetra[0]] ?? -1,
        corners[tetra[1]] ?? -1,
        corners[tetra[2]] ?? -1,
        corners[tetra[3]] ?? -1
      ]);
    }
  }

  private extractTetrahedron(corners: [number, number, number, number]): void {
    const { values, valid } = this.field;
    // Mandatory invalid-region safety: a tet touching any invalid sample
    // emits nothing, so triangles can never bridge through non-finite
    // domain points. The cost is a one-cell gap around singular loci.
    for (const corner of corners) {
      if (corner < 0 || valid[corner] !== 1) {
        return;
      }
    }
    const inside = corners.map((corner) => (values[corner] ?? Number.NaN) < 0);
    const insideCorners: number[] = [];
    const outsideCorners: number[] = [];
    for (let k = 0; k < 4; k += 1) {
      if (inside[k]) {
        insideCorners.push(corners[k] ?? -1);
      } else {
        outsideCorners.push(corners[k] ?? -1);
      }
    }

    if (insideCorners.length === 0 || insideCorners.length === 4) {
      return;
    }
    // Outside reference point: average of outside corners in math coords.
    // Every emitted triangle is oriented so its normal points toward this
    // point (outward, toward increasing F).
    const outsidePoint = averageMathPositions(outsideCorners.map((corner) => this.mathPosition(corner)));

    if (insideCorners.length === 1) {
      const apex = insideCorners[0] ?? -1;
      const p0 = this.edgeVertex(apex, outsideCorners[0] ?? -1);
      const p1 = this.edgeVertex(apex, outsideCorners[1] ?? -1);
      const p2 = this.edgeVertex(apex, outsideCorners[2] ?? -1);
      this.emitTriangle(p0, p1, p2, outsidePoint);
      return;
    }
    if (insideCorners.length === 3) {
      const apex = outsideCorners[0] ?? -1;
      const p0 = this.edgeVertex(apex, insideCorners[0] ?? -1);
      const p1 = this.edgeVertex(apex, insideCorners[1] ?? -1);
      const p2 = this.edgeVertex(apex, insideCorners[2] ?? -1);
      this.emitTriangle(p0, p1, p2, outsidePoint);
      return;
    }
    // 2 vs 2: quad (e_ik, e_il, e_jl, e_jk) split along its interior
    // diagonal. The diagonal never crosses a cell boundary, so the split
    // choice cannot crack neighboring cells.
    const i = insideCorners[0] ?? -1;
    const j = insideCorners[1] ?? -1;
    const k = outsideCorners[0] ?? -1;
    const l = outsideCorners[1] ?? -1;
    const q0 = this.edgeVertex(i, k);
    const q1 = this.edgeVertex(i, l);
    const q2 = this.edgeVertex(j, l);
    const q3 = this.edgeVertex(j, k);
    this.emitTriangle(q0, q1, q2, outsidePoint);
    this.emitTriangle(q0, q2, q3, outsidePoint);
  }

  private mathPosition(gridIndex: number): MathPoint {
    return gridVertexMathPosition(this.field, gridIndex);
  }

  // Canonical shared intersection vertex for grid edge (a, b), or null when
  // no vertex may be produced (invalid endpoints, same-side signs, or a
  // finite-pole witness rejection). Deterministic in the endpoint values, so
  // every tet sharing the edge resolves identically.
  private edgeVertex(a: number, b: number): number | null {
    if (a < 0 || b < 0) {
      return null;
    }
    const { values, valid } = this.field;
    if (valid[a] !== 1 || valid[b] !== 1) {
      return null;
    }
    const fa = values[a] ?? Number.NaN;
    const fb = values[b] ?? Number.NaN;
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
      return null;
    }
    const aInside = fa < 0;
    const bInside = fb < 0;
    if (aInside === bInside) {
      return null;
    }
    // Exact grid landing: reuse one vertex per grid point so incident edges
    // never duplicate the same point (grid-aligned planes stay clean).
    if (fa === 0) {
      return this.gridVertex(a);
    }
    if (fb === 0) {
      return this.gridVertex(b);
    }
    if (!this.witnessAllowsCrossingCached(a, b, fa, fb)) {
      return null;
    }
    const denominator = fa - fb;
    // Linear zero-crossing t = fa / (fa - fb), same formula as
    // `interpolateImplicitEdge` (lib/graph3d/implicitEquationParse.ts) and
    // the 2D canvas `interpolateZeroCrossing`. Kept local because the
    // extractor additionally needs the endpoint-grid-reuse and witness
    // decisions around it; do not deduplicate into a shared helper that
    // would couple the 3D mesher to the legacy 2D contour path.
    let t: number;
    if (Math.abs(denominator) < 1e-12) {
      t = 0.5;
    } else {
      t = fa / denominator;
      if (!(t > 0) || !(t < 1)) {
        t = Math.min(1, Math.max(0, t));
      }
    }
    const key = canonicalEdgeKey(a, b, this.gridVertexCount);
    const cached = this.edgeVertexCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const pa = this.mathPosition(a);
    const pb = this.mathPosition(b);
    const world = mathToWorld3D({
      x: pa.x + (pb.x - pa.x) * t,
      y: pa.y + (pb.y - pa.y) * t,
      z: pa.z + (pb.z - pa.z) * t
    });
    const vertexIndex = this.worldPositions.length / 3;
    this.worldPositions.push(world.x, world.y, world.z);
    this.edgeVertexCache.set(key, vertexIndex);
    return vertexIndex;
  }

  private gridVertex(gridIndex: number): number {
    const cached = this.gridVertexCache.get(gridIndex);
    if (cached !== undefined) {
      return cached;
    }
    const math = this.mathPosition(gridIndex);
    const world = mathToWorld3D(math);
    const vertexIndex = this.worldPositions.length / 3;
    this.worldPositions.push(world.x, world.y, world.z);
    this.gridVertexCache.set(gridIndex, vertexIndex);
    return vertexIndex;
  }

  private witnessAllowsCrossingCached(a: number, b: number, fa: number, fb: number): boolean {
    const key = canonicalEdgeKey(a, b, this.gridVertexCount);
    const cached = this.witnessCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const allowed = this.witnessAllowsCrossing(a, b, fa, fb);
    this.witnessCache.set(key, allowed);
    return allowed;
  }

  // Finite-pole witness: refine the sign-changing edge by bisection. A
  // continuous root converges (bracket magnitudes shrink toward 0); a pole
  // keeps both bracket ends large or hits non-finite values. The bar is the
  // SMALLER original endpoint magnitude: a genuine root always improves on
  // it within a few bisections, while a straddled pole cannot (one side
  // stays huge). Bounded extra evaluations only (<= witnessBisections per
  // crossing edge). Characterized on linear/steep/cubic roots, sphere and
  // gyroid crossings (all kept) vs shifted reciprocal poles (all rejected).
  private witnessAllowsCrossing(a: number, b: number, fa: number, fb: number): boolean {
    const pa = this.mathPosition(a);
    const pb = this.mathPosition(b);
    let left = 0;
    let right = 1;
    let leftValue = fa;
    let rightValue = fb;
    const originalMin = Math.min(Math.abs(fa), Math.abs(fb));
    for (let step = 0; step < this.witnessBisections; step += 1) {
      const mid = (left + right) / 2;
      const midValue = this.evaluate(
        pa.x + (pb.x - pa.x) * mid,
        pa.y + (pb.y - pa.y) * mid,
        pa.z + (pb.z - pa.z) * mid
      );
      if (!Number.isFinite(midValue)) {
        return false;
      }
      if ((midValue < 0) === (leftValue < 0)) {
        left = mid;
        leftValue = midValue;
      } else {
        right = mid;
        rightValue = midValue;
      }
    }
    // After refinement the bracket must improve on the better original
    // endpoint; otherwise the "crossing" is a pole straddle, not a root.
    return Math.min(Math.abs(leftValue), Math.abs(rightValue)) <= originalMin;
  }

  // Orient the triangle so its WORLD normal points toward the world-mapped
  // outside point (outward, toward increasing F). Testing in world coords
  // against a world point is self-consistent: the math->world map is a
  // coordinate permutation, so inside/outside membership is preserved and
  // no reflection reasoning is needed — the conditional swap below absorbs
  // the det -1 flip automatically (S17 encountered the same flip; here the
  // orientation test, not a fixed index order, carries the correction).
  // Proven by outward-normal tests on sphere/torus/ellipsoid.
  private emitTriangle(
    p0: number | null,
    p1: number | null,
    p2: number | null,
    outsidePoint: MathPoint
  ): void {
    if (p0 === null || p1 === null || p2 === null) {
      return;
    }
    // Degenerate triangles (two edges landing on one shared grid vertex via
    // exact-zero reuse) cover no area and contribute nothing to normals, so
    // they are skipped rather than emitted. Skipping cannot open holes.
    if (p0 === p1 || p1 === p2 || p0 === p2) {
      return;
    }
    const a = this.worldVertex(p0);
    const b = this.worldVertex(p1);
    const c = this.worldVertex(p2);
    const worldOutside = mathToWorld3D(outsidePoint);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const dot = nx * (worldOutside.x - cx) + ny * (worldOutside.y - cy) + nz * (worldOutside.z - cz);
    // Tie-break is deterministic: dot == 0 (outside point coplanar with the
    // triangle, measure-zero) takes the swapped branch. Either choice is
    // geometrically equivalent there.
    if (dot > 0) {
      this.indices.push(p0, p1, p2);
    } else {
      this.indices.push(p0, p2, p1);
    }
    this.triangleCount += 1;
  }

  private worldVertex(vertexIndex: number): MathPoint {
    return {
      x: this.worldPositions[vertexIndex * 3] ?? 0,
      y: this.worldPositions[vertexIndex * 3 + 1] ?? 0,
      z: this.worldPositions[vertexIndex * 3 + 2] ?? 0
    };
  }

  finish(): {
    positions: Float32Array;
    indices: Uint16Array | Uint32Array;
    vertexCount: number;
    triangleCount: number;
  } {
    const vertexCount = this.worldPositions.length / 3;
    const positions = new Float32Array(this.worldPositions);
    const indices =
      vertexCount <= 65535 ? new Uint16Array(this.indices) : new Uint32Array(this.indices);
    return { positions, indices, vertexCount, triangleCount: this.triangleCount };
  }
}

function averageMathPositions(points: MathPoint[]): MathPoint {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
    z += point.z;
  }
  const count = Math.max(1, points.length);
  return { x: x / count, y: y / count, z: z / count };
}

// Numeric pair key min * vertexCount + max. Safe: vertexCount <= 49^3 =
// 117649, so keys stay below ~1.4e10 << Number.MAX_SAFE_INTEGER. No string
// keys on the hot path.
function canonicalEdgeKey(a: number, b: number, gridVertexCount: number): number {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return min * gridVertexCount + max;
}
