import { describe, it, expect, beforeEach } from "vitest";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import {
  MAX_HISTORY_SNAPSHOTS,
  useHistoryStore,
} from "@/lib/store/historyStore";
import { createGeometryComputeManager } from "@/lib/compute/geometryComputeManager";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { validateSceneDocument } from "@/lib/scene/validateScene";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import {
  compileScalarGradient,
  evaluateSurfaceGradient,
  normalizeSurfaceLevelSet,
  type SurfaceLevelSet,
} from "@/lib/math/surfaceDifferential";
import {
  compileVectorFieldDifferential,
  evaluateVectorDifferential,
  vectorCurl3D,
  vectorDivergence,
} from "@/lib/math/vectorCalculus";
import {
  determinant3,
  inverse3,
  matrixRank,
  type Matrix3,
} from "@/lib/math/matrix";
import { useEditorStore } from "@/lib/store/editorStore";
import type { SceneSnapshot } from "@/lib/types/scene";

function makeSnapshot(id: string): SceneSnapshot {
  return {
    objects: [{ id } as unknown as SceneSnapshot["objects"][number]],
    measurements: [],
    selection: { selectedObjectId: null },
  };
}

function setEditorParams(params: Record<string, number>): void {
  useEditorStore.setState({
    parameters: Object.entries(params).map(([id, value]) => ({
      id,
      value,
      min: -1e9,
      max: 1e9,
    })),
  });
}

function gradientOfParaboloidAt(x: number, y: number): { fx: number; fy: number } {
  const levelSet = normalizeSurfaceLevelSet({
    id: "s",
    kind: "surface",
    color: "#fff",
    visible: true,
    equation: "z = x^2+2*y^2",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 32,
    appearance: { wireframe: false },
  });
  if ("error" in levelSet) throw new Error(levelSet.error);
  const compiled = compileScalarGradient(levelSet as SurfaceLevelSet, {});
  expect(compiled.error).toBeNull();
  const result = evaluateSurfaceGradient(compiled, { x, y, z: x * x + 2 * y * y }, {});
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("gradient unavailable");
  // Level-set convention is G = z - f, so gradient = <-fx, -fy, 1>.
  return { fx: -result.gradient.x, fy: -result.gradient.y };
}

// S29 core-freeze audit regressions: only BLOCKER/MAJOR correctness defects
// found by the audit get pinned here. Each case names its repair ID.

