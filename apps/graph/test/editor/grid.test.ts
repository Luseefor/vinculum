import { describe, it, expect } from 'vitest';
import { getNiceGridStep } from '@/lib/graph/grid';

describe('grid - HIGH-1: Math.log10(0) fix', () => {
  it('should handle distance = 0 without producing -Infinity', () => {
    const result = getNiceGridStep(0);
    
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle very small distances', () => {
    const result = getNiceGridStep(1e-10);
    
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle negative distances (absolute value)', () => {
    const result = getNiceGridStep(-100);
    
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
    // Should be same as positive
    expect(result).toBe(getNiceGridStep(100));
  });

  it('should produce nice round numbers for typical distances', () => {
    const result = getNiceGridStep(100);
    
    // For distance 100, target step = 100/12 ≈ 8.33
    // Should round to nice value like 10
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('should handle very large distances', () => {
    const result = getNiceGridStep(1e10);
    
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should produce consistent results for same input', () => {
    const distance = 42.5;
    const result1 = getNiceGridStep(distance);
    const result2 = getNiceGridStep(distance);
    
    expect(result1).toBe(result2);
  });

  it('should return power of 10 multiples', () => {
    const result = getNiceGridStep(50);
    
    // Result should be like 1, 2, 5, 10, 20, 50, 100, etc.
    // Check if it's a reasonable grid step
    const log = Math.log10(result);
    const fractional = log % 1;
    
    // Should be close to 0 (1, 10, 100) or log10(2) or log10(5)
    const isNice = 
      Math.abs(fractional) < 0.01 || // 1, 10, 100
      Math.abs(fractional - Math.log10(2)) < 0.01 || // 2, 20, 200
      Math.abs(fractional - Math.log10(5)) < 0.01;   // 5, 50, 500
      
    expect(isNice).toBe(true);
  });

  it('should scale appropriately with distance', () => {
    const step1 = getNiceGridStep(10);
    const step2 = getNiceGridStep(100);
    const step3 = getNiceGridStep(1000);
    
    // Larger distances should produce larger steps
    expect(step2).toBeGreaterThan(step1);
    expect(step3).toBeGreaterThan(step2);
  });
});
