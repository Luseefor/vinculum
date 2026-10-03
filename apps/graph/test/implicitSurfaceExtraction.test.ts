import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import {
  MAX_IMPLICIT_SURFACE_RESOLUTION,
  MIN_IMPLICIT_SURFACE_RESOLUTION
} from "@vinculum/scene/defaults";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { computeIndexedBoundingSphereData } from "@/lib/math/indexedBounds";
import {
  extractImplicitSurfaceMesh,
  MAX_IMPLICIT_SURFACE_TRIANGLES
} from "@/lib/math/marchingTetrahedra";
import {
  gridVertexIndex,
  sampleImplicitScalarField,
  type SampledImplicitField
} from "@/lib/math/sampleImplicitField";

interface BoxDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

const SPHERE_BOX: BoxDomain = { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 };

function extract(
  equation: string,
  domain: BoxDomain,
  resolution: number,
  options: { witnessBisections?: number; maxTriangles?: number } = {}
) {
  const compiled = compileImplicitSurfaceExpression(equation, {});
  if (compiled.error) {
    throw new Error(`Unexpected compile error: ${compiled.error}`);
  }
  const field = sampleImplicitScalarField(compiled.evaluator, { domain, resolution });
  const mesh = extractImplicitSurfaceMesh({ field, evaluate: compiled.evaluator, ...options });
  return { compiled, field, mesh };
}

function mathPositionsOf(mesh: { positions: Float32Array }): Array<[number, number, number]> {
  // World frame is (x, z, y): map back to math for residual checks.
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const wx = mesh.positions[i] ?? 0;
    const wy = mesh.positions[i + 1] ?? 0;
    const wz = mesh.positions[i + 2] ?? 0;
    points.push([wx, wz, wy]);
  }
  return points;
}

function referencedVertices(indices: Uint16Array | Uint32Array | number[]): Set<number> {
  const referenced = new Set<number>();
  for (let i = 0; i < indices.length; i += 1) {
    referenced.add(indices[i] ?? -1);
  }
  return referenced;
}

function computeNormals(positions: Float32Array, indices: Uint16Array | Uint32Array): Float32Array {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return (geometry.getAttribute("normal") as BufferAttribute).array as Float32Array;
}

// Incidence-1 mesh edges strictly inside the domain (boundary-clipped edges
// hug the box). Any interior incidence-1 edge is a crack defect.
function countInteriorCracks(
  indices: Uint16Array | Uint32Array,
  positions: Float32Array,
  domain: BoxDomain,
  resolution: number
): number {
  const vertexCount = positions.length / 3;
  const edgeCount = new Map<number, number>();
  const keyOf = (a: number, b: number) => Math.min(a, b) * (vertexCount + 1) + Math.max(a, b);
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t] ?? -1, indices[t + 1] ?? -1, indices[t + 2] ?? -1];
    const pairs: Array<[number, number]> = [
      [tri[0], tri[1]],
      [tri[1], tri[2]],
      [tri[2], tri[0]]
    ];
    for (const [a, b] of pairs) {
      const key = keyOf(a, b);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }
  const margin = 1.5;
  const cellX = ((domain.xMax - domain.xMin) / resolution) * margin + 1e-9;
  const cellY = ((domain.yMax - domain.yMin) / resolution) * margin + 1e-9;
  const cellZ = ((domain.zMax - domain.zMin) / resolution) * margin + 1e-9;
  const nearBoundary = (vi: number): boolean => {
    // World frame (x, z, y): world x = math x, world y = math z, world z = math y.
    const px = positions[vi * 3] ?? 0;
    const py = positions[vi * 3 + 1] ?? 0;
    const pz = positions[vi * 3 + 2] ?? 0;
    return (
      px - domain.xMin < cellX ||
      domain.xMax - px < cellX ||
      pz - domain.yMin < cellY ||
      domain.yMax - pz < cellY ||
      py - domain.zMin < cellZ ||
      domain.zMax - py < cellZ
    );
  };
  let cracks = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t] ?? -1, indices[t + 1] ?? -1, indices[t + 2] ?? -1];
    const pairs: Array<[number, number]> = [
      [tri[0], tri[1]],
      [tri[1], tri[2]],
      [tri[2], tri[0]]
    ];
    for (const [a, b] of pairs) {
      if (edgeCount.get(keyOf(a, b)) === 1 && !nearBoundary(a) && !nearBoundary(b)) {
        cracks += 1;
      }
    }
  }
  return cracks;
}

