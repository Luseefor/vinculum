"use client";

import { useEffect, useState } from "react";
import type { ImplicitSurfaceObject, SurfaceGraphObject, VectorFieldObject } from "@vinculum/scene/types";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { normalizeSurfaceLevelSet } from "@/lib/math/surfaceDifferential";
import { solveComplexField } from "@/lib/math/complexFieldAnalysis";
import { solveFieldProblem, type FieldSolution } from "@/lib/math/fieldSolutions";
import FieldSolutionView from "./FieldSolutionView";

export default function AutomaticFieldAnalysis({ object }: { object: VectorFieldObject | SurfaceGraphObject | ImplicitSurfaceObject }) {
  const [interpretation, setInterpretation] = useState<"vector" | "complex">("vector");
  const parameters = useEditorStore((state) => state.parameters);
  const [result, setResult] = useState<{ key: string; solution: FieldSolution } | null>(null);
  const definition = object.kind === "vectorField"
    ? [object.id, object.kind, object.dimension, object.pExpr, object.qExpr, object.rExpr]
    : [object.id, object.kind, object.equation, object.kind === "surface" ? object.orientation : null];
  const key = JSON.stringify([definition, parameters, interpretation]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = parametersToScope(parameters);
      if (object.kind === "vectorField" && object.dimension === "2d" && interpretation === "complex") {
        setResult({ key, solution: solveComplexField(object.pExpr, object.qExpr, params) });
      } else if (object.kind === "vectorField") {
        const variables = object.dimension === "2d" ? ["x", "y"] : ["x", "y", "z"];
        setResult({ key, solution: solveFieldProblem({ kind: "vector", coordinates: "cartesian", components: object.dimension === "2d" ? [object.pExpr, object.qExpr] : [object.pExpr, object.qExpr, object.rExpr], variables, params }) });
      } else {
        const normalized = normalizeSurfaceLevelSet(object);
        if ("error" in normalized) {
          setResult({ key, solution: { definition: object.equation, answers: [], notes: [], error: normalized.error } });
          return;
        }
        const expression = normalized.kind === "explicit" ? normalized.body : `(${normalized.lhs})-(${normalized.rhs})`;
        const variables = normalized.kind === "explicit" ? normalized.independentVars : ["x", "y", "z"];
        setResult({ key, solution: solveFieldProblem({ kind: "scalar", coordinates: "cartesian", components: [expression], variables, params }) });
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // Only mathematical inputs invalidate symbolic solutions; appearance and sampling do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <section className="border-b border-[var(--border-subtle)] pb-4" aria-label="Automatic field solution">
      <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Automatic solution</h3>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Derived from the definition. No point required.</p>
      {object.kind === "vectorField" && object.dimension === "2d" ? <label className="mt-2 block text-[12px] text-[var(--text-secondary)]">Interpret as
        <select aria-label="Field interpretation" value={interpretation} onChange={(event) => setInterpretation(event.target.value as "vector" | "complex")} className="mt-1 h-8 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-[12px] text-[var(--text-primary)]">
          <option value="vector">Real vector field (P,Q)</option><option value="complex">Complex function P + i Q</option>
        </select>
      </label> : null}
      <FieldSolutionView solution={result?.key === key ? result.solution : null} pending={result?.key !== key} />
    </section>
  );
}
