// S24 deterministic seed lattices. No Math.random anywhere: identical
// source + params + domain + config yields identical seeds, hence
// identical streamlines and stable rendering. Interior-centered samples
// ((i + 0.5) / n) avoid exact-boundary seeds that would terminate
// immediately on domain exit.

export interface SeedDomain2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SeedDomain3D extends SeedDomain2D {
  zMin: number;
  zMax: number;
}

export const MIN_STREAMLINE_SEED_DENSITY_2D = 2;
export const MAX_STREAMLINE_SEED_DENSITY_2D = 12;
export const DEFAULT_STREAMLINE_SEED_DENSITY_2D = 6;
export const MIN_STREAMLINE_SEED_DENSITY_3D = 2;
export const MAX_STREAMLINE_SEED_DENSITY_3D = 5;
export const DEFAULT_STREAMLINE_SEED_DENSITY_3D = 3;

export function clampSeedDensity(density: number, dimension: "2d" | "3d"): number {
  const [lo, hi] =
    dimension === "2d"
      ? [MIN_STREAMLINE_SEED_DENSITY_2D, MAX_STREAMLINE_SEED_DENSITY_2D]
      : [MIN_STREAMLINE_SEED_DENSITY_3D, MAX_STREAMLINE_SEED_DENSITY_3D];
  if (!Number.isFinite(density)) {
    return dimension === "2d" ? DEFAULT_STREAMLINE_SEED_DENSITY_2D : DEFAULT_STREAMLINE_SEED_DENSITY_3D;
  }
  return Math.min(hi, Math.max(lo, Math.floor(density)));
}

function axisSamples(min: number, max: number, density: number): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const samples: number[] = [];
  for (let i = 0; i < density; i += 1) {
    samples.push(lo + ((hi - lo) * (i + 0.5)) / density);
  }
  return samples;
}

export function generateSeeds2D(domain: SeedDomain2D, density: number): number[][] {
  if (
    !Number.isFinite(domain.xMin) ||
    !Number.isFinite(domain.xMax) ||
    !Number.isFinite(domain.yMin) ||
    !Number.isFinite(domain.yMax)
  ) {
    return [];
  }
  const clamped = clampSeedDensity(density, "2d");
  const xs = axisSamples(domain.xMin, domain.xMax, clamped);
  const ys = axisSamples(domain.yMin, domain.yMax, clamped);
  const seeds: number[][] = [];
  for (const y of ys) {
    for (const x of xs) {
      seeds.push([x, y]);
    }
  }
  return seeds;
}

export function generateSeeds3D(domain: SeedDomain3D, density: number): number[][] {
  if (
    !Number.isFinite(domain.xMin) ||
    !Number.isFinite(domain.xMax) ||
    !Number.isFinite(domain.yMin) ||
    !Number.isFinite(domain.yMax) ||
    !Number.isFinite(domain.zMin) ||
    !Number.isFinite(domain.zMax)
  ) {
    return [];
  }
  const clamped = clampSeedDensity(density, "3d");
  const xs = axisSamples(domain.xMin, domain.xMax, clamped);
  const ys = axisSamples(domain.yMin, domain.yMax, clamped);
  const zs = axisSamples(domain.zMin, domain.zMax, clamped);
  const seeds: number[][] = [];
  for (const z of zs) {
    for (const y of ys) {
      for (const x of xs) {
        seeds.push([x, y, z]);
      }
    }
  }
  return seeds;
}
