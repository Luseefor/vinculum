"use client";

import { useEffect, useMemo, useState } from "react";
import type { GraphObject, ObjectOperation } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { buildObjectOperation, objectRegionDimension } from "@/lib/math/geometry/objectOperations";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import { MathText } from "@/components/math/MathExpression";
import { Button } from "@/components/ui/button";

const labels: Record<ObjectOperation, string> = { union: "Union", intersection: "Intersection", subtract: "Subtract" };

export function ObjectCombinationSummary({ object }: { object: GraphObject }) {
  const objects = useGraphStore(state => state.scene.objects);
  const selectObject = useGraphStore(state => state.selectObject);
  const detach = useGraphStore(state => state.detachObjectOperation);
  const parameters = useEditorStore(state => state.parameters);
  const combination = object.combination;
  const sources = useMemo(() => combination?.operands.map(id => objects.find(candidate => candidate.id === id)), [combination, objects]);
  const status = useMemo(() => sources?.[0] && sources[1] && combination
    ? buildObjectOperation(sources[0], sources[1], combination.operation, parametersToScope(parameters)) : null,
  [sources, combination, parameters]);
  if (!combination || !sources) return null;
  return <div className="space-y-3" data-testid="object-combination-summary">
    <h3 className="text-[13px] font-semibold text-(--text-primary)">{labels[combination.operation]}</h3>
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      {sources.map((source, index) => <Button key={index} variant="secondary" size="sm" disabled={!source}
        onClick={() => source && selectObject(source.id)} aria-label={`Select source ${index + 1}`}>
        {source ? `${getObjectRowDisplayMeta(source).label} #${objects.indexOf(source) + 1}` : "Missing source"}
      </Button>)}
    </div>
    <p className="text-[12px] text-(--text-secondary)">Updates with its sources. Deleting a source also removes this result.</p>
    {status && !status.ok ? <p role="alert" className="text-[12px] text-(--status-error-fg)">{status.error}</p>
      : "equation" in object && <div className="overflow-x-auto py-1"><MathText text={object.equation} /></div>}
    <Button size="sm" variant="secondary" onClick={() => detach(object.id)}>Make independent</Button>
  </div>;
}

export default function ObjectOperationsSection() {
  const objects = useGraphStore(state => state.scene.objects);
  const selectedId = useGraphStore(state => state.ui.selectedObjectId);
  const addOperation = useGraphStore(state => state.addObjectOperation);
  const parameters = useEditorStore(state => state.parameters);
  const source = objects.find(object => object.id === selectedId);
  const options = useMemo(() => objects.filter(object => object.id !== selectedId && objectRegionDimension(object)), [objects, selectedId]);
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTargetId(current => options.some(object => object.id === current) ? current : options[0]?.id ?? "");
    setError(null);
  }, [options, selectedId]);
  const target = options.find(object => object.id === targetId);
  const availability = useMemo(() => source && target
    ? buildObjectOperation(source, target, "union", parametersToScope(parameters)) : null,
  [source, target, parameters]);
  const create = (operation: ObjectOperation) => {
    const result = addOperation(operation, targetId);
    setError(result.error);
    if (result.id && result.dimension) {
      useGraphStore.getState().setGraphMode(result.dimension);
      const editor = useEditorStore.getState();
      if (editor.viewportMode === "2d" || editor.viewportMode === "3d") editor.setViewportMode(result.dimension);
    }
  };
  return <section className="space-y-3" data-testid="object-operations-section">
    {source?.combination && <ObjectCombinationSummary object={source} />}
    <p className="text-[12px] text-(--text-secondary)">Combine regions of two equations. Inside means F ≤ 0 for F = 0; an explicit surface uses the side below its dependent coordinate.</p>
    <label className="block space-y-1 text-[12px] text-(--text-secondary)">Second object
      <select aria-label="Second object for operation" value={targetId} onChange={event => { setTargetId(event.target.value); setError(null); }}
        disabled={!source || !options.length} className="h-9 w-full rounded-[var(--ui-radius-sm)] bg-(--editor-control) px-2 text-[13px]">
        {!options.length && <option value="">No compatible equation objects</option>}
        {options.map(object => <option key={object.id} value={object.id}>{getObjectRowDisplayMeta(object).label} #{objects.indexOf(object) + 1}</option>)}
      </select>
    </label>
    <div className="flex flex-wrap gap-2">
      {(["union", "intersection", "subtract"] as const).map(operation => <Button key={operation} size="sm" variant="secondary"
        disabled={!availability?.ok} onClick={() => create(operation)}>{labels[operation]}</Button>)}
    </div>
    <p className="text-[12px] text-(--text-tertiary)">Subtract removes the second region from the selected region. Sources are kept and hidden; the result stays linked.</p>
    {(error || availability && !availability.ok) && <p role="alert" className="text-[12px] text-(--status-error-fg)">{error ?? (availability && !availability.ok ? availability.error : "")}</p>}
    {!options.length && <p role="status" className="text-[12px] text-(--text-secondary)">Add another equation curve or surface to combine regions.</p>}
  </section>;
}
