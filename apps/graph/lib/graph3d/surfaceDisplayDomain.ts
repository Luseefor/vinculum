import type { SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";
import { getEffectiveSurfaceOrientation } from "@/lib/math/expressions/compileExpression";

export interface SurfaceDisplayView {
  distance: number;
  fov: number;
  aspect: number;
  target: { x: number; y: number; z: number };
  orthoSpans?: number[];
}

/** Keep all surface-attached layers within the same numerical height limit. */
export function surfaceHeightClamp(object: SurfaceGraphObject): number {
  return (object.autoDomain ?? object.autoExpression) ? 1e12 : 10_000;
}

/** Renderer-only bounds. Quantized tiles avoid resampling on every orbit frame. */
export function surfaceDisplayDomain(object: SurfaceGraphObject, view: SurfaceDisplayView): SurfaceDomain {
  if (!(object.autoDomain ?? object.autoExpression)) return object.domain;
  const { effectiveOrientation } = getEffectiveSurfaceOrientation(object.equation, object.orientation);
  const target = { x: view.target.x, y: view.target.z, z: view.target.y }; // world → math
  const inputs = effectiveOrientation === "x" ? [target.y, target.z] : effectiveOrientation === "y" ? [target.x, target.z] : [target.x, target.y];
  return viewInputDomain(inputs, view, object.domain);
}

/** A planar equation's display range follows the same camera tiles as surfaces. */
export function planarCurveDisplayDomain(view: SurfaceDisplayView): SurfaceDomain {
  return viewInputDomain([view.target.x, view.target.z], view, { xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
}

/** Scalar layers in a 2D pane use its own pan, zoom, and measured size. */
export function surfaceDisplayDomain2D(
  object: SurfaceGraphObject,
  viewport: { centerX: number; centerY: number; scale: number },
  frame: { width: number; height: number }
): SurfaceDomain {
  return (object.autoDomain ?? object.autoExpression) ? planarDisplayDomain2D(viewport, frame, object.domain) : object.domain;
}

export function planarDisplayDomain2D(
  viewport: { centerX: number; centerY: number; scale: number },
  frame: { width: number; height: number },
  fallback: SurfaceDomain = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
): SurfaceDomain {
  if (!(viewport.scale > 0) ||
    !Number.isFinite(viewport.scale) || !(frame.width > 0) || !(frame.height > 0) ||
    !Number.isFinite(frame.width) || !Number.isFinite(frame.height)) return fallback;
  return viewInputDomain([viewport.centerX, viewport.centerY], {
    distance: 0, fov: 0, aspect: 1,
    orthoSpans: [frame.width / (2 * viewport.scale), frame.height / (2 * viewport.scale)]
  }, fallback, true);
}

function viewInputDomain(inputs: number[], view: Pick<SurfaceDisplayView, "distance" | "fov" | "aspect" | "orthoSpans">, fallback: SurfaceDomain, planar = false): SurfaceDomain {
  const visibleRadius = Math.max(planar ? 0 : 4,
    Math.abs(view.distance) * Math.tan(view.fov * Math.PI / 360) * Math.max(1, view.aspect),
    ...(view.orthoSpans ?? []).filter(Number.isFinite));
  const radius = Math.min(8192, visibleRadius);
  const step = Math.min(4096, 2 ** Math.ceil(Math.log2(radius / (planar ? 4 : 2))));
  // 2D needs only half a tile of pan padding: excessive overscan puts
  // automatic contour levels outside the visible range, especially on zoom.
  const half = planar ? step * Math.ceil(radius / step + .5) : step * 4;
  const center = (value: number) => Math.round(Math.max(-1e6, Math.min(1e6, value)) / step) * step;
  if (!Number.isFinite(step) || inputs.some((value) => !Number.isFinite(value))) return fallback;
  return { xMin: center(inputs[0]) - half, xMax: center(inputs[0]) + half, yMin: center(inputs[1]) - half, yMax: center(inputs[1]) + half };
}
