// S8-U2/U4 — Surface bounds-integrity regression.
//
// F7 contract: geometry bounds must represent rendered/indexed geometry, not
// dead placeholder storage vertices. S8-U4 implements referenced-only spheres
// in production; all assertions below now PASS.
import { describe, expect, it } from "vitest";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Raycaster,
  Sphere,
  Vector3
} from "three";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { buildSurface } from "@/lib/graph3d/buildGraphSurface";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { SurfaceDomain, SurfaceGraphObject, SurfaceOrientation } from "@vinculum/scene/types";

const DOMAIN: SurfaceDomain = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };

// Shifted singularity: compiles (origin value 100.5 is finite), pole lands
// exactly on grid vertex (xStep 6, yStep 6) at res 10 / step 1, and all real
// geometry sits at heights >= 100 while invalidHeight defaults to 0.
const SINGULAR_EQUATION = "100 + 1 / ((x - 1)^2 + (y - 1)^2)";
const SINGULAR_RESOLUTION = 10;
const SINGULAR_STRIDE = SINGULAR_RESOLUTION + 1;
const SINGULAR_INDEX = 6 * SINGULAR_STRIDE + 6;

interface DeadVertexAnalysis {
  vertexCount: number;
  referencedMask: Uint8Array;
  referencedCount: number;
  deadCount: number;
  deadIndices: number[];
}

function analyzeDeadVertices(positions: Float32Array, indices: ArrayLike<number>): DeadVertexAnalysis {
  const vertexCount = positions.length / 3;
  const referencedMask = new Uint8Array(vertexCount);
  for (let i = 0; i < indices.length; i += 1) {
    const vertex = indices[i] ?? -1;
    if (vertex >= 0 && vertex < vertexCount) {
      referencedMask[vertex] = 1;
    }
  }
  const deadIndices: number[] = [];
  let referencedCount = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (referencedMask[vertex] === 1) {
      referencedCount += 1;
    } else {
      deadIndices.push(vertex);
    }
  }
  return { vertexCount, referencedMask, referencedCount, deadCount: deadIndices.length, deadIndices };
}

interface ReferencedBounds {
  sphere: Sphere;
  min: Vector3;
  max: Vector3;
}

// Test-local reference bounds over indexed vertices only, mirroring the
// essential Three.js bounding-sphere semantics: box center of the included
// set, radius = sqrt(max squared distance from that center).
function computeReferencedBounds(positions: Float32Array, mask: Uint8Array): ReferencedBounds {
  const box = new Box3();
  const point = new Vector3();
  const vertexCount = positions.length / 3;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (mask[vertex] !== 1) {
      continue;
    }
    point.set(positions[vertex * 3] ?? 0, positions[vertex * 3 + 1] ?? 0, positions[vertex * 3 + 2] ?? 0);
    box.expandByPoint(point);
  }
  const center = box.getCenter(new Vector3());
  let maxDistanceSquared = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (mask[vertex] !== 1) {
      continue;
    }
    point.set(positions[vertex * 3] ?? 0, positions[vertex * 3 + 1] ?? 0, positions[vertex * 3 + 2] ?? 0);
    maxDistanceSquared = Math.max(maxDistanceSquared, center.distanceToSquared(point));
  }
  return {
    sphere: new Sphere(center, Math.sqrt(maxDistanceSquared)),
    min: box.min.clone(),
    max: box.max.clone()
  };
}

function sampleCompiled(equation: string, domain: SurfaceDomain, resolution: number) {
  const compiled = compileSurfaceExpression(equation, "z");
  if (compiled.error || !compiled.evaluator) {
    throw new Error(`Cannot compile ${equation}: ${compiled.error}`);
  }
  const sampled = sampleSurface(compiled.evaluator, { domain, resolution, clampHeight: 10_000 });
  return sampled;
}

function buildSurfaceMesh(
  equation: string,
  resolution: number,
  orientation: SurfaceOrientation = "z"
): { mesh: Mesh; positions: Float32Array } {
  const object: SurfaceGraphObject = {
    id: "s8-surface",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { ...DOMAIN },
    resolution,
    appearance: { wireframe: false },
    orientation
  };
  const group = buildSurface(object, "dark", getGraphThemeTokens("dark"));
  if (!group) {
    throw new Error(`buildSurface returned null for ${equation}`);
  }
  let mesh: Mesh | null = null;
  group.traverse((child) => {
    if (mesh === null && child instanceof Mesh) {
      mesh = child;
    }
  });
  if (!mesh) {
    throw new Error(`buildSurface produced no Mesh for ${equation}`);
  }
  const found: Mesh = mesh;
  const positions = (found.geometry.getAttribute("position") as BufferAttribute).array as Float32Array;
  return { mesh: found, positions };
}

