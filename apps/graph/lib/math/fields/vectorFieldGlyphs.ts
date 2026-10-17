import type {
  VectorFieldDimension,
  VectorFieldDomain2D,
  VectorFieldDomain3D
} from "@vinculum/scene/types";

// Pure glyph-sizing policy for S20 vector fields (no Three.js, no React:
// shared by the Canvas2D renderer and the instanced 3D builder so both
// views agree on lengths).
//
// Length semantics: glyph length communicates relative magnitude without
// raw |F| scaling (fields span huge ranges) and without overlap explosion.
// The local cell spacing is the maximum glyph scale:
//
//   direction           = normalize(F)                      (exact)
//   normalize OFF       = cell * clamp((m / ref) * scale, MIN, MAX)
//   normalize ON        = cell * min(scale, MAX)             (all equal)
//
// where ref is the field's max finite magnitude. Zero/invalid magnitudes
// yield length 0 (no visible arrow; the sample stays valid for later
// calculus use). Extreme magnitudes self-normalize because m <= ref by
// construction, and the MAX cap absorbs user scale above 1.
export const VECTOR_GLYPH_MIN_FRACTION = 0.05;
export const VECTOR_GLYPH_MAX_FRACTION = 1;

export function computeGlyphLength(
  magnitude: number,
  referenceMagnitude: number,
  cell: number,
  scale: number,
  normalize: boolean
): number {
  if (!(magnitude > 0) || !(cell > 0) || !(scale > 0)) {
    return 0;
  }
  if (normalize) {
    return cell * Math.min(scale, VECTOR_GLYPH_MAX_FRACTION);
  }
  if (!(referenceMagnitude > 0)) {
    return 0;
  }
  const fraction = (magnitude / referenceMagnitude) * scale;
  const clamped = Math.min(Math.max(fraction, VECTOR_GLYPH_MIN_FRACTION), VECTOR_GLYPH_MAX_FRACTION);
  return cell * clamped;
}

// Local cell spacing: the minimum axis spacing, so glyphs capped at one
// cell never overlap along the tightest axis. Degenerate (zero-extent)
// domains yield cell 0, which collapses every glyph length to 0 safely.
export function vectorFieldCellSize(
  domain: VectorFieldDomain2D | VectorFieldDomain3D,
  density: number,
  dimension: VectorFieldDimension
): number {
  if (!Number.isFinite(density) || density < 2) {
    return 0;
  }
  const extents = [domain.xMax - domain.xMin, domain.yMax - domain.yMin];
  if (dimension === "3d") {
    const domain3D = domain as VectorFieldDomain3D;
    extents.push(domain3D.zMax - domain3D.zMin);
  }
  let minExtent = Number.POSITIVE_INFINITY;
  for (const extent of extents) {
    if (!Number.isFinite(extent)) {
      return 0;
    }
    if (extent < minExtent) {
      minExtent = extent;
    }
  }
  if (!(minExtent > 0)) {
    return 0;
  }
  return minExtent / (density - 1);
}
