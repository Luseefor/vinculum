import { describe, expect, it } from "vitest";
import {
  traceStreamline,
  traceStreamlineBranch,
  type StreamlineEvaluator,
  type StreamlineIntegratorOptions
} from "@/lib/math/streamlineIntegrate";

const DOMAIN2D = { min: [-5, -5], max: [5, 5] };

function options2D(overrides: Partial<StreamlineIntegratorOptions> = {}): StreamlineIntegratorOptions {
  return {
    dimension: 2,
    stepSize: 0.1,
    maxStepsPerBranch: 1024,
    maxLengthPerBranch: 30,
    zeroThreshold: 1e-12,
    loopMinSteps: 48,
    loopRadiusSteps: 2,
    loopAlignment: 0.7,
    stagnationEps: 1e-11,
    stagnationLimit: 3,
    ...overrides
  };
}

function constant2D(value: [number, number]): StreamlineEvaluator {
  return () => [...value];
}

describe("traceStreamlineBranch termination (S24 PART 3)", () => {
  it("traces a constant field as a straight horizontal line", () => {
    const branch = traceStreamlineBranch(constant2D([1, 0]), [0, 0], 1, DOMAIN2D, options2D());
    expect(branch.reason).toBe("domain-exit");
    expect(branch.points.length).toBeGreaterThan(4);
    for (let i = 0; i < branch.points.length; i += 2) {
      expect(branch.points[i + 1]).toBeCloseTo(0, 12);
    }
    // Exits near x=+5 without overshooting the domain.
    const lastX = branch.points[branch.points.length - 2] as number;
    expect(lastX).toBeLessThanOrEqual(5);
    expect(lastX).toBeGreaterThan(4);
  });

  it("terminates cleanly at zero and near-zero seeds", () => {
    const zero = traceStreamlineBranch(constant2D([0, 0]), [1, 1], 1, DOMAIN2D, options2D());
    expect(zero.reason).toBe("zero-field");
    expect(zero.points).toEqual([1, 1]);
    const radial = (p: number[]) => [p[0] as number, p[1] as number];
    const nearZero = traceStreamlineBranch(radial, [1e-13, 0], 1, DOMAIN2D, options2D());
    expect(nearZero.reason).toBe("zero-field");
  });

  it("never crosses the 1/x singularity", () => {
    const field = (p: number[]) => [1 / (p[0] as number), 1];
    const branch = traceStreamlineBranch(field, [-1, 0], 1, DOMAIN2D, options2D());
    expect(["domain-exit", "invalid-field"]).toContain(branch.reason);
    for (let i = 0; i < branch.points.length; i += 2) {
      expect(branch.points[i] as number).toBeLessThan(0);
    }
  });

  it("terminates invalid RK stages without partial steps", () => {
    // Finite at integers, NaN at half-integers: the first RK midpoint
    // evaluation fails and the branch stops with only the seed.
    const field = (p: number[]) => {
      const x = p[0] as number;
      return Number.isInteger(x * 10) ? [1, 0] : [Number.NaN, 0];
    };
    const branch = traceStreamlineBranch(field, [0, 0], 1, DOMAIN2D, options2D({ stepSize: 0.05 }));
    expect(branch.reason).toBe("invalid-field");
    expect(branch.points).toEqual([0, 0]);
  });

  it("stops at the domain boundary without far-out points", () => {
    const branch = traceStreamlineBranch(
      constant2D([1, 0]),
      [0, 0],
      1,
      { min: [-1, -1], max: [1, 1] },
      options2D({ stepSize: 0.3 })
    );
    expect(branch.reason).toBe("domain-exit");
    for (const value of branch.points) {
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
    }
  });
});

describe("rotation field circles (S24 PART 23, critical)", () => {
  const rotation = (p: number[]) => [-(p[1] as number), p[0] as number];

  it("keeps radius tightly bounded", () => {
    const branch = traceStreamlineBranch(rotation, [3, 0], 1, DOMAIN2D, options2D());
    let worstDrift = 0;
    for (let i = 0; i < branch.points.length; i += 2) {
      const radius = Math.hypot(branch.points[i] as number, branch.points[i + 1] as number);
      worstDrift = Math.max(worstDrift, Math.abs(radius - 3));
    }
    // RK4 at step 0.1 over several revolutions: drift must be tiny (Euler
    // would spiral by orders of magnitude more).
    expect(worstDrift).toBeLessThan(0.02);
  });

  it("closes the loop instead of exhausting max steps", () => {
    const branch = traceStreamlineBranch(rotation, [3, 0], 1, DOMAIN2D, options2D());
    expect(branch.closed).toBe(true);
    expect(branch.reason).toBe("closed-loop");
    // One revolution plus detection margin — not thousands of points.
    expect(branch.points.length / 2).toBeLessThan(400);
    const endX = branch.points[branch.points.length - 2] as number;
    const endY = branch.points[branch.points.length - 1] as number;
    expect(Math.hypot(endX - 3, endY)).toBeLessThan(0.3);
  });
});

describe("traceStreamline joining (S24)", () => {
  it("joins backward and forward without duplicating the seed", () => {
    const traced = traceStreamline(constant2D([1, 0]), [0, 0], DOMAIN2D, options2D({ stepSize: 1 }));
    // Points run from the backward end (x<0) through the seed to x>0.
    const xs: number[] = [];
    for (let i = 0; i < traced.points.length; i += 2) {
      xs.push(traced.points[i] as number);
    }
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1] as number);
    }
    expect(xs).toContain(0);
    expect(xs.filter((x) => x === 0)).toHaveLength(1);
  });

  it("produces no points for a zero field", () => {
    const traced = traceStreamline(constant2D([0, 0]), [1, 2], DOMAIN2D, options2D());
    expect(traced.points).toHaveLength(0);
    expect(traced.closed).toBe(false);
  });
});