describe("sampleImplicitScalarField", () => {
  it("samples a (resolution+1)^3 grid with x-fastest documented indexing", () => {
    const { field } = extract("x + y + z", SPHERE_BOX, 8);
    expect(field.stride).toBe(9);
    expect(field.values.length).toBe(9 * 9 * 9);
    expect(field.valid.length).toBe(9 * 9 * 9);
    expect(gridVertexIndex(9, 0, 0, 0)).toBe(0);
    expect(gridVertexIndex(9, 8, 0, 0)).toBe(8);
    expect(gridVertexIndex(9, 0, 1, 0)).toBe(9);
    expect(gridVertexIndex(9, 0, 0, 1)).toBe(81);
  });

  it("maps domain corners to exact field values", () => {
    const { field } = extract("x + 2 * y + 3 * z - 1", SPHERE_BOX, 4);
    // Corner (xMin, yMin, zMin) = index 0.
    expect(field.values[0]).toBeCloseTo(-1.5 + 2 * -1.5 + 3 * -1.5 - 1, 9);
    expect(field.valid[0]).toBe(1);
    // Corner (xMax, yMax, zMax) = last index.
    const last = field.values.length - 1;
    expect(field.values[last]).toBeCloseTo(1.5 + 2 * 1.5 + 3 * 1.5 - 1, 9);
  });

  it("evaluates every sample exactly once per extraction", () => {
    const compiled = compileImplicitSurfaceExpression("x^2 + y^2 + z^2 - 1", {});
    if (compiled.error) throw new Error(compiled.error);
    let evaluations = 0;
    const counting = (x: number, y: number, z: number): number => {
      evaluations += 1;
      return compiled.evaluator(x, y, z);
    };
    const field = sampleImplicitScalarField(counting, { domain: SPHERE_BOX, resolution: 8 });
    expect(evaluations).toBe(9 * 9 * 9);
    expect(field.values.length).toBe(9 * 9 * 9);
  });

  it("marks non-finite samples invalid without poisoning the grid", () => {
    const { field } = extract("1 / x", { xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }, 8);
    let invalid = 0;
    for (let i = 0; i < field.valid.length; i += 1) {
      if (field.valid[i] !== 1) {
        invalid += 1;
        expect(field.values[i]).toBeNaN();
      }
    }
    // Exactly the x = 0 plane of the 9^3 grid (res 8 over [-2,2] hits 0).
    expect(invalid).toBe(9 * 9);
  });

  it("swaps inverted ranges like the explicit-surface convention", () => {
    const forward = extract("x + y + z", SPHERE_BOX, 4).field;
    const swapped = extract(
      "x + y + z",
      { xMin: 1.5, xMax: -1.5, yMin: 1.5, yMax: -1.5, zMin: 1.5, zMax: -1.5 },
      4
    ).field;
    expect(Array.from(swapped.values)).toEqual(Array.from(forward.values));
  });

  it("keeps a zero-span domain finite without span division", () => {
    const compiled = compileImplicitSurfaceExpression("x + y + z", {});
    if (compiled.error) throw new Error(compiled.error);
    const field = sampleImplicitScalarField(compiled.evaluator, {
      domain: { xMin: 1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
      resolution: 4
    });
    for (const value of field.values) {
      expect(Number.isFinite(value)).toBe(true);
    }
    // Degenerate slice: every sample sits at x = 1.
    expect(field.values[0]).toBeCloseTo(1 + -1 + -1, 9);
  });

  it("maps throwing evaluations to invalid samples via the compiler contract", () => {
    // max() compiles (allowed function) but throws at evaluation; the
    // compiler's evaluator must convert the throw to NaN, and the sampler
    // must flag every sample invalid without throwing itself.
    const compiled = compileImplicitSurfaceExpression("max() + x + y + z", {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(0, 0, 0)).toBeNaN();
    const field = sampleImplicitScalarField(compiled.evaluator, { domain: SPHERE_BOX, resolution: 4 });
    for (const flag of field.valid) {
      expect(flag).toBe(0);
    }
    const { mesh } = extract("max() + x + y + z", SPHERE_BOX, 4);
    expect(mesh.status).toBe("empty");
  });
});

describe("marching tetrahedra grid-aligned plane", () => {
  it("extracts F = x through exact grid vertices with no missing cells", () => {
    const { mesh } = extract("x", { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2 }, 8);
    expect(mesh.status).toBe("ok");
    expect(mesh.triangleCount).toBeGreaterThan(0);
    // Linear field: every interpolated vertex lies exactly on the plane.
    for (const [x] of mathPositionsOf(mesh)) {
      expect(Math.abs(x)).toBeLessThan(1e-9);
    }
    expect(countInteriorCracks(mesh.indices, mesh.positions, { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2 }, 8)).toBe(0);
  });

  it("holds tight residuals on the asymmetric tilted plane", () => {
    const domain = { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3 };
    const { mesh } = extract("x + 2 * y + 3 * z - 1", domain, 16);
    expect(mesh.status).toBe("ok");
    let maxResidual = 0;
    for (const [x, y, z] of mathPositionsOf(mesh)) {
      maxResidual = Math.max(maxResidual, Math.abs(x + 2 * y + 3 * z - 1));
    }
    // Linear fields interpolate exactly; only float rounding remains.
    expect(maxResidual).toBeLessThan(1e-6);
    expect(countInteriorCracks(mesh.indices, mesh.positions, domain, 16)).toBe(0);
  });
});

describe("marching tetrahedra sphere", () => {
  it("keeps interpolation residuals within grid-appropriate tolerance", () => {
    const { mesh } = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 32);
    expect(mesh.status).toBe("ok");
    let maxResidual = 0;
    let sumResidual = 0;
    let count = 0;
    for (const [x, y, z] of mathPositionsOf(mesh)) {
      const residual = Math.abs(x * x + y * y + z * z - 1);
      maxResidual = Math.max(maxResidual, residual);
      sumResidual += residual;
      count += 1;
    }
    expect(count).toBeGreaterThan(1000);
    expect(maxResidual).toBeLessThan(0.02);
    expect(sumResidual / count).toBeLessThan(0.01);
  });

  it("produces outward finite normals with shared vertices and no cracks", () => {
    const { mesh } = extract("x^2 + y^2 + z^2 = 1", SPHERE_BOX, 32);
    expect(mesh.status).toBe("ok");
    // Vertex sharing: far fewer vertices than 3 per triangle (no soup).
    expect(mesh.vertexCount).toBeLessThan(mesh.triangleCount);
    const normals = computeNormals(mesh.positions, mesh.indices);
    const referenced = referencedVertices(mesh.indices);
    expect(referenced.size).toBeGreaterThan(1000);
    for (const vertex of referenced) {
      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      expect(Number.isFinite(nx + ny + nz)).toBe(true);
      const length = Math.hypot(nx, ny, nz);
      expect(length).toBeGreaterThan(1e-9);
      const px = mesh.positions[vertex * 3] ?? 0;
      const py = mesh.positions[vertex * 3 + 1] ?? 0;
      const pz = mesh.positions[vertex * 3 + 2] ?? 0;
      expect((nx * px + ny * py + nz * pz) / length).toBeGreaterThan(0.9);
    }
    expect(countInteriorCracks(mesh.indices, mesh.positions, SPHERE_BOX, 32)).toBe(0);
  });

  it("has no duplicate triangles and sane indexed bounds", () => {
    const { mesh } = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 24);
    const seen = new Set<string>();
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const key = [mesh.indices[t] ?? -1, mesh.indices[t + 1] ?? -1, mesh.indices[t + 2] ?? -1]
        .sort((a, b) => a - b)
        .join(",");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    const bounds = computeIndexedBoundingSphereData(mesh.positions, mesh.indices);
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.centerX)).toBeLessThan(0.05);
    expect(Math.abs(bounds!.centerY)).toBeLessThan(0.05);
    expect(Math.abs(bounds!.centerZ)).toBeLessThan(0.05);
    expect(bounds!.radius).toBeGreaterThan(0.95);
    expect(bounds!.radius).toBeLessThan(1.05);
  });
});

