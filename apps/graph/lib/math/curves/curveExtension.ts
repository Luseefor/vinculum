import type { ImplicitCurveObject, ImplicitSurfaceObject, SurfaceDomain } from "@vinculum/scene/types";
import { createDefaultImplicitSurfaceGraph, defaultCurveExtensionRange, defaultSurfaceDomain } from "@vinculum/scene/defaults";
import { inferGraphEquation } from "../expressions/inferGraphEquation";

/** One definition for extrusion, shared by rendering, workers, and analysis. */
export function extendCurveToSurface(object: ImplicitCurveObject, domain: SurfaceDomain = defaultSurfaceDomain, params: Record<string, number> = {}): ImplicitSurfaceObject {
  const inferred = inferGraphEquation(object.equation, params);
  return createDefaultImplicitSurfaceGraph({ id: object.id, equation: inferred.ok ? inferred.relation : object.equation,
    color: object.color, visible: object.visible, resolution: 48,
    domain: { ...domain, ...(object.extensionRange ?? defaultCurveExtensionRange) } });
}