function sphereSummary(sphere: Sphere): string {
  return `center=(${sphere.center.x.toFixed(4)}, ${sphere.center.y.toFixed(4)}, ${sphere.center.z.toFixed(4)}) radius=${sphere.radius.toFixed(4)}`;
}

describe("S8-U2-C smooth control", () => {
  it("x^2+y^2 has no dead vertices and matching full/referenced bounds", () => {
    const sampled = sampleCompiled("x^2 + y^2", DOMAIN, 24);
    const analysis = analyzeDeadVertices(sampled.positions, sampled.indices);
    expect(analysis.vertexCount).toBe(625);
    expect(analysis.deadCount).toBe(0);
    expect(analysis.referencedCount).toBe(analysis.vertexCount);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(sampled.positions.slice(), 3));
    geometry.setIndex(new BufferAttribute(sampled.indices.slice(), 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const actual = geometry.boundingSphere as Sphere;
    const expected = computeReferencedBounds(sampled.positions, analysis.referencedMask).sphere;
    console.log(`SMOOTH actual ${sphereSummary(actual)} | referenced-only ${sphereSummary(expected)}`);
    expect(actual.center.distanceTo(expected.center)).toBeLessThan(1e-4);
    expect(Math.abs(actual.radius - expected.radius)).toBeLessThan(1e-4);

    const normals = geometry.getAttribute("normal") as BufferAttribute;
    for (let i = 0; i < normals.count; i += 1) {
      expect(Number.isFinite(normals.getX(i) + normals.getY(i) + normals.getZ(i))).toBe(true);
    }
  });
});

describe("S8-U2-D shifted singularity dead vertex", () => {
  it("pole sample exists as an unreferenced placeholder with a zero normal", () => {
    const compiled = compileSurfaceExpression(SINGULAR_EQUATION, "z");
    expect(compiled.error).toBeNull();

    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    expect(analysis.vertexCount).toBe(SINGULAR_STRIDE * SINGULAR_STRIDE);
    expect(analysis.deadCount).toBeGreaterThanOrEqual(1);
    expect(analysis.referencedMask[SINGULAR_INDEX]).toBe(0);

    const placeholder = new Vector3(
      positions[SINGULAR_INDEX * 3] ?? Number.NaN,
      positions[SINGULAR_INDEX * 3 + 1] ?? Number.NaN,
      positions[SINGULAR_INDEX * 3 + 2] ?? Number.NaN
    );
    console.log(
      `POLE index=${SINGULAR_INDEX} placeholder=(${placeholder.x}, ${placeholder.y}, ${placeholder.z}) deadCount=${analysis.deadCount}`
    );
    // Placeholder keeps the sampled (x, z) grid location at invalidHeight 0.
    expect(placeholder.x).toBeCloseTo(1, 9);
    expect(placeholder.y).toBe(0);
    expect(placeholder.z).toBeCloseTo(1, 9);

    const normals = mesh.geometry.getAttribute("normal") as BufferAttribute;
    const deadNormal = new Vector3(normals.getX(SINGULAR_INDEX), normals.getY(SINGULAR_INDEX), normals.getZ(SINGULAR_INDEX));
    expect(Number.isFinite(deadNormal.x + deadNormal.y + deadNormal.z)).toBe(true);
    expect(deadNormal.length()).toBeLessThan(1e-9);
  });
});

describe("S8-U2-E bounds defect regression", () => {
  it("DESIRED: geometry bounding sphere matches referenced-only rendered bounds", () => {
    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    expect(analysis.deadCount).toBeGreaterThanOrEqual(1);

    const actual = (mesh.geometry.boundingSphere as Sphere).clone();
    const expected = computeReferencedBounds(positions, analysis.referencedMask).sphere;
    const radiusRatio = actual.radius / expected.radius;
    const centerDisplacement = actual.center.distanceTo(expected.center);
    console.log(`BOUNDS actual ${sphereSummary(actual)}`);
    console.log(`BOUNDS referenced-only ${sphereSummary(expected)}`);
    console.log(`BOUNDS radiusRatio=${radiusRatio.toFixed(4)} centerDisplacement=${centerDisplacement.toFixed(4)}`);

    // Material defect gate: the placeholder must not inflate the sphere.
    expect(radiusRatio).toBeLessThan(1.05);
    expect(centerDisplacement).toBeLessThan(1.0);
  });
});

describe("S8-U2-F bounding-box characterization", () => {
  it("full-buffer box includes the placeholder while referenced-only min/max excludes it", () => {
    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);

    const fullBox = new Box3().setFromBufferAttribute(mesh.geometry.getAttribute("position") as BufferAttribute);
    const referenced = computeReferencedBounds(positions, analysis.referencedMask);
    console.log(
      `BOX full minY=${fullBox.min.y.toFixed(2)} maxY=${fullBox.max.y.toFixed(2)} | ref minY=${referenced.min.y.toFixed(2)} maxY=${referenced.max.y.toFixed(2)}`
    );
    expect(fullBox.min.y).toBe(0);
    expect(referenced.min.y).toBeGreaterThan(50);
    expect(referenced.max.y).toBeLessThanOrEqual(10_000);
  });
});

