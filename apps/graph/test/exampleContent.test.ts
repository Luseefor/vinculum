import { describe, expect, it } from "vitest";
import { SCENE_EXAMPLES, getSceneExampleById } from "@/lib/templates/examplesRegistry";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { sampleParametricSurface } from "@/lib/math/sampleParametricSurface";
import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { computeVectorFieldData } from "@/lib/math/computeVectorFieldData";

it.each(SCENE_EXAMPLES)("$title compiles and produces finite, nonempty plotted data", example => {
  const scene = example.createScene();
  expect(scene.metadata.name).toBe(example.title);
  expect(scene.objects.length).toBeGreaterThan(0);
  for (const object of scene.objects) {
    let positions: Float32Array;
    switch (object.kind) {
      case "surface": {
        const compiled = compileSurfaceExpression(object.equation, object.orientation);
        expect(compiled.error).toBeNull();
        const mesh = sampleSurface(compiled.evaluator, { domain: object.domain, resolution: object.resolution, orientation: compiled.effectiveOrientation });
        expect(mesh.indices.length).toBeGreaterThan(0);
        positions = mesh.positions;
        break;
      }
      case "implicitSurface": {
        const data = computeImplicitSurfaceData({ equation: object.equation, domain: object.domain, resolution: object.resolution, params: {} });
        expect(data.status).toBe("ok");
        if (data.status !== "ok") throw new Error(`Empty or failed example: ${example.id}`);
        expect(data.triangleCount).toBeGreaterThan(0);
        positions = data.positions;
        break;
      }
      case "parametricSurface": {
        const compiled = compileParametricSurfaceExpressions(object.xExpr, object.yExpr, object.zExpr, {});
        expect(compiled.error).toBeNull();
        const mesh = sampleParametricSurface(compiled.evaluator, object);
        expect(mesh.indices.length).toBeGreaterThan(0);
        positions = mesh.positions;
        break;
      }
      case "parametricCurve": {
        const compiled = compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr);
        expect(compiled.error).toBeNull();
        const curve = sampleCurve(compiled.evaluator, object);
        expect(Array.from(curve.validSamples).every(v => v === 1)).toBe(true);
        expect(Array.from(curve.connectedSegments).some(v => v === 1)).toBe(true);
        positions = curve.positions;
        break;
      }
      case "plane": {
        const compiled = compilePlaneEquation(object.equation, {});
        expect(compiled.error).toBeNull();
        expect(compiled.coefficients).not.toBeNull();
        positions = samplePlane(compiled.coefficients!, object.size).positions;
        break;
      }
      case "vectorField": {
        const data = computeVectorFieldData({ ...object, params: {} });
        expect(data.status).toBe("ok");
        if (data.status !== "ok") throw new Error("Empty field");
        expect(data.invalidCount).toBe(0);
        expect(data.maxMagnitude).toBeGreaterThan(0);
        positions = data.positions;
        break;
      }
      default: throw new Error(`Unaudited example kind ${object.kind}`);
    }
    expect(positions.length).toBeGreaterThan(0);
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
  }
});

describe("named shapes", () => {
  it("uses a real radius-3 sphere and a correctly signed saddle", () => {
    const sphere = getSceneExampleById("surface-sphere")!.createScene().objects[0];
    expect(sphere.kind).toBe("implicitSurface");
    if (sphere.kind !== "implicitSurface") throw new Error("Wrong kind");
    const sphereFn = compileImplicitSurfaceExpression(sphere.equation, {}).evaluator;
    for (const p of [[3, 0, 0], [0, -3, 0], [0, 0, 3]]) expect(sphereFn(...p as [number, number, number])).toBeCloseTo(0);
    expect(sphereFn(0, 0, 0)).toBe(-9);
    const saddle = getSceneExampleById("surface-saddle")!.createScene().objects[0];
    if (saddle.kind !== "surface") throw new Error("Wrong kind");
    const height = compileSurfaceExpression(saddle.equation).evaluator;
    expect(height(2, 0)).toBe(2);
    expect(height(0, 2)).toBe(-2);
    expect(height(2, 2)).toBe(0);
  });

  it("matches the unit sphere and torus descriptions", () => {
    const sphere = getSceneExampleById("parametric-sphere")!.createScene().objects[0];
    const torus = getSceneExampleById("parametric-torus")!.createScene().objects[0];
    if (sphere.kind !== "parametricSurface" || torus.kind !== "parametricSurface") throw new Error("Wrong kind");
    const sf = compileParametricSurfaceExpressions(sphere.xExpr, sphere.yExpr, sphere.zExpr, {}).evaluator;
    const tf = compileParametricSurfaceExpressions(torus.xExpr, torus.yExpr, torus.zExpr, {}).evaluator;
    for (const u of [0, 0.8, Math.PI]) for (const v of [0, 1.7, 2 * Math.PI]) {
      expect(Math.hypot(...sf(u, v))).toBeCloseTo(1);
      const [x, y, z] = tf(u, v);
      expect((Math.hypot(x, y) - 2) ** 2 + z * z).toBeCloseTo(0.25);
    }
  });
});
