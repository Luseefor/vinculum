import { describe, expect, it } from "vitest";
import {
  computeStreamlineData,
  MAX_STREAMLINE_POINTS_TOTAL,
  streamlineMaxLength,
  streamlineStepSize,
  type StreamlineComputeInput
} from "@/lib/math/computeStreamlineData";
import { generateSeeds2D, generateSeeds3D } from "@/lib/math/streamlineSeeds";

function run2D(
  pExpr: string,
  qExpr: string,
  overrides: Partial<StreamlineComputeInput> = {}
): Extract<ReturnType<typeof computeStreamlineData>, { status: "ok" }> {
  const result = computeStreamlineData({
    dimension: "2d",
    pExpr,
    qExpr,
    rExpr: "",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    seedDensity: 6,
    length: "medium",
    quality: "medium",
    params: {},
    ...overrides
  });
  if (result.status !== "ok") {
    throw new Error(`expected ok, got ${result.status}`);
  }
  return result;
}

function curvePoints(
  result: Extract<ReturnType<typeof computeStreamlineData>, { status: "ok" }>,
  index: number,
  dimension: number
): number[][] {
  const points: number[][] = [];
  for (let p = result.offsets[index] as number; p < (result.offsets[index + 1] as number); p += 1) {
    const point: number[] = [];
    for (let d = 0; d < dimension; d += 1) {
      point.push(result.points[p * dimension + d] as number);
    }
    points.push(point);
  }
  return points;
}

