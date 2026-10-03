import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import {
  MAX_PARAMETRIC_SURFACE_RESOLUTION,
  MIN_PARAMETRIC_SURFACE_RESOLUTION
} from "@vinculum/scene/defaults";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { computeIndexedBoundingSphereData } from "@/lib/math/indexedBounds";
import {
  repairZeroVertexNormals,
  sampleParametricSurface
} from "@/lib/math/sampleParametricSurface";

interface SurfaceDomain {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

function sample(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  domain: SurfaceDomain,
  resolution: number,
  clampCoordinate = 10_000
) {
  const compiled = compileParametricSurfaceExpressions(xExpr, yExpr, zExpr, {});
  if (compiled.error) {
    throw new Error(`Unexpected compile error: ${compiled.error}`);
  }
  return sampleParametricSurface(compiled.evaluator, { domain, resolution, clampCoordinate });
}

function worldPositionsOf(sampled: { positions: Float32Array }): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i < sampled.positions.length; i += 3) {
    points.push([sampled.positions[i] ?? 0, sampled.positions[i + 1] ?? 0, sampled.positions[i + 2] ?? 0]);
  }
  return points;
}

function computeNormals(positions: Float32Array, indices: Uint16Array): Float32Array {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return (geometry.getAttribute("normal") as BufferAttribute).array as Float32Array;
}