describe("marching tetrahedra ellipsoid and torus", () => {
  const ELLIPSOID_DOMAIN = { xMin: -2, xMax: 4, yMin: -4, yMax: 0, zMin: -3, zMax: 4 };

  it("recovers the offset asymmetric ellipsoid center and extents", () => {
    const { mesh } = extract("(x - 1)^2 / 4 + (y + 2)^2 + (z - 0.5)^2 / 9 = 1", ELLIPSOID_DOMAIN, 32);
    expect(mesh.status).toBe("ok");
    const bounds = computeIndexedBoundingSphereData(mesh.positions, mesh.indices);
    expect(bounds).not.toBeNull();
    // World frame is (x, z, y): world x = math x, world y = math z, world z = math y.
    // Ellipsoid math center (1, -2, 0.5) -> world (1, 0.5, -2), radius 3.
    expect(bounds!.centerX).toBeCloseTo(1, 0);
    expect(bounds!.centerY).toBeCloseTo(0.5, 0);
    expect(bounds!.centerZ).toBeCloseTo(-2, 0);
    expect(bounds!.radius).toBeGreaterThan(2.8);
    expect(bounds!.radius).toBeLessThan(3.2);
    // Axis extents in math coords: x in [-1, 3], y in [-3, -1], z in [-2.5, 3.5].
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, y, z] of mathPositionsOf(mesh)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    expect(minX).toBeGreaterThan(-1.2);
    expect(maxX).toBeLessThan(3.2);
    expect(minY).toBeGreaterThan(-3.2);
    expect(maxY).toBeLessThan(-0.8);
    expect(minZ).toBeGreaterThan(-2.7);
    expect(maxZ).toBeLessThan(3.7);
    expect(countInteriorCracks(mesh.indices, mesh.positions, ELLIPSOID_DOMAIN, 32)).toBe(0);
  });

  it("points ellipsoid normals outward along the analytic gradient direction", () => {
    const { mesh } = extract("(x - 1)^2 / 4 + (y + 2)^2 + (z - 0.5)^2 / 9 = 1", ELLIPSOID_DOMAIN, 32);
    expect(mesh.status).toBe("ok");
    const normals = computeNormals(mesh.positions, mesh.indices);
    const referenced = referencedVertices(mesh.indices);
    expect(referenced.size).toBeGreaterThan(1000);
    for (const vertex of referenced) {
      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      const length = Math.hypot(nx, ny, nz);
      expect(length).toBeGreaterThan(1e-9);
      // Ellipsoid true normals are NOT radial (except spheres): compare
      // against the analytic gradient grad F = ((x-1)/2, 2(y+2),
      // 2(z-0.5)/9). World frame is (x, z, y), so math (mx,my,mz) reads as
      // world (mx,mz,my) and the gradient permutes identically.
      const px = mesh.positions[vertex * 3] ?? 0;
      const py = mesh.positions[vertex * 3 + 1] ?? 0;
      const pz = mesh.positions[vertex * 3 + 2] ?? 0;
      const gx = (px - 1) / 2;
      const gy = (2 * (py - 0.5)) / 9;
      const gz = 2 * (pz + 2);
      const gradLength = Math.hypot(gx, gy, gz);
      expect((nx * gx + ny * gy + nz * gz) / (length * gradLength)).toBeGreaterThan(0.9);
    }
  });

  it("extracts the algebraic torus with hole, bounds, and tube relation", () => {
    const domain = { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -1, zMax: 1 };
    const { mesh } = extract("(x^2 + y^2 + z^2 + 3.75)^2 - 16 * (x^2 + y^2) = 0", domain, 32);
    expect(mesh.status).toBe("ok");
    const bounds = computeIndexedBoundingSphereData(mesh.positions, mesh.indices);
    expect(bounds).not.toBeNull();
    expect(bounds!.radius).toBeGreaterThan(2.4);
    expect(bounds!.radius).toBeLessThan(2.6);
    // Tube relation: ((hypot(x, y) - 2)^2 + z^2) ~= 0.25 for every vertex.
    let maxTubeError = 0;
    for (const [x, y, z] of mathPositionsOf(mesh)) {
      const tube = (Math.hypot(x, y) - 2) ** 2 + z * z;
      maxTubeError = Math.max(maxTubeError, Math.abs(tube - 0.25));
    }
    expect(maxTubeError).toBeLessThan(0.05);
    // Hole: no vertex near the z axis inside the ring opening.
    for (const [x, y] of mathPositionsOf(mesh)) {
      if (Math.abs(y) < 2 && Math.abs(x) < 2) {
        expect(Math.hypot(x, y)).toBeGreaterThan(1.2);
      }
    }
    expect(countInteriorCracks(mesh.indices, mesh.positions, domain, 32)).toBe(0);
  });

  it("points torus normals outward from the tube center", () => {
    const domain = { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -1, zMax: 1 };
    const { mesh } = extract("(x^2 + y^2 + z^2 + 3.75)^2 - 16 * (x^2 + y^2) = 0", domain, 32);
    expect(mesh.status).toBe("ok");
    const normals = computeNormals(mesh.positions, mesh.indices);
    const referenced = referencedVertices(mesh.indices);
    expect(referenced.size).toBeGreaterThan(1000);
    for (const vertex of referenced) {
      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      const length = Math.hypot(nx, ny, nz);
      expect(length).toBeGreaterThan(1e-9);
      // World frame is (x, z, y): tube center for math angle u sits at
      // world (2cos u, 0, 2sin u); recover u from the world x/z angle.
      const px = mesh.positions[vertex * 3] ?? 0;
      const py = mesh.positions[vertex * 3 + 1] ?? 0;
      const pz = mesh.positions[vertex * 3 + 2] ?? 0;
      const u = Math.atan2(pz, px);
      const cx = 2 * Math.cos(u);
      const cz = 2 * Math.sin(u);
      const radial = [px - cx, py, pz - cz] as const;
      const radialLength = Math.hypot(radial[0], radial[1], radial[2]);
      expect((nx * radial[0] + ny * radial[1] + nz * radial[2]) / (length * radialLength)).toBeGreaterThan(0.9);
    }
  });
});

