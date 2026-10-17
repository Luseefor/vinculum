"use client";

import type { ParametricCurveObject, ParametricSurfaceObject } from "@vinculum/scene/types";
import { revealObjectInViewport } from "@/lib/objects/objectCreation";
import { useGraphStore } from "@/store/graphStore";

export default function ParametricDimensionControl({ object }: { object: ParametricCurveObject | ParametricSurfaceObject }) {
  const setDimension = useGraphStore(state => state.setObjectKind);
  return <div role="group" aria-label="Parametric dimension" className="flex items-center gap-1">
    {(["2d", "3d"] as const).map(dimension => <button
      key={dimension}
      type="button"
      aria-pressed={(object.dimension ?? "3d") === dimension}
      onClick={event => {
        event.stopPropagation();
        setDimension(object.id, object.kind, dimension);
        revealObjectInViewport(object.id);
      }}
      className="min-h-11 sm:min-h-8 rounded-[var(--ui-radius-sm)] px-3 text-[12px] font-medium text-(--text-secondary) hover:bg-(--surface-muted) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--accent) aria-pressed:bg-(--surface-muted) aria-pressed:text-(--text-primary)"
    >{dimension.toUpperCase()}</button>)}
  </div>;
}
