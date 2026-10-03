import { describe, it, expect } from "vitest";
import { Line, type Object3D } from "three";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { buildParametric } from "@/lib/graph3d/buildGraphParametric";
import { buildParametricPolylineHV } from "@/components/graph/graph2d/graph2dCanvasParametricPolyline";
import { drawGraph2dVerticalHorizontalLinesAndPolyline } from "@/components/graph/graph2d/graph2dCanvasDrawRenderableGraphLinesPolyline";
import { graph2dMathToScreen } from "@/components/graph/graph2d/graph2dCanvasTransforms";
import type { RenderableGraph } from "@/components/graph/graph2d/graph2dCanvasTypes";
import type { ParametricCurveObject } from "@vinculum/scene/types";

// S5-U2: F3 parametric gap regression tests.
// Primary curve x=t, y=1/(t-0.5), z=0 (shifted pole keeps S5 isolated from F1;
// the t=0 compile probe evaluates y=-2, finite).
// F3-A (101 samples): t=0.5 sampled exactly -> y non-finite -> sanitized gap.
// F3-B (100 samples): pole straddled by finite samples -> ~396 chord.
// Desired assertions (no segment through/across the pole) FAIL pre-fix.

interface ReferenceSample {
  index: number;
  t: number;
  x: number;
  y: number;
  z: number;
  valid: boolean;
}

function makeCurve(xExpr: string, yExpr: string, zExpr: string, tMin: number, tMax: number, samples: number): ParametricCurveObject {
  return {
    id: "gap-curve",
    kind: "parametricCurve",
    color: "#3b82f6",
    visible: true,
    xExpr,
    yExpr,
    zExpr,
    tMin,
    tMax,
    samples
  };
}

function sampleReference(curve: ParametricCurveObject): ReferenceSample[] {
  const compiled = compileParametricExpressions(curve.xExpr, curve.yExpr, curve.zExpr);
  if (compiled.error) {
    throw new Error(`Cannot compile test curve: ${compiled.error}`);
  }
  const samples: ReferenceSample[] = [];
  for (let index = 0; index < curve.samples; index += 1) {
    const t = curve.tMin + ((curve.tMax - curve.tMin) * index) / (curve.samples - 1);
    const [x, y, z] = compiled.evaluator(t);
    samples.push({
      index,
      t,
      x,
      y,
      z,
      valid: Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    });
  }
  return samples;
}