describe("S29 core freeze audit", () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    useGeometryComputeStore.getState().clearAll();
    setEditorParams({});
  });

  it("S29-R1: plane probe locals win over same-named params", () => {
    const withoutParams = compilePlaneEquation("x = 1", {});
    expect(withoutParams.error).toBeNull();
    expect(withoutParams.coefficients).toMatchObject({ a: 1, b: 0, c: 0, d: -1 });

    const withShadowingParams = compilePlaneEquation("x = 1", { x: 100, y: 100, z: 100 });
    expect(withShadowingParams.error).toBeNull();
    expect(withShadowingParams.coefficients).toMatchObject({ a: 1, b: 0, c: 0, d: -1 });
  });

  it("S29-R2: history stack is bounded", () => {
    expect(MAX_HISTORY_SNAPSHOTS).toBe(100);
    for (let i = 0; i < MAX_HISTORY_SNAPSHOTS + 20; i += 1) {
      useHistoryStore.getState().pushSnapshot(makeSnapshot(`s${i}`));
    }
    const { past } = useHistoryStore.getState();
    expect(past.length).toBe(MAX_HISTORY_SNAPSHOTS);
    expect(JSON.stringify(past[0])).toContain("s20");
    expect(JSON.stringify(past[past.length - 1])).toContain(`s${MAX_HISTORY_SNAPSHOTS + 19}`);
  });

  it("S29-R3: manager dispose clears only tracked IDs", () => {
    const mkTransport = () => ({
      postRequest: () => {},
      setOnResponse: () => {},
      setOnError: () => {},
      terminate: () => {},
    });
    const a = createGeometryComputeManager({ createTransport: mkTransport, onResult: () => {} });
    const b = createGeometryComputeManager({ createTransport: mkTransport, onResult: () => {} });
    a.requestCompute({
      objectId: "obj-a",
      kind: "implicitSurface",
      payload: {
        equation: "x^2+y^2+z^2=1",
        domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
        resolution: 8,
      } as never,
      params: {},
      structure: "sa",
    });
    b.requestCompute({
      objectId: "obj-b",
      kind: "implicitSurface",
      payload: {
        equation: "x^2+y^2+z^2=1",
        domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
        resolution: 8,
      } as never,
      params: {},
      structure: "sb",
    });
    expect(useGeometryComputeStore.getState().entries["obj-a"]?.status).toBe("pending");
    expect(useGeometryComputeStore.getState().entries["obj-b"]?.status).toBe("pending");
    a.dispose();
    expect(useGeometryComputeStore.getState().entries["obj-a"]).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["obj-b"]?.status).toBe("pending");
    b.dispose();
  });

  it("S29-R5: surface cache keys include param snapshot", () => {
    setEditorParams({});
    const before = compileSurfaceExpression("a*x", "z");
    expect(before.error).not.toBeNull();
    setEditorParams({ a: 2 });
    const after = compileSurfaceExpression("a*x", "z");
    expect(after.error).toBeNull();
    expect(after.evaluator(1, 0)).toBeCloseTo(2, 8);
    setEditorParams({});
  });

  it("S29-R6: parametric cache keys include param snapshot", () => {
    setEditorParams({});
    const before = compileParametricExpressions("a*t", "t", "0");
    expect(before.error).not.toBeNull();
    setEditorParams({ a: 3 });
    const after = compileParametricExpressions("a*t", "t", "0");
    expect(after.error).toBeNull();
    expect(after.evaluator(2)[0]).toBeCloseTo(6, 8);
    setEditorParams({});
  });

  it("S29-R7: duplicate object and measurement IDs reject", () => {
    const doc = {
      schemaVersion: 1,
      version: "1.0.0",
      metadata: { name: "dup", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      objects: [
        { id: "dup", kind: "point", color: "#ffffff", visible: true, xExpr: "0", yExpr: "0", zExpr: "0" },
        { id: "dup", kind: "point", color: "#ffffff", visible: true, xExpr: "1", yExpr: "1", zExpr: "1" },
      ],
      measurements: [],
    };
    const result = validateSceneDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/unique/i);

    const doc2 = {
      schemaVersion: 1,
      version: "1.0.0",
      metadata: { name: "dup-m", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      objects: [],
      measurements: [
        { id: "m1", kind: "pin", point: { x: 0, y: 0, z: 0 } },
        { id: "m1", kind: "pin", point: { x: 1, y: 1, z: 1 } },
      ],
    };
    const result2 = validateSceneDocument(doc2);
    expect(result2.valid).toBe(false);
    expect(result2.errors.join("\n")).toMatch(/unique/i);
  });

  it("S29 master: coordinates (1,2,3)->(1,3,2), direction <4,5,6>-><4,6,5>", () => {
    expect(mathToWorld3D({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: 2 });
    expect(mathVectorToWorld3D({ x: 4, y: 5, z: 6 })).toEqual({ x: 4, y: 6, z: 5 });
  });

  it("S29 master: implicit sphere residual sane", () => {
    const compiled = compileImplicitSurfaceExpression("x^2+y^2+z^2=1", {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(1, 0, 0)).toBeCloseTo(0, 8);
    expect(compiled.evaluator(0, 0, 0)).toBeCloseTo(-1, 8);
  });

  it("S29 master: differential paraboloid z=x^2+2y^2 at (1,2,9)", () => {
    // Level-set gradient of F=x^2+2y^2-z at (1,2,9) is <2,8,-1>;
    // explicit partials are fx=2, fy=8.
    const g = gradientOfParaboloidAt(1, 2);
    expect(g.fx).toBeCloseTo(2, 6);
    expect(g.fy).toBeCloseTo(8, 6);
  });

  it("S29 master: rotation field F=<-y,x,0> div=0 curl=<0,0,2>", () => {
    const compiled = compileVectorFieldDifferential("3d", "-y", "x", "0", {});
    const jacobian = evaluateVectorDifferential(compiled, { x: 1, y: 0, z: 0 }, {});
    expect(vectorDivergence(jacobian)).toBeCloseTo(0, 6);
    expect(vectorCurl3D(jacobian)).toMatchObject({ x: 0, y: 0, z: 2 });
  });

  it("S29 master: linear algebra diag(2,3,4) det=24 rank=3", () => {
    const m: Matrix3 = [2, 0, 0, 0, 3, 0, 0, 0, 4];
    expect(determinant3(m)).toBeCloseTo(24, 8);
    expect(matrixRank([2, 0, 0, 0, 3, 0, 0, 0, 4], 3)).toBe(3);
    const inv = inverse3(m);
    expect(inv?.[0]).toBeCloseTo(0.5, 8);
    expect(inv?.[4]).toBeCloseTo(1 / 3, 8);
    expect(inv?.[8]).toBeCloseTo(0.25, 8);
  });

  it("S29 master: vector field compiles with params (cross-feature param scene)", () => {
    const compiled = compileVectorFieldExpressions("2d", "a*x", "-a*y", "", { a: 2 });
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate2D?.(1, 1)).toEqual([2, -2]);
  });
});
