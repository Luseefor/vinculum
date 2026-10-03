import { describe, expect, it } from "vitest";
import {
  computeGeometryFacts,
  geometryPairSupported,
  radiansToDegrees,
  resolveGeometrySource,
  type GeometryAnalysisFacts
} from "@/lib/math/geometryAnalysis";
import type { GraphObject } from "@vinculum/scene/types";

function makeObject(kind: string, fields: Record<string, unknown>): GraphObject {
  return { id: `${kind}-1`, kind, color: "#3b82f6", visible: true, ...fields } as GraphObject;
}

const POINT = (x: string, y: string, z: string): GraphObject =>
  makeObject("point", { xExpr: x, yExpr: y, zExpr: z });
const VECTOR = (v: [string, string, string]): GraphObject =>
  makeObject("vector", { oxExpr: "0", oyExpr: "0", ozExpr: "0", vxExpr: v[0], vyExpr: v[1], vzExpr: v[2] });
const LINE = (p: [string, string, string], d: [string, string, string]): GraphObject =>
  makeObject("line", { pxExpr: p[0], pyExpr: p[1], pzExpr: p[2], dxExpr: d[0], dyExpr: d[1], dzExpr: d[2] });
const RAY = (o: [string, string, string], d: [string, string, string]): GraphObject =>
  makeObject("ray", { oxExpr: o[0], oyExpr: o[1], ozExpr: o[2], dxExpr: d[0], dyExpr: d[1], dzExpr: d[2] });
const SEGMENT = (a: [string, string, string], b: [string, string, string]): GraphObject =>
  makeObject("segment", { axExpr: a[0], ayExpr: a[1], azExpr: a[2], bxExpr: b[0], byExpr: b[1], bzExpr: b[2] });
const PLANE = (equation: string): GraphObject => makeObject("plane", { equation, size: 12, appearance: { wireframe: false } });

function facts(a: GraphObject, b: GraphObject): GeometryAnalysisFacts {
  return computeGeometryFacts(resolveGeometrySource(a, {}), resolveGeometrySource(b, {}));
}

describe("pair support matrix (S27 PART 22)", () => {
  it("supports the documented pairs and rejects the rest", () => {
    expect(geometryPairSupported("point", "point")).toBe(true);
    expect(geometryPairSupported("point", "line")).toBe(true);
    expect(geometryPairSupported("point", "ray")).toBe(true);
    expect(geometryPairSupported("point", "segment")).toBe(true);
    expect(geometryPairSupported("point", "plane")).toBe(true);
    expect(geometryPairSupported("vector", "vector")).toBe(true);
    expect(geometryPairSupported("line", "line")).toBe(true);
    expect(geometryPairSupported("line", "ray")).toBe(true);
    expect(geometryPairSupported("ray", "segment")).toBe(true);
    expect(geometryPairSupported("line", "plane")).toBe(true);
    expect(geometryPairSupported("segment", "plane")).toBe(true);
    expect(geometryPairSupported("plane", "plane")).toBe(true);
    expect(geometryPairSupported("point", "vector")).toBe(false);
    expect(geometryPairSupported("vector", "line")).toBe(false);
    expect(geometryPairSupported("vector", "plane")).toBe(false);
    expect(geometryPairSupported("line", "surface")).toBe(false);
    expect(geometryPairSupported("point", "surface")).toBe(false);
  });
});

