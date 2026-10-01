// S30 Object tab: definition + domain/sampling editors for the selected
// object. Analysis sections live in AnalysisInspector; this tab stays compact
// so selecting an object never reveals 800px of advanced controls at once.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import GeometryPrimitiveInspector from "./GeometryPrimitiveInspector";
import LinearTransformInspector from "./LinearTransformInspector";
import {
  ImplicitSurfaceDefinitionEditor,
  ParametricCurveDefinitionEditor,
  ParametricSurfaceDefinitionEditor,
  SurfaceDefinitionEditor,
  VectorFieldDefinitionEditor
} from "./MathDefinitionEditors";
import type { GraphObject, LineObject, PlaneGraphObject, PointObject, RayObject, SegmentObject, SurfaceGraphObject, VectorObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";

export function useSelectedGraphObject(): GraphObject | null {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  return useMemo<GraphObject | null>(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );
}

export default function ObjectInspector() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObject = useSelectedGraphObject();

  if (!selectedObject) {
    return (
      <div data-inspector-section className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-subtle)] bg-transparent px-3 py-4 text-center shadow-none">
        <p className="text-[12px] font-semibold text-[var(--text-secondary)]">No selection</p>
        <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Select an object to edit its properties.</p>
      </div>
    );
  }

  if (selectedObject.kind === "parametricCurve") {
    const selectedIndex = objects.findIndex((object) => object.id === selectedObject.id);
    return (
      <section data-inspector-section>
        <ParametricCurveDefinitionEditor object={selectedObject} index={selectedIndex} />
      </section>
    );
  }

  if (selectedObject.kind === "parametricSurface") {
    const selectedIndex = objects.findIndex((object) => object.id === selectedObject.id);
    return (
      <section data-inspector-section>
        <ParametricSurfaceDefinitionEditor object={selectedObject} index={selectedIndex} />
      </section>
    );
  }

  if (selectedObject.kind === "implicitSurface") {
    const selectedIndex = objects.findIndex((object) => object.id === selectedObject.id);
    return (
      <section data-inspector-section>
        <ImplicitSurfaceDefinitionEditor object={selectedObject} index={selectedIndex} />
      </section>
    );
  }

  if (selectedObject.kind === "plane") {
    return (
      <section data-inspector-section>
        <PlaneInspector object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "linearTransform") {
    return (
      <section data-inspector-section>
        <LinearTransformInspector object={selectedObject} section="definition" />
      </section>
    );
  }

  if (selectedObject.kind === "vectorField") {
    const selectedIndex = objects.findIndex((candidate) => candidate.id === selectedObject.id);
    return (
      <section data-inspector-section>
        <VectorFieldDefinitionEditor object={selectedObject} index={selectedIndex} />
      </section>
    );
  }

  if (
    selectedObject.kind === "point" ||
    selectedObject.kind === "vector" ||
    selectedObject.kind === "line" ||
    selectedObject.kind === "ray" ||
    selectedObject.kind === "segment"
  ) {
    const primitive: PointObject | VectorObject | LineObject | RayObject | SegmentObject = selectedObject;
    const primitiveIndex = objects.findIndex((candidate) => candidate.id === primitive.id);
    return (
      <section data-inspector-section>
        <GeometryPrimitiveInspector key={primitive.id} object={primitive} index={primitiveIndex} />
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);

  return (
    <section data-inspector-section>
      <SurfaceDefinitionEditor object={selectedSurfaceObject} index={selectedIndex} />
    </section>
  );
}

function PlaneInspector({ object }: { object: PlaneGraphObject }) {
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);
  const [draft, setDraft] = useState(object.equation);
  const [focused, setFocused] = useState(false);
  // Adopt external edits (undo, row edits) when not focused; typing never
  // clobbers (S30 draft discipline).
  useEffect(() => {
    if (!focused) {
      setDraft(object.equation);
    }
  }, [object.equation, focused]);
  const commit = (value: string) => {
    if (value !== object.equation) {
      updatePlaneEquation(object.id, value);
    }
  };
  return (
    <section className="border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0">
      <header className="pb-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Plane</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          2D view shows the intersection with the axis plane you chose in the
          toolbar. Color and wireframe live under the Styles tab.
        </p>
      </header>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
          Equation
        </span>
        <Input
          value={focused ? draft : object.equation}
          aria-label="Plane equation"
          onChange={(event) => {
            setDraft(event.target.value);
            updatePlaneEquation(object.id, event.target.value);
          }}
          onFocus={() => {
            setDraft(object.equation);
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
        />
      </label>
    </section>
  );
}
