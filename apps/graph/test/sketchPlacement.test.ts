import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { fitParametricSketch } from "@/lib/math/fitParametricSketch";
import { mathToWorld3D, projectMathToPair2D } from "@/lib/math/coordinates";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";

beforeEach(() => useGraphStore.getState().resetScene());
const stroke = Array.from({ length: 41 }, (_, i) => ({ horizontal: 2 + i / 10, vertical: 3 + i / 5 }));

describe("sketch placement", () => {
  it.each(["xy", "xz", "yz"] as const)("keeps a sketch on its mathematical %s plane", pair => {
    const id = useGraphStore.getState().addSketchedParametricFromStroke(stroke, pair);
    const object = useGraphStore.getState().scene.objects.find(o => o.id === id)!;
    expect(object.kind).toBe("parametricCurve");
    if (object.kind !== "parametricCurve") throw new Error("Wrong kind");
    const compiled = compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr);
    expect(compiled.error).toBeNull();
    for (const t of [0, 0.5, 1]) {
      const [x, y, z] = compiled.evaluator(t);
      const projected = projectMathToPair2D({ x, y, z }, pair);
      expect(projected.horizontal).toBeCloseTo(2 + 4 * t, 4);
      expect(projected.vertical).toBeCloseTo(3 + 8 * t, 4);
      expect({ xy: z, xz: y, yz: x }[pair]).toBe(0);
    }
    expect(deserializeScene(serializeScene(useGraphStore.getState().scene)).normalizedScene?.objects).toEqual(useGraphStore.getState().scene.objects);
  });

  it("converts a world-space 3D sketch back to math exactly once", () => {
    const points = stroke.map(p => mathToWorld3D({ x: p.horizontal, y: p.vertical, z: 0 }));
    const id = useGraphStore.getState().addSketchedParametricFromStroke3d(points);
    const object = useGraphStore.getState().scene.objects.find(o => o.id === id)!;
    if (object.kind !== "parametricCurve") throw new Error("Wrong kind");
    const compiled = compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr);
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(0.5)).toEqual([4, 7, 0]);
  });
});

describe("sketch recognition", () => {
  it("recognizes a parabola instead of forcing an arc-length polynomial", () => {
    const points = Array.from({ length: 81 }, (_, i) => {
      const x = -2 + i / 20;
      return { horizontal: x, vertical: x * x };
    });
    const fit = fitParametricSketch(points)!;
    expect(fit.shape).toBe("parabola");
    expect(fit.horizontalExpr).toBe("-2 + 4*t");
    expect(fit.verticalExpr).toBe("4 - 16*t + 16*t^2");
    const curve = compileParametricExpressions(fit.horizontalExpr, fit.verticalExpr, "0");
    expect(curve.error).toBeNull();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [x, y] = curve.evaluator(t);
      expect(y).toBeCloseTo(x * x, 4);
    }
  });

  it.each([1, -1])("recognizes a translated circle in drawing direction %s", direction => {
    const points = Array.from({ length: 101 }, (_, i) => {
      const angle = direction * 2 * Math.PI * i / 100;
      return { horizontal: 20 + 3 * Math.cos(angle), vertical: -7 + 3 * Math.sin(angle) };
    });
    const fit = fitParametricSketch(points)!;
    expect(fit.shape).toBe("circle");
    const curve = compileParametricExpressions(fit.horizontalExpr, fit.verticalExpr, "0");
    expect(curve.error).toBeNull();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [x, y] = curve.evaluator(t);
      expect(x).toBeCloseTo(20 + 3 * Math.cos(direction * 2 * Math.PI * t), 4);
      expect(y).toBeCloseTo(-7 + 3 * Math.sin(direction * 2 * Math.PI * t), 4);
    }
  });

  it("keeps angular freehand strokes rather than accepting a bad polynomial", () => {
    const corners = [{ horizontal: 0, vertical: 0 }, { horizontal: 4, vertical: 0 }, { horizontal: 4, vertical: 3 }, { horizontal: 1, vertical: 3 }, { horizontal: 1, vertical: -2 }];
    const fit = fitParametricSketch(corners)!;
    expect(fit.shape).toBe("freehand");
    expect(fit.horizontalExpr.length).toBeLessThan(2048);
    expect(fit.verticalExpr.length).toBeLessThan(2048);
    const curve = compileParametricExpressions(fit.horizontalExpr, fit.verticalExpr, "0");
    expect(curve.error).toBeNull();
    corners.forEach((p, i) => {
      const [x, y] = curve.evaluator(i / 4);
      expect(x).toBeCloseTo(p.horizontal, 4);
      expect(y).toBeCloseTo(p.vertical, 4);
    });
  });

  it("rejects invalid coordinates without adding a broken curve", () => {
    expect(fitParametricSketch([...stroke, { horizontal: NaN, vertical: 2 }])).toBeNull();
    expect(useGraphStore.getState().addSketchedParametricFromStroke([...stroke, { horizontal: Infinity, vertical: 2 }])).toBe("");
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });
});

describe("3D sketch rendering", () => {
  it("shows the next draft after clearing a previous stroke", async () => {
    const { BufferGeometry, Line, LineBasicMaterial } = await import("three");
    const { appendThreeSketchPoint, clearThreeSketch } = await import("@/lib/graph3d/graphThreeSketchStroke");
    const geometry = new BufferGeometry();
    const line = new Line(geometry, new LineBasicMaterial());
    clearThreeSketch(geometry, line);
    let points = appendThreeSketchPoint([], geometry, line, { x: 0, y: 0, z: 0 });
    points = appendThreeSketchPoint(points, geometry, line, { x: 1, y: 0, z: 2 });
    expect(line.visible).toBe(true);
    expect(geometry.drawRange.count).toBe(points.length);
    geometry.dispose();
    line.material.dispose();
  });

  it("draws on the baseline even when a surface is in front of it", async () => {
    const { Group, Mesh, BoxGeometry, MeshBasicMaterial, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } = await import("three");
    const { pickWorldPointFromCanvasPointer } = await import("@/lib/graph3d/graphThreeEnginePickWorld");
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 10, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const root = new Group();
    const surface = new Mesh(new BoxGeometry(4, 1, 4), new MeshBasicMaterial());
    surface.position.y = 3;
    root.add(surface);
    root.updateMatrixWorld(true);
    const args = { renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } } as unknown as import("@/lib/graph3d/graphRenderer").GraphRenderer,
      camera, objectsRoot: root, baselinePlane: new Plane(new Vector3(0, 1, 0), 0), tempGround: new Vector3(), raycaster: new Raycaster(), ndc: new Vector2() };
    const probe = pickWorldPointFromCanvasPointer({ clientX: 50, clientY: 50 }, args)!;
    const sketch = pickWorldPointFromCanvasPointer({ clientX: 50, clientY: 50 }, { ...args, baselineOnly: true })!;
    expect(probe.y).toBeGreaterThan(0);
    expect(sketch.y).toBeCloseTo(0);
    expect(sketch.z).toBeCloseTo(0);
    surface.geometry.dispose();
    surface.material.dispose();
  });
});
