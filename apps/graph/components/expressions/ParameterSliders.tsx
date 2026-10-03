"use client";

import { useEffect, useMemo } from "react";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEquationParameterNames } from "@/lib/store/editorParameters";
import { MathExpression } from "@/components/math/MathExpression";

/** Compact controls use the same parameter scope as rendering and analysis. */
export default function ParameterSliders() {
  const objects = useGraphStore(state => state.scene.objects);
  const parameters = useEditorStore(state => state.parameters);
  const setValue = useEditorStore(state => state.setParameterValue);
  const usedNames = useMemo(() => new Set(objects.flatMap(object => Object.entries(object).flatMap(([key, value]) =>
    typeof value === "string" && (key === "equation" || key.endsWith("Expr")) ? getEquationParameterNames(value) : []
  ))), [objects]);
  useEffect(() => { useEditorStore.getState().ensureParameters([...usedNames]); }, [usedNames]);
  const visible = parameters.filter(parameter => parameter.defined || usedNames.has(parameter.id));
  if (!visible.length) return null;
  return <section aria-label="Parameters" className="mt-3 px-3 pb-3">
    <h3 className="mb-1 text-[12px] font-medium text-[var(--text-secondary)]">Parameters</h3>
    {visible.map(parameter => <div key={parameter.id} className="flex min-h-11 items-center gap-2">
      <label htmlFor={`parameter-${parameter.id}`} className="min-w-5 text-[14px]"><MathExpression expression={parameter.id} /></label>
      <input id={`parameter-${parameter.id}`} type="range" aria-label={`${parameter.id} slider`} min={parameter.min} max={parameter.max} step="0.01" value={parameter.value}
        className="h-11 min-w-0 flex-1 accent-[var(--accent)]" onChange={event => setValue(parameter.id, Number(event.target.value))} />
      <input type="number" aria-label={`${parameter.id} value`} min={parameter.min} max={parameter.max} step="any" value={Number(parameter.value.toFixed(6))}
        className="h-11 w-16 rounded-[var(--radius-sm)] border border-transparent bg-[var(--surface-muted)] px-2 text-right text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onChange={event => { if (event.target.value && Number.isFinite(event.target.valueAsNumber)) setValue(parameter.id, event.target.valueAsNumber); }} />
    </div>)}
  </section>;
}