describe("seeds (S24 PART 6)", () => {
  it("generates interior-centered deterministic lattices", () => {
    const seeds = generateSeeds2D({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 6);
    expect(seeds).toHaveLength(36);
    // (i + 0.5)/n: first seed strictly inside the boundary.
    expect(seeds[0]).toEqual([-5 + (10 * 0.5) / 6, -5 + (10 * 0.5) / 6]);
    expect(generateSeeds2D({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 6)).toEqual(seeds);
    const seeds3D = generateSeeds3D(
      { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3 },
      3
    );
    expect(seeds3D).toHaveLength(27);
    expect(seeds3D[0]).toHaveLength(3);
  });

  it("clamps densities to the supported ranges", () => {
    expect(generateSeeds2D({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, 99)).toHaveLength(144);
    expect(
      generateSeeds3D({ xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 }, 99)
    ).toHaveLength(125);
  });
});

describe("step and length policy (S24 PART 2/7)", () => {
  it("scales step with the minimum span and length with the diagonal", () => {
    const domain = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    expect(streamlineStepSize(domain, "2d", "medium")).toBeCloseTo(10 / 96, 12);
    expect(streamlineStepSize(domain, "2d", "high")).toBeCloseTo(10 / 144, 12);
    expect(streamlineMaxLength(domain, "2d", "medium")).toBeCloseTo(Math.SQRT2 * 10 * 1.5, 10);
    expect(streamlineStepSize(domain, "2d", "low")).toBeGreaterThan(
      streamlineStepSize(domain, "2d", "medium")
    );
  });
});

describe("constant field (S24 PART 21/31)", () => {
  it("traces horizontal lines that exit near x=±1 in [-1,1]^2", () => {
    const result = computeStreamlineData({
      dimension: "2d",
      pExpr: "1",
      qExpr: "0",
      rExpr: "",
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      seedDensity: 2,
      length: "long",
      quality: "medium",
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.streamlineCount).toBe(4);
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 2);
      const y0 = points[0]?.[1] as number;
      for (const point of points) {
        expect(point[1]).toBeCloseTo(y0, 10);
      }
      // Exits near a vertical boundary, never outside.
      const lastX = points[points.length - 1]?.[0] as number;
      const firstX = points[0]?.[0] as number;
      expect(Math.max(Math.abs(firstX), Math.abs(lastX))).toBeGreaterThan(0.9);
      for (const point of points) {
        expect(Math.abs(point[0] as number)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("traces the 3D normalized direction of F=<1,2,3>", () => {
    const result = computeStreamlineData({
      dimension: "3d",
      pExpr: "1",
      qExpr: "2",
      rExpr: "3",
      domain: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2 },
      seedDensity: 2,
      length: "medium",
      quality: "medium",
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    const length = Math.sqrt(14);
    const expected = [1 / length, 2 / length, 3 / length];
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 3);
      for (let i = 1; i < points.length; i += 1) {
        const direction = [
          (points[i]?.[0] as number) - (points[i - 1]?.[0] as number),
          (points[i]?.[1] as number) - (points[i - 1]?.[1] as number),
          (points[i]?.[2] as number) - (points[i - 1]?.[2] as number)
        ];
        const step = Math.hypot(...direction);
        // Float32-packed coordinates quantize directions (~1e-7).
        expect(direction[0] as number / step).toBeCloseTo(expected[0] as number, 5);
        expect(direction[1] as number / step).toBeCloseTo(expected[1] as number, 5);
        expect(direction[2] as number / step).toBeCloseTo(expected[2] as number, 5);
      }
    }
  });
});

describe("radial field (S24 PART 22/30)", () => {
  it("stays on rays through the origin and stops near zero", () => {
    const result = run2D("x", "y", { seedDensity: 4 });
    expect(result.streamlineCount).toBeGreaterThan(0);
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 2);
      expect(points.length).toBeGreaterThanOrEqual(2);
      const seed = points[Math.floor(points.length / 2)] as number[];
      for (const point of points) {
        // Collinearity with the origin ray through the midpoint seed.
        const cross = (point[0] as number) * (seed[1] as number) - (point[1] as number) * (seed[0] as number);
        expect(Math.abs(cross)).toBeLessThan(0.05);
        expect(Number.isFinite(point[0])).toBe(true);
        expect(Number.isFinite(point[1])).toBe(true);
      }
    }
  });

  it("preserves radial geometry at 1e-8 scale", () => {
    const scaled = run2D("1e-8*x", "1e-8*y", { seedDensity: 4 });
    const reference = run2D("x", "y", { seedDensity: 4 });
    expect(scaled.streamlineCount).toBe(reference.streamlineCount);
    expect(scaled.totalPoints).toBe(reference.totalPoints);
  });
});

describe("rotation field (S24 PART 23, critical)", () => {
  it("holds x^2+y^2 constant and closes the loop", () => {
    // Long traces: outer circles (circumference > medium budget) must
    // still complete their revolution so loop detection can fire.
    const result = run2D("-y", "x", { seedDensity: 4, length: "long" });
    let closedCount = 0;
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 2);
      const seedRadius = Math.hypot(points[0]?.[0] as number, points[0]?.[1] as number);
      let worstDrift = 0;
      for (const point of points) {
        worstDrift = Math.max(worstDrift, Math.abs(Math.hypot(point[0] as number, point[1] as number) - seedRadius));
      }
      expect(worstDrift).toBeLessThan(0.05);
      if (result.closed[c] === 1) {
        closedCount += 1;
        const end = points[points.length - 1] as number[];
        expect(Math.hypot(end[0] as number, end[1] as number)).toBeCloseTo(seedRadius, 1);
      }
    }
    // Interior seeds close; the majority must terminate by loop detection.
    expect(closedCount).toBeGreaterThan(result.streamlineCount / 2);
  });
});

describe("saddle field (S24 PART 24)", () => {
  it("holds x*y constant without cross-quadrant jumps", () => {
    const result = run2D("x", "-y", { seedDensity: 4 });
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 2);
      const invariant = (points[0]?.[0] as number) * (points[0]?.[1] as number);
      const signs: string[] = [];
      for (const point of points) {
        expect((point[0] as number) * (point[1] as number)).toBeCloseTo(invariant, 1);
        signs.push(`${Math.sign(point[0] as number)},${Math.sign(point[1] as number)}`);
      }
      // One quadrant per streamline (axes are separatrices).
      expect(new Set(signs).size).toBe(1);
    }
  });
});

describe("3D rotation and helix (S24 PART 25/26)", () => {
  it("holds z and XY radius constant for F=<-y,x,0>", () => {
    const result = computeStreamlineData({
      dimension: "3d",
      pExpr: "-y",
      qExpr: "x",
      rExpr: "0",
      domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -2, zMax: 2 },
      seedDensity: 3,
      length: "medium",
      quality: "medium",
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 3);
      const z0 = points[0]?.[2] as number;
      const radius = Math.hypot(points[0]?.[0] as number, points[0]?.[1] as number);
      for (const point of points) {
        expect(point[2]).toBeCloseTo(z0, 8);
        expect(Math.hypot(point[0] as number, point[1] as number)).toBeCloseTo(radius, 1);
      }
    }
  });

  it("traces monotone-z helices for F=<-y,x,0.5>", () => {
    const result = computeStreamlineData({
      dimension: "3d",
      pExpr: "-y",
      qExpr: "x",
      rExpr: "0.5",
      domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -2, zMax: 2 },
      seedDensity: 2,
      length: "long",
      quality: "medium",
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 3);
      const radius = Math.hypot(points[0]?.[0] as number, points[0]?.[1] as number);
      let worstRadius = 0;
      for (let i = 1; i < points.length; i += 1) {
        const previous = points[i - 1] as number[];
        const current = points[i] as number[];
        // Forward in index follows +F: z increases along the curve.
        expect((current[2] as number) - (previous[2] as number)).toBeGreaterThan(-1e-9);
        worstRadius = Math.max(
          worstRadius,
          Math.abs(Math.hypot(current[0] as number, current[1] as number) - radius)
        );
      }
      expect(worstRadius).toBeLessThan(0.1);
    }
  });
});