describe("marching tetrahedra gyroid", () => {
  const GYROID_DOMAIN = { xMin: -3.2, xMax: 3.2, yMin: -3.2, yMax: 3.2, zMin: -3.2, zMax: 3.2 };

  it("extracts a finite mesh with finite normals inside the budget", () => {
    const { mesh } = extract(
      "sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x) = 0",
      GYROID_DOMAIN,
      32
    );
    expect(mesh.status).toBe("ok");
    expect(mesh.triangleCount).toBeGreaterThan(10000);
    expect(mesh.triangleCount).toBeLessThan(MAX_IMPLICIT_SURFACE_TRIANGLES);
    const normals = computeNormals(mesh.positions, mesh.indices);
    for (const vertex of referencedVertices(mesh.indices)) {
      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      expect(Number.isFinite(nx + ny + nz)).toBe(true);
      expect(Math.hypot(nx, ny, nz)).toBeGreaterThan(1e-9);
    }
    for (const value of mesh.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("marching tetrahedra degenerate and singular fields", () => {
  it("emits nothing for constant nonzero fields", () => {
    expect(extract("1", SPHERE_BOX, 8).mesh.status).toBe("empty");
  });

  it("emits nothing for constant zero fields (whole volume, not a surface)", () => {
    const { mesh } = extract("0", SPHERE_BOX, 8);
    expect(mesh.status).toBe("empty");
    expect(mesh.triangleCount).toBe(0);
  });

  it("emits nothing for 1/x over x = 0 without NaN geometry", () => {
    const domain = { xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
    const { mesh } = extract("1 / x", domain, 24);
    expect(mesh.status).toBe("empty");
    expect(mesh.triangleCount).toBe(0);
    for (const value of mesh.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("rejects shifted finite poles while keeping steep continuous roots", () => {
    const domain = { xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
    // Poles off the grid: naive sign-change extraction would sheet a
    // phantom plane; the bisection witness rejects every crossing.
    expect(extract("1 / (x - 0.17)", domain, 24).mesh.status).toBe("empty");
    expect(extract("1 / (x + 0.113)", domain, 24).mesh.status).toBe("empty");
    // Witness disabled: the phantom plane appears (documents witness value).
    const naive = extract("1 / (x - 0.17)", domain, 24, { witnessBisections: 0 });
    expect(naive.mesh.status).toBe("ok");
    expect(naive.mesh.triangleCount).toBeGreaterThan(1000);
    // Continuous controls survive the witness at full strength.
    expect(extract("1000 * x + y + z - 0.3", { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }, 16).mesh.status).toBe("ok");
    expect(extract("x^3 + y + z", { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }, 16).mesh.status).toBe("ok");
    expect(extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 16).mesh.status).toBe("ok");
  });
});

describe("marching tetrahedra index type and budgets", () => {
  it("selects Uint16 below the 65535-vertex boundary", () => {
    const { mesh } = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 32);
    expect(mesh.indices).toBeInstanceOf(Uint16Array);
    expect(mesh.vertexCount).toBeLessThanOrEqual(65535);
  });

  it("selects Uint32 past the boundary without overflow", () => {
    const { mesh } = extract(
      "sin(12 * x) * sin(12 * y) * sin(12 * z) - 0.1",
      SPHERE_BOX,
      MAX_IMPLICIT_SURFACE_RESOLUTION
    );
    expect(mesh.status).toBe("ok");
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.vertexCount).toBeGreaterThan(65535);
    let maxIndex = 0;
    for (let i = 0; i < mesh.indices.length; i += 1) {
      maxIndex = Math.max(maxIndex, mesh.indices[i] ?? 0);
    }
    expect(maxIndex).toBeLessThan(mesh.vertexCount);
  }, 30_000);

  it("aborts cleanly past the triangle budget with bounded output", () => {
    const { mesh } = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 32, { maxTriangles: 100 });
    expect(mesh.status).toBe("budget-exceeded");
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });

  it("keeps the default budget far above representative worst cases", () => {
    const { mesh } = extract(
      "sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x) = 0",
      { xMin: -3.2, xMax: 3.2, yMin: -3.2, yMax: 3.2, zMin: -3.2, zMax: 3.2 },
      MAX_IMPLICIT_SURFACE_RESOLUTION
    );
    expect(mesh.status).toBe("ok");
    expect(mesh.triangleCount).toBeLessThan(MAX_IMPLICIT_SURFACE_TRIANGLES);
  });

  it("normalizes below-minimum and above-maximum resolutions", () => {
    const tiny = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 0);
    expect(tiny.field.resolution).toBe(MIN_IMPLICIT_SURFACE_RESOLUTION);
    const huge = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, 10_000);
    expect(huge.field.resolution).toBe(MAX_IMPLICIT_SURFACE_RESOLUTION);
  });

  it("quantifies maximum allocation within the browser-safe budget", () => {
    const { mesh } = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, MAX_IMPLICIT_SURFACE_RESOLUTION);
    const positionBytes = mesh.positions.length * Float32Array.BYTES_PER_ELEMENT;
    const indexBytes = mesh.indices.length * (mesh.indices instanceof Uint32Array ? 4 : 2);
    expect(positionBytes + indexBytes).toBeLessThan(2_000_000);
  });

  it("aborts an extremely oscillating field without returning a partial mesh", () => {
    const { mesh } = extract(
      "sin(40 * x) * sin(40 * y) * sin(40 * z) - 0.1",
      SPHERE_BOX,
      MAX_IMPLICIT_SURFACE_RESOLUTION
    );
    expect(mesh.status).toBe("budget-exceeded");
    expect(mesh.triangleCount).toBeGreaterThan(MAX_IMPLICIT_SURFACE_TRIANGLES);
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  }, 30_000);
});

describe("marching tetrahedra resolution limits", () => {
  it("documents exact sample and cell counts", () => {
    const { field } = extract("x^2 + y^2 + z^2 - 1", SPHERE_BOX, MAX_IMPLICIT_SURFACE_RESOLUTION);
    expect(field.values.length).toBe(49 * 49 * 49);
    expect(field.resolution ** 3).toBe(48 * 48 * 48);
  });
});
