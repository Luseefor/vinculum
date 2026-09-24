// S23 pure marching-squares contour extraction. No React, no Three, no
// stores, no DOM — TypedArrays in, TypedArrays out. Operates on the
// sampled scalar grid (grid-math coordinates), so the 2D canvas and the 3D
// slice path share one engine (the slice maps (u,v) segments back through
// mathToWorld3D; no separate 3D contour code exists).
//
// Conventions:
// - corners a=(i,j), b=(i+1,j), c=(i+1,j+1), d=(i,j+1); "inside" means
//   value >= level, so vertices exactly on a level become shared segment
//   endpoints (this keeps saddle diagonals like y=+-x continuous instead
//   of gapping at every diagonal vertex).
// - ambiguous cases 5 (a,c) and 10 (b,d) use a deterministic
//   center-average decider: center >= level joins through the middle,
//   otherwise the corners stay separate. No arbitrary diagonals, no
//   checkerboard cracks.
// - cells with ANY invalid corner are skipped outright: contours never
//   bridge singularities (1/x leaves a clean gap at x=0).
// - a uniform field equal to a requested level is degenerate (the whole
//   domain is the level set): status "degenerate" with zero segments,
//   never a grid-edge mess.
// - segment budget aborts cleanly with "budget-exceeded" and NO partial
//   output (a truncated contour would mislead).

import type { SampledScalarGrid, ScalarGridDomain } from "./scalarFieldSample";

export const MAX_CONTOUR_SEGMENTS = 32768;
export const MAX_CONTOUR_LEVELS = 16;
export const MIN_CONTOUR_LEVELS = 1;
export const DEFAULT_CONTOUR_COUNT = 8;

// Evenly spaced levels over [min, max]. If the range strictly spans zero,
// the level nearest zero is replaced by exactly 0 (unless one already
// sits within a quarter step) — the zero contour is the most informative
// level for signed fields and implicit analysis, and it must never be
// duplicated.
export function computeContourLevels(min: number, max: number, count: number): Float32Array {
  const clamped = Math.min(MAX_CONTOUR_LEVELS, Math.max(MIN_CONTOUR_LEVELS, Math.floor(count)));
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) {
    return new Float32Array([Number.isFinite(min) ? min : 0]);
  }
  const levels = new Float32Array(clamped);
  if (clamped === 1) {
    levels[0] = (min + max) / 2;
  } else {
    for (let k = 0; k < clamped; k += 1) {
      levels[k] = min + ((max - min) * k) / (clamped - 1);
    }
  }
  if (min < 0 && max > 0) {
    const step = (max - min) / Math.max(1, clamped - 1);
    let nearest = 0;
    let nearestDistance = Math.abs(levels[0] as number);
    for (let k = 1; k < clamped; k += 1) {
      const distance = Math.abs(levels[k] as number);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = k;
      }
    }
    if (nearestDistance > step / 4) {
      levels[nearest] = 0;
    }
  }
  return levels;
}

export type ContourStatus = "ok" | "empty" | "degenerate" | "budget-exceeded";

export interface ExtractedContours {
  /** Flat [x0,y0,x1,y1]* in grid-math (u,v) coordinates. */
  segments: Float32Array;
  segmentCount: number;
  status: ContourStatus;
}