describe("analysis facts (S27 PART 22/49)", () => {
  it("computes point-line projection facts", () => {
    const result = facts(POINT("3", "4", "0"), LINE(["0", "0", "0"], ["2", "0", "0"]));
    expect(result.pair).toBe("point-linear");
    if (result.pair === "point-linear") {
      expect(result.projection.point).toEqual({ x: 3, y: 0, z: 0 });
      expect(result.projection.distance).toBe(4);
    }
  });

  it("computes point-plane facts with signed distance", () => {
    const result = facts(POINT("1", "3", "7"), PLANE("z = 2"));
    expect(result.pair).toBe("point-plane");
    if (result.pair === "point-plane") {
      expect(result.projection.projection).toEqual({ x: 1, y: 3, z: 2 });
      expect(result.projection.signedDistance).toBe(5);
    }
  });

  it("computes vector-vector angle facts with zero-vector unavailability", () => {
    const right = facts(VECTOR(["1", "0", "0"]), VECTOR(["0", "1", "0"]));
    expect(right.pair).toBe("vector-vector");
    if (right.pair === "vector-vector") {
      expect(radiansToDegrees(right.angleRadians ?? 0)).toBeCloseTo(90, 9);
      expect(right.parallel).toBe(false);
      expect(right.perpendicular).toBe(true);
    }
    const zero = facts(VECTOR(["0", "0", "0"]), VECTOR(["1", "0", "0"]));
    expect(zero.pair).toBe("vector-vector");
    if (zero.pair === "vector-vector") {
      expect(zero.angleRadians).toBeNull();
    }
  });

  it("computes skew line facts with relationship, distance, and angle", () => {
    const result = facts(LINE(["0", "0", "0"], ["1", "0", "0"]), LINE(["0", "1", "1"], ["0", "1", "0"]));
    expect(result.pair).toBe("linear-linear");
    if (result.pair === "linear-linear") {
      expect(result.relation.kind).toBe("skew");
      if (result.relation.kind === "skew") {
        expect(result.relation.distance).toBeCloseTo(1, 9);
      }
      expect(radiansToDegrees(result.angleRadians ?? 0)).toBeCloseTo(90, 9);
    }
  });

  it("computes line-plane intersection facts", () => {
    const result = facts(LINE(["0", "0", "0"], ["0", "0", "1"]), PLANE("z = 2"));
    expect(result.pair).toBe("linear-plane");
    if (result.pair === "linear-plane") {
      expect(result.intersection.kind).toBe("point");
      expect(radiansToDegrees(result.angleRadians ?? 0)).toBeCloseTo(90, 9);
      expect(result.distance).toBe(0);
    }
  });

  it("computes plane-plane intersection facts", () => {
    const result = facts(PLANE("x = 0"), PLANE("y = 0"));
    expect(result.pair).toBe("plane-plane");
    if (result.pair === "plane-plane") {
      expect(result.intersection.kind).toBe("line");
      expect(radiansToDegrees(result.angleRadians ?? 0)).toBeCloseTo(90, 9);
    }
  });

  it("computes point-point distance facts", () => {
    const result = facts(POINT("1", "2", "3"), POINT("4", "6", "3"));
    expect(result.pair).toBe("point-point");
    if (result.pair === "point-point") {
      expect(result.distance).toBe(5);
    }
  });

  it("computes ray-segment and segment-plane facts explicitly", () => {
    const raySeg = facts(
      RAY(["0", "0", "0"], ["1", "0", "0"]),
      SEGMENT(["5", "-1", "0"], ["5", "1", "0"])
    );
    expect(raySeg.pair).toBe("linear-linear");
    if (raySeg.pair === "linear-linear") {
      expect(raySeg.relation.kind).toBe("intersect");
    }
    const segPlane = facts(SEGMENT(["0", "0", "0"], ["0", "0", "4"]), PLANE("z = 2"));
    expect(segPlane.pair).toBe("linear-plane");
    if (segPlane.pair === "linear-plane") {
      expect(segPlane.intersection.kind).toBe("point");
      expect(segPlane.distance).toBe(0);
    }
  });

  it("reports unresolved sources precisely and incompatible pairs", () => {
    const bad = facts(POINT("x", "0", "0"), LINE(["0", "0", "0"], ["1", "0", "0"]));
    expect(bad.pair).toBe("unresolved");
    const incompatible = facts(
      POINT("1", "2", "3"),
      makeObject("surface", { equation: "x", domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, resolution: 8, appearance: { wireframe: false } })
    );
    expect(incompatible.pair).toBe("incompatible");
  });

  it("resolves every supported scene kind without a second compiler", () => {
    expect(resolveGeometrySource(POINT("1", "2", "3"), {}).kind).toBe("point");
    expect(resolveGeometrySource(VECTOR(["1", "0", "0"]), {}).kind).toBe("vector");
    expect(resolveGeometrySource(LINE(["0", "0", "0"], ["1", "0", "0"]), {}).kind).toBe("line");
    expect(resolveGeometrySource(RAY(["0", "0", "0"], ["1", "0", "0"]), {}).kind).toBe("ray");
    expect(resolveGeometrySource(SEGMENT(["0", "0", "0"], ["1", "0", "0"]), {}).kind).toBe("segment");
    expect(resolveGeometrySource(PLANE("z = 0"), {}).kind).toBe("plane");
    expect(resolveGeometrySource(LINE(["0", "0", "0"], ["0", "0", "0"]), {}).kind).toBe("unresolved");
    expect(resolveGeometrySource(PLANE("0 = 0"), {}).kind).toBe("unresolved");
  });
});
