import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultSurfaceGraph, createDefaultParametricCurve, createDefaultImplicitSurfaceGraph, createDefaultPlaneGraph } from "@vinculum/scene/defaults";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { compileSurfaceExpression } from "@/lib/math/expressions/compileExpression";
import { inferGraphEquation } from "@/lib/math/expressions/inferGraphEquation";
import { compileParametricCurveExpressions, compileParametricExpressions } from "@/lib/math/expressions/compileParametric";
import { useEditorStore } from "@/lib/store/editorStore";
import { export2dSvg } from "@/lib/export/sceneExport";
import { sampleCurve } from "@/lib/math/curves/sampleCurve";
import { buildImplicitCurve } from "@/lib/graph3d/buildGraphImplicitCurve";
import { planarCurveDisplayDomain } from "@/lib/graph3d/surfaceDisplayDomain";
import { getGraphObjectStructureSignature } from "@/lib/graph3d/graphObject3dSignatures";
import { disposeObject3D } from "@/lib/graph3d/buildGraphObjectDisposal";
import { getGraphObjectFor3D, isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";
import { useGraphStore } from "@/store/graphStore";
import type { BufferGeometry } from "three";

beforeEach(() => useGraphStore.getState().resetScene());
describe("2D and 3D mathematical rendering parity", () => {
  it("changes the rendered coordinate with the dependent-variable control for assigned surfaces", () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    state.updateSurfaceEquation(id, "z = 3");
    state.updateSurfaceOrientation(id, "x");
    const object = useGraphStore.getState().scene.objects.find(o => o.id === id)!;
    if (object.kind !== "surface") throw new Error("expected surface");
    expect(compileSurfaceExpression(object.equation, object.orientation).effectiveOrientation).toBe("x");
    const slice = buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {})[0];
    expect(slice.swapAxes).toBe(true);
    expect(slice.evaluate!(1)).toBe(3);
  });
  it("shares immutable parameter snapshots between renderer and explicit compiler cache entries", () => {
    useEditorStore.getState().ensureParameters(["a"]);
    useEditorStore.getState().setParameterValue("a", 3);
    const curve = compileParametricExpressions("a*t", "t", "0");
    const surface = compileSurfaceExpression("a*x", "z");
    useEditorStore.getState().setParameterValue("a", 9);
    expect(curve.evaluator(2)).toEqual([6, 2, 0]);
    expect(compileParametricCurveExpressions("a*t", "t", "0", { a: 3 }).evaluator(2)).toEqual([6, 2, 0]);
    expect(surface.evaluator(2, 0)).toBe(6);
    expect(compileSurfaceExpression("a*x", "z", { a: 3 }).evaluator(2, 0)).toBe(6);
    expect(compileParametricExpressions("a*t", "t", "0").evaluator(2)).toEqual([18, 2, 0]);
  });
  it.each(["x", "y", "z"] as const)("maps %s surfaces to both in-plane slice orientations", output => {
    const inputs = output === "x" ? ["y", "z"] : output === "y" ? ["x", "z"] : ["x", "y"];
    const object = createDefaultSurfaceGraph({ id: "s", index: 0, equation: `${output}=a*${inputs[0]}+2*${inputs[1]}` });
    object.orientation = output;
    object.domain = { xMin: -2, xMax: 2, yMin: -3, yMax: 3 };
    const compiled = compileSurfaceExpression(object.equation, output, { a: 3 });
    for (const pair of ["xy", "xz", "yz"] as const) {
      const spec = getAxisPairSpec(pair);
      const graph = buildRenderableGraphsFromScene([object], spec, { a: 3 })[0];
      if (output !== spec.horizontal && output !== spec.vertical) {
        expect(graph.hatchDomain).toBeNull();
        expect(graph.implicitEvaluate!(1, -1.5)).toBeCloseTo(0);
        continue;
      }
      const input = output === spec.horizontal ? spec.vertical : spec.horizontal;
      const coords = { x: 0, y: 0, z: 0, [input]: 1 };
      expect(graph.swapAxes).toBe(output === spec.horizontal);
      expect(graph.evaluate!(1)).toBe(compiled.evaluator(coords[inputs[0] as "x" | "y" | "z"], coords[inputs[1] as "x" | "y" | "z"]));
      expect(graph.evaluate!(4)).toBeNull();
    }
  });

  it("does not invent a slice when the omitted independent coordinate lies outside the saved domain", () => {
    const object = createDefaultSurfaceGraph({ id: "s", index: 0, equation: "z=x+y" });
    object.domain = { xMin: -2, xMax: 2, yMin: 1, yMax: 3 };
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xz"), {})[0].evaluate!(1)).toBeNull();
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("yz"), {})[0].evaluate!(2)).toBe(2);
  });

  it("preserves Follow view for automatic surfaces while fixed ranges clip slices", () => {
    const object = createDefaultSurfaceGraph({ id: "auto", index: 0, equation: "z=x+y" });
    object.autoDomain = true;
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xz"), {})[0].evaluate!(20)).toBe(20);
    object.autoDomain = false;
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xz"), {})[0].evaluate!(20)).toBeNull();
    object.equation = "z=0";
    object.autoDomain = true;
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {})[0]).toMatchObject({ coplanarSurface: true, hatchDomain: null });
    object.equation = "z=a";
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), { a: 0 })[0]).toMatchObject({ coplanarSurface: true, hatchDomain: null });
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), { a: 2 })[0].implicitEvaluate!(0, 0)).toBe(-2);
  });

  it("does not misread a comparison in a surface body as an implicit equation", () => {
    const object = createDefaultSurfaceGraph({ id: "step", index: 0, equation: "x >= 0 ? x : -x" });
    const graph = buildRenderableGraphsFromScene([object], getAxisPairSpec("xz"), {})[0];
    expect(graph.evaluate!(-2)).toBe(2);
    expect(graph.evaluate!(2)).toBe(2);
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {})[0].hatchDomain).toBeNull();
  });

  it("exports a coincident surface as its visible area instead of dropping it", async () => {
    const object = createDefaultSurfaceGraph({ id: "flat", index: 0, equation: "z=0" });
    object.autoDomain = true;
    const result = export2dSvg({ objects: [object], sceneName: "parity", axisPair: "xy", viewport: { centerX: 0, centerY: 0, scale: 20 }, viewportFrame: { width: 200, height: 100 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const svg = await result.file!.blob.text();
    expect(svg).toContain('width="200.00" height="100.00"');
    expect(svg).toContain('fill-opacity="0.12"');
    expect(result.file!.warnings).toEqual([]);
  });

  it.each(["xy", "xz", "yz"] as const)("projects a parameterized curve with the exact 3D sampling topology onto %s", pair => {
    const object = createDefaultParametricCurve({ id: "c", index: 0, xExpr: "a*t", yExpr: "t^2", zExpr: "2*t", tMin: -1, tMax: 1, samples: 33 });
    const sampled = sampleCurve(compileParametricCurveExpressions(object.xExpr, object.yExpr, object.zExpr, { a: 3 }).evaluator, object);
    const graph = buildRenderableGraphsFromScene([object], getAxisPairSpec(pair), { a: 3 })[0].polylineHV!;
    expect(graph.connectedSegments).toEqual(sampled.connectedSegments);
    const indices = pair === "xy" ? [0, 2] : pair === "xz" ? [0, 1] : [2, 1];
    for (let i = 0; i < 33; i++) {
      expect(graph.points[2 * i]).toBe(sampled.positions[3 * i + indices[0]]);
      expect(graph.points[2 * i + 1]).toBe(sampled.positions[3 * i + indices[1]]);
    }
  });

  it("respects implicit-surface bounds in scalar and batched slice samples", () => {
    const object = createDefaultImplicitSurfaceGraph({ id: "i", index: 0, equation: "x^2+y^2+z^2=4" });
    object.domain = { xMin: 0, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3 };
    const field = buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {})[0].implicitEvaluate!;
    expect(field(2, 0)).toBe(0);
    expect(field(-2, 0)).toBeNull();
    const batch = (field as typeof field & { sampleXYGrid: (...args: number[]) => Float64Array }).sampleXYGrid(-2, 2, 3, 0, 1, 2);
    expect(batch[0]).toBeNaN();
    expect(batch[2]).toBe(0);
    object.domain.zMin = 1;
    expect(buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {})[0].implicitEvaluate!(2, 0)).toBeNull();
  });

  it("uses the actual bounded 3D plane patch for its 2D intersection", () => {
    const plane = createDefaultPlaneGraph({ id: "p", index: 0, equation: "x=a", size: 4 });
    const points = buildRenderableGraphsFromScene([plane], getAxisPairSpec("xy"), { a: 3 })[0].polylineHV!.points;
    expect([...points]).toEqual([3, 2, 3, -2]);
    expect(buildRenderableGraphsFromScene([plane], getAxisPairSpec("yz"), { a: 3 })).toEqual([]);
    plane.equation = "z=0";
    expect(buildRenderableGraphsFromScene([plane], getAxisPairSpec("xy"), {})[0].polylineHV!.points).toHaveLength(10);
  });

  it.each(["y=10", "x=12", "y=x^2+10"])("keeps %s on the 3D XY plane above the previous cutoff", equation => {
    const stroke = buildImplicitCurve({ kind: "implicitCurve", id: "c", equation, color: "#3b82f6", visible: true })!;
    expect(stroke).not.toBeNull();
    const positions = (stroke.geometry as BufferGeometry).userData.strokePositions as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i + 1]).toBe(0);
      if (equation === "x=12") expect(positions[i]).toBe(12);
      else expect(positions[i + 2]).toBeGreaterThanOrEqual(10);
    }
    disposeObject3D(stroke);
  });

  it("expands and recenters planar relations with camera tiles and includes those bounds in cache identity", () => {
    const view = { distance: 16, fov: 48, aspect: 1.5, target: { x: 0, y: 0, z: 0 } };
    const domain = planarCurveDisplayDomain(view);
    expect(domain.xMax).toBeGreaterThan(7);
    const object = { kind: "implicitCurve" as const, id: "circle", equation: "x^2+y^2=49", color: "#3b82f6", visible: true, displayDomain: domain };
    expect(getGraphObjectFor3D({ ...object, extendTo3D: true })).toMatchObject({ kind: "implicitSurface", domain: { ...domain, zMin: -5, zMax: 5 } });
    const stroke = buildImplicitCurve(object)!;
    expect(stroke).not.toBeNull();
    const shifted = planarCurveDisplayDomain({ ...view, target: { x: 50, y: 0, z: 100 } });
    const shiftedObject = { ...object, displayDomain: shifted };
    expect(getGraphObjectStructureSignature(object)).not.toBe(getGraphObjectStructureSignature(shiftedObject));
    expect(planarCurveDisplayDomain({ ...view, distance: 16.01 })).toEqual(domain);
    disposeObject3D(stroke);
  });

  it("checks every canonical object kind against its supported viewport", () => {
    const store = useGraphStore.getState();
    const ids = [store.addSurfaceObject(), store.addParametricCurve(), store.addPlaneObject(), store.addImplicitSurface(), store.addParametricSurface(), store.addVectorFieldObject("2d"), store.addVectorFieldObject("3d"), store.addPointObject(), store.addVectorObject(), store.addLineObject(), store.addRayObject(), store.addSegmentObject(), store.addLinearTransformObject("2d"), store.addLinearTransformObject("3d")];
    for (const id of ids) {
      const object = useGraphStore.getState().scene.objects.find(o => o.id === id)!;
      const renderables = buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {});
      const supports2D = !["point", "vector", "ray"].includes(object.kind) && !((object.kind === "vectorField" || object.kind === "linearTransform") && object.dimension === "3d");
      expect(renderables.length > 0, `${object.kind} 2D support`).toBe(supports2D);
      expect(isGraphObjectRenderable3D(object), `${object.kind} 3D support`).toBe(!(object.kind === "vectorField" && object.dimension === "2d"));
    }
  });

  it.each(["1/(x-0.013)=0", "1e-20/(x-0.013)=0", "(x<0.013 ? -1 : 1)=0"])("does not invent a spatial contour at a sign discontinuity: %s", equation => {
    expect(inferGraphEquation(equation, {})).toMatchObject({ ok: true, dimension: "2d" });
    expect(buildImplicitCurve({ id: "pole", kind: "implicitCurve", equation, color: "#123456", visible: true })).toBeNull();
  });
});
