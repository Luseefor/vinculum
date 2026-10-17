// Pure coordinate conventions for Vinculum mathematics (S3).
//
// This module has no dependencies: no React, Next.js, Zustand, Three.js, or
// DOM APIs, and it produces no renderer objects. It exists so samplers and
// renderers share one audited convention instead of reimplementing it.
//
// Canonical mapping (proven S2): math(x, y, z) -> world(x, z, y).
// World Y is up. There are no sign changes; the mapping is its own inverse.
// 2D axis pairs are MATHEMATICAL: xy -> (x, y), xz -> (x, z), yz -> (y, z).

export type MathAxis = "x" | "y" | "z";

// Minimal pair key. UI-layer twins (`Axis2DPair` in types/graphUi and
// `AxisPairSpec`/`AxisVariable` in graph2dCanvasTypes) predate this module.
// A later section may unify them; this module takes the plain string form so
// math code never imports UI layers.
export type MathAxisPair = "xy" | "xz" | "yz";

export interface MathPoint3 {
  x: number;
  y: number;
  z: number;
}

export interface WorldPoint3 {
  x: number;
  y: number;
  z: number;
}

export interface PairPoint2D {
  horizontal: number;
  vertical: number;
}

export function mathToWorld3D(point: MathPoint3): WorldPoint3 {
  return {
    x: point.x,
    y: point.z,
    z: point.y
  };
}

export function worldToMath3D(point: WorldPoint3): MathPoint3 {
  return {
    x: point.x,
    y: point.z,
    z: point.y
  };
}

// Direction-only twin of mathToWorld3D: a mathematical vector (dx, dy, dz)
// maps to world (dx, dz, dy) with NO translation and NO sign changes. The
// body is identical to the point map by construction (same linear axis
// permutation); the separate name exists so a future "fix" to one cannot
// silently break the other. S20 pins (4,5,6) -> (4,6,5) independently.
export interface MathVector3 {
  x: number;
  y: number;
  z: number;
}

export interface WorldVector3 {
  x: number;
  y: number;
  z: number;
}

export function mathVectorToWorld3D(vector: MathVector3): WorldVector3 {
  return {
    x: vector.x,
    y: vector.z,
    z: vector.y
  };
}

export function projectMathToPair2D(point: MathPoint3, pair: MathAxisPair): PairPoint2D {
  if (pair === "xz") {
    return {
      horizontal: point.x,
      vertical: point.z
    };
  }
  if (pair === "yz") {
    return {
      horizontal: point.y,
      vertical: point.z
    };
  }
  return {
    horizontal: point.x,
    vertical: point.y
  };
}

// Index of a mathematical axis component inside a WORLD-frame tuple produced
// by the canonical mapping (math x -> 0, math y -> 2, math z -> 1). Lets
// consumers read world-frame buffers (e.g. sampleCurve positions) with zero
// per-point allocation or branching. Derived from mathToWorld3D; keep in sync.
export function worldIndexForMathAxis(axis: MathAxis): 0 | 1 | 2 {
  if (axis === "y") {
    return 2;
  }
  if (axis === "z") {
    return 1;
  }
  return 0;
}
