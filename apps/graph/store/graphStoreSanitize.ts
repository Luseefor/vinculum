import type { SurfaceDomain } from "@vinculum/scene/types";

export function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function sanitizePartialDomain(partialDomain: Partial<SurfaceDomain>): Partial<SurfaceDomain> {
  const nextDomain: Partial<SurfaceDomain> = {};

  if (isFiniteNumber(partialDomain.xMin)) {
    nextDomain.xMin = partialDomain.xMin;
  }

  if (isFiniteNumber(partialDomain.xMax)) {
    nextDomain.xMax = partialDomain.xMax;
  }

  if (isFiniteNumber(partialDomain.yMin)) {
    nextDomain.yMin = partialDomain.yMin;
  }

  if (isFiniteNumber(partialDomain.yMax)) {
    nextDomain.yMax = partialDomain.yMax;
  }

  return nextDomain;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