interface DrawnSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Collects every rendered 3D segment in MATH frame (world->math:
// mathX = worldX, mathY = worldZ) across all Line descendants (LineSegments
// extends Line), following the geometry index when present so only actually
// drawn segments are collected. Valid for single-strip and split-branch
// representations alike.
function collectDrawnSegments(node: Object3D | null): DrawnSegment[] {
  const segments: DrawnSegment[] = [];
  node?.traverse((child) => {
    if (child.userData.wideStroke) {
      const geometry = (child as import("three").Mesh).geometry;
      const start = geometry.getAttribute("instanceStart");
      const end = geometry.getAttribute("instanceEnd");
      for (let i = 0; i < start.count; i++) segments.push({ x0: start.getX(i), y0: start.getZ(i), x1: end.getX(i), y1: end.getZ(i) });
      return;
    }
    if (!(child instanceof Line)) {
      return;
    }
    const position = child.geometry.getAttribute("position");
    const index = child.geometry.getIndex();
    const pointAt = (vertex: number): [number, number] => [position.getX(vertex), position.getZ(vertex)];
    if (index) {
      for (let i = 0; i + 1 < index.count; i += 2) {
        const [x0, y0] = pointAt(index.getX(i));
        const [x1, y1] = pointAt(index.getX(i + 1));
        segments.push({ x0, y0, x1, y1 });
      }
      return;
    }
    for (let i = 0; i + 1 < position.count; i += 1) {
      const [x0, y0] = pointAt(i);
      const [x1, y1] = pointAt(i + 1);
      segments.push({ x0, y0, x1, y1 });
    }
  });
  return segments;
}

const POLE_T = 0.5;

describe("parametric gap regression", () => {
  it("F3-A reference: sample 50 is invalid between valid 49 and 51", () => {
    const reference = sampleReference(makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 101));
    expect(reference).toHaveLength(101);
    expect(reference[49]?.valid).toBe(true);
    expect(reference[50]?.valid).toBe(false);
    expect(reference[51]?.valid).toBe(true);
    // Exact reference coordinates: (0.49, -100, 0), invalid, (0.51, 100, 0).
    expect(reference[49]?.t).toBeCloseTo(0.49, 12);
    expect(reference[49]?.y).toBeCloseTo(-100, 9);
    expect(reference[51]?.t).toBeCloseTo(0.51, 12);
    expect(reference[51]?.y).toBeCloseTo(100, 9);
  });

  it("F3-A: no rendered segment crosses the invalid sample parameter", () => {
    const segments = collectDrawnSegments(buildParametric(makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 101)));
    expect(segments.length).toBeGreaterThan(0);
    // Pre-fix the per-coordinate sanitizer keeps x=0.5 but patches y from the
    // previous sample, fabricating vertex (0.5, -100); the next segment
    // (0.5, -100) -> (0.51, 100), length ~200, jumps branches from the pole
    // position itself. The harmless stub into the pole (length ~0.01) is
    // tolerated; fabricated chords (>> grid step 0.01) are not.
    const crossing = segments.filter((segment) => {
      const spans =
        (segment.x0 < POLE_T && segment.x1 > POLE_T) || (segment.x1 < POLE_T && segment.x0 > POLE_T);
      const touchesPole =
        segment.x0 === POLE_T || segment.x1 === POLE_T;
      const length = Math.hypot(segment.x1 - segment.x0, segment.y1 - segment.y0);
      return spans || (touchesPole && length > 1);
    });
    expect(crossing).toHaveLength(0);
  });

  it("F3-B reference: all samples finite with a straddling pair at 49/50", () => {
    const reference = sampleReference(makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 100));
    expect(reference).toHaveLength(100);
    expect(reference.every((sample) => sample.valid)).toBe(true);
    // Exact straddle: t=49/99 (y=-198) and t=50/99 (y=+198). Neighbor segment
    // lengths ~132 with a -,+,- y-difference sign pattern around the chord.
    expect(reference[49]?.t).toBeCloseTo(49 / 99, 12);
    expect(reference[49]?.y).toBeCloseTo(-198, 9);
    expect(reference[50]?.t).toBeCloseTo(50 / 99, 12);
    expect(reference[50]?.y).toBeCloseTo(198, 9);
    expect(reference[48]?.y).toBeCloseTo(-66, 9);
    expect(reference[51]?.y).toBeCloseTo(66, 9);
  });

  it("F3-B: no rendered segment crosses the pole with opposite branch signs", () => {
    const segments = collectDrawnSegments(buildParametric(makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 100)));
    expect(segments.length).toBeGreaterThan(0);
    // Pre-fix chord (0.4949, -198) -> (0.5051, 198), length ~396.
    const crossing = segments.filter(
      (segment) =>
        ((segment.x0 < POLE_T && segment.x1 > POLE_T) || (segment.x1 < POLE_T && segment.x0 > POLE_T)) &&
        ((segment.y0 < 0 && segment.y1 > 0) || (segment.y1 < 0 && segment.y0 > 0))
    );
    expect(crossing).toHaveLength(0);
  });

  it("2D fixed behavior: identical branch topology at any zoom (S5-U5)", () => {
    const polyline = buildParametricPolylineHV(makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 100), "x", "y");
    expect(polyline).not.toBeNull();
    const graph: RenderableGraph = {
      id: "gap",
      color: "#3b82f6",
      verticalLineValue: null,
      horizontalLineValue: null,
      evaluate: null,
      implicitEvaluate: null,
      hatchDomain: null,
      polylineHV: polyline
    };

    const drawWithScale = (scale: number): { moves: number; lines: number; segments: Array<[number, number, number, number]> } => {
      const ops: Array<{ op: string; x: number; y: number }> = [];
      const fakeCtx = {
        moveTo: (x: number, y: number) => {
          ops.push({ op: "move", x, y });
        },
        lineTo: (x: number, y: number) => {
          ops.push({ op: "line", x, y });
        },
        stroke: () => {}
      } as unknown as CanvasRenderingContext2D;
      const dc = { width: 800, height: 600, centerX: 0.5, centerY: 0, scale };
      drawGraph2dVerticalHorizontalLinesAndPolyline(graph, { ...dc, ctx: fakeCtx } as never, fakeCtx, 800, 600, graph2dMathToScreen);
      const segments: Array<[number, number, number, number]> = [];
      let moves = 0;
      let lines = 0;
      let cursor: [number, number] | null = null;
      for (const op of ops) {
        if (op.op === "move") {
          moves += 1;
          cursor = [op.x, op.y];
        } else {
          lines += 1;
          if (cursor) {
            segments.push([cursor[0], cursor[1], op.x, op.y]);
          }
          cursor = [op.x, op.y];
        }
      }
      return { moves, lines, segments };
    };

    // Canonical cuts apply identically at every zoom: the old viewport-
    // dependent behavior (connected at scale 1, broken at scale 10) is gone.
    // Two branches [0..49] and [50..99]: 2 moves, 98 lines, no cross-pole
    // opposite-sign segment at either scale.
    for (const scale of [1, 10]) {
      const drawn = drawWithScale(scale);
      expect(drawn.moves, `moves@${scale}`).toBe(2);
      expect(drawn.lines, `lines@${scale}`).toBe(98);
      const crossing = drawn.segments.filter(
        ([x0, y0, x1, y1]) =>
          ((x0 < 0.5 && x1 > 0.5) || (x1 < 0.5 && x0 > 0.5)) && ((y0 < 0 && y1 > 0) || (y1 < 0 && y0 > 0))
      );
      expect(crossing, `crossing@${scale}`).toHaveLength(0);
    }
  });

  it("2D F3-A: invalid gap breaks identically at any zoom", () => {
    const polyline = buildParametricPolylineHV(makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 101), "x", "y");
    expect(polyline).not.toBeNull();
    expect(polyline?.connectedSegments[49]).toBe(0);
    expect(polyline?.connectedSegments[50]).toBe(0);
    const graph: RenderableGraph = {
      id: "gap",
      color: "#3b82f6",
      verticalLineValue: null,
      horizontalLineValue: null,
      evaluate: null,
      implicitEvaluate: null,
      hatchDomain: null,
      polylineHV: polyline
    };
    const topologies: Array<[number, number]> = [];
    for (const scale of [1, 10, 0.25]) {
      let moves = 0;
      let lines = 0;
      const fakeCtx = {
        moveTo: () => {
          moves += 1;
        },
        lineTo: () => {
          lines += 1;
        },
        stroke: () => {}
      } as unknown as CanvasRenderingContext2D;
      const dc = { width: 800, height: 600, centerX: 0.5, centerY: 0, scale };
      drawGraph2dVerticalHorizontalLinesAndPolyline(graph, { ...dc, ctx: fakeCtx } as never, fakeCtx, 800, 600, graph2dMathToScreen);
      // Branches [0..49], [50..50], [51..100]: 3 moves, 49 + 0 + 49 lines.
      expect(moves, `moves@${scale}`).toBe(3);
      expect(lines, `lines@${scale}`).toBe(98);
      topologies.push([moves, lines]);
    }
    expect(topologies[0]).toEqual(topologies[1]);
    expect(topologies[1]).toEqual(topologies[2]);
  });

  it("2D projection invariance: cuts survive in XY, XZ, and YZ", () => {
    const curve = makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 100);
    const topologies: Array<[number, number]> = [];
    for (const [horizontal, vertical] of [["x", "y"], ["x", "z"], ["y", "z"]] as const) {
      const polyline = buildParametricPolylineHV(curve, horizontal, vertical);
      expect(polyline).not.toBeNull();
      const graph: RenderableGraph = {
        id: "gap",
        color: "#3b82f6",
        verticalLineValue: null,
        horizontalLineValue: null,
        evaluate: null,
        implicitEvaluate: null,
        hatchDomain: null,
        polylineHV: polyline
      };
      let moves = 0;
      let lines = 0;
      const fakeCtx = {
        moveTo: () => {
          moves += 1;
        },
        lineTo: () => {
          lines += 1;
        },
        stroke: () => {}
      } as unknown as CanvasRenderingContext2D;
      const dc = { width: 800, height: 600, centerX: 0, centerY: 0, scale: 40 };
      drawGraph2dVerticalHorizontalLinesAndPolyline(graph, { ...dc, ctx: fakeCtx } as never, fakeCtx, 800, 600, graph2dMathToScreen);
      // The y-pole cut persists even where the projected view looks smooth
      // (XZ shows (t, 0)): canonical cuts never reconnect by projection.
      expect(moves, `moves@${horizontal}${vertical}`).toBe(2);
      expect(lines, `lines@${horizontal}${vertical}`).toBe(98);
      topologies.push([moves, lines]);
    }
    expect(topologies[0]).toEqual(topologies[1]);
    expect(topologies[1]).toEqual(topologies[2]);
  });

  it("2D smooth controls draw one continuous branch at any zoom", () => {
    const controls: Array<[string, ParametricCurveObject, number]> = [
      ["line", makeCurve("t", "2*t", "3*t", 0, 1, 64), 63],
      ["steep", makeCurve("t", "100*t", "0", 0, 1, 64), 63],
      ["circle", makeCurve("cos(t)", "sin(t)", "0", 0, 2 * Math.PI, 240), 239],
      ["helix", makeCurve("cos(t)", "sin(t)", "t / 3", 0, 6 * Math.PI, 300), 299],
      ["hifreq", makeCurve("t", "sin(8*t)", "0", 0, 2 * Math.PI, 240), 239]
    ];
    for (const [name, curve, expectedLines] of controls) {
      for (const scale of [1, 50]) {
        const polyline = buildParametricPolylineHV(curve, "x", "y");
        expect(polyline).not.toBeNull();
        const graph: RenderableGraph = {
          id: name,
          color: "#3b82f6",
          verticalLineValue: null,
          horizontalLineValue: null,
          evaluate: null,
          implicitEvaluate: null,
          hatchDomain: null,
          polylineHV: polyline
        };
        let moves = 0;
        let lines = 0;
        const fakeCtx = {
          moveTo: () => {
            moves += 1;
          },
          lineTo: () => {
            lines += 1;
          },
          stroke: () => {}
        } as unknown as CanvasRenderingContext2D;
        const dc = { width: 800, height: 600, centerX: 0, centerY: 0, scale };
        drawGraph2dVerticalHorizontalLinesAndPolyline(graph, { ...dc, ctx: fakeCtx } as never, fakeCtx, 800, 600, graph2dMathToScreen);
        expect(moves, `${name}@${scale}`).toBe(1);
        expect(lines, `${name}@${scale}`).toBe(expectedLines);
      }
    }
  });

  it("controls stay continuous: line, steep line, circle, helix", () => {
    const controls: Array<[string, ParametricCurveObject, number]> = [
      ["line", makeCurve("t", "2*t", "3*t", 0, 1, 64), 63],
      ["steep", makeCurve("t", "100*t", "0", 0, 1, 64), 63],
      ["circle", makeCurve("cos(t)", "sin(t)", "0", 0, 2 * Math.PI, 240), 239],
      ["helix", makeCurve("cos(t)", "sin(t)", "t / 3", 0, 6 * Math.PI, 300), 299]
    ];
    for (const [name, curve, expectedSegments] of controls) {
      const segments = collectDrawnSegments(buildParametric(curve));
      expect(segments.length, name).toBe(expectedSegments);
      for (const segment of segments) {
        expect(Number.isFinite(segment.x0) && Number.isFinite(segment.y0), name).toBe(true);
      }
    }
  });

  it("canonical sampling marks F3-A validity and cuts both adjacent segments", () => {
    const compiled = compileParametricExpressions("t", "1/(t - 0.5)", "0");
    if (compiled.error) {
      throw new Error(compiled.error);
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: 0, tMax: 1, samples: 101 });
    expect(sampled.validSamples[49]).toBe(1);
    expect(sampled.validSamples[50]).toBe(0);
    expect(sampled.validSamples[51]).toBe(1);
    expect(sampled.connectedSegments[49]).toBe(0);
    expect(sampled.connectedSegments[50]).toBe(0);
    expect(sampled.connectedSegments[48]).toBe(1);
    expect(sampled.connectedSegments[51]).toBe(1);
  });

  it("canonical sampling cuts the F3-B straddle while keeping neighbors", () => {
    const compiled = compileParametricExpressions("t", "1/(t - 0.5)", "0");
    if (compiled.error) {
      throw new Error(compiled.error);
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: 0, tMax: 1, samples: 100 });
    for (let i = 0; i < 100; i += 1) {
      expect(sampled.validSamples[i]).toBe(1);
    }
    expect(sampled.connectedSegments[49]).toBe(0);
    expect(sampled.connectedSegments[48]).toBe(1);
    expect(sampled.connectedSegments[50]).toBe(1);
  });

  it("canonical sampling keeps every control segment connected", () => {
    const cases: Array<[string, string, string, string, number, number, number]> = [
      ["linear", "t", "2*t", "3*t", 0, 1, 64],
      ["steep", "t", "1000*t", "0", 0, 1, 64],
      ["quadratic", "t", "100*t^2", "0", 0, 1, 64],
      ["circle", "cos(t)", "sin(t)", "0", 0, 2 * Math.PI, 240],
      ["helix", "cos(t)", "sin(t)", "t / 3", 0, 6 * Math.PI, 300],
      ["hifreq", "t", "sin(8*t)", "0", 0, 2 * Math.PI, 240]
    ];
    for (const [name, xExpr, yExpr, zExpr, tMin, tMax, samples] of cases) {
      const compiled = compileParametricExpressions(xExpr, yExpr, zExpr);
      if (compiled.error) {
        throw new Error(`${name}: ${compiled.error}`);
      }
      const sampled = sampleCurve(compiled.evaluator, { tMin, tMax, samples });
      expect(sampled.connectedSegments.length, name).toBe(samples - 1);
      for (let i = 0; i < samples - 1; i += 1) {
        expect(sampled.connectedSegments[i], `${name}[${i}]`).toBe(1);
      }
    }
  });

  it("canonical sampling cuts the shifted tangent straddle, keeping branches", () => {
    const compiled = compileParametricExpressions("t", "tan(t - 0.5)", "0");
    if (compiled.error) {
      throw new Error(compiled.error);
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: -2, tMax: 2, samples: 200 });
    let cuts = 0;
    for (let i = 0; i < 199; i += 1) {
      if (sampled.connectedSegments[i] === 0) {
        cuts += 1;
      }
    }
    expect(cuts).toBeGreaterThan(0);
    expect(cuts).toBeLessThan(199);
    expect(sampled.connectedSegments[46]).toBe(0);
  });

  it("wide strokes obey canonical connectivity exactly", () => {
    const curve = makeCurve("t", "1/(t - 0.5)", "0", 0, 1, 100);
    const compiled = compileParametricExpressions(curve.xExpr, curve.yExpr, curve.zExpr);
    if (compiled.error) {
      throw new Error(compiled.error);
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: curve.tMin, tMax: curve.tMax, samples: curve.samples });
    const node = buildParametric(curve);
    expect(node).not.toBeNull();
    let pairCount = 0;
    node?.traverse(child => {
      if (!child.userData.wideStroke) return;
      const geometry = (child as import("three").Mesh).geometry;
      const start = geometry.getAttribute("instanceStart");
      const end = geometry.getAttribute("instanceEnd");
      const expectedStarts = Array.from(sampled.connectedSegments).flatMap((connected, i) => connected === 1 ? [i] : []);
      expect(start.count).toBe(expectedStarts.length);
      expectedStarts.forEach((a, i) => {
        expect(sampled.validSamples[a]).toBe(1);
        expect(sampled.validSamples[a + 1]).toBe(1);
        expect([start.getX(i), start.getY(i), start.getZ(i)]).toEqual(Array.from(sampled.positions.slice(a * 3, a * 3 + 3)));
        expect([end.getX(i), end.getY(i), end.getZ(i)]).toEqual(Array.from(sampled.positions.slice((a + 1) * 3, (a + 1) * 3 + 3)));
        pairCount++;
      });
    });
    let expectedPairs = 0;
    for (let i = 0; i < curve.samples - 1; i += 1) {
      if (sampled.connectedSegments[i] === 1) {
        expectedPairs += 1;
      }
    }
    expect(pairCount).toBe(expectedPairs);
    expect(pairCount).toBeGreaterThan(0);
  });
});
