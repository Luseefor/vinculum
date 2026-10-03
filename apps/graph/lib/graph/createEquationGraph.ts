import type { GraphObject, ImplicitCurveObject } from "@vinculum/scene/types";
import { createSurfaceGraph } from "./createSurfaceGraph";
import { createImplicitSurfaceGraph } from "./createImplicitSurfaceGraph";
import type { inferGraphEquation } from "@/lib/math/inferGraphEquation";

type Inference = Extract<ReturnType<typeof inferGraphEquation>, { ok: true }>;

/** Reuse canonical surface factories; only planar relations need a new shape. */
export function createEquationGraph(equation: string, inferred: Inference, index: number, current?: GraphObject): GraphObject {
  const base = { id: current?.id, color: current?.color, visible: current?.visible, colorIndex: index, equation };
  if (inferred.kind === "surface") {
    const object = createSurfaceGraph(base);
    return { ...object, ...(current?.kind === "surface" ? { domain: current.domain, resolution: current.resolution, appearance: current.appearance } : {}), orientation: inferred.orientation, autoDomain: current?.kind === "surface" ? current.autoDomain ?? true : true, autoExpression: true };
  }
  if (inferred.kind === "implicitSurface") {
    const object = createImplicitSurfaceGraph(base);
    return { ...object, ...(current?.kind === "implicitSurface" ? { domain: current.domain, resolution: current.resolution, appearance: current.appearance } : {}), autoExpression: true };
  }
  const object = createSurfaceGraph(base);
  const curve: ImplicitCurveObject = { id: object.id, color: object.color, visible: object.visible, kind: "implicitCurve", equation, autoExpression: true, ...(current?.kind === "implicitCurve" ? { extendTo3D: current.extendTo3D } : {}) };
  return curve;
}
