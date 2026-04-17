import { describe, it, expect, vi } from 'vitest';
import { sampleCurve } from '@/lib/math/sampleCurve';
import type { ParametricEvaluator } from '@/lib/math/compileParametric';

describe('sampleCurve - HIGH-2: Division by zero and degenerate range fixes', () => {
  const simpleEvaluator: ParametricEvaluator = (t) => [t, t * t, 0];

  it('should handle samples = 2 (minimum) without division by zero', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: 0,
      tMax: 1,
      samples: 1, // Will be clamped to 2
    });

    expect(result.positions.length).toBe(2 * 3); // 2 samples * 3 coords (minimum)
    expect(Number.isFinite(result.positions[0])).toBe(true);
  });

  it('should handle tMin ≈ tMax (very narrow range)', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: 1.0,
      tMax: 1.0000001, // Nearly identical - will be expanded to [-1, 1]
      samples: 10,
    });

    expect(result.positions.length).toBe(10 * 3);
  });

  it('should handle tMin = tMax exactly', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: 5,
      tMax: 5, // Will be expanded to [-1, 1]
      samples: 10,
    });

    expect(result.positions.length).toBe(10 * 3);
  });

  it('should handle tMin > tMax by swapping', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: 10,
      tMax: 0, // Reversed
      samples: 5,
    });

    expect(result.positions.length).toBe(5 * 3);
    // Should sample from 0 to 10 (swapped)
  });

  it('should handle non-finite tMin', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: Number.POSITIVE_INFINITY,
      tMax: 1,
      samples: 5,
    });

    // Should fallback to [-1, 1]
    expect(result.positions.length).toBe(5 * 3);
  });

  it('should handle non-finite tMax', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: 0,
      tMax: Number.NaN,
      samples: 5,
    });

    expect(result.positions.length).toBe(5 * 3);
  });

  it('should handle evaluator returning NaN', () => {
    const nanEvaluator: ParametricEvaluator = () => [Number.NaN, Number.NaN, Number.NaN];

    const result = sampleCurve(nanEvaluator, {
      tMin: 0,
      tMax: 1,
      samples: 3,
    });

    // sanitizePoint uses fallback (previous point, initially [0,0,0])
    // So first point is [0,0,0], subsequent use previous
    expect(result.positions.length).toBe(3 * 3);
    // All should be 0 (fallback to previous which starts at 0)
    for (let i = 0; i < result.positions.length; i++) {
      expect(result.positions[i]).toBe(0);
    }
  });

  it('should handle evaluator returning Infinity with clamping', () => {
    const infEvaluator: ParametricEvaluator = (t) => [
      Number.POSITIVE_INFINITY,
      t,
      Number.NEGATIVE_INFINITY
    ];

    const result = sampleCurve(infEvaluator, {
      tMin: 0,
      tMax: 1,
      samples: 3,
      clampCoordinate: 100,
    });

    // X and Z should be clamped
    expect(Math.abs(result.positions[0])).toBeLessThanOrEqual(100); // x
    expect(Number.isFinite(result.positions[1])).toBe(true); // y
    expect(Math.abs(result.positions[2])).toBeLessThanOrEqual(100); // z
  });

  it('should produce correct number of samples', () => {
    const samples = 100;
    const result = sampleCurve(simpleEvaluator, {
      tMin: -5,
      tMax: 5,
      samples,
    });

    expect(result.positions.length).toBe(samples * 3);
  });

  it('should interpolate t parameter correctly', () => {
    const result = sampleCurve(simpleEvaluator, {
      tMin: 0,
      tMax: 4,
      samples: 5,
    });

    // With 5 samples from 0 to 4, t should be [0, 1, 2, 3, 4]
    // x = t, so positions[0] = 0, positions[3] = 1, positions[6] = 2, etc.
    expect(result.positions[0]).toBeCloseTo(0, 5);
    expect(result.positions[3]).toBeCloseTo(1, 5);
    expect(result.positions[6]).toBeCloseTo(2, 5);
    expect(result.positions[9]).toBeCloseTo(3, 5);
    expect(result.positions[12]).toBeCloseTo(4, 5);
  });

  it('should handle evaluator throwing exception', () => {
    const throwingEvaluator: ParametricEvaluator = () => {
      throw new Error('Evaluation failed');
    };

    // This will throw during evaluation
    expect(() => {
      sampleCurve(throwingEvaluator, {
        tMin: 0,
        tMax: 1,
        samples: 3,
      });
    }).toThrow();
  });
});