describe("sampleParametricSurface grid", () => {
  it("samples a (resolution+1)^2 grid with two triangles per cell", () => {
    const sampled = sample("u", "v", "0", { uMin: -5, uMax: 5, vMin: -5, vMax: 5 }, 8);
    expect(sampled.positions.length).toBe(9 * 9 * 3);
    expect(sampled.indices.length).toBe(8 * 8 * 2 * 3);
    expect(sampled.indices).toBeInstanceOf(Uint16Array);
    expect(sampled.rejectedTriangles).toBe(0);
  });

  it("maps plane-patch corners exactly through math->world (x, z, y)", () => {
    const sampled = sample("u", "v", "0", { uMin: -5, uMax: 5, vMin: -5, vMax: 5 }, 4);
    const points = worldPositionsOf(sampled);
    // Vertex (uStep 0, vStep 0): math (-5, -5, 0) -> world (-5, 0, -5).
    expect(points[0]).toEqual([-5, 0, -5]);
    // Vertex (uStep 4, vStep 0): math (5, -5, 0) -> world (5, 0, -5).
    expect(points[4]).toEqual([5, 0, -5]);
    // Vertex (uStep 0, vStep 4): math (-5, 5, 0) -> world (-5, 0, 5).
    expect(points[4 * 5]).toEqual([-5, 0, 5]);
    // Vertex (uStep 4, vStep 4): math (5, 5, 0) -> world (5, 0, 5).
    expect(points[24]).toEqual([5, 0, 5]);
  });

  it("samples the asymmetric affine map at known corners", () => {
    const sampled = sample("u", "2 * v", "3 * u + v", { uMin: -3, uMax: 2, vMin: -2, vMax: 4 }, 6);
    const stride = 7;
    const at = (i: number, j: number): [number, number, number] => {
      const k = (j * stride + i) * 3;
      return [sampled.positions[k] ?? 0, sampled.positions[k + 1] ?? 0, sampled.positions[k + 2] ?? 0];
    };
    // math (u, 2v, 3u+v) -> world (u, 3u+v, 2v).
    expect(at(0, 0)).toEqual([-3, -11, -4]);
    expect(at(6, 0)).toEqual([2, 4, -4]);
    expect(at(0, 6)).toEqual([-3, -5, 8]);
    expect(at(6, 6)).toEqual([2, 10, 8]);
  });

  it("keeps every emitted triangle inside valid vertices (no chords through holes)", () => {
    const sampled = sample("1 / u", "v", "0", { uMin: -2, uMax: 2, vMin: -1, vMax: 1 }, 16);
    // Re-derive validity from positions: invalid samples sit at the origin
    // placeholder, but only unreferenced ones may do so.
    const referenced = new Set<number>();
    for (let i = 0; i < sampled.indices.length; i += 1) {
      referenced.add(sampled.indices[i] ?? -1);
    }
    for (const vertex of referenced) {
      const x = sampled.positions[vertex * 3] ?? Number.NaN;
      const y = sampled.positions[vertex * 3 + 1] ?? Number.NaN;
      const z = sampled.positions[vertex * 3 + 2] ?? Number.NaN;
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      // No referenced vertex is the degenerate placeholder: u != 0 everywhere
      // referenced, so world.x = 1/u never vanishes... placeholder is exactly
      // (0,0,0); valid samples have v in [-1,1] but x = 1/u with |u| >= 1/8.
      expect(Math.abs(x) > 0.4 || Math.abs(y) > 0 || Math.abs(z) > 0).toBe(true);
    }
    expect(sampled.indices.length).toBeGreaterThan(0);
    expect(sampled.indices.length).toBeLessThan(16 * 16 * 2 * 3);
  });

  it("emits no triangles when every sample is invalid", () => {
    const sampled = sample("1 / 0", "v", "u", { uMin: 0, uMax: 1, vMin: 0, vMax: 1 }, 8);
    expect(sampled.indices.length).toBe(0);
    for (const value of sampled.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("clamps huge finite coordinates instead of leaking them into buffers", () => {
    const sampled = sample("100000 * u", "v", "0", { uMin: -1, uMax: 1, vMin: -1, vMax: 1 }, 4, 100);
    for (const value of sampled.positions) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThanOrEqual(100);
    }
  });

  it("swaps inverted ranges and tolerates degenerate spans without NaN", () => {
    const swapped = sample("u", "v", "u + v", { uMin: 2, uMax: -2, vMin: 1, vMax: -1 }, 4);
    const ordered = sample("u", "v", "u + v", { uMin: -2, uMax: 2, vMin: -1, vMax: 1 }, 4);
    expect(Array.from(swapped.positions)).toEqual(Array.from(ordered.positions));

    const degenerate = sample("u", "v", "0", { uMin: 1, uMax: 1, vMin: -1, vMax: 1 }, 4);
    for (const value of degenerate.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
    // Zero u-span collapses every column to u = 1 (world x = 1).
    for (let i = 0; i < degenerate.positions.length; i += 3) {
      expect(degenerate.positions[i]).toBe(1);
    }
  });

  it("keeps a fully point-degenerate domain finite (builder rejects it via zero radius)", () => {
    const point = sample("u", "v", "0", { uMin: 1, uMax: 1, vMin: 2, vMax: 2 }, 4);
    for (const value of point.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
    const bounds = computeIndexedBoundingSphereData(point.positions, point.indices);
    expect(bounds?.radius).toBe(0);
  });
});

describe("sampleParametricSurface sphere", () => {
  const SPHERE_DOMAIN = { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI };

  it("lies on the unit sphere at every valid sample", () => {
    const sampled = sample("sin(u) * cos(v)", "sin(u) * sin(v)", "cos(u)", SPHERE_DOMAIN, 24);
    const points = worldPositionsOf(sampled);
    for (const [x, y, z] of points) {
      expect(x * x + y * y + z * z).toBeCloseTo(1, 5);
    }
  });

  it("keeps pole rows valid with finite outward normals", () => {
    const sampled = sample("sin(u) * cos(v)", "sin(u) * sin(v)", "cos(u)", SPHERE_DOMAIN, 24);
    const normals = computeNormals(sampled.positions, sampled.indices);
    // Same pipeline as the builder: repair the degenerate pole-corner zero
    // normal from its indexed neighbors before asserting.
    const repaired = repairZeroVertexNormals(normals, sampled.indices);
    expect(repaired).toBeGreaterThanOrEqual(1);
    const index = sampled.indices;
    const referenced = new Set<number>();
    for (let i = 0; i < index.length; i += 1) {
      referenced.add(index[i] ?? -1);
    }
    for (const vertex of referenced) {
      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      expect(Number.isFinite(nx + ny + nz)).toBe(true);
      const length = Math.hypot(nx, ny, nz);
      expect(length).toBeGreaterThan(1e-9);
      // Outward: normal aligns with the radial position (unit sphere).
      const px = sampled.positions[vertex * 3] ?? 0;
      const py = sampled.positions[vertex * 3 + 1] ?? 0;
      const pz = sampled.positions[vertex * 3 + 2] ?? 0;
      const dot = (nx * px + ny * py + nz * pz) / length;
      expect(dot).toBeGreaterThan(0.9);
    }
  });

  it("bounds the unit sphere sanely from indexed geometry", () => {
    const sampled = sample("sin(u) * cos(v)", "sin(u) * sin(v)", "cos(u)", SPHERE_DOMAIN, 24);
    const bounds = computeIndexedBoundingSphereData(sampled.positions, sampled.indices);
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.centerX)).toBeLessThan(0.05);
    expect(Math.abs(bounds!.centerY)).toBeLessThan(0.05);
    expect(Math.abs(bounds!.centerZ)).toBeLessThan(0.05);
    expect(bounds!.radius).toBeGreaterThan(0.99);
    expect(bounds!.radius).toBeLessThan(1.01);
  });
});

describe("sampleParametricSurface torus", () => {
  const TORUS_DOMAIN = { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI };

  it("matches the torus tube relation with finite outward normals", () => {
    const sampled = sample(
      "(2 + 0.5 * cos(v)) * cos(u)",
      "(2 + 0.5 * cos(v)) * sin(u)",
      "0.5 * sin(v)",
      TORUS_DOMAIN,
      24
    );
    const normals = computeNormals(sampled.positions, sampled.indices);
    const index = sampled.indices;
    const referenced = new Set<number>();
    for (let i = 0; i < index.length; i += 1) {
      referenced.add(index[i] ?? -1);
    }
    expect(referenced.size).toBeGreaterThan(500);
    for (const vertex of referenced) {
      // World frame is (x, z, y): tube center for angle u sits at
      // world (2cos u, 0, 2sin u); recover u from the world x/z angle.
      const px = sampled.positions[vertex * 3] ?? 0;
      const py = sampled.positions[vertex * 3 + 1] ?? 0;
      const pz = sampled.positions[vertex * 3 + 2] ?? 0;
      const u = Math.atan2(pz, px);
      const cx = 2 * Math.cos(u);
      const cz = 2 * Math.sin(u);
      const tubeDistance = Math.hypot(px - cx, py, pz - cz);
      expect(tubeDistance).toBeCloseTo(0.5, 2);

      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      const length = Math.hypot(nx, ny, nz);
      expect(length).toBeGreaterThan(1e-9);
      const dot = (nx * (px - cx) + ny * py + nz * (pz - cz)) / (length * tubeDistance);
      expect(dot).toBeGreaterThan(0.9);
    }
  });

  it("bounds the torus around radius 2.5", () => {
    const sampled = sample(
      "(2 + 0.5 * cos(v)) * cos(u)",
      "(2 + 0.5 * cos(v)) * sin(u)",
      "0.5 * sin(v)",
      TORUS_DOMAIN,
      24
    );
    const bounds = computeIndexedBoundingSphereData(sampled.positions, sampled.indices);
    expect(bounds).not.toBeNull();
    expect(bounds!.radius).toBeGreaterThan(2.4);
    expect(bounds!.radius).toBeLessThan(2.6);
  });
});

describe("sampleParametricSurface discontinuities", () => {
  it("cuts the finite pole-straddling band of x = tan(u)", () => {
    const full = sample("tan(u)", "v", "0", { uMin: 0, uMax: 3, vMin: -1, vMax: 1 }, 32);
    expect(full.rejectedTriangles).toBeGreaterThan(0);
    expect(full.indices.length).toBeGreaterThan(0);
    expect(full.indices.length).toBeLessThan(32 * 32 * 2 * 3);
    for (const value of full.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("cuts v-direction pole straddles such as y = tan(v)", () => {
    const full = sample("u", "tan(v)", "0", { uMin: -1, uMax: 1, vMin: 0, vMax: 3 }, 32);
    expect(full.rejectedTriangles).toBeGreaterThan(0);
    expect(full.indices.length).toBeGreaterThan(0);
    expect(full.indices.length).toBeLessThan(32 * 32 * 2 * 3);
    for (const value of full.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("leaves smooth steep surfaces untouched", () => {
    const steep = sample("u^3", "v", "u * v", { uMin: -2, uMax: 2, vMin: -2, vMax: 2 }, 24);
    expect(steep.rejectedTriangles).toBe(0);
    expect(steep.indices.length).toBe(24 * 24 * 2 * 3);
  });
});

describe("sampleParametricSurface resolution limits", () => {
  it("normalizes below-minimum and above-maximum resolutions", () => {
    const tiny = sample("u", "v", "0", { uMin: 0, uMax: 1, vMin: 0, vMax: 1 }, 0);
    expect(tiny.positions.length).toBe((MIN_PARAMETRIC_SURFACE_RESOLUTION + 1) ** 2 * 3);
    const huge = sample("u", "v", "0", { uMin: 0, uMax: 1, vMin: 0, vMax: 1 }, 10_000);
    expect(huge.positions.length).toBe((MAX_PARAMETRIC_SURFACE_RESOLUTION + 1) ** 2 * 3);
  });

  it("stays within Uint16 indices at the maximum resolution", () => {
    const max = sample("u", "v", "0", { uMin: -1, uMax: 1, vMin: -1, vMax: 1 }, 128);
    expect(max.positions.length).toBe(129 * 129 * 3);
    let maxIndex = 0;
    for (let i = 0; i < max.indices.length; i += 1) {
      maxIndex = Math.max(maxIndex, max.indices[i] ?? 0);
    }
    expect(maxIndex).toBeLessThan(65536);
    // Odd resolution tiles exactly too.
    const odd = sample("u", "v", "0", { uMin: -1, uMax: 1, vMin: -1, vMax: 1 }, 7);
    expect(odd.positions.length).toBe(8 * 8 * 3);
    expect(odd.indices.length).toBe(7 * 7 * 2 * 3);
  });

  it("quantifies maximum allocation within the browser-safe budget", () => {
    const max = sample("u", "v", "0", { uMin: -1, uMax: 1, vMin: -1, vMax: 1 }, 128);
    const positionBytes = max.positions.length * Float32Array.BYTES_PER_ELEMENT;
    expect(positionBytes).toBeLessThanOrEqual(2_000_000);
    const indexBytes = max.indices.length * Uint16Array.BYTES_PER_ELEMENT;
    // positions ~200KB, indices ~200KB, normals ~200KB after build.
    expect(positionBytes + indexBytes).toBeLessThan(500_000);
  });
});

describe("repairZeroVertexNormals", () => {
  it("repairs isolated zero normals from neighbors and counts them", () => {
    const normals = new Float32Array([0, 0, 0, 0, 1, 0, 0, 1, 0]);
    const repaired = repairZeroVertexNormals(normals, [0, 1, 2]);
    expect(repaired).toBe(1);
    expect(normals[0]).toBeCloseTo(0, 12);
    expect(normals[1]).toBeCloseTo(1, 12);
    expect(normals[2]).toBeCloseTo(0, 12);
  });

  it("leaves fully degenerate neighborhoods untouched", () => {
    const normals = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(repairZeroVertexNormals(normals, [0, 1, 2])).toBe(0);
  });

  it("leaves healthy normals alone", () => {
    const normals = new Float32Array([0, 1, 0, 1, 0, 0]);
    expect(repairZeroVertexNormals(normals, [0, 1])).toBe(0);
    expect(Array.from(normals)).toEqual([0, 1, 0, 1, 0, 0]);
  });
});

describe("sampleParametricSurface bounds with dead placeholders", () => {
  it("derives the sphere from indexed vertices only (S8)", () => {
    const sampled = sample("1 / u", "v", "0", { uMin: -2, uMax: 2, vMin: -1, vMax: 1 }, 16);
    const bounds = computeIndexedBoundingSphereData(sampled.positions, sampled.indices);
    expect(bounds).not.toBeNull();
    expect(Number.isFinite(bounds!.centerX + bounds!.centerY + bounds!.centerZ + bounds!.radius)).toBe(true);
    // The invalid u = 0 column sits at the (0,0,0) placeholder unreferenced:
    // referenced x-values stay away from the placeholder.
    const index = sampled.indices;
    let minAbsX = Infinity;
    for (let i = 0; i < index.length; i += 1) {
      const vertex = index[i] ?? -1;
      minAbsX = Math.min(minAbsX, Math.abs(sampled.positions[vertex * 3] ?? 0));
    }
    expect(minAbsX).toBeGreaterThan(0.4);
  });
});