describe("S8-U2-G index safety", () => {
  it("emitted topology never references the singular placeholder", () => {
    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const vertexCount = positions.length / 3;
    expect(index.count % 3).toBe(0);
    const seen = new Set<number>();
    for (let i = 0; i < index.count; i += 1) {
      const vertex = index.getX(i);
      expect(vertex).toBeGreaterThanOrEqual(0);
      expect(vertex).toBeLessThan(vertexCount);
      expect(vertex).not.toBe(SINGULAR_INDEX);
      seen.add(vertex);
    }
    expect(seen.has(SINGULAR_INDEX)).toBe(false);
    expect(seen.size).toBe(vertexCount - analyzeDeadVertices(positions, index.array as Uint16Array).deadCount);
  });
});

describe("S8-U2-H normal characterization", () => {
  it("dead normals are finite zero vectors; referenced normals are finite", () => {
    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    expect(analysis.deadCount).toBeGreaterThanOrEqual(1);
    const normals = mesh.geometry.getAttribute("normal") as BufferAttribute;
    for (const dead of analysis.deadIndices) {
      const nx = normals.getX(dead);
      const ny = normals.getY(dead);
      const nz = normals.getZ(dead);
      expect(Number.isFinite(nx + ny + nz)).toBe(true);
      expect(Math.hypot(nx, ny, nz)).toBeLessThan(1e-9);
    }
    for (let vertex = 0; vertex < analysis.vertexCount; vertex += 1) {
      if (analysis.referencedMask[vertex] !== 1) {
        continue;
      }
      const nx = normals.getX(vertex);
      const ny = normals.getY(vertex);
      const nz = normals.getZ(vertex);
      expect(Number.isFinite(nx + ny + nz)).toBe(true);
    }
  });
});

describe("S8-U2-I S4 discontinuity non-regression", () => {
  it("tan(x) rejects triangles without orphaning any vertex", () => {
    const sampled = sampleCompiled("tan(x)", DOMAIN, 40);
    const analysis = analyzeDeadVertices(sampled.positions, sampled.indices);
    expect(sampled.rejectedTriangles).toBeGreaterThan(0);
    expect(analysis.vertexCount).toBe(41 * 41);
    expect(analysis.deadCount).toBe(0);
    expect(analysis.referencedCount).toBe(analysis.vertexCount);
  });

  it("tan(x*y) rejects triangles without orphaning any vertex", () => {
    const sampled = sampleCompiled("tan(x*y)", DOMAIN, 40);
    const analysis = analyzeDeadVertices(sampled.positions, sampled.indices);
    expect(sampled.rejectedTriangles).toBeGreaterThan(0);
    expect(analysis.deadCount).toBe(0);
    expect(analysis.referencedCount).toBe(analysis.vertexCount);
  });
});

describe("S8-U2-J raycast topology characterization", () => {
  it("narrow-phase hits only ever reference indexed vertices", () => {
    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    mesh.updateMatrixWorld(true);

    // Aim at the centroid of the first emitted triangle to guarantee a hit.
    const a = index.getX(0);
    const b = index.getX(1);
    const c = index.getX(2);
    const centroid = new Vector3(
      ((positions[a * 3] ?? 0) + (positions[b * 3] ?? 0) + (positions[c * 3] ?? 0)) / 3,
      ((positions[a * 3 + 1] ?? 0) + (positions[b * 3 + 1] ?? 0) + (positions[c * 3 + 1] ?? 0)) / 3,
      ((positions[a * 3 + 2] ?? 0) + (positions[b * 3 + 2] ?? 0) + (positions[c * 3 + 2] ?? 0)) / 3
    );
    const raycaster = new Raycaster(
      new Vector3(centroid.x, centroid.y + 500, centroid.z),
      new Vector3(0, -1, 0)
    );
    const hits = raycaster.intersectObject(mesh, false);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      const face = hit.face;
      if (!face) {
        continue;
      }
      expect(analysis.referencedMask[face.a]).toBe(1);
      expect(analysis.referencedMask[face.b]).toBe(1);
      expect(analysis.referencedMask[face.c]).toBe(1);
      expect([face.a, face.b, face.c]).not.toContain(SINGULAR_INDEX);
    }
  });
});

