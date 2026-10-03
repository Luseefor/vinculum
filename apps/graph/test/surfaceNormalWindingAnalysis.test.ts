import { describe, it, expect } from "vitest";
import { BufferGeometry, BufferAttribute } from "three";
import { compileSurfaceExpression, type SurfaceEvaluator } from "@/lib/math/compileExpression";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";
import { sampleSurface } from "@/lib/math/sampleSurface";

// S1-U5: normal/winding analysis (diagnostic-only, characterization).
// Replicates exactly what buildSurface/buildPlane feed to lighting
// (positions + index + computeVertexNormals) and checks winding consistency
// via an independent per-face oracle.

const DOMAIN = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };

function buildGeometry(positions: Float32Array, indices: ArrayLike<number>): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(Uint16Array.from(indices), 1));
  geometry.computeVertexNormals();
  return geometry;
}

function faceNormals(positions: Float32Array, indices: ArrayLike<number>): Array<[number, number, number]> {
  const faces: Array<[number, number, number]> = [];
  const corner = (vertex: number): [number, number, number] => [
    positions[vertex * 3] ?? 0,
    positions[vertex * 3 + 1] ?? 0,
    positions[vertex * 3 + 2] ?? 0
  ];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = corner(indices[i] ?? 0);
    const b = corner(indices[i + 1] ?? 0);
    const c = corner(indices[i + 2] ?? 0);
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    faces.push([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
  }
  return faces;
}

function expectVertexNormalsUnit(geometry: BufferGeometry): void {
  const normal = geometry.getAttribute("normal");
  expect(normal).toBeDefined();
  for (let i = 0; i < normal.count; i += 1) {
    const x = normal.getX(i);
    const y = normal.getY(i);
    const z = normal.getZ(i);
    expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  }
}

describe("surface normal and winding analysis", () => {
  it("produces unit vertex normals and up-facing consistent winding on a smooth surface", () => {
    const compiled = compileSurfaceExpression("x^2 + y^2", "z");
    expect(compiled.error).toBeNull();
    const sampled = sampleSurface(compiled.evaluator, { domain: DOMAIN, resolution: 20 });

    const geometry = buildGeometry(sampled.positions, sampled.indices);
    expectVertexNormalsUnit(geometry);

    // Structural property of the (a,c,b)/(b,c,d) triangulation: every face
    // normal has positive world-Y regardless of heights -> consistent winding.
    for (const face of faceNormals(sampled.positions, sampled.indices)) {
      expect(face[1]).toBeGreaterThan(0);
    }
  });

  it("keeps winding consistent across tan(x) pole stretches (stretch is geometry, not winding)", () => {
    const compiled = compileSurfaceExpression("tan(x)", "z");
    expect(compiled.error).toBeNull();
    const sampled = sampleSurface(compiled.evaluator, {
      domain: DOMAIN,
      resolution: 20,
      clampHeight: 10_000
    });

    const geometry = buildGeometry(sampled.positions, sampled.indices);
    expectVertexNormalsUnit(geometry);

    for (const face of faceNormals(sampled.positions, sampled.indices)) {
      expect(face[1]).toBeGreaterThan(0);
    }
  });

  it("keeps hole-boundary vertex normals finite and unit with consistent winding", () => {
    const diskEvaluator: SurfaceEvaluator = (u, v) => (u * u + v * v < 1 ? Number.NaN : u * u + v * v);
    const sampled = sampleSurface(diskEvaluator, {
      domain: DOMAIN,
      resolution: 20,
      invalidHeight: 0
    });
    expect(sampled.indices.length).toBeGreaterThan(0);

    const geometry = buildGeometry(sampled.positions, sampled.indices);
    const normal = geometry.getAttribute("normal");
    const indexed = new Set<number>(sampled.indices);
    let zeroNormalCount = 0;
    for (let i = 0; i < normal.count; i += 1) {
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (!indexed.has(i)) {
        // Dead buffer vertices (never indexed) keep three.js zero normals.
        expect(length).toBe(0);
        zeroNormalCount += 1;
      } else {
        expect(Number.isFinite(length)).toBe(true);
        expect(length).toBeCloseTo(1, 6);
      }
    }
    // The NaN disk vertices are present but unrendered.
    expect(zeroNormalCount).toBeGreaterThan(0);

    for (const face of faceNormals(sampled.positions, sampled.indices)) {
      expect(face[1]).toBeGreaterThan(0);
    }
  });

  it("keeps a single consistent height-axis sign for x-orientation surfaces", () => {
    const constEvaluator: SurfaceEvaluator = () => 3;
    const sampled = sampleSurface(constEvaluator, { domain: DOMAIN, resolution: 4, orientation: "x" });

    const faces = faceNormals(sampled.positions, sampled.indices);
    expect(faces.length).toBeGreaterThan(0);
    const signs = new Set(faces.map((face) => Math.sign(face[0])));
    // No mixed winding: all face normals agree on the world-X hemisphere.
    expect(signs.size).toBe(1);
    expect(signs.has(0)).toBe(false);
  });

  it("produces parallel unit normals for the analytic plane mesh", () => {
    const compiled = compilePlaneEquation("x + 2y + z - 3");
    expect(compiled.error).toBeNull();
    expect(compiled.coefficients).not.toBeNull();
    const sampled = samplePlane(compiled.coefficients ?? { a: 1, b: 2, c: 1, d: -3 }, 12);

    const geometry = buildGeometry(sampled.positions, sampled.indices);
    expectVertexNormalsUnit(geometry);

    const faces = faceNormals(sampled.positions, sampled.indices);
    expect(faces.length).toBe(2);
    const dot =
      (faces[0]?.[0] ?? 0) * (faces[1]?.[0] ?? 0) +
      (faces[0]?.[1] ?? 0) * (faces[1]?.[1] ?? 0) +
      (faces[0]?.[2] ?? 0) * (faces[1]?.[2] ?? 0);
    const lengths =
      Math.hypot(...(faces[0] ?? [0, 0, 0])) * Math.hypot(...(faces[1] ?? [0, 0, 0]));
    expect(dot / lengths).toBeCloseTo(1, 9);
  });
});
