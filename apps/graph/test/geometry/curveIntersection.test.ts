import { describe, expect, it } from "vitest";
import type { ImplicitCurveObject } from "@vinculum/scene/types";
import { computeCurveIntersection } from "@/lib/math/geometry/curveIntersection";
import { computeGeometryFacts, geometryObjectsPairSupported, resolveGeometrySource } from "@/lib/math/geometry/geometryAnalysis";
import { useGraphStore } from "@/store/graphStore";

const curve = (equation: string): ImplicitCurveObject => ({ id: equation, kind: "implicitCurve", equation, color: "#3080ef", visible: true });

describe("planar equation intersections", () => {
  it("keeps analysis linked through equation edits and clears it on dimensional conversion", () => {
    const store = useGraphStore.getState();
    store.resetScene();
    const a = store.commitAutoEquation("x^2+y^2=4").id!, b = store.commitAutoEquation("y=x").id!;
    store.setGeometryAnalysis(a, { secondaryId: b, showOverlay: true });
    store.commitAutoEquation("y=1", b);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]).toEqual({ secondaryId: b, showOverlay: true });
    const sources = useGraphStore.getState().scene.objects;
    const facts = computeGeometryFacts(resolveGeometrySource(sources[0], {}), resolveGeometrySource(sources[1], {}));
    expect(facts.pair).toBe("curve-curve");
    if (facts.pair === "curve-curve") for (const point of facts.intersection.points) expect(point.y).toBeCloseTo(1, 6);
    store.commitAutoEquation("z=x+y", b);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId).toEqual({});
  });
  it("finds both circle/line crossings and satisfies both source equations", () => {
    const result = computeCurveIntersection(curve("x^2+y^2=4"), curve("y=x"), {});
    expect(result.status).toBe("points");
    expect(result.points).toHaveLength(2);
    for (const point of result.points) {
      expect(point.x ** 2 + point.y ** 2).toBeCloseTo(4, 6);
      expect(point.y).toBeCloseTo(point.x, 6);
      expect(point.z).toBe(0);
    }
  });
  it("finds circle/circle and tangent contacts without duplicate markers", () => {
    const circle = curve("x^2+y^2=4");
    expect(computeCurveIntersection(circle, curve("(x-2)^2+y^2=4"), {}).points).toHaveLength(2);
    const tangent = computeCurveIntersection(circle, curve("y=2"), {});
    expect(tangent.status).toBe("points");
    expect(tangent.points).toHaveLength(1);
    expect(tangent.points[0].x).toBeCloseTo(0, 4);
    expect(tangent.points[0].y).toBeCloseTo(2, 6);
  });
  it("reports coincidence, disjoint curves and invalid definitions honestly", () => {
    expect(computeCurveIntersection(curve("y=x"), curve("y=x"), {}).status).toBe("overlap");
    expect(computeCurveIntersection(curve("y=x"), curve("2*y=2*x"), {}).status).toBe("overlap");
    expect(computeCurveIntersection(curve("x^2+y^2=1"), curve("y=2"), {}).status).toBe("empty");
    expect(computeCurveIntersection(curve("y=1/x"), curve("y=0"), {}).points).toHaveLength(0);
    expect(computeCurveIntersection(curve("sqrt("), curve("y=0"), {}).status).toBe("unresolved");
  });
  it("uses the current sampling view and live parameters", () => {
    const a = curve("x=a"), b = curve("y=40");
    expect(computeCurveIntersection(a, b, { a: 30 }).status).toBe("empty");
    const domain = { xMin: 25, xMax: 35, yMin: 35, yMax: 45 };
    expect(computeCurveIntersection(a, b, { a: 30 }, domain).points).toEqual([{ x: 30, y: 40, z: 0 }]);
    expect(computeCurveIntersection(a, b, { a: 31 }, domain).points[0].x).toBeCloseTo(31, 6);
    const facts = computeGeometryFacts(resolveGeometrySource(a, { a: 30 }, domain), resolveGeometrySource(b, {}, domain));
    expect(facts.pair).toBe("curve-curve");
    expect(geometryObjectsPairSupported(a, { ...b, extendTo3D: true })).toBe(false);
  });
});
