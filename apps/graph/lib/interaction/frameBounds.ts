// S33 Frame Selected / Fit Scene presentation bounds (UI-only).
//
// Framing changes CAMERA ONLY: object math, domains, scene state, and
// analysis are never touched. Infinite Line/Ray/Plane use LOCAL
// presentation radii (never the renderer-clipped 20,000-unit extent), and
// degenerate objects use a minimum radius (no camera singularity). These
// radii never leak into canonical math.
//
// Inputs are plain math-frame numbers (callers convert via mathToWorld3D /
// renderer Box3 reads); this module holds no Three.js dependency.

export interface MathPoint3 {
  x: number;
  y: number;
  z: number;
}

export interface FrameBounds {
  center: MathPoint3;
  radius: number;
}

/** Local presentation radii (camera-only, never canonical). */
export const MIN_FRAME_RADIUS = 1.5;
export const LINE_FRAME_RADIUS = 6;
export const RAY_FRAME_RADIUS = 6;
export const PLANE_FRAME_RADIUS = 8;
const FINITE_FIT_PADDING = 1.25;

function sanitizePoint(point: MathPoint3): MathPoint3 | null {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(point.z)
  ) {
    return null;
  }
  return { x: point.x, y: point.y, z: point.z };
}

/** Fit a finite point cloud: bbox center, half-diagonal padded. */
export function frameBoundsFromPoints(points: MathPoint3[]): FrameBounds | null {
  const clean: MathPoint3[] = [];
  for (const point of points) {
    const sanitized = sanitizePoint(point);
    if (sanitized) {
      clean.push(sanitized);
    }
  }
  if (clean.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const point of clean) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    maxZ = Math.max(maxZ, point.z);
  }
  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2
  };
  const halfDiagonal =
    Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
  const radius = Math.max(MIN_FRAME_RADIUS, halfDiagonal * FINITE_FIT_PADDING);
  if (!Number.isFinite(radius)) {
    return null;
  }
  return { center, radius };
}

/** Infinite Line: focus around the defining point P (local radius). */
export function frameBoundsLinePoint(point: MathPoint3): FrameBounds | null {
  const center = sanitizePoint(point);
  if (!center) {
    return null;
  }
  return { center, radius: LINE_FRAME_RADIUS };
}

/**
 * Ray: focus around the origin and nearby forward direction (local
 * radius); the center sits half a radius along the direction so both the
 * origin and the outgoing ray read well.
 */
export function frameBoundsRayOrigin(
  origin: MathPoint3,
  direction: MathPoint3
): FrameBounds | null {
  const cleanOrigin = sanitizePoint(origin);
  const cleanDirection = sanitizePoint(direction);
  if (!cleanOrigin || !cleanDirection) {
    return null;
  }
  const length = Math.hypot(cleanDirection.x, cleanDirection.y, cleanDirection.z);
  if (!(length > 0)) {
    return { center: cleanOrigin, radius: RAY_FRAME_RADIUS };
  }
  const half = RAY_FRAME_RADIUS / 2;
  return {
    center: {
      x: cleanOrigin.x + (cleanDirection.x / length) * half,
      y: cleanOrigin.y + (cleanDirection.y / length) * half,
      z: cleanOrigin.z + (cleanDirection.z / length) * half
    },
    radius: RAY_FRAME_RADIUS
  };
}

/** Plane: focus a useful visible region around the resolved anchor. */
export function frameBoundsPlaneAnchor(anchor: MathPoint3): FrameBounds | null {
  const center = sanitizePoint(anchor);
  if (!center) {
    return null;
  }
  return { center, radius: PLANE_FRAME_RADIUS };
}

/** Union of bounds for Fit Scene (skips nulls; null when empty). */
export function unionFrameBounds(bounds: Array<FrameBounds | null>): FrameBounds | null {
  const corners: MathPoint3[] = [];
  for (const entry of bounds) {
    if (!entry || !Number.isFinite(entry.radius) || entry.radius < 0) {
      continue;
    }
    corners.push(
      { x: entry.center.x - entry.radius, y: entry.center.y - entry.radius, z: entry.center.z - entry.radius },
      { x: entry.center.x + entry.radius, y: entry.center.y + entry.radius, z: entry.center.z + entry.radius }
    );
  }
  return frameBoundsFromPoints(corners);
}