describe("scaling invariance (S24 PART 27)", () => {
  it("matches geometry for F, 10*F, and 0.001*F", () => {
    const reference = run2D("x", "y", { seedDensity: 4 });
    const up = run2D("10*x", "10*y", { seedDensity: 4 });
    const down = run2D("0.001*x", "0.001*y", { seedDensity: 4 });
    expect(up.streamlineCount).toBe(reference.streamlineCount);
    expect(down.streamlineCount).toBe(reference.streamlineCount);
    expect(up.totalPoints).toBe(reference.totalPoints);
    expect(down.totalPoints).toBe(reference.totalPoints);
    for (let i = 0; i < reference.points.length; i += 1) {
      expect(up.points[i]).toBeCloseTo(reference.points[i] as number, 6);
      expect(down.points[i]).toBeCloseTo(reference.points[i] as number, 6);
    }
  });

  it("reverses orientation but keeps geometry for -F", () => {
    const reference = run2D("x", "y", { seedDensity: 2 });
    const negated = run2D("-x", "-y", { seedDensity: 2 });
    expect(negated.streamlineCount).toBe(reference.streamlineCount);
    // Same point sets (order may differ along the curve).
    const sortedOf = (points: Float32Array): string[] =>
      Array.from({ length: points.length / 2 }, (_, i) => i)
        .map((i) => `${(points[i * 2] as number).toFixed(6)},${(points[i * 2 + 1] as number).toFixed(6)}`)
        .sort();
    expect(sortedOf(negated.points)).toEqual(sortedOf(reference.points));
  });
});

describe("singular and zero fields (S24 PART 28/30)", () => {
  it("never crosses x=0 for F=<1/x,1>", () => {
    const result = run2D("1/x", "1", { seedDensity: 6 });
    for (let c = 0; c < result.streamlineCount; c += 1) {
      const points = curvePoints(result, c, 2);
      const side = Math.sign(points[0]?.[0] as number);
      expect(side).not.toBe(0);
      for (const point of points) {
        expect(Math.sign(point[0] as number)).toBe(side);
        expect(Number.isFinite(point[0])).toBe(true);
        expect(Number.isFinite(point[1])).toBe(true);
      }
    }
  });

  it("returns empty for the zero field without NaNs", () => {
    const result = computeStreamlineData({
      dimension: "2d",
      pExpr: "0",
      qExpr: "0",
      rExpr: "",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      seedDensity: 4,
      length: "medium",
      quality: "medium",
      params: {}
    });
    expect(result.status).toBe("empty");
  });

  it("rejects unsafe fields at the canonical level", () => {
    const result = computeStreamlineData({
      dimension: "2d",
      pExpr: "sin(factorial(x))",
      qExpr: "y",
      rExpr: "",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      seedDensity: 2,
      length: "short",
      quality: "low",
      params: {}
    });
    expect(result.status).toBe("error");
  });
});

describe("packing contract and budgets (S24 PART 9/32)", () => {
  it("packs monotonic offsets ending at totalPoints", () => {
    const result = run2D("-y", "x", { seedDensity: 6 });
    expect(result.offsets).toHaveLength(result.streamlineCount + 1);
    expect(result.offsets[0]).toBe(0);
    expect(result.offsets[result.streamlineCount]).toBe(result.totalPoints);
    for (let i = 1; i <= result.streamlineCount; i += 1) {
      expect(result.offsets[i] as number).toBeGreaterThan(result.offsets[i - 1] as number);
    }
    expect(result.closed).toHaveLength(result.streamlineCount);
    expect(result.points.length).toBe(result.totalPoints * 2);
  });

  it("fails cleanly past the point budget", () => {
    const result = computeStreamlineData({
      dimension: "3d",
      pExpr: "-y",
      qExpr: "x",
      rExpr: "0.5",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 },
      seedDensity: 5,
      length: "long",
      quality: "high",
      params: {}
    });
    expect(["ok", "budget-exceeded"]).toContain(result.status);
    if (result.status === "ok") {
      expect(result.totalPoints).toBeLessThanOrEqual(MAX_STREAMLINE_POINTS_TOTAL);
    }
  });
});