describe("S8-U2-K memory characterization", () => {
  it("reports dead-vertex buffer overhead informationally", () => {
    const { mesh, positions } = buildSurfaceMesh(SINGULAR_EQUATION, SINGULAR_RESOLUTION);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    const deadPositionBytes = analysis.deadCount * 3 * 4;
    const deadPositionNormalBytes = analysis.deadCount * 3 * 4 * 2;
    console.log(
      `MEMORY dead=${analysis.deadCount}/${analysis.vertexCount} deadPositionBytes=${deadPositionBytes} deadPositionNormalBytes=${deadPositionNormalBytes}`
    );
    expect(deadPositionBytes).toBe(analysis.deadCount * 12);
    expect(deadPositionNormalBytes).toBe(deadPositionBytes * 2);
  });
});

describe("S8-U4-E clamped valid geometry", () => {
  it("indexed clamped vertices drive the sphere; magnitude never excludes", () => {
    const { mesh, positions } = buildSurfaceMesh("20000 * sin(x) * cos(y)", 24);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    let clampedTotal = 0;
    let clampedReferenced = 0;
    for (let vertex = 0; vertex < analysis.vertexCount; vertex += 1) {
      if (Math.abs(positions[vertex * 3 + 1] ?? 0) >= 10_000 - 1e-6) {
        clampedTotal += 1;
        if (analysis.referencedMask[vertex] === 1) {
          clampedReferenced += 1;
        }
      }
    }
    expect(clampedTotal).toBeGreaterThan(0);
    expect(clampedReferenced).toBe(clampedTotal);
    const sphere = mesh.geometry.boundingSphere as Sphere;
    expect(sphere.radius).toBeGreaterThanOrEqual(10_000);
  });
});

describe("S8-U4-F orientation builds", () => {
  it.each([
    { orientation: "z", equation: "x^2 + y^2" },
    { orientation: "y", equation: "x^2 + z^2" },
    { orientation: "x", equation: "y^2 + z^2" }
  ] as const)("encloses every indexed vertex for $orientation orientation", ({ orientation, equation }) => {
    const { mesh, positions } = buildSurfaceMesh(equation, 24, orientation);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    const sphere = mesh.geometry.boundingSphere as Sphere;
    const point = new Vector3();
    for (let vertex = 0; vertex < analysis.vertexCount; vertex += 1) {
      if (analysis.referencedMask[vertex] !== 1) {
        continue;
      }
      point.set(positions[vertex * 3] ?? 0, positions[vertex * 3 + 1] ?? 0, positions[vertex * 3 + 2] ?? 0);
      expect(point.distanceTo(sphere.center)).toBeLessThanOrEqual(sphere.radius + 1e-6);
    }
  });
});

describe("S8-U4-G enclosure invariant", () => {
  it.each([
    { label: "smooth", equation: "x^2 + y^2", resolution: 24, orientation: "z" as const },
    { label: "singular", equation: SINGULAR_EQUATION, resolution: SINGULAR_RESOLUTION, orientation: "z" as const },
    { label: "tan", equation: "tan(x)", resolution: 40, orientation: "z" as const },
    { label: "clamped", equation: "20000 * sin(x) * cos(y)", resolution: 24, orientation: "z" as const }
  ])("never excludes a referenced vertex ($label)", ({ equation, resolution, orientation }) => {
    const { mesh, positions } = buildSurfaceMesh(equation, resolution, orientation);
    const index = mesh.geometry.getIndex();
    if (!index) {
      throw new Error("Built surface geometry has no index");
    }
    const analysis = analyzeDeadVertices(positions, index.array as Uint16Array);
    const sphere = mesh.geometry.boundingSphere as Sphere;
    expect(analysis.referencedCount).toBeGreaterThan(0);
    const point = new Vector3();
    for (let vertex = 0; vertex < analysis.vertexCount; vertex += 1) {
      if (analysis.referencedMask[vertex] !== 1) {
        continue;
      }
      point.set(positions[vertex * 3] ?? 0, positions[vertex * 3 + 1] ?? 0, positions[vertex * 3 + 2] ?? 0);
      expect(point.distanceTo(sphere.center)).toBeLessThanOrEqual(sphere.radius + 1e-6);
    }
  });
});