export function extractContours(
  grid: SampledScalarGrid,
  domain: ScalarGridDomain,
  levels: ArrayLike<number>
): ExtractedContours {
  if (grid.validCount === 0 || levels.length === 0) {
    return { segments: new Float32Array(0), segmentCount: 0, status: "empty" };
  }
  // Uniform field: every finite sample equals min == max. If a requested
  // level coincides, the entire domain is the level set — degenerate by
  // policy (PART 37), never an edge-soup.
  if (grid.min === grid.max) {
    const degenerate = Array.from(levels).some((level) => level === grid.min);
    return {
      segments: new Float32Array(0),
      segmentCount: 0,
      status: degenerate ? "degenerate" : "empty"
    };
  }
  const width = grid.width;
  const height = grid.height;
  if (width < 2 || height < 2) {
    return { segments: new Float32Array(0), segmentCount: 0, status: "empty" };
  }
  const du = (domain.uMax - domain.uMin) / (width - 1);
  const dv = (domain.vMax - domain.vMin) / (height - 1);
  if (!Number.isFinite(du) || !Number.isFinite(dv)) {
    return { segments: new Float32Array(0), segmentCount: 0, status: "empty" };
  }
  const out = new Float32Array(MAX_CONTOUR_SEGMENTS * 4);
  let segmentCount = 0;
  const pushSegment = (x0: number, y0: number, x1: number, y1: number): boolean => {
    if (segmentCount >= MAX_CONTOUR_SEGMENTS) {
      return false;
    }
    // Zero-length endpoint touches (level exactly through two adjacent
    // vertices of one edge) carry no geometry; skip them so saddle
    // diagonals stay clean single-width polylines.
    if (x0 === x1 && y0 === y1) {
      return true;
    }
    const base = segmentCount * 4;
    out[base] = x0;
    out[base + 1] = y0;
    out[base + 2] = x1;
    out[base + 3] = y1;
    segmentCount += 1;
    return true;
  };

  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const level = levels[levelIndex] as number;
    if (!Number.isFinite(level)) {
      continue;
    }
    for (let j = 0; j < height - 1; j += 1) {
      const v0 = domain.vMin + j * dv;
      const v1 = domain.vMin + (j + 1) * dv;
      for (let i = 0; i < width - 1; i += 1) {
        const base = j * width + i;
        if (
          grid.valid[base] === 0 ||
          grid.valid[base + 1] === 0 ||
          grid.valid[base + width] === 0 ||
          grid.valid[base + width + 1] === 0
        ) {
          continue;
        }
        const a = grid.values[base] as number;
        const b = grid.values[base + 1] as number;
        const d = grid.values[base + width] as number;
        const c = grid.values[base + width + 1] as number;
        const u0 = domain.uMin + i * du;
        const u1 = domain.uMin + (i + 1) * du;
        const insideA = a >= level;
        const insideB = b >= level;
        const insideC = c >= level;
        const insideD = d >= level;
        const caseIndex =
          (insideA ? 1 : 0) | (insideB ? 2 : 0) | (insideC ? 4 : 0) | (insideD ? 8 : 0);
        if (caseIndex === 0 || caseIndex === 15) {
          continue;
        }
        // Edge crossing points (only computed when the case needs them).
        // B: bottom a→b at v0; R: right b→c at u1; T: top d→c at v1;
        // L: left a→d at u0.
        const pointB = () => edgePoint(u0, v0, a, u1, v0, b, level);
        const pointR = () => edgePoint(u1, v0, b, u1, v1, c, level);
        const pointT = () => edgePoint(u0, v1, d, u1, v1, c, level);
        const pointL = () => edgePoint(u0, v0, a, u0, v1, d, level);
        let complete = true;
        const connect = (
          p: () => { x: number; y: number },
          q: () => { x: number; y: number }
        ): void => {
          if (!complete) {
            return;
          }
          const p0 = p();
          const p1 = q();
          complete = pushSegment(p0.x, p0.y, p1.x, p1.y);
        };
        switch (caseIndex) {
          case 1:
          case 14:
            connect(pointL, pointB);
            break;
          case 2:
          case 13:
            connect(pointB, pointR);
            break;
          case 3:
          case 12:
            connect(pointL, pointR);
            break;
          case 4:
          case 11:
            connect(pointR, pointT);
            break;
          case 6:
          case 9:
            connect(pointB, pointT);
            break;
          case 7:
          case 8:
            connect(pointL, pointT);
            break;
          case 5:
          case 10: {
            // Ambiguous saddle: the bilinear center estimate decides.
            // Center inside joins through the middle; otherwise the two
            // inside corners keep separate contours. Deterministic for a
            // given grid (no arbitrary diagonals, no cracks).
            const centerInside = (a + b + c + d) / 4 >= level;
            const throughMiddle = centerInside === (caseIndex === 5);
            if (throughMiddle) {
              connect(pointB, pointR);
              connect(pointT, pointL);
            } else {
              connect(pointL, pointB);
              connect(pointR, pointT);
            }
            break;
          }
          default:
            break;
        }
        if (!complete) {
          return { segments: new Float32Array(0), segmentCount: 0, status: "budget-exceeded" };
        }
      }
    }
  }
  return {
    segments: out.slice(0, segmentCount * 4),
    segmentCount,
    status: segmentCount > 0 ? "ok" : "empty"
  };
}

function edgePoint(
  x1: number,
  y1: number,
  v1: number,
  x2: number,
  y2: number,
  v2: number,
  level: number
): { x: number; y: number } {
  const denominator = v2 - v1;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }
  const t = Math.min(1, Math.max(0, (level - v1) / denominator));
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}
