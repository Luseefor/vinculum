import type { GraphObject } from "@vinculum/scene/types";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { polarVectorCartesianExpressions, substituteFieldSymbols } from "@/lib/math/polarFieldExpressions";
import { checkFieldExpression } from "@/lib/math/fieldSolutions";
import { parseGraphObject } from "@/lib/scene/validateSceneGraphParsers";
import { useGraphStore } from "@/store/graphStore";

export function plotFieldProblem(input: { kind: "vector" | "scalar" | "curve"; coordinates: "cartesian" | "polar"; components: string[]; dimension: "2" | "3"; params: Record<string, number> }): { id: string | null; error: string | null } {
  const { components, coordinates, dimension, params } = input;
  const required = input.kind === "vector" ? (dimension === "2" ? 2 : 3) : 1;
  if (components.length !== required || (coordinates === "polar" && dimension !== "2")) return { id: null, error: "The component count or dimension does not match this definition." };
  const variables = input.kind === "curve" ? ["theta"] : coordinates === "polar" ? ["r", "theta"] : dimension === "2" ? ["x", "y"] : ["x", "y", "z"];
  const error = components.map((expression) => checkFieldExpression(expression, variables, params)).find(Boolean);
  if (error) return { id: null, error };
  const colorIndex = useGraphStore.getState().scene.objects.length;
  let object: GraphObject;
  if (input.kind === "vector") {
    const exprs = coordinates === "polar" ? polarVectorCartesianExpressions(components[0]!, components[1]!) : components;
    object = createVectorFieldGraph({ dimension: dimension === "2" ? "2d" : "3d", colorIndex, pExpr: exprs[0], qExpr: exprs[1], rExpr: dimension === "3" ? exprs[2] : undefined });
  } else if (input.kind === "curve") {
    const radius = substituteFieldSymbols(components[0]!, { theta: "t" });
    object = createParametricCurve({ colorIndex, xExpr: `(${radius})*cos(t)`, yExpr: `(${radius})*sin(t)`, zExpr: "0", tMin: 0, tMax: 2 * Math.PI });
  } else if (coordinates === "polar") {
    object = createParametricSurfaceGraph({ colorIndex, xExpr: "u*cos(v)", yExpr: "u*sin(v)", zExpr: substituteFieldSymbols(components[0]!, { r: "u", theta: "v" }), domain: { uMin: 0.05, uMax: 3, vMin: 0, vMax: 2 * Math.PI } });
  } else {
    if (dimension === "3") return { id: null, error: "A scalar function of three variables is analyzed symbolically; use a 2D scalar definition to plot a surface." };
    object = createSurfaceGraph({ colorIndex, equation: components[0]! });
  }
  const errors: string[] = [];
  const parsed = parseGraphObject(object, 0, errors);
  if (!parsed) return { id: null, error: errors.join(" ") || "Invalid plot definition." };
  const result = useGraphStore.getState().addDefinedObject(parsed);
  if (result.id) useGraphStore.getState().requestEquationFocus(result.id);
  return result;
}
