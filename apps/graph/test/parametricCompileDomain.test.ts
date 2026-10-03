import { describe, it, expect } from "vitest";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { buildParametric } from "@/lib/graph3d/buildGraphParametric";
import { getExpressionRowValidation } from "@/components/expressions/expressionRowValidation";
import type { ParametricCurveObject } from "@vinculum/scene/types";

// S6-U2: domain-independent parametric compilation regressions.
// Locked contract: compilation validates syntax/legal-language only;
// per-sample domain validity belongs to sampleCurve (S5 validity model).
// Desired F1 assertions FAIL pre-fix (t=0 probe rejects); controls pass.
// NOTE (policy conflict, resolved S6-U3): expressionSafety.test.ts formerly
// asserted compile-time rejection of constant "1/0" ("rejects non-finite
// results from parametric axis evaluation"). Under the locked contract above
// that expectation is obsolete, so S6-U3 rewrote it in place to assert the new
// behavior (compiles; evaluator yields NaN; see "constant 1/0" test below).
// The rewrite carries its own explanatory comment; nothing is hidden.

function makeCurve(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  tMin: number,
  tMax: number,
  samples: number
): ParametricCurveObject {
  return {
    id: "domain-curve",
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

describe("parametric compile domain independence", () => {
  it("A: 1/t compiles despite the t=0 singularity", () => {
    const compiled = compileParametricExpressions("t", "1/t", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    expect(compiled.evaluator(1)[1]).toBeCloseTo(1, 12);
    expect(compiled.evaluator(2)[1]).toBeCloseTo(0.5, 12);
    expect(compiled.evaluator(0)[1]).toBeNaN();
  });

  it("B: log(t) compiles despite t<=0 domain holes", () => {
    const compiled = compileParametricExpressions("t", "log(t)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    expect(compiled.evaluator(1)[1]).toBeCloseTo(0, 12);
    expect(compiled.evaluator(Math.E)[1]).toBeCloseTo(1, 9);
    expect(compiled.evaluator(0)[1]).toBeNaN();
    expect(compiled.evaluator(-1)[1]).toBeNaN();
  });

  it("C: sqrt(t) compiles; runtime handles the domain (control)", () => {
    const compiled = compileParametricExpressions("t", "sqrt(t)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    expect(compiled.evaluator(4)[1]).toBeCloseTo(2, 12);
    expect(compiled.evaluator(0)[1]).toBeCloseTo(0, 12);
    expect(compiled.evaluator(-1)[1]).toBeNaN();
  });

  it("D: 1/(t-2) compiles; t=0 safety is incidental (control)", () => {
    const compiled = compileParametricExpressions("t", "1/(t - 2)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    expect(compiled.evaluator(1)[1]).toBeCloseTo(-1, 12);
    expect(compiled.evaluator(2)[1]).toBeNaN();
    expect(compiled.evaluator(3)[1]).toBeCloseTo(1, 12);
  });

  it("constant 1/0 compiles under the new policy; every evaluation is NaN", () => {
    const compiled = compileParametricExpressions("t", "1/0", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    for (const t of [-5, 0, 5]) {
      expect(compiled.evaluator(t)[1]).toBeNaN();
    }
  });

  it("1/t on [1,5] samples fully valid and connected", () => {
    const curve = makeCurve("t", "1/t", "0", 1, 5, 64);
    const compiled = compileParametricExpressions(curve.xExpr, curve.yExpr, curve.zExpr);
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: 1, tMax: 5, samples: 64 });
    for (let i = 0; i < 64; i += 1) {
      expect(sampled.validSamples[i]).toBe(1);
    }
    for (let i = 0; i < 63; i += 1) {
      expect(sampled.connectedSegments[i]).toBe(1);
    }
    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }
  });

  it("1/t on [-1,1] marks the t=0 hole and keeps both branches", () => {
    const curve = makeCurve("t", "1/t", "0", -1, 1, 101);
    const compiled = compileParametricExpressions(curve.xExpr, curve.yExpr, curve.zExpr);
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: -1, tMax: 1, samples: 101 });
    expect(sampled.validSamples[50]).toBe(0);
    expect(sampled.validSamples[49]).toBe(1);
    expect(sampled.validSamples[51]).toBe(1);
    expect(sampled.connectedSegments[49]).toBe(0);
    expect(sampled.connectedSegments[50]).toBe(0);
    let kept = 0;
    for (let i = 0; i < 100; i += 1) {
      if (sampled.connectedSegments[i] === 1) {
        kept += 1;
      }
    }
    expect(kept).toBeGreaterThan(0);
  });

  it("1/(t-2) on [3,5] samples fully valid (control)", () => {
    const compiled = compileParametricExpressions("t", "1/(t - 2)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: 3, tMax: 5, samples: 64 });
    for (let i = 0; i < 64; i += 1) {
      expect(sampled.validSamples[i]).toBe(1);
    }
  });

  it("1/(t-2) on [1,3] cuts exactly at t=2, branches retained", () => {
    const compiled = compileParametricExpressions("t", "1/(t - 2)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: 1, tMax: 3, samples: 101 });
    expect(sampled.validSamples[50]).toBe(0);
    expect(sampled.connectedSegments[49]).toBe(0);
    expect(sampled.connectedSegments[50]).toBe(0);
    expect(sampled.connectedSegments[48]).toBe(1);
    expect(sampled.connectedSegments[51]).toBe(1);
  });

  it("log(t) on [1,5] fully valid; on [-1,5] only the positive branch survives", () => {
    const compiled = compileParametricExpressions("t", "log(t)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const good = sampleCurve(compiled.evaluator, { tMin: 1, tMax: 5, samples: 64 });
    for (let i = 0; i < 64; i += 1) {
      expect(good.validSamples[i]).toBe(1);
    }
    const mixed = sampleCurve(compiled.evaluator, { tMin: -1, tMax: 5, samples: 61 });
    // t=-1+0.1k: indices 0..9 nonpositive -> invalid; index 10 (t=0) invalid.
    for (let i = 0; i <= 10; i += 1) {
      expect(mixed.validSamples[i]).toBe(0);
    }
    for (let i = 11; i < 61; i += 1) {
      expect(mixed.validSamples[i]).toBe(1);
    }
  });

  it("sqrt(t) on [1,4] fully valid; on [-1,4] the negative branch is invalid", () => {
    const compiled = compileParametricExpressions("t", "sqrt(t)", "0");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const good = sampleCurve(compiled.evaluator, { tMin: 1, tMax: 4, samples: 64 });
    for (let i = 0; i < 64; i += 1) {
      expect(good.validSamples[i]).toBe(1);
    }
    const mixed = sampleCurve(compiled.evaluator, { tMin: -1, tMax: 4, samples: 101 });
    // t=-1+0.05k: indices 0..19 negative -> invalid; index 20 (t=0) valid.
    for (let i = 0; i < 20; i += 1) {
      expect(mixed.validSamples[i]).toBe(0);
    }
    for (let i = 20; i < 101; i += 1) {
      expect(mixed.validSamples[i]).toBe(1);
    }
  });

  it("true compiler errors remain errors without any probe", () => {
    expect(compileParametricExpressions("sin(", "t", "0").error).not.toBeNull();
    expect(compileParametricExpressions("nosuchsymbol(t)", "t", "0").error).not.toBeNull();
    expect(compileParametricExpressions("gamma(t)", "t", "0").error).not.toBeNull();
    expect(compileParametricExpressions("t", "t", "t").error).toBeNull();
  });

  it("compile result is domain-independent (same triple, any range)", () => {
    const first = compileParametricExpressions("t", "1/(t - 0.5)", "0");
    const second = compileParametricExpressions("t", "1/(t - 0.5)", "0");
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    // Domain lives in sampling: [0,0.4] fully valid, [0,1] has the t=0.5 hole.
    if (first.error || second.error) {
      return;
    }
    const narrow = sampleCurve(first.evaluator, { tMin: 0, tMax: 0.4, samples: 32 });
    for (let i = 0; i < 32; i += 1) {
      expect(narrow.validSamples[i]).toBe(1);
    }
    const wide = sampleCurve(second.evaluator, { tMin: 0, tMax: 1, samples: 101 });
    expect(wide.validSamples[50]).toBe(0);
  });

  it("row validation no longer rejects 1/t merely for t=0", () => {
    const result = getExpressionRowValidation(makeCurve("t", "1/t", "0", 1, 5, 64));
    expect(result.error).toBeNull();
  });

  it("constant-invalid sampling yields no drawable curve and no phantom sphere", () => {
    const curve = makeCurve("t", "1/0", "0", 0, 1, 32);
    const compiled = compileParametricExpressions(curve.xExpr, curve.yExpr, curve.zExpr);
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const sampled = sampleCurve(compiled.evaluator, { tMin: 0, tMax: 1, samples: 32 });
    for (let i = 0; i < 32; i += 1) {
      expect(sampled.validSamples[i]).toBe(0);
    }
    for (let i = 0; i < 31; i += 1) {
      expect(sampled.connectedSegments[i]).toBe(0);
    }
    expect(buildParametric(curve)).toBeNull();
  });
});
