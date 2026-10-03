import type { SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";
import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";

export interface SurfaceDisplayView {
  distance: number;
  fov: number;
  aspect: number;
  target: { x: number; y: number; z: number };
  orthoSpans?: number[];
}

/** Renderer-only bounds. Quantized tiles avoid resampling on every orbit frame. */
export function surfaceDisplayDomain(object: SurfaceGraphObject, view: SurfaceDisplayView): SurfaceDomain {
  if (!(object.autoDomain ?? object.autoExpression)) return object.domain;
  const { effectiveOrientation } = getEffectiveSurfaceOrientation(object.equation, object.orientation);
  const target = { x: view.target.x, y: view.target.z, z: view.target.y }; // world → math
  const inputs = effectiveOrientation === "x" ? [target.y, target.z] : effectiveOrientation === "y" ? [target.x, target.z] : [target.x, target.y];
  const visibleRadius = Math.max(4,
    Math.abs(view.distance) * Math.tan(view.fov * Math.PI / 360) * Math.max(1, view.aspect),
    ...(view.orthoSpans ?? []).filter(Number.isFinite));
  const step = Math.min(4096, 2 ** Math.ceil(Math.log2(Math.min(8192, visibleRadius) / 2)));
  const half = step * 4;
  const center = (value: number) => Math.round(Math.max(-1e6, Math.min(1e6, value)) / step) * step;
  if (!Number.isFinite(step) || inputs.some((value) => !Number.isFinite(value))) return object.domain;
  return { xMin: center(inputs[0]) - half, xMax: center(inputs[0]) + half, yMin: center(inputs[1]) - half, yMax: center(inputs[1]) + half };
}
