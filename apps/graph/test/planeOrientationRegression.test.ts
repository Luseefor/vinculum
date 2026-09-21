import { describe, it, expect } from "vitest";
import { Group, Mesh } from "three";
import type { PlaneGraphObject } from "@vinculum/scene/types";
import { buildPlane } from "@/lib/graph3d/buildGraphPlane";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";

// S2-U2: plane orientation regression tests (F5).
// Canonical mapping: math(x,y,z) -> world(x,z,y), world Y is up.
// World-frame assertions FAIL before the F5 fix (proving the failure) and pass
// after it. The math-frame guard passes before and after (semantics preserved).

const SIZE = 12;
const HALF = SIZE / 2;
const EPS = 1e-6;

function makePlane(equation: string): PlaneGraphObject {
  return {
    id: "plane-test",
    kind: "plane",
    color: "#3b82f6",
    visible: true,
    equation,
    size: SIZE,
    appearance: { wireframe: false }
  };
}

function worldPositionsOfFirstMesh(group: Group | null): number[][] {
  expect(group).not.toBeNull();
  const mesh = group?.children.find((child): child is Mesh => child instanceof Mesh);
  expect(mesh).toBeDefined();
  const position = mesh?.geometry.getAttribute("position");
  expect(position).toBeDefined();
  const vertices: number[][] = [];
  for (let i = 0; i < (position?.count ?? 0); i += 1) {
    vertices.push([position?.getX(i) ?? 0, position?.getY(i) ?? 0, position?.getZ(i) ?? 0]);
  }
  expect(vertices.length).toBe(4);
  return vertices;
}

function expectAllCloseTo(values: number[], expected: number): void {
  for (const value of values) {
    expect(Math.abs(value - expected)).toBeLessThan(EPS);
  }
}

describe("plane orientation regression", () => {
  it("case A: z = 0 renders horizontal (constant world Y)", () => {
    const vertices = worldPositionsOfFirstMesh(buildPlane(makePlane("z = 0"), "dark"));
    expectAllCloseTo(
      vertices.map((v) => v[1] ?? 0),
      0
    );
    expect(Math.max(...vertices.map((v) => Math.abs(v[0] ?? 0)))).toBeCloseTo(HALF, 5);
    expect(Math.max(...vertices.map((v) => Math.abs(v[2] ?? 0)))).toBeCloseTo(HALF, 5);
  });

  it("case B: y = 0 renders as a vertical plane with normal along world Z (constant world Z)", () => {
    const vertices = worldPositionsOfFirstMesh(buildPlane(makePlane("y = 0"), "dark"));
    expectAllCloseTo(
      vertices.map((v) => v[2] ?? 0),
      0
    );
    expect(Math.max(...vertices.map((v) => Math.abs(v[0] ?? 0)))).toBeCloseTo(HALF, 5);
    expect(Math.max(...vertices.map((v) => Math.abs(v[1] ?? 0)))).toBeCloseTo(HALF, 5);
  });

  it("case C: x = 0 renders as a vertical plane with normal along world X (constant world X)", () => {
    const vertices = worldPositionsOfFirstMesh(buildPlane(makePlane("x = 0"), "dark"));
    expectAllCloseTo(
      vertices.map((v) => v[0] ?? 0),
      0
    );
    expect(Math.max(...vertices.map((v) => Math.abs(v[1] ?? 0)))).toBeCloseTo(HALF, 5);
    expect(Math.max(...vertices.map((v) => Math.abs(v[2] ?? 0)))).toBeCloseTo(HALF, 5);
  });

  it("case D: x + 2y + z = 3 satisfies the math equation after world-to-math conversion", () => {
    const vertices = worldPositionsOfFirstMesh(buildPlane(makePlane("x + 2y + z = 3"), "dark"));
    for (const vertex of vertices) {
      const mathX = vertex[0] ?? 0;
      const mathY = vertex[2] ?? 0;
      const mathZ = vertex[1] ?? 0;
      expect(Math.abs(mathX + 2 * mathY + mathZ - 3)).toBeLessThan(1e-5);
    }
  });

  it("math-frame guard: samplePlane corners satisfy the plane equation (pre/post fix)", () => {
    const compiled = compilePlaneEquation("x + 2y + z - 3");
    expect(compiled.error).toBeNull();
    expect(compiled.coefficients).not.toBeNull();
    const sampled = samplePlane(compiled.coefficients ?? { a: 1, b: 2, c: 1, d: -3 }, SIZE);
    for (let i = 0; i < sampled.positions.length; i += 3) {
      const x = sampled.positions[i] ?? 0;
      const y = sampled.positions[i + 1] ?? 0;
      const z = sampled.positions[i + 2] ?? 0;
      expect(x + 2 * y + z).toBeCloseTo(3, 5);
    }
  });
});
